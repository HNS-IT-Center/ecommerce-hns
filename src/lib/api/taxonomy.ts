/**
 * Lapisan data untuk taksonomi produk: atribut, nilai atribut, dan brand.
 *
 * Mengikuti konvensi `lib/api/banners.ts` & `lib/theme/settings.ts`:
 * `revalidateTag`/`revalidatePath` TIDAK dipanggil dari sini, melainkan dari
 * lapisan action — supaya fungsi di berkas ini tetap bisa dipakai dari script
 * tanpa menyeret konteks request.
 */
import { unstable_cache } from "next/cache"

import { getPrisma } from "@/lib/prisma/client"

export const TAXONOMY_CACHE_TAG = "taxonomy"

export type AttributeValueRow = {
  id: number
  value: string
  /** Berapa produk memakai nilai ini — dipakai untuk peringatan sebelum hapus. */
  productCount: number
}

export type AttributeRow = {
  id: number
  name: string
  values: AttributeValueRow[]
  /** Total produk yang memakai atribut ini lewat nilai mana pun. */
  productCount: number
}

export type BrandRow = {
  id: number
  name: string
  slug: string
  logoUrl: string | null
  productCount: number
}

/**
 * Semua atribut beserta nilainya dan jumlah pemakaian.
 *
 * Jumlah produk diambil lewat `_count` pada relasi `productAttributes`, bukan
 * query terpisah per nilai: dengan puluhan atribut × puluhan nilai, pola
 * "hitung satu per satu" berubah menjadi ratusan query untuk satu kali render.
 */
export async function getAttributes(): Promise<AttributeRow[]> {
  const fetcher = unstable_cache(
    async () => {
      const attributes = await getPrisma().attribute.findMany({
        orderBy: { name: "asc" },
        include: {
          _count: { select: { productAttributes: true } },
          values: {
            orderBy: { value: "asc" },
            include: { _count: { select: { productAttributes: true } } },
          },
        },
      })

      return attributes.map((attribute) => ({
        id: attribute.id,
        name: attribute.name,
        productCount: attribute._count.productAttributes,
        values: attribute.values.map((value) => ({
          id: value.id,
          value: value.value,
          productCount: value._count.productAttributes,
        })),
      }))
    },
    ["admin-attributes"],
    { revalidate: 300, tags: [TAXONOMY_CACHE_TAG] }
  )

  return fetcher()
}

/** Semua brand beserta jumlah produk yang memakainya. */
export async function getBrandsWithCount(): Promise<BrandRow[]> {
  const fetcher = unstable_cache(
    async () => {
      const brands = await getPrisma().brand.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { products: true } } },
      })

      return brands.map((brand) => ({
        id: brand.id,
        name: brand.name,
        slug: brand.slug,
        logoUrl: brand.logoUrl,
        productCount: brand._count.products,
      }))
    },
    ["admin-brands"],
    { revalidate: 300, tags: [TAXONOMY_CACHE_TAG] }
  )

  return fetcher()
}

/**
 * CATATAN: `slugify` sengaja TIDAK ada (dan tidak di-re-export) di sini —
 * lihat `lib/utils/slug.ts`.
 *
 * Berkas ini mengimpor Prisma. Komponen klien (form brand) butuh `slugify`
 * untuk pratinjau slug, dan mengambilnya lewat modul ini akan ikut menyeret
 * Prisma beserta driver mariadb ke bundel browser — build gagal dengan
 * "module not found: net/tls". Impor langsung dari `@/lib/utils/slug`.
 */
