import { getPrisma, isDatabaseConfigured } from "@/lib/prisma/client"
import { POLICY_PAGES, FAQ_ITEMS, type FaqItemContent } from "@/lib/constants/policy-content"
import type { FaqItem, PolicyPage } from "@prisma/client"

// Halaman kebijakan/FAQ ini konten publik yang harus SELALU tampil benar buat
// pengunjung asli — kalau database belum dikonfigurasi (belum ada
// DATABASE_URL) atau query-nya gagal (koneksi database bermasalah), fallback
// ke konten yang sudah difinalisasi di lib/constants/policy-content.ts alih-
// alih menampilkan halaman kosong/error ke customer.

/**
 * Bentuk yang dipakai halaman publik. Sengaja bukan `PolicyPage` milik Prisma:
 * pengunjung tidak pernah melihat `deletedBy`, dan fallback di bawah memang
 * tidak punya kolom-kolom itu untuk diisi.
 */
export type PublicPolicyPage = {
  slug: string
  title: string
  description: string
  content: string
}

function toPublic(page: PolicyPage): PublicPolicyPage {
  return {
    slug: page.slug,
    title: page.title,
    // Kolomnya nullable di database — halaman yang dibuat staff boleh saja
    // belum punya ringkasan. Yang tidak boleh adalah halaman publik meledak
    // karenanya, jadi kosong diperlakukan sebagai "tidak ada ringkasan".
    description: page.description ?? "",
    content: page.content,
  }
}

export async function getPolicyPage(slug: string): Promise<PublicPolicyPage | null> {
  const fallback = POLICY_PAGES.find((page) => page.slug === slug) ?? null

  if (!isDatabaseConfigured()) return fallback

  try {
    const prisma = getPrisma()
    /*
     * `findFirst` + saringan `deletedAt`, bukan `findUnique` seperti dulu.
     * Tanpa saringan itu, kebijakan yang dihapus staff tetap tayang di
     * alamatnya sendiri: hilang dari /kebijakan dan dari panel admin, tapi
     * masih terbuka penuh bagi siapa pun yang menyimpan tautannya.
     */
    const page = await prisma.policyPage.findFirst({ where: { slug, deletedAt: null } })

    /*
     * Halaman yang DIHAPUS tidak boleh jatuh ke fallback, sedangkan halaman
     * yang belum pernah di-seed harus. Keduanya sama-sama `page === null` di
     * atas, jadi bedanya diperiksa di sini — dan hanya pada kasus nol, supaya
     * jalur normal tetap satu query.
     *
     * Yang dicegah: staff menghapus kebijakan bawaan lewat database, lalu
     * isinya muncul kembali dari konstanta seolah tidak pernah dihapus.
     */
    if (!page) {
      const pernahAda = await prisma.policyPage.count({ where: { slug } })
      return pernahAda > 0 ? null : fallback
    }

    return toPublic(page)
  } catch (error) {
    console.error(`getPolicyPage("${slug}") gagal, pakai fallback:`, error)
    return fallback
  }
}

/**
 * Seluruh kebijakan yang tayang — untuk daftar di `/kebijakan` dan peta situs.
 *
 * Nol baris di sini hanya punya satu sebab yang masuk akal: tabelnya belum
 * pernah diisi. Keempat kebijakan bawaan bertanda `isSystem` dan panel admin
 * menolak menghapusnya, jadi tidak ada jalan normal menuju tabel yang kosong
 * karena dihapus — beda dengan FAQ di bawah, yang boleh habis dihapus staff.
 */
export async function getPolicyPages(): Promise<PublicPolicyPage[]> {
  if (!isDatabaseConfigured()) return POLICY_PAGES

  try {
    const pages = await getPrisma().policyPage.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    })
    return pages.length > 0 ? pages.map(toPublic) : POLICY_PAGES
  } catch (error) {
    console.error("getPolicyPages() gagal, pakai fallback:", error)
    return POLICY_PAGES
  }
}

/**
 * Kebijakan untuk panel admin — tanpa fallback.
 *
 * Alasannya sama persis seperti `getAdminFaqItems` di bawah: panel yang
 * menampilkan konten fallback membuat staff menyunting baris yang tidak ada.
 */
export async function getAdminPolicyPages(): Promise<PolicyPage[]> {
  return getPrisma().policyPage.findMany({
    where: { deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  })
}

/** Satu kebijakan yang belum dihapus, atau null. */
export async function getAdminPolicyPage(slug: string): Promise<PolicyPage | null> {
  return getPrisma().policyPage.findFirst({ where: { slug, deletedAt: null } })
}

export type PolicyPageInput = {
  slug: string
  title: string
  description: string
  content: string
  sortOrder: number
}

/** Kesalahan yang layak ditampilkan apa adanya ke staff, bukan ditelan jadi 500. */
export class PolicyPageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PolicyPageError"
  }
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Slug yang sudah menjadi alamat panel admin.
 *
 * `/admin/kebijakan/baru` dan `/admin/kebijakan/faq` adalah segmen statis, dan
 * Next.js selalu memenangkannya atas `[slug]`. Kebijakan dengan slug ini akan
 * tersimpan dengan rapi lalu tidak pernah bisa dibuka lagi untuk disunting —
 * tombol Edit-nya mendarat di formulir "Tambah Kebijakan".
 */
const SLUG_TERPAKAI = ["baru", "faq"]

/**
 * Memeriksa isian sebelum menyentuh database.
 *
 * Isi kosong diperiksa SETELAH tag dilepas: editor Tiptap yang kosong
 * menghasilkan "<p></p>", bukan string kosong, jadi `trim()` saja meloloskannya.
 * Yang dijaga bukan kerapian data melainkan halaman publik — kebijakan kosong
 * yang tersimpan langsung tayang ke pengunjung, dan tidak ada yang memberi tahu
 * staff bahwa itu terjadi.
 */
function periksaInput(input: PolicyPageInput): void {
  if (!input.title.trim()) {
    throw new PolicyPageError("Judul kebijakan tidak boleh kosong.")
  }
  if (!input.content.replace(/<[^>]*>/g, "").trim()) {
    throw new PolicyPageError("Isi kebijakan tidak boleh kosong.")
  }
}

/**
 * Slug halaman baru. Ia menjadi alamat publiknya selamanya — lihat catatan pada
 * formulir soal kenapa slug tidak bisa diubah setelah dibuat.
 */
function periksaSlug(slug: string): string {
  if (!slug) {
    throw new PolicyPageError(
      "Slug tidak bisa diturunkan dari judul ini. Isi slug secara manual, mis. kebijakan-garansi.",
    )
  }
  if (!SLUG_PATTERN.test(slug)) {
    throw new PolicyPageError(
      `Slug "${slug}" tidak sah. Pakai huruf kecil, angka, dan tanda hubung saja — mis. kebijakan-garansi.`,
    )
  }
  if (SLUG_TERPAKAI.includes(slug)) {
    throw new PolicyPageError(
      `Slug "${slug}" sudah dipakai halaman panel admin. Pakai slug yang berbeda, mis. kebijakan-${slug}.`,
    )
  }
  return slug
}

/**
 * Membuat kebijakan baru — atau MENGHIDUPKAN KEMBALI yang slug-nya sama dan
 * sudah dihapus.
 *
 * `slug` adalah primary key, jadi baris yang di-soft-delete tetap memegang
 * alamatnya. Tanpa jalur pemulihan ini, staff yang menghapus "kebijakan-garansi"
 * lalu membuatnya lagi dengan nama sama akan ditolak database dengan galat
 * duplikat yang tidak bisa dijelaskan oleh apa pun yang terlihat di panel —
 * daftarnya kosong, tapi namanya "sudah dipakai".
 */
export async function createPolicyPage(input: PolicyPageInput): Promise<void> {
  periksaInput(input)
  const slug = periksaSlug(input.slug)

  const prisma = getPrisma()
  const existing = await prisma.policyPage.findUnique({ where: { slug } })

  if (existing && !existing.deletedAt) {
    throw new PolicyPageError(
      `Slug "${slug}" sudah dipakai kebijakan "${existing.title}". Pakai slug yang berbeda.`,
    )
  }

  const data = {
    title: input.title.trim(),
    description: input.description.trim() || null,
    content: input.content,
    sortOrder: input.sortOrder,
  }

  if (existing) {
    await prisma.policyPage.update({
      where: { slug },
      // `isSystem` sengaja TIDAK disentuh: kalau yang dipulihkan kebetulan
      // kebijakan bawaan, ia harus tetap terkunci setelah kembali.
      data: { ...data, deletedAt: null, deletedBy: null },
    })
    return
  }

  await prisma.policyPage.create({ data: { slug, ...data } })
}

/**
 * Menyimpan suntingan. Slug TIDAK ikut berubah — ia dipakai sebagai kunci
 * pencarian di sini, dan formulir tidak menyediakan cara mengubahnya.
 */
export async function savePolicyPage(input: PolicyPageInput): Promise<void> {
  periksaInput(input)

  const { count } = await getPrisma().policyPage.updateMany({
    where: { slug: input.slug, deletedAt: null },
    data: {
      title: input.title.trim(),
      description: input.description.trim() || null,
      content: input.content,
      sortOrder: input.sortOrder,
    },
  })

  // Nol baris berarti kebijakannya dihapus orang lain sementara formulir ini
  // terbuka. `update` biasa akan melempar galat Prisma mentah di layar staff;
  // ini menjelaskan apa yang sebenarnya terjadi.
  if (count === 0) {
    throw new PolicyPageError(
      "Kebijakan ini sudah tidak ada — mungkin dihapus dari perangkat lain. Muat ulang halaman daftar.",
    )
  }
}

/**
 * Tandai terhapus, JANGAN hapus barisnya — alasannya sama seperti
 * `softDeleteFaqItem`.
 *
 * Saringan `isSystem: false` ada DI SINI, bukan cuma di UI. Tombol Hapus
 * memang tidak dirender untuk kebijakan bawaan, tapi server action menerima
 * slug dari formulir, dan formulir bisa dikirim dari mana saja.
 */
export async function softDeletePolicyPage(slug: string, deletedBy: string): Promise<number> {
  const { count } = await getPrisma().policyPage.updateMany({
    where: { slug, deletedAt: null, isSystem: false },
    data: { deletedAt: new Date(), deletedBy },
  })
  return count
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
