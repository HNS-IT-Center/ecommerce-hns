/**
 * Kirim kabar tautan & harga web ke web Data secara manual — untuk menguji
 * penerimanya (docs/13 §11). Membaca `.env.local`.
 *
 *   npx tsx --tsconfig scripts/tsconfig.uji-next.json --conditions=react-server \
 *     scripts/kirim-kabar-web-data.mts <perintah> [--lihat]
 *
 * Perintah:
 *   ping                 tes sambungan & tanda tangan, tanpa data barang
 *   contoh               satu produk simple + satu varian yang tertaut
 *   kode <k1> [k2 ...]   kode Accurate tertentu (tertaut, ditandai, atau belum)
 *   salinan              salinan utuh, persis seperti yang dikirim cron
 *
 * `--lihat` menampilkan isi kiriman TANPA mengirimnya.
 *
 * Penjaga di `kabar-tautan.ts` tetap berlaku: database lokal hanya dikirim ke
 * penerima localhost. Skrip ini tidak menulis apa pun ke database.
 */
import { config } from "dotenv"
import type { KeadaanTautan } from "../src/lib/api/hns-data/kabar-tautan"
config({ path: ".env.local", quiet: true })

const K = await import("../src/lib/api/hns-data/kabar-tautan")
const { getPrisma } = await import("../src/lib/prisma/client")
const prisma = getPrisma()

const PEMAKAIAN = "Perintah: ping | contoh | kode <k1> [k2 ...] | salinan   (tambah --lihat untuk tidak mengirim)"
const [perintah, ...sisa] = process.argv.slice(2)
const lihat = sisa.includes("--lihat")
const argumen = sisa.filter((a) => a !== "--lihat")

const rupiah = (n: number | null) => (n === null ? "—" : `Rp ${n.toLocaleString("id-ID")}`)

function ringkas(i: KeadaanTautan): string {
  const kepala = `[${i.status}] ${i.kode}`
  if (!i.produk) return kepala
  const p = i.produk
  const varian = p.varian ? ` / varian #${p.varian.id} "${p.varian.nama}"` : ""
  const promo = p.harga.promo !== null
    ? `, promo ${rupiah(p.harga.promo)}${p.harga.promoBerakhir ? ` s/d ${new Date(p.harga.promoBerakhir).toLocaleString("id-ID")}` : " tanpa batas"}`
    : ""
  return `${kepala} → #${p.id} ${p.nama}${varian} · ${p.tayang ? "tayang" : "TIDAK tayang"} · normal ${rupiah(p.harga.normal)}${promo}`
}

function cetakIsi(items: KeadaanTautan[]) {
  for (const i of items) console.log(ringkas(i))
  console.log(`\nIsi kiriman (links.changed → items):\n${JSON.stringify(items, null, 2)}`)
}

function cetakHasil(hasil: { ok: boolean; galat?: string }) {
  console.log(hasil.ok ? "\nBERHASIL — web Data membalas 2xx." : `\nGAGAL — ${hasil.galat}`)
  return hasil.ok
}

const db = (process.env.DATABASE_URL ?? "").match(/@([^/]+)\/([^?]+)/)
const tujuan = K.tujuanKirim()
console.log(`Database : ${db ? `${db[1]}/${db[2]}` : "(tidak terbaca)"}`)
console.log(`Tujuan   : ${"alasan" in tujuan ? `tidak mengirim — ${tujuan.alasan}` : tujuan.url}`)
console.log(`Mode     : ${lihat ? "LIHAT SAJA, tidak mengirim" : "KIRIM"}\n`)

let ok = true
try {
  if (perintah === "ping") {
    if (lihat) console.log("Ping tidak membawa data barang; tidak ada yang ditampilkan.")
    else ok = cetakHasil(await K.kirimPing())
  } else if (perintah === "kode" || perintah === "contoh") {
    let kode = argumen
    if (perintah === "contoh") {
      const simple = await prisma.product.findFirst({
        where: { accurateCode: { not: null }, type: "SIMPLE", status: "PUBLISHED" },
        select: { accurateCode: true },
        orderBy: { id: "desc" },
      })
      const varian = await prisma.product.findFirst({
        where: { accurateCode: { not: null }, type: "VARIATION", parent: { status: "PUBLISHED" } },
        select: { accurateCode: true },
        orderBy: { id: "desc" },
      })
      kode = [simple?.accurateCode, varian?.accurateCode].filter((k): k is string => !!k)
    }
    if (kode.length === 0) {
      console.error(perintah === "kode" ? `Sebutkan kodenya.\n${PEMAKAIAN}` : "Tidak ada produk tertaut di database ini.")
      ok = false
    } else {
      cetakIsi(await K.keadaanTautan(kode))
      if (!lihat) ok = cetakHasil(await K.kirimKeadaan(kode))
    }
  } else if (perintah === "salinan") {
    const items = await K.semuaKeadaanTautan()
    const hitung = (s: string) => items.filter((i) => i.status === s).length
    console.log(`${items.length} kode: ${hitung("tertaut")} tertaut, ${hitung("diabaikan")} ditandai "tidak dijual di web"`)
    console.log(`Dikirim dalam ${Math.max(1, Math.ceil(items.length / 500))} bagian (500 kode per bagian).\n`)
    console.log("Tiga baris pertama:")
    for (const i of items.slice(0, 3)) console.log(`  ${ringkas(i)}`)
    if (!lihat) {
      const hasil = await K.kirimSalinanTautan()
      if (hasil.ok) console.log(`\nBERHASIL — ${hasil.kode} kode dalam ${hasil.bagian} bagian.`)
      else console.log(`\n${"dilewati" in hasil ? `DILEWATI — ${hasil.dilewati}` : `GAGAL — ${hasil.galat} (${hasil.bagianTerkirim} bagian sempat terkirim)`}`)
      ok = hasil.ok
    }
  } else {
    console.error(PEMAKAIAN)
    ok = false
  }
} finally {
  await prisma.$disconnect()
}
// `exitCode`, bukan `process.exit()`: memaksa keluar selagi soket fetch ke
// penerima masih ditutup membuat Node di Windows crash
// ("Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)").
process.exitCode = ok ? 0 : 1
