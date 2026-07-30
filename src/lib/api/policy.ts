import { getPrisma, isDatabaseConfigured } from "@/lib/prisma/client"
import { POLICY_PAGES, FAQ_ITEMS, type PolicyPageContent, type FaqItemContent } from "@/lib/constants/policy-content"
import type { FaqItem } from "@prisma/client"

// Halaman kebijakan/FAQ ini konten publik yang harus SELALU tampil benar buat
// pengunjung asli — kalau database belum dikonfigurasi (belum ada
// DATABASE_URL) atau query-nya gagal (koneksi database bermasalah), fallback
// ke konten yang sudah difinalisasi di lib/constants/policy-content.ts alih-
// alih menampilkan halaman kosong/error ke customer.

export async function getPolicyPage(slug: string): Promise<PolicyPageContent | null> {
  const fallback = POLICY_PAGES.find((page) => page.slug === slug) ?? null

  if (!isDatabaseConfigured()) return fallback

  try {
    const prisma = getPrisma()
    const page = await prisma.policyPage.findUnique({ where: { slug } })
    if (!page) return fallback
    return { slug: page.slug, title: page.title, content: page.content }
  } catch (error) {
    console.error(`getPolicyPage("${slug}") gagal, pakai fallback:`, error)
    return fallback
  }
}

export async function getFaqItems(): Promise<FaqItemContent[]> {
  if (!isDatabaseConfigured()) return FAQ_ITEMS

  try {
    const prisma = getPrisma()
    const items = await prisma.faqItem.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: "asc" },
    })
    if (items.length > 0) return items

    /**
     * Nol hasil punya DUA sebab yang sangat berbeda, dan fallback hanya benar
     * untuk salah satunya.
     *
     * Kalau tabelnya memang masih kosong (database baru, belum pernah diisi),
     * menampilkan konten default adalah yang diinginkan — itu maksud fallback
     * sejak awal.
     *
     * Tapi kalau barisnya ADA dan semuanya sudah dihapus staff, fallback
     * berubah menjadi kesalahan serius: FAQ yang sengaja dihapus akan muncul
     * kembali di halaman publik. Staff menekan Hapus, melihatnya hilang dari
     * panel, lalu pelanggan tetap membacanya — dan tidak ada apa pun di admin
     * yang bisa menjelaskan kenapa.
     *
     * Hitungan tambahan ini hanya dijalankan pada kasus nol, jadi jalur normal
     * tetap satu query.
     */
    const totalTermasukTerhapus = await prisma.faqItem.count()
    return totalTermasukTerhapus === 0 ? FAQ_ITEMS : []
  } catch (error) {
    console.error("getFaqItems() gagal, pakai fallback:", error)
    return FAQ_ITEMS
  }
}

/**
 * FAQ untuk panel admin.
 *
 * Terpisah dari `getFaqItems` karena keduanya menjawab pertanyaan yang berbeda:
 * yang itu "apa yang harus dibaca pelanggan" dan karenanya punya fallback ke
 * konten default; yang ini "apa yang sesungguhnya ada di tabel". Panel admin
 * tidak boleh pernah menampilkan konten fallback — kalau iya, staff akan
 * mencoba menyunting baris yang tidak ada.
 */
export async function getAdminFaqItems(): Promise<FaqItem[]> {
  return getPrisma().faqItem.findMany({
    where: { deletedAt: null },
    orderBy: { sortOrder: "asc" },
  })
}

/** Satu FAQ yang belum dihapus, atau null. Lihat catatan di `getStore`. */
export async function getFaqItem(id: string): Promise<FaqItem | null> {
  return getPrisma().faqItem.findFirst({ where: { id, deletedAt: null } })
}

/**
 * Tandai terhapus, JANGAN hapus barisnya. Alasan dan bentuknya sama seperti
 * `softDeleteStore` di `lib/api/stores.ts`.
 */
export async function softDeleteFaqItem(id: string, deletedBy: string): Promise<number> {
  const { count } = await getPrisma().faqItem.updateMany({
    where: { id, deletedAt: null },
    data: { deletedAt: new Date(), deletedBy },
  })
  return count
}
