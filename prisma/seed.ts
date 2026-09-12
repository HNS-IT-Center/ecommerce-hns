import { getPrisma } from "../src/lib/prisma/client"
import { POLICY_PAGES, FAQ_ITEMS } from "../src/lib/constants/policy-content"

const DEFAULT_BANNERS = [
  {
    id: "banner-garansi-resmi",
    tag: "PROMO MINGGU INI",
    title: "Garansi Resmi 2 Tahun",
    subtitle: "Semua produk laptop & komponen bergaransi",
    ctaLabel: "Cek Katalog",
    ctaHref: "/shop",
    imageUrl: null,
    bgClass: "bg-brand-green",
    sortOrder: 0,
    isActive: true,
    startsAt: null,
    endsAt: null,
  },
  {
    id: "banner-build-pc",
    tag: "NEW ARRIVAL",
    title: "Build PC Custom Impianmu",
    subtitle: "Konsultasi gratis dengan teknisi berpengalaman",
    ctaLabel: "Mulai Rakit",
    ctaHref: "/build-pc",
    imageUrl: null,
    bgClass: "bg-primary",
    sortOrder: 1,
    isActive: true,
    startsAt: null,
    endsAt: null,
  },
]

async function main() {
  const prisma = getPrisma()

  for (const page of POLICY_PAGES) {
    await prisma.policyPage.upsert({
      where: { slug: page.slug },
      create: page,
      update: { title: page.title, content: page.content },
    })
  }
  console.log(`Seeded ${POLICY_PAGES.length} policy pages.`)

  await prisma.faqItem.deleteMany()
  await prisma.faqItem.createMany({ data: FAQ_ITEMS })
  console.log(`Seeded ${FAQ_ITEMS.length} FAQ items.`)

  // Toko TIDAK lagi di-seed. Datanya dikelola staff lewat /admin/toko dan sudah
  // berisi alamat serta tautan peta sungguhan; blok lama di sini melakukan
  // upsert dengan `update: data`, sehingga menjalankan seed sekali lagi akan
  // menimpa hasil kerja mereka dengan contoh — persis yang dicegah `update: {}`
  // pada banner di bawah.

  // Dua slide yang dulu ditulis langsung di hero-carousel.tsx. Dipindahkan ke
  // sini supaya beranda tetap tampil sama setelah hero beralih ke database.
  // `update: {}` disengaja: kalau staff sudah menyuntingnya lewat /admin/banner,
  // menjalankan seed lagi tidak boleh menimpa hasil suntingan mereka.
  for (const banner of DEFAULT_BANNERS) {
    await prisma.promoBanner.upsert({
      where: { id: banner.id },
      create: banner,
      update: {},
    })
  }
  console.log(`Seeded ${DEFAULT_BANNERS.length} promo banners.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    const prisma = getPrisma()
    await prisma.$disconnect()
  })
