import "server-only"

import crypto from "node:crypto"
import { after } from "next/server"
import { Prisma, ProductStatus, ProductType } from "@prisma/client"

import { env } from "@/config/env"
import { getPrisma } from "@/lib/prisma/client"

/**
 * Kabar tautan & harga web ke Data Accurate (data.hnsitcenter.id) — docs/13 §11.
 *
 * Arah KEBALIKAN dari `client.ts`: di sana web membaca Data Accurate, di sini
 * web memberi tahu Data Accurate barang Accurate mana yang sudah tertaut ke
 * produk web, berikut harga jualnya, supaya halaman barang di sana bisa
 * menampilkan indikator "sudah match".
 *
 * Dua jalur, sengaja dua-duanya:
 *  - `kabariWebData(kode)` — sesaat setelah ada perubahan: tautan, tandai
 *    "tidak dijual di web", harga/nama/status produk, hapus produk. Dikirim
 *    SESUDAH balasan ke staff (`after`), jadi tidak menahan tombol simpan.
 *    Gagal = dicatat ke log, tidak diulang.
 *  - `kirimSalinanTautan()` — seluruh tautan sekaligus, dari cron
 *    `/api/cron/sinkron-stok` (±2 jam). Inilah yang membetulkan kiriman yang
 *    gagal, perubahan lewat skrip operasi (yang menulis langsung ke database
 *    tanpa melewati fungsi-fungsi di atas), dan promo yang berakhir tanpa ada
 *    yang menyunting produknya.
 *
 * Dikirim ke API v1 web Data (`POST {HNS_API_URL}/web-links`) dengan token
 * client yang SAMA dengan yang dipakai membaca stok — keputusan 26 Oktober
 * 2026: web Data jadi pusat, setiap aplikasi cukup satu client di halaman
 * API & Integrasi. Web Data memeriksanya lewat `withApiClient` + izin client
 * `webLinks`; tidak ada secret tambahan.
 *
 * Mati sampai `HNS_WEB_LINKS_ENABLED=true`: token ecommerce sudah terpasang di
 * produksi, jadi tanpa sakelar ini kiriman langsung mengalir begitu deploy —
 * sebelum penerimanya ada — dan setiap simpan produk mencatat galat 404.
 */

export type StatusTautan = "tertaut" | "diabaikan" | "belum"

export type ProdukTertaut = {
  /**
   * `wooId` — id yang tampil di panel admin web (`/admin/produk/<id>`). Untuk
   * varian: id INDUKNYA, karena varian disunting di halaman induk.
   * BUKAN `Product.id` internal; dua ruang id itu bertabrakan.
   */
  id: number
  nama: string
  jenis: "simple" | "variable"
  varian: { id: number; nama: string; sku: string | null } | null
  /** Terlihat pelanggan: produk (induknya, untuk varian) berstatus terbit. */
  tayang: boolean
  url: string
  adminUrl: string
  /**
   * Angka katalog apa adanya, tidak dihitung. `promo` dan `promoBerakhir` hanya
   * terisi kalau promo SEDANG berlaku; lewat `promoBerakhir`, yang berlaku
   * `normal` — aturan yang sama dengan toko (`harga()` di cart-pricing.ts).
   */
  harga: { normal: number | null; promo: number | null; promoBerakhir: string | null }
}

export type KeadaanTautan = {
  kode: string
  status: StatusTautan
  produk: ProdukTertaut | null
}

export type HasilKirim = { ok: true } | { ok: false; galat: string }

export type HasilSalinan =
  | { ok: true; kode: number; bagian: number }
  /** Belum dikonfigurasi, atau dijaga penjaga database lokal — bukan kegagalan. */
  | { ok: false; dilewati: string }
  | { ok: false; galat: string; bagianTerkirim: number }

/** Kode per kiriman. ±400 byte per kode → ±200 KB per kiriman. */
const PER_KIRIMAN = 500

/** Jalur penerima di bawah `HNS_API_URL` (yang sudah berakhiran `/api/v1`). */
export const JALUR_PENERIMA = "/web-links"

const DB_LOKAL = /@(127\.0\.0\.1|localhost)[:/]/
const URL_LOKAL = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/

/**
 * Tujuan kiriman, atau alasan tidak mengirim.
 *
 * Database LOKAL tidak pernah dikirim ke web Data sungguhan. `.env.local`
 * menunjuk Docker (docs/16) sementara `HNS_API_URL`-nya tetap produksi (untuk
 * membaca stok), dan skrip uji menulis produk ZZ TEST di database itu — tanpa
 * penjaga ini, isi database percobaan tampil sebagai tautan sungguhan di
 * data.hnsitcenter.id. Untuk menguji, arahkan `HNS_API_URL` ke web Data lokal
 * (`http://localhost:…/api/v1`).
 */
export function periksaTujuan(
  aktif: boolean,
  apiUrl: string | undefined,
  token: string | undefined,
  databaseUrl: string | undefined,
): { url: string; token: string } | { alasan: string } {
  if (!aktif) return { alasan: "HNS_WEB_LINKS_ENABLED belum true." }
  if (!apiUrl || !token) return { alasan: "HNS_API_URL / HNS_API_TOKEN belum diisi." }
  if (DB_LOKAL.test(databaseUrl ?? "") && !URL_LOKAL.test(apiUrl)) {
    return { alasan: "Database lokal tidak dikirim ke web Data selain localhost." }
  }
  return { url: `${apiUrl.replace(/\/+$/, "")}${JALUR_PENERIMA}`, token }
}

/** Tujuan dari env proses ini. Diekspor supaya skrip bisa menampilkannya sebelum mengirim. */
export const tujuanKirim = () =>
  periksaTujuan(env.HNS_WEB_LINKS_ENABLED, env.HNS_API_URL, env.HNS_API_TOKEN, env.DATABASE_URL)

/**
 * Pesan dari balasan gagal web Data. API v1 membalas `{ error: { code, message } }`
 * — pesannya ("Client ini tidak diizinkan…") jauh lebih cepat menunjuk masalah
 * daripada angka status saja. Halaman HTML (404/500 bawaan Next, artinya route
 * penerimanya belum ada) tidak dikutip: ribuan karakter markup tak menjelaskan apa-apa.
 */
function pesanBalasan(mentah: string): string {
  const teks = mentah.trim()
  if (teks.startsWith("<")) return "balasan berupa halaman HTML — route penerimanya sudah ada?"
  try {
    const isi: unknown = JSON.parse(teks)
    if (typeof isi === "object" && isi !== null && "error" in isi) {
      const pesan = (isi as { error?: { message?: unknown } }).error?.message
      if (typeof pesan === "string") return pesan
    }
  } catch {
    // Bukan JSON — dikutip apa adanya di bawah.
  }
  return teks.slice(0, 200)
}

function pesanGalat(error: unknown): string {
  if (!(error instanceof Error)) return String(error)
  const sebab = error.cause instanceof Error ? error.cause.message : null
  return sebab ? `${error.message} (${sebab})` : error.message
}

async function kirim(event: string, isi: Record<string, unknown>, timeoutMs: number): Promise<HasilKirim> {
  const tujuan = tujuanKirim()
  if ("alasan" in tujuan) return { ok: false, galat: tujuan.alasan }

  const deliveryId = crypto.randomUUID()
  const body = JSON.stringify({ event, deliveryId, sentAt: new Date().toISOString(), ...isi })

  try {
    const res = await fetch(tujuan.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tujuan.token}`,
        "Content-Type": "application/json",
        "User-Agent": "HNS-Ecommerce/1.0",
        "X-HNS-Event": event,
        "X-HNS-Delivery": deliveryId,
      },
      body,
      cache: "no-store",
      // Pengalihan dianggap gagal: mengikutinya berarti mengirim token ke
      // alamat yang tidak pernah dipilih siapa pun.
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (res.status >= 200 && res.status < 300) return { ok: true }
    const pesan = pesanBalasan(await res.text().catch(() => ""))
    return { ok: false, galat: `web Data membalas HTTP ${res.status}${pesan ? `: ${pesan}` : ""}` }
  } catch (error) {
    return { ok: false, galat: pesanGalat(error) }
  }
}

// ---------------------------------------------------------------- isi kiriman

const PILIH_PRODUK = {
  wooId: true,
  name: true,
  slug: true,
  sku: true,
  type: true,
  status: true,
  accurateCode: true,
  regularPrice: true,
  salePrice: true,
  saleEndDate: true,
  parent: { select: { wooId: true, name: true, slug: true, status: true } },
} satisfies Prisma.ProductSelect

type BarisProduk = Prisma.ProductGetPayload<{ select: typeof PILIH_PRODUK }>

const angka = (n: Prisma.Decimal | null) => (n === null ? null : Number(n))

function bentukProduk(p: BarisProduk): ProdukTertaut {
  const asal = env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "")
  const induk = p.type === ProductType.VARIATION ? p.parent : null
  const halaman = induk ?? p

  const promo = angka(p.salePrice)
  const promoBerlaku =
    promo !== null && promo > 0 && (p.saleEndDate === null || p.saleEndDate.getTime() > Date.now())

  return {
    id: halaman.wooId,
    nama: halaman.name,
    jenis: induk ? "variable" : "simple",
    varian: induk
      ? {
          id: p.wooId,
          // Nama varian = "<nama induk> - <label>"; yang membedakan cuma ekornya.
          nama: p.name.startsWith(`${induk.name} - `) ? p.name.slice(induk.name.length + 3) : p.name,
          sku: p.sku,
        }
      : null,
    tayang: halaman.status === ProductStatus.PUBLISHED,
    url: `${asal}/product/${halaman.slug}${induk && p.sku ? `?sku=${encodeURIComponent(p.sku)}` : ""}`,
    adminUrl: `${asal}/admin/produk/${halaman.wooId}`,
    harga: {
      normal: angka(p.regularPrice),
      promo: promoBerlaku ? promo : null,
      promoBerakhir: promoBerlaku && p.saleEndDate ? p.saleEndDate.toISOString() : null,
    },
  }
}

/** Kunci pembanding kode: kolom `accurate_code` ber-collation tak peka huruf. */
const kunci = (kode: string) => kode.trim().toUpperCase()

function susun(kode: string[], produk: BarisProduk[], diabaikan: string[]): KeadaanTautan[] {
  const perKode = new Map(produk.map((p) => [kunci(p.accurateCode ?? ""), p]))
  const abaikan = new Set(diabaikan.map(kunci))
  return kode.map((k) => {
    const p = perKode.get(kunci(k))
    // Tertaut menang atas "diabaikan": menandai menolak kode yang tertaut, jadi
    // keduanya bersamaan hanya bisa berarti tautan dibuat sesudah penandaan.
    if (p) return { kode: (p.accurateCode ?? k).trim(), status: "tertaut", produk: bentukProduk(p) }
    return { kode: k, status: abaikan.has(kunci(k)) ? "diabaikan" : "belum", produk: null }
  })
}

/**
 * Keadaan TERBARU kode-kode ini — bukan selisih, cukup di-upsert per kode.
 * Diekspor untuk skrip `kirim-kabar-web-data.mts --lihat`, yang menampilkan isi
 * kiriman tanpa mengirimnya.
 */
export async function keadaanTautan(kode: string[]): Promise<KeadaanTautan[]> {
  const unik = [...new Map(kode.map((k) => [kunci(k), k.trim()])).values()].filter((k) => k !== "")
  if (unik.length === 0) return []
  const prisma = getPrisma()
  const produk = await prisma.product.findMany({ where: { accurateCode: { in: unik } }, select: PILIH_PRODUK })
  const diabaikan = await prisma.accurateIgnored.findMany({
    where: { kodeAccurate: { in: unik } },
    select: { kodeAccurate: true },
  })
  return susun(unik, produk, diabaikan.map((d) => d.kodeAccurate))
}

function potongan<T>(daftar: T[], ukuran: number): T[][] {
  if (daftar.length === 0) return [[]]
  const hasil: T[][] = []
  for (let i = 0; i < daftar.length; i += ukuran) hasil.push(daftar.slice(i, i + ukuran))
  return hasil
}

// ---------------------------------------------------------------- jalur kirim

/** Kirim keadaan terbaru kode-kode ini sekarang juga (dipakai antrean & skrip). */
export async function kirimKeadaan(kode: string[]): Promise<HasilKirim> {
  // `readAt` — kapan keadaan ini dibaca. Penerima menerapkan item hanya kalau
  // `readAt`-nya tidak lebih tua daripada yang sudah ia simpan untuk kode itu.
  const readAt = new Date().toISOString()
  const items = await keadaanTautan(kode)
  if (items.length === 0) return { ok: true }
  for (const potong of potongan(items, PER_KIRIMAN)) {
    const hasil = await kirim("links.changed", { readAt, count: potong.length, items: potong }, 5000)
    if (!hasil.ok) return hasil
  }
  return { ok: true }
}

/**
 * Kode yang menunggu dikirim, digabung lintas pemanggilan.
 *
 * Penyuntingan massal memanggil `updateProduct` puluhan kali dalam satu
 * permintaan; tanpa penggabungan itu menjadi puluhan kiriman. Antrean ini
 * milik proses, bukan permintaan — kode dari permintaan lain yang ikut terbawa
 * tidak merugikan apa pun, karena yang dikirim selalu keadaan terbaru.
 */
const antrean = new Set<string>()
/**
 * Kapan pengosongan antrean terakhir dijadwalkan. Dicatat sebagai waktu, bukan
 * sekadar ya/tidak: kalau callback `after` tidak pernah berjalan (proses
 * dimatikan di tengah), penanda ya/tidak akan tersangkut dan tidak ada kabar
 * lagi yang terkirim sampai server dimulai ulang.
 */
let terjadwalSejak: number | null = null
const BATAS_TERJADWAL_MS = 60_000

async function kosongkanAntrean(): Promise<void> {
  terjadwalSejak = null
  const kode = [...antrean]
  antrean.clear()
  try {
    const hasil = await kirimKeadaan(kode)
    if (!hasil.ok) console.error(`[kabar-tautan] ${kode.length} kode gagal dikirim: ${hasil.galat}`)
  } catch (error) {
    console.error("[kabar-tautan] gagal menyusun kabar:", error)
  }
}

/**
 * Kabari web Data bahwa kode-kode ini berubah. Tidak pernah melempar, tidak
 * pernah menahan pemanggil: kirimannya berjalan sesudah balasan dikirim.
 *
 * Untuk produk yang DIHAPUS, kodenya harus diambil sebelum penghapusan — lihat
 * `kodeAccurateProdukDanVarian`. Sesudahnya kode itu tidak ada di mana pun, dan
 * keadaan yang terkirim ("belum") memang keadaan yang benar.
 */
export function kabariWebData(kode: (string | null | undefined)[]): void {
  if ("alasan" in tujuanKirim()) return
  for (const k of kode) if (k && k.trim() !== "") antrean.add(k.trim())
  if (antrean.size === 0) return
  if (terjadwalSejak !== null && Date.now() - terjadwalSejak < BATAS_TERJADWAL_MS) return
  terjadwalSejak = Date.now()
  try {
    after(kosongkanAntrean)
  } catch {
    // Di luar permintaan (skrip operasi) `after` melempar. Jalankan di giliran
    // berikutnya; skrip yang keluar lebih dulu bisa memotongnya — salinan
    // berkala yang menutup celah itu.
    setTimeout(() => void kosongkanAntrean(), 0)
  }
}

/**
 * Kode Accurate milik produk ini dan semua variannya — diambil SEBELUM produk
 * diubah/dihapus, karena varian yang terhapus membawa kodenya pergi.
 *
 * @param produkIdInternal `Product.id` internal, BUKAN `wooId`.
 */
export async function kodeAccurateProdukDanVarian(produkIdInternal: number): Promise<string[]> {
  if ("alasan" in tujuanKirim()) return []
  const baris = await getPrisma().product.findMany({
    where: { OR: [{ id: produkIdInternal }, { parentId: produkIdInternal }], accurateCode: { not: null } },
    select: { accurateCode: true },
  })
  return baris.map((b) => b.accurateCode).filter((k): k is string => k !== null)
}

/** Isi salinan utuh: seluruh kode tertaut + ditandai "tidak dijual di web". */
export async function semuaKeadaanTautan(): Promise<KeadaanTautan[]> {
  const prisma = getPrisma()
  const produk = await prisma.product.findMany({
    where: { accurateCode: { not: null } },
    select: PILIH_PRODUK,
    orderBy: { accurateCode: "asc" },
  })
  const diabaikan = (await prisma.accurateIgnored.findMany({ select: { kodeAccurate: true } })).map(
    (d) => d.kodeAccurate,
  )
  // Satu baris per kode, tertaut lebih dulu; kode yang tertaut sekaligus
  // ditandai cukup muncul sekali (`susun` memenangkan "tertaut").
  const perKunci = new Map<string, string>()
  for (const k of [...produk.map((p) => p.accurateCode ?? ""), ...diabaikan]) {
    if (k.trim() !== "" && !perKunci.has(kunci(k))) perKunci.set(kunci(k), k.trim())
  }
  return susun([...perKunci.values()], produk, diabaikan)
}

/**
 * Seluruh tautan dan penandaan "tidak dijual di web", dikirim berbagian.
 *
 * Penerima baru boleh menganggap kode di luar salinan sebagai "belum" setelah
 * SEMUA bagian (`part` 1..`totalParts`) dengan `snapshotId` yang sama diterima.
 * Salinan kosong tetap dikirim satu bagian, supaya penerima bisa menuntaskannya.
 *
 * Tidak pernah melempar — dipanggil cron yang tidak boleh gagal karenanya.
 */
export async function kirimSalinanTautan(): Promise<HasilSalinan> {
  const tujuan = tujuanKirim()
  if ("alasan" in tujuan) return { ok: false, dilewati: tujuan.alasan }
  try {
    // Diambil SEBELUM database dibaca: penerima memakainya untuk menolak isi
    // salinan yang lebih tua daripada kabar seketika yang sudah ia terima, dan
    // untuk tidak "melepas" kode yang tertaut sesudah salinan ini dibaca.
    const readAt = new Date().toISOString()
    const items = await semuaKeadaanTautan()

    const snapshotId = crypto.randomUUID()
    const bagian = potongan(items, PER_KIRIMAN)
    for (let i = 0; i < bagian.length; i++) {
      const hasil = await kirim(
        "links.snapshot",
        { snapshotId, readAt, part: i + 1, totalParts: bagian.length, count: bagian[i]!.length, items: bagian[i] },
        10000,
      )
      if (!hasil.ok) return { ok: false, galat: `bagian ${i + 1}/${bagian.length}: ${hasil.galat}`, bagianTerkirim: i }
    }
    return { ok: true, kode: items.length, bagian: bagian.length }
  } catch (error) {
    return { ok: false, galat: pesanGalat(error), bagianTerkirim: 0 }
  }
}

/** Tes sambungan & tanda tangan, tanpa data barang. */
export function kirimPing(): Promise<HasilKirim> {
  return kirim("ping", { message: "Tes kabar dari web ecommerce HNS." }, 10000)
}
