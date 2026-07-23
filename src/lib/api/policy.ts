import { getPrisma, isDatabaseConfigured } from "@/lib/prisma/client"
import { POLICY_PAGES, FAQ_ITEMS, type PolicyPageContent, type FaqItemContent } from "@/lib/constants/policy-content"

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
    const items = await prisma.faqItem.findMany({ orderBy: { sortOrder: "asc" } })
    if (items.length === 0) return FAQ_ITEMS
    return items
  } catch (error) {
    console.error("getFaqItems() gagal, pakai fallback:", error)
    return FAQ_ITEMS
  }
}
