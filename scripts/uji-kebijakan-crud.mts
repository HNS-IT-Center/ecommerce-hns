/**
 * Verifikasi migrasi `add_policy_page_crud` di database yang sedang aktif.
 *
 * HANYA MEMBACA. Tidak ada satu pun perintah tulis di berkas ini, jadi aman
 * dijalankan kapan saja — termasuk terhadap produksi.
 *
 *   npx tsx --tsconfig scripts/tsconfig.uji.json --conditions=react-server \
 *     scripts/uji-kebijakan-crud.mts
 *
 * Satu koneksi untuk seluruh pemeriksaan — batas Hostinger 500 koneksi/jam
 * habis oleh skrip verifikasi yang dijalankan beruntun.
 */
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

const { getPrisma } = await import("../src/lib/prisma/client")
const { getPolicyPage, getPolicyPages, getAdminPolicyPages } = await import("../src/lib/api/policy")
const { policyBreadcrumbLabel } = await import("../src/lib/utils/policy-label")

const BAWAAN = [
  { slug: "pengembalian-barang", sortOrder: 0, breadcrumb: "Pengembalian Barang", desc: "Syarat dan ketentuan pengembalian barang di HNS IT Center." },
  { slug: "pengembalian-dana", sortOrder: 1, breadcrumb: "Pengembalian Dana", desc: "Syarat, metode, dan waktu proses pengembalian dana (refund) di HNS IT Center." },
  { slug: "pembatalan-pesanan", sortOrder: 2, breadcrumb: "Pembatalan Pesanan", desc: "Ketentuan pembatalan pesanan di HNS IT Center." },
  { slug: "pengiriman", sortOrder: 3, breadcrumb: "Pengiriman", desc: "Area, estimasi waktu, dan opsi pengiriman/pengambilan barang di HNS IT Center." },
]

let gagal = 0
function cek(nama: string, dapat: unknown, harap: unknown) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harap)
  if (!ok) gagal++
  console.log(`${ok ? "LOLOS" : "GAGAL"}  ${nama}`)
  if (!ok) console.log(`        dapat: ${JSON.stringify(dapat)}\n        harap: ${JSON.stringify(harap)}`)
}

async function main() {
  const prisma = getPrisma()

  // 1. Kolom baru benar-benar ada dan terisi untuk keempat kebijakan bawaan.
  const baris = await prisma.policyPage.findMany({ orderBy: { sortOrder: "asc" } })
  cek("jumlah baris policy_pages", baris.length, BAWAAN.length)

  for (const harap of BAWAAN) {
    const row = baris.find((b) => b.slug === harap.slug)
    cek(`[${harap.slug}] barisnya ada`, Boolean(row), true)
    if (!row) continue
    cek(`[${harap.slug}] is_system = true`, row.isSystem, true)
    cek(`[${harap.slug}] sort_order`, row.sortOrder, harap.sortOrder)
    cek(`[${harap.slug}] description terisi`, row.description, harap.desc)
    cek(`[${harap.slug}] belum terhapus`, row.deletedAt, null)
    cek(`[${harap.slug}] breadcrumb tidak berubah`, policyBreadcrumbLabel(row.title), harap.breadcrumb)
  }

  // 2. Jalur baca publik — yang dipakai /kebijakan/[slug] dan /kebijakan.
  for (const harap of BAWAAN) {
    const page = await getPolicyPage(harap.slug)
    cek(`getPolicyPage("${harap.slug}") ketemu`, Boolean(page), true)
    cek(`getPolicyPage("${harap.slug}") description`, page?.description, harap.desc)
    cek(`getPolicyPage("${harap.slug}") isi tidak kosong`, (page?.content.replace(/<[^>]*>/g, "").trim().length ?? 0) > 100, true)
  }

  const daftar = await getPolicyPages()
  cek("getPolicyPages() urutan slug", daftar.map((p) => p.slug), BAWAAN.map((b) => b.slug))

  const admin = await getAdminPolicyPages()
  cek("getAdminPolicyPages() jumlah", admin.length, BAWAAN.length)
  cek("getAdminPolicyPages() semua terkunci", admin.every((p) => p.isSystem), true)

  // 3. Slug yang tidak ada HARUS null (bukan jatuh ke konten bawaan) —
  //    inilah yang membuat /kebijakan/<ngawur> menjawab 404, bukan halaman asal.
  cek('getPolicyPage("slug-yang-tidak-ada")', await getPolicyPage("slug-yang-tidak-ada"), null)

  console.log(gagal === 0 ? "\nSEMUA PEMERIKSAAN LOLOS" : `\n${gagal} PEMERIKSAAN GAGAL`)
  await prisma.$disconnect()
  process.exit(gagal === 0 ? 0 : 1)
}

main()
