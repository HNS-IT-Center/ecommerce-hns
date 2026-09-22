import "server-only"

import { env } from "@/config/env"
import type { AdminUser } from "@/lib/auth"

/**
 * Lapisan izin RBAC — Fase 1 (fondasi, tanpa tabel Role).
 *
 * Rancangan lengkap ada di dokumen RBAC. Fase ini sengaja BELUM menyentuh
 * database: ia menetapkan daftar halaman, tingkat akses, siapa master, dan satu
 * helper `bisaAkses()`. Tabel `Role`/`RolePermission` menyusul di fase berikut;
 * sampai itu ada, izin dihitung dari role lama (`owner`/`staff`) — jadi perilaku
 * hari ini TIDAK berubah (mundur-kompatibel).
 *
 * Aturan yang tak bisa ditawar (dari rancangan): izin ditegakkan di SERVER.
 * Helper ini dipanggil di proxy (penjaga halaman) DAN di dalam server action
 * sensitif — menyembunyikan menu di sidebar bukan pengamanan.
 */

/** Level akses satu halaman untuk satu peran. Urutan menaik: none < view < edit. */
export type AccessLevel = "none" | "view" | "edit"

const ACCESS_ORDER: Record<AccessLevel, number> = { none: 0, view: 1, edit: 2 }

/**
 * Halaman admin yang izinnya diatur. Kunci = segmen path setelah `/admin/`.
 * Didaftar eksplisit (bukan diturunkan dari folder) supaya menambah halaman
 * adalah keputusan sadar — halaman baru TIDAK otomatis terbuka untuk peran mana
 * pun sampai didaftarkan di sini.
 */
export const ADMIN_PAGES = {
  produk: "Produk",
  kategori: "Kategori",
  "atribut-brand": "Atribut & Brand",
  sinkronisasi: "Sinkronisasi",
  "harga-accurate": "Update Harga",
  /**
   * BUKAN halaman — saklar izin untuk satu KOLOM: harga modal (CP) di tabel
   * Update Harga.
   *
   * Modal adalah angka yang kita bayar ke pemasok. Kasir dan staff toko perlu
   * membuka halaman Update Harga untuk mengisi harga dealer, tapi tidak
   * seharusnya ikut melihat margin setiap barang — dan izin per-halaman yang
   * ada tidak bisa membedakan keduanya karena keduanya satu halaman.
   *
   * Ditumpangkan ke daftar ini supaya bisa diatur di tempat yang sudah dikenal
   * (Manajemen User → Peran) tanpa membangun konsep izin kedua. Aman karena
   * daftar ini hanya dibaca editor peran; sidebar punya daftar menunya sendiri
   * dan menyaringnya, jadi kunci tanpa menu tidak memunculkan apa-apa.
   */
  "harga-modal": "Harga Modal (CP)",
  "pc-builder": "PC Builder",
  "pc-prebuild": "PC Prebuild",
  banner: "Banner Promo",
  toko: "Toko & Lokasi",
  pelanggan: "Pelanggan",
  "manajemen-user": "Manajemen User",
  theme: "Tema",
  colors: "Warna",
  kebijakan: "Kebijakan",
  logs: "Logs",
  /**
   * BUKAN halaman di bawah `/admin` — izin untuk `/verify` dan `/verify/[code]`,
   * alat cek quotation untuk kasir.
   *
   * Halamannya sengaja tinggal di luar panel: kasir hanya berurusan dengan
   * verifikasi, dan panel admin (sidebar, dashboard) tidak ada gunanya bagi
   * mereka. Kuncinya tetap didaftarkan di sini supaya aksesnya diatur di tempat
   * yang sama dengan halaman lain (Manajemen User → Peran). `pageFromPathname`
   * tidak akan pernah mengembalikannya karena path-nya bukan `/admin/verify`;
   * penjagaannya ada di halaman `/verify` sendiri dan di `src/proxy.ts`.
   */
  verify: "Verifikasi Rakitan (/verify)",
  /**
   * Halaman sungguhan: `/admin/quotation` — pengawasan quotation lintas sales,
   * rekap penjualan, dan PEMBATALAN status Closing (`edit`).
   *
   * Kuncinya wajib bernama persis segmen URL-nya, karena `pageFromPathname`
   * menurunkan kunci dari situ. Itulah sebabnya izin milik Sales/CS di bawah
   * TIDAK boleh memakai nama ini: kalau `quotation` dipakai untuk halaman
   * profil, setiap Sales yang boleh melihat riwayatnya sendiri ikut lolos
   * penjaga `/admin/quotation` dan melihat capaian seluruh tim.
   */
  quotation: "Quotation & Penjualan",
  /**
   * BUKAN halaman — penanda bahwa user boleh MENERBITKAN quotation bernama
   * (mengisi identitas pelanggan) dan punya riwayatnya sendiri di
   * `/profile/quotation`. Dimiliki Sales maupun CS.
   *
   * Penjagaannya ada di halaman `/profile/quotation` itu sendiri, bukan di
   * `pageFromPathname` — pola yang sama dengan `verify`.
   */
  "quotation-terbit": "Terbitkan Quotation",
  /**
   * BUKAN halaman — penanda peran SALES. Dua akibatnya:
   * 1. namanya muncul di daftar operan yang dilihat CS;
   * 2. nama tampilannya ikut tercetak di PDF sebagai "Sales:".
   *
   * Dipisah dari `quotation-terbit` supaya CS bisa menerbitkan tanpa ikut
   * menjadi tujuan operan — kalau digabung, CS akan mengoper ke dirinya sendiri.
   */
  "quotation-sales": "Tercantum sebagai Sales",
  akun: "Akun",
} as const

export type AdminPage = keyof typeof ADMIN_PAGES

/**
 * Penjelasan tiap izin, untuk tooltip di editor peran (Manajemen User → Peran).
 *
 * Ditulis untuk orang yang sedang MENYUSUN peran dan belum tentu tahu apa isi
 * tiap halaman. Karena itu tiap keterangan menjawab dua hal: halaman/kemampuan
 * apa yang dibuka, dan apa bedanya "Lihat" dari "Edit" — bukan sekadar
 * mengulang labelnya dengan kata lain.
 *
 * Di mana perbedaannya berbahaya (harga modal, pembatalan penjualan, izin
 * peran), keterangannya menyebutkan akibatnya, bukan cuma mekanismenya. Orang
 * yang memberi izin perlu tahu apa yang sedang ia serahkan.
 *
 * `Record<AdminPage, string>` — bukan `Partial`. Menambah kunci baru di
 * `ADMIN_PAGES` tanpa menuliskan keterangannya akan GAGAL typecheck, jadi tidak
 * ada izin yang bisa diam-diam muncul di panel tanpa penjelasan.
 */
export const ADMIN_PAGE_DESCRIPTIONS: Record<AdminPage, string> = {
  produk:
    "Katalog produk: harga jual, stok, gambar, dan status tayang. Lihat = membuka daftar & detail. Edit = menambah, mengubah, dan menarik produk dari etalase.",
  kategori:
    "Struktur kategori toko dan produk apa masuk ke mana. Edit = membuat, mengganti nama, memindah, dan menghapus kategori.",
  "atribut-brand":
    "Atribut produk beserta nilainya (mis. Kapasitas: 1TB) dan daftar brand. Edit = menambah dan mengubah keduanya.",
  sinkronisasi:
    "Membandingkan katalog dengan situs WordPress lama dan menarik perbedaannya. Edit = menjalankan sinkronisasi, bukan sekadar melihat hasilnya.",
  "harga-accurate":
    "Halaman Update Harga: menautkan produk ke kode Accurate dan menerapkan harga. Edit = mengubah harga yang berlaku di toko.",
  "harga-modal":
    "Kolom harga modal (CP) di halaman Update Harga — angka yang kita bayar ke pemasok. Tanpa izin ini, halamannya tetap bisa dibuka tapi kolom modalnya tersembunyi, sehingga marginnya tidak ikut terlihat.",
  "pc-builder":
    "Konfigurasi wizard Rakit PC: langkah apa saja, urutannya, dan mana yang wajib. Edit = mengubah susunan yang dipakai pelanggan.",
  "pc-prebuild":
    "Paket rakitan siap pakai beserta potongan harganya. Edit = membuat paket, menukar komponennya, dan mengatur potongan nominalnya.",
  banner: "Slide promo di paling atas beranda. Edit = menambah, mengganti, dan menjadwalkannya.",
  toko: "Data cabang: alamat, peta, jam buka, dan nomor WhatsApp. Edit = mengubahnya.",
  pelanggan:
    "Akun pelanggan yang mendaftar di toko. Lihat = mencocokkan permintaan yang masuk lewat CS. Edit = menyunting datanya.",
  "manajemen-user":
    "Peran dan izinnya, serta peran mana yang ditempelkan ke tiap akun admin. Edit = mengubah siapa boleh apa di seluruh panel — termasuk izin ini sendiri. Berikan hanya kepada yang memang mengelola tim.",
  theme: "Nuansa musiman halaman toko. Panel admin tidak ikut berubah.",
  colors: "Halaman rujukan palet warna. Untuk pengembang; tidak mengubah apa pun.",
  kebijakan:
    "Isi halaman kebijakan (pengiriman, pengembalian, dan lainnya) yang dibaca pelanggan. Edit = menyuntingnya.",
  logs: "Catatan aktivitas: perubahan produk, harga, dan rakitan yang dicetak. Hanya untuk dibaca.",
  verify:
    "Halaman /verify di luar panel — alat kasir untuk mencocokkan quotation yang dibawa pelanggan. Lihat = membuka dan mencari quotation. Edit = menandai quotation sebagai TERJUAL (Closing).",
  quotation:
    "Halaman /admin/quotation: seluruh quotation lintas sales dan rekap penjualan per orang. Edit = MEMBATALKAN status terjual, yang mengurangi angka penjualan seorang sales. Setiap pembatalan tercatat beserta alasannya.",
  "quotation-terbit":
    "Boleh menerbitkan quotation atas nama pelanggan (mengisi nama, nomor HP, catatan) dan punya riwayatnya sendiri di /profile/quotation. Dimiliki Sales maupun Customer Service.",
  "quotation-sales":
    "Menandai akun ini sebagai SALES. Dua akibatnya: namanya muncul di daftar operan yang dilihat CS, dan nama tampilannya ikut tercetak di PDF quotation. CS tidak diberi izin ini — kalau diberi, ia akan mengoper ke dirinya sendiri.",
  akun: "Halaman Akun Saya. Selalu terbuka untuk setiap admin dan tidak bisa dicabut.",
}

/** Halaman yang tidak pernah dibatasi role: setiap admin yang masuk boleh. */
const PAGES_SELALU_BOLEH: ReadonlySet<string> = new Set<AdminPage>(["akun"])

/**
 * Apakah user ini MASTER — developer, dipatok ke email di env.
 *
 * Dicek dari email, BUKAN dari role di database, dan diperiksa SEBELUM role apa
 * pun. Ini pagar utama: master tidak bisa dihapus atau diturunkan lewat UI
 * karena ia bukan baris data yang bisa disunting — ia string di konfigurasi.
 * Kalau `MASTER_ADMIN_EMAIL` kosong, tidak ada master (aman-tertutup).
 */
export function isMaster(user: Pick<AdminUser, "email">): boolean {
  const master = env.MASTER_ADMIN_EMAIL?.trim().toLowerCase()
  if (!master) return false
  return user.email.trim().toLowerCase() === master
}

/**
 * Kumpulan izin satu user, sudah dihitung — peta halaman → level.
 *
 * Sengaja dimuat SEKALI (satu query) lalu dicek berkali-kali secara sinkron,
 * bukan satu query per halaman. Dibuat lewat `muatIzinUser()` (async, baca DB),
 * lalu `bisaAkses`/`halamanTerlihat` bekerja di atasnya tanpa await.
 */
export type PermissionSet = {
  isMaster: boolean
  /** Level per halaman. Halaman yang tak tercantum → "none". */
  levels: Partial<Record<AdminPage, AccessLevel>>
}

/**
 * Muat izin user dari sumber yang berlaku:
 *
 * 1. Master (email) → edit semua. Dicek pertama, tak menyentuh DB.
 * 2. Punya `roleId` → baca `role_permissions`. Halaman tanpa baris = "none"
 *    (aman-tertutup): peran hanya bisa apa yang diberikan eksplisit.
 * 3. Tanpa `roleId` (baris lama) → fallback role owner/staff, PERSIS perilaku
 *    sebelum RBAC ada. Owner=edit semua; staff=edit semua kecuali "pelanggan"
 *    yang view. Ini yang menjaga akun lama tak terkunci.
 *
 * `import` Prisma dinamis: berkas ini juga dipakai di konteks yang tak boleh
 * menyeret klien DB kalau tak perlu (mis. saat cuma cek master).
 */
export async function muatIzinUser(
  user: Pick<AdminUser, "id" | "email" | "role"> & { roleId?: string | null },
): Promise<PermissionSet> {
  // 1. Master — jalan pintas, tanpa query.
  if (isMaster(user)) {
    const semua: Partial<Record<AdminPage, AccessLevel>> = {}
    for (const p of Object.keys(ADMIN_PAGES) as AdminPage[]) semua[p] = "edit"
    return { isMaster: true, levels: semua }
  }

  const levels: Partial<Record<AdminPage, AccessLevel>> = {}
  // Halaman yang selalu boleh (mis. "akun") — edit untuk siapa pun yang masuk.
  for (const p of PAGES_SELALU_BOLEH) levels[p as AdminPage] = "edit"

  // 2. Peran dinamis dari tabel.
  if (user.roleId) {
    const { getPrisma } = await import("@/lib/prisma/client")
    const rows = await getPrisma().rolePermission.findMany({
      where: { roleId: user.roleId },
      select: { page: true, access: true },
    })
    for (const r of rows) {
      if (r.page in ADMIN_PAGES && isAccessLevel(r.access)) {
        levels[r.page as AdminPage] = r.access
      }
    }
    return { isMaster: false, levels }
  }

  // 3. Fallback role lama — perilaku sebelum RBAC.
  for (const p of Object.keys(ADMIN_PAGES) as AdminPage[]) {
    if (levels[p] !== undefined) continue // sudah diset (halaman selalu-boleh)
    if (OPT_IN_PAGES.has(p)) {
      // Harus DIBERIKAN eksplisit lewat peran, tidak pernah lewat fallback.
      levels[p] = "none"
      continue
    }
    if (user.role === "owner") levels[p] = "edit"
    else levels[p] = p === "pelanggan" ? "view" : "edit" // staff
  }
  return { isMaster: false, levels }
}

/**
 * Kunci yang TIDAK ikut kemurahan hati fallback owner/staff.
 *
 * Fallback memberi "edit" atas hampir segalanya supaya akun lama tidak terkunci
 * saat RBAC masuk. Untuk kunci di bawah, kemurahan itu justru merusak:
 *
 * - `harga-modal` — kasir yang belum diberi peran akan melihat margin tiap
 *   barang, persis yang dihindari dengan memisahkannya dari halaman induknya.
 * - `quotation-sales` — setiap staff lama otomatis jadi "Sales", sehingga daftar
 *   operan yang dilihat CS berisi seluruh isi kantor, termasuk orang yang tidak
 *   pernah melayani penjualan. Nama mereka juga akan tercetak di PDF pelanggan.
 * - `quotation-terbit` & `quotation` — menerbitkan quotation atas nama pelanggan
 *   dan membatalkan status terjual keduanya menyentuh angka penjualan orang
 *   lain. Keduanya pekerjaan yang ditugaskan, bukan yang didapat karena
 *   kebetulan punya akun sejak dulu.
 *
 * Aman-tertutup: kunci baru yang ragu-ragu sebaiknya masuk sini.
 */
const OPT_IN_PAGES: ReadonlySet<AdminPage> = new Set<AdminPage>([
  "harga-modal",
  "quotation",
  "quotation-terbit",
  "quotation-sales",
])

function isAccessLevel(v: string): v is AccessLevel {
  return v === "none" || v === "view" || v === "edit"
}

/** Level user atas satu halaman, dari izin yang sudah dimuat. */
export function levelAksesHalaman(izin: PermissionSet, page: AdminPage): AccessLevel {
  return izin.levels[page] ?? "none"
}

/**
 * Apakah izin yang dimuat mencukupi untuk `page` pada `minimal` level.
 * `bisaAkses(izin, "harga-accurate", "edit")` → boleh menerapkan harga?
 */
export function bisaAkses(
  izin: PermissionSet,
  page: AdminPage,
  minimal: AccessLevel = "view",
): boolean {
  return ACCESS_ORDER[levelAksesHalaman(izin, page)] >= ACCESS_ORDER[minimal]
}

/** Semua halaman yang boleh user LIHAT — dipakai menyaring menu sidebar. */
export function halamanTerlihat(izin: PermissionSet): Set<AdminPage> {
  const out = new Set<AdminPage>()
  for (const page of Object.keys(ADMIN_PAGES) as AdminPage[]) {
    if (bisaAkses(izin, page, "view")) out.add(page)
  }
  return out
}

/**
 * Ke mana user diarahkan sesudah login.
 *
 * `/admin` bukan tujuan yang masuk akal untuk semua orang. Kasir hanya berurusan
 * dengan `/verify`, dan Sales/CS dengan riwayat quotation-nya — keduanya di luar
 * panel. Mengantar mereka ke dashboard berarti halaman pertama yang mereka lihat
 * setiap hari adalah halaman yang sidebar-nya kosong.
 *
 * Urutannya disengaja: panel dulu (kalau memang ada yang bisa dibuka di sana),
 * baru quotation, baru verify. `akun` tidak dihitung — setiap admin memilikinya,
 * jadi ia tidak pernah menjadi alasan seseorang "punya panel".
 */
export function landingPathFor(izin: PermissionSet): string {
  const terlihat = halamanTerlihat(izin)
  for (const p of PAGES_SELALU_BOLEH) terlihat.delete(p as AdminPage)
  // Kunci non-halaman: memilikinya tidak berarti punya sesuatu untuk dibuka di panel.
  terlihat.delete("verify")
  terlihat.delete("quotation-terbit")
  terlihat.delete("quotation-sales")

  if (terlihat.size > 0) return "/admin"
  if (bisaAkses(izin, "quotation-terbit", "edit")) return "/profile/quotation"
  if (bisaAkses(izin, "verify", "view")) return "/verify"
  return "/admin"
}

/** Ambil segmen halaman dari pathname `/admin/<page>/...`. Null kalau bukan sub-halaman. */
export function pageFromPathname(pathname: string): AdminPage | null {
  const m = pathname.match(/^\/admin\/([^/?#]+)/)
  if (!m) return null
  const seg = m[1]
  return seg in ADMIN_PAGES ? (seg as AdminPage) : null
}
