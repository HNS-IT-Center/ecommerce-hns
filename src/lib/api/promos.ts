/**
 * Lapisan data untuk halaman promo (`promos`, `promo_products`) — lihat
 * docs/20-halaman-promo.md.
 *
 * Mengikuti konvensi `lib/api/banners.ts`: `revalidateTag`/`revalidatePath`
 * TIDAK dipanggil dari sini, melainkan dari lapisan action.
 *
 * Promo tidak menyimpan harga. Produknya dibaca lewat
 * `getPublishedProductsByIds`, jalur yang sama dengan katalog (CLAUDE.md §2.7).
 */
import { unstable_cache } from "next/cache"
import { Prisma, ProductStatus } from "@prisma/client"
import { getPrisma } from "@/lib/prisma/client"
import { buildPrismaWhere, getPublishedProductsByIds } from "@/lib/api/woocommerce/products"
import type { Product } from "@/types/woocommerce"
import { promoPhase, type PromoPhase } from "@/lib/utils/promo"

export const PROMOS_CACHE_TAG = "promos"

// --------------------------------------------------------------------------- storefront

/**
 * Gambar header halaman promo: banner pertama (menurut urutan beranda) yang
 * menautnya dan punya gambar. Status tayang banner sengaja TIDAK disaring —
 * promo yang sudah berakhir tetap menampilkan banner yang dulu diklik orang.
 */
const HEADER_BANNER_SELECT = {
  where: { imageUrl: { not: null } },
  orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  take: 1,
  select: { imageUrl: true, title: true },
} satisfies Prisma.Promo$bannersArgs

const PUBLIC_PROMO_SELECT = {
  id: true,
  slug: true,
  title: true,
  description: true,
  terms: true,
  startsAt: true,
  endsAt: true,
  banners: HEADER_BANNER_SELECT,
  products: { orderBy: { sortOrder: "asc" }, select: { productId: true } },
} satisfies Prisma.PromoSelect

type PublicPromoRow = Prisma.PromoGetPayload<{ select: typeof PUBLIC_PROMO_SELECT }>

export type PublicPromo = {
  id: string
  slug: string
  title: string
  description: string | null
  terms: string | null
  startsAt: Date | null
  endsAt: Date | null
  bannerImageUrl: string | null
  bannerAlt: string | null
  productIds: number[]
}

function toPublicPromo(row: PublicPromoRow): PublicPromo {
  const banner = row.banners[0]
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    terms: row.terms,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    bannerImageUrl: banner?.imageUrl ?? null,
    bannerAlt: banner?.title ?? null,
    productIds: row.products.map((p) => p.productId),
  }
}

/**
 * `unstable_cache` menyerialkan hasilnya ke JSON, jadi `Date` keluar sebagai
 * string. Dikembalikan ke `Date` di luar cache supaya pemanggil tidak perlu
 * tahu soal itu.
 */
function reviveDates(promo: PublicPromo): PublicPromo {
  return {
    ...promo,
    startsAt: promo.startsAt ? new Date(promo.startsAt) : null,
    endsAt: promo.endsAt ? new Date(promo.endsAt) : null,
  }
}

/**
 * Promo yang boleh dibuka publik: aktif dan belum dihapus. Jadwal TIDAK
 * menyaring di sini — promo yang belum mulai atau sudah berakhir tetap punya
 * halaman, hanya statusnya yang berbeda (`promoPhase`, dihitung saat dibaca).
 */
export async function getPromoBySlug(slug: string): Promise<PublicPromo | null> {
  const fetcher = unstable_cache(
    async () => {
      const row = await getPrisma().promo.findFirst({
        where: { slug, isActive: true, deletedAt: null },
        select: PUBLIC_PROMO_SELECT,
      })
      return row ? toPublicPromo(row) : null
    },
    ["promo-by-slug", slug],
    { revalidate: 300, tags: [PROMOS_CACHE_TAG] }
  )

  const promo = await fetcher()
  return promo ? reviveDates(promo) : null
}

/** Produk sebuah promo, dalam urutan pilihan staff. Harga dari katalog. */
export async function getPromoProducts(promo: Pick<PublicPromo, "productIds">): Promise<Product[]> {
  return getPublishedProductsByIds(promo.productIds)
}

export type PromoTeaser = Pick<
  PublicPromo,
  "id" | "slug" | "title" | "endsAt" | "bannerImageUrl" | "bannerAlt"
>

/**
 * Promo yang sedang berlangsung — untuk "Promo lain" dan halaman `/promo`.
 * Penyaringan jadwal di LUAR cache, alasannya sama dengan `getActiveBanners`.
 */
export async function getLivePromos(now = Date.now()): Promise<PromoTeaser[]> {
  const fetcher = unstable_cache(
    async () => {
      const rows = await getPrisma().promo.findMany({
        where: { isActive: true, deletedAt: null },
        orderBy: [{ endsAt: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          slug: true,
          title: true,
          startsAt: true,
          endsAt: true,
          banners: HEADER_BANNER_SELECT,
        },
      })
      return rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        bannerImageUrl: row.banners[0]?.imageUrl ?? null,
        bannerAlt: row.banners[0]?.title ?? null,
      }))
    },
    ["live-promos"],
    { revalidate: 300, tags: [PROMOS_CACHE_TAG] }
  )

  const rows = await fetcher()
  return rows
    .map((row) => ({
      ...row,
      startsAt: row.startsAt ? new Date(row.startsAt) : null,
      endsAt: row.endsAt ? new Date(row.endsAt) : null,
    }))
    .filter((row) => promoPhase(row, now) === "live")
}

export type { PromoPhase }

// --------------------------------------------------------------------------- admin

export type PromoInput = {
  slug: string
  title: string
  description: string | null
  terms: string | null
  isActive: boolean
  startsAt: Date | null
  endsAt: Date | null
  /** Id baris Prisma (`products.id`), dalam urutan tampil. */
  productIds: number[]
}

/** Satu baris di daftar promo admin. */
export type PromoRow = {
  id: string
  slug: string
  title: string
  isActive: boolean
  startsAt: Date | null
  endsAt: Date | null
  productCount: number
  bannerCount: number
}

export async function getAllPromos(): Promise<PromoRow[]> {
  const rows = await getPrisma().promo.findMany({
    where: { deletedAt: null },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      isActive: true,
      startsAt: true,
      endsAt: true,
      _count: { select: { products: true, banners: true } },
    },
  })

  return rows.map(({ _count, ...row }) => ({
    ...row,
    productCount: _count.products,
    bannerCount: _count.banners,
  }))
}

/** Pilihan untuk dropdown "Halaman Promo" di formulir banner. */
export type PromoOption = { id: string; title: string; slug: string; isActive: boolean }

export async function getPromoOptions(): Promise<PromoOption[]> {
  return getPrisma().promo.findMany({
    where: { deletedAt: null },
    orderBy: [{ createdAt: "desc" }],
    select: { id: true, title: true, slug: true, isActive: true },
  })
}

/**
 * Produk dalam bentuk yang dibutuhkan pemilih produk di admin.
 *
 * `onSaleNow` dihitung dengan syarat yang sama dengan `onSale` di
 * `buildPrismaWhere` — sale price terisi DAN belum lewat masa berlakunya —
 * supaya peringatan "belum ada harga obral" di admin cocok dengan yang
 * benar-benar tampil di toko.
 */
export type PromoPickerProduct = {
  id: number
  name: string
  sku: string | null
  imageUrl: string | null
  regularPrice: number | null
  salePrice: number | null
  onSaleNow: boolean
  published: boolean
}

const PICKER_SELECT = {
  id: true,
  name: true,
  sku: true,
  status: true,
  regularPrice: true,
  salePrice: true,
  saleEndDate: true,
  images: {
    orderBy: [{ isPrimary: "desc" }, { position: "asc" }],
    take: 1,
    select: { url: true },
  },
} satisfies Prisma.ProductSelect

type PickerRow = Prisma.ProductGetPayload<{ select: typeof PICKER_SELECT }>

function toPickerProduct(row: PickerRow, now = Date.now()): PromoPickerProduct {
  const regularPrice = row.regularPrice === null ? null : Number(row.regularPrice)
  const salePrice = row.salePrice === null ? null : Number(row.salePrice)
  const saleStillValid = !row.saleEndDate || row.saleEndDate.getTime() > now

  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    imageUrl: row.images[0]?.url ?? null,
    regularPrice,
    salePrice,
    onSaleNow:
      salePrice !== null && saleStillValid && (regularPrice === null || salePrice < regularPrice),
    published: row.status === ProductStatus.PUBLISHED,
  }
}

export type PromoForEdit = {
  id: string
  slug: string
  title: string
  description: string | null
  terms: string | null
  isActive: boolean
  startsAt: Date | null
  endsAt: Date | null
  products: PromoPickerProduct[]
  banners: { id: string; title: string }[]
}

export async function getPromoForEdit(id: string): Promise<PromoForEdit | null> {
  const row = await getPrisma().promo.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      terms: true,
      isActive: true,
      startsAt: true,
      endsAt: true,
      products: { orderBy: { sortOrder: "asc" }, select: { product: { select: PICKER_SELECT } } },
      banners: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true } },
    },
  })
  if (!row) return null

  const now = Date.now()
  return {
    ...row,
    products: row.products.map((p) => toPickerProduct(p.product, now)),
  }
}

/**
 * Pencarian produk untuk pemilih di formulir promo. Kata kunci diproses
 * `buildPrismaWhere` — aturan yang sama dengan pencarian katalog dan daftar
 * produk admin, jadi staff menemukan barang dengan kata yang sama.
 */
export async function searchPromoPickerProducts(query: string, limit = 20): Promise<PromoPickerProduct[]> {
  const search = query.trim()
  if (!search) return []

  const rows = await getPrisma().product.findMany({
    where: buildPrismaWhere({ search, status: "active" }),
    orderBy: [{ id: "desc" }],
    take: limit,
    select: PICKER_SELECT,
  })

  const now = Date.now()
  return rows.map((row) => toPickerProduct(row, now))
}

export class PromoSlugTakenError extends Error {
  constructor(slug: string) {
    super(`Alamat /promo/${slug} sudah dipakai promo lain — termasuk promo yang sudah dihapus. Pakai alamat lain.`)
    this.name = "PromoSlugTakenError"
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

/**
 * Slug dipakai juga oleh promo yang sudah di-soft-delete (indeks unik tidak
 * mengenal `deletedAt`). Galat P2002 diterjemahkan supaya staff tahu harus
 * mengganti alamatnya, bukan melihat galat database mentah.
 */
export async function createPromo(input: PromoInput): Promise<{ id: string }> {
  const { productIds, ...data } = input
  try {
    return await getPrisma().promo.create({
      data: {
        ...data,
        products: {
          create: productIds.map((productId, index) => ({ productId, sortOrder: index })),
        },
      },
      select: { id: true },
    })
  } catch (error) {
    if (isUniqueViolation(error)) throw new PromoSlugTakenError(input.slug)
    throw error
  }
}

/**
 * Daftar produk ditulis ulang seluruhnya dalam satu transaksi — sama dengan
 * `reorderBanners`: tidak pernah ada keadaan separuh lama separuh baru.
 */
export async function updatePromo(id: string, input: PromoInput): Promise<void> {
  const { productIds, ...data } = input
  const prisma = getPrisma()
  try {
    await prisma.$transaction([
      prisma.promo.update({ where: { id }, data }),
      prisma.promoProduct.deleteMany({ where: { promoId: id } }),
      prisma.promoProduct.createMany({
        data: productIds.map((productId, index) => ({ promoId: id, productId, sortOrder: index })),
      }),
    ])
  } catch (error) {
    if (isUniqueViolation(error)) throw new PromoSlugTakenError(input.slug)
    throw error
  }
}

/**
 * Soft delete (CLAUDE.md §2.8). Halamannya langsung 404 dan banner yang
 * menautnya kembali memakai `ctaHref` — penautannya sendiri dibiarkan sebagai
 * catatan, sama seperti banner milik kampanye yang dihapus.
 */
export async function softDeletePromo(id: string): Promise<void> {
  await getPrisma().promo.update({ where: { id }, data: { deletedAt: new Date() } })
}
