/**
 * Mengekspor isi NETWORK TOOLS beserta sub-kategorinya ke JSON.
 *
 * Membaca saja — tidak pernah menulis ke database. Keluarannya ditulis ke
 * `backup/networking-<tanggal>.json` dan juga dicetak ringkasannya.
 *
 *   npx tsx --tsconfig scripts/tsconfig.uji.json --conditions=react-server \
 *     scripts/ekspor-networking-json.mts
 *
 * Produk yang berada di lebih dari satu sub-kategori muncul di masing-masing,
 * dan itu bukan duplikasi yang salah: `kategoriLain` di tiap produk menyebut
 * rak lain tempat ia juga tinggal, supaya "satu barang di dua tempat" terbaca
 * apa adanya alih-alih tampak seperti data ganda.
 */
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

import { writeFileSync } from "node:fs"

const INDUK = 62

const { getPrisma } = await import("../src/lib/prisma/client")
const prisma = getPrisma()

const induk = await prisma.category.findUniqueOrThrow({ where: { id: INDUK } })

const anak = await prisma.category.findMany({
  where: { parentId: INDUK },
  orderBy: { name: "asc" },
  select: { id: true, name: true, slug: true, path: true, depth: true },
})

type Produk = {
  id: number
  wooId: number
  nama: string
  status: string
  brand: string | null
  hargaNormal: number | null
  hargaObral: number | null
  sku: string | null
  kategoriUtama: boolean
  kategoriLain: string[]
}

const subkategori = []
let totalTautan = 0

for (const k of anak) {
  const baris = await prisma.productCategory.findMany({
    where: { categoryId: k.id },
    select: {
      isPrimary: true,
      product: {
        select: {
          id: true,
          wooId: true,
          name: true,
          status: true,
          sku: true,
          regularPrice: true,
          salePrice: true,
          brand: { select: { name: true } },
          categories: {
            select: { category: { select: { id: true, path: true } } },
          },
        },
      },
    },
  })

  const produk: Produk[] = baris
    .map(({ isPrimary, product: p }) => ({
      id: p.id,
      wooId: p.wooId,
      nama: p.name.replace(/\r?\n/g, " ").trim(),
      status: p.status,
      brand: p.brand?.name ?? null,
      hargaNormal: p.regularPrice === null ? null : Number(p.regularPrice),
      hargaObral: p.salePrice === null ? null : Number(p.salePrice),
      sku: p.sku,
      kategoriUtama: isPrimary,
      kategoriLain: p.categories
        .filter((c) => c.category.id !== k.id)
        .map((c) => c.category.path)
        .sort(),
    }))
    .sort((a, b) => a.nama.localeCompare(b.nama))

  totalTautan += produk.length
  subkategori.push({
    id: k.id,
    nama: k.name,
    slug: k.slug,
    path: k.path,
    jumlahProduk: produk.length,
    produk,
  })
}

// Produk unik: satu barang yang tinggal di dua sub-kategori dihitung sekali.
const unik = new Set(subkategori.flatMap((s) => s.produk.map((p) => p.id)))

const hasil = {
  dibuat: new Date().toISOString(),
  sumber: "database lokal Docker (ecommerce_hns @ 127.0.0.1:3307)",
  catatan:
    "Penataan ulang 28 September 2026. Sepuluh sub-kategori dibuat baru dari 68 produk " +
    "NETWORK TOOLS yang sebelumnya datar; dua lagi (KABEL LAN, MODEM) dipindahkan dari " +
    "AKSESSORIES KOMPUTER beserta seluruh produknya. Produk yang tertaut ke rak lain " +
    "TIDAK dicabut dari sana — lihat `kategoriLain` di tiap produk.",
  kategoriInduk: { id: induk.id, nama: induk.name, slug: induk.slug, path: induk.path },
  ringkasan: {
    jumlahSubkategori: subkategori.length,
    jumlahTautanProduk: totalTautan,
    jumlahProdukUnik: unik.size,
    subkategoriBaru: subkategori.filter((s) => s.id >= 180).map((s) => s.nama),
    subkategoriPindahan: subkategori.filter((s) => s.id < 180).map((s) => s.nama),
  },
  subkategori,
}

const stamp = new Date().toISOString().slice(0, 10)
const berkas = `backup/networking-${stamp}.json`
writeFileSync(berkas, JSON.stringify(hasil, null, 2), "utf8")

console.log(`\nDitulis ke: ${berkas}\n`)
console.log(`Sub-kategori     : ${subkategori.length}`)
console.log(`Tautan produk    : ${totalTautan}`)
console.log(`Produk unik      : ${unik.size}`)
console.log(`\n${"Sub-kategori".padEnd(28)} Produk`)
console.log("-".repeat(38))
for (const s of subkategori) {
  const tanda = s.id < 180 ? " (pindahan)" : ""
  console.log(`${(s.nama + tanda).padEnd(28)} ${String(s.jumlahProduk).padStart(3)}`)
}

await prisma.$disconnect()
