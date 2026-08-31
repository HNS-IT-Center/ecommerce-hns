"use server"

import { getPrisma } from "@/lib/prisma/client"
import { BuilderProduct, BuilderVariation } from "@/store/new-builder"
import { Prisma } from "@prisma/client"
import { displayStockCount, getStockDisplayMode, type StockDisplayMode } from "@/lib/api/stock-display"
import { buildVariationLabel, cheapestAvailableVariation } from "@/lib/utils/variation"

/**
 * ATURAN HARGA & STOK — satu-satunya yang berlaku di seluruh PC Builder:
 *
 *     price = salePrice > 0 ? salePrice : regularPrice
 *     stock = stockStatus === "OUTOFSTOCK" ? 0 : (stockQty ?? 10)
 *
 * Salinan aturan yang sama ada di `lib/pc-prebuild/products.ts` dan
 * `lib/pc-prebuild/resolve.ts`; kalau salah satu berubah, ubah semuanya. Angka
 * di panel admin harus sama persis dengan angka yang muncul di wizard.
 * `salePrice` adalah satu-satunya potongan yang sah menurut CLAUDE.md §2.7 dan
 * dibaca apa adanya — tidak ada perkalian, tidak ada persentase.
 */
function hargaBerlaku(regular: Prisma.Decimal | null, sale: Prisma.Decimal | null) {
  const salePrice = sale ? Number(sale) : 0
  const regularPrice = regular ? Number(regular) : 0
  return { price: salePrice > 0 ? salePrice : regularPrice, regularPrice, salePrice }
}

function stokBerlaku(status: string | null, qty: number | null, mode: StockDisplayMode): number {
  return displayStockCount(status === "OUTOFSTOCK" ? 0 : (qty ?? 10), mode)
}

/** Baris VARIATION: yang dibutuhkan untuk menampilkan & memilih satu varian. */
const PILIH_VARIAN = {
  id: true,
  name: true,
  regularPrice: true,
  salePrice: true,
  stockQty: true,
  stockStatus: true,
  images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
  attributes: { select: { value: { select: { value: true } } } },
} satisfies Prisma.ProductSelect

const PILIH_ATRIBUT = {
  attribute: { select: { id: true, name: true } },
  value: { select: { id: true, value: true } },
} satisfies Prisma.ProductAttributeSelect

type BarisVarian = Prisma.ProductGetPayload<{ select: typeof PILIH_VARIAN }>

function petakanVarian(v: BarisVarian, mode: StockDisplayMode): BuilderVariation {
  const harga = hargaBerlaku(v.regularPrice, v.salePrice)
  return {
    id: v.id,
    // Label dari NILAI ATRIBUT, bukan dari `name` — lihat `lib/utils/variation.ts`.
    label: buildVariationLabel(v.attributes.map((a) => a.value.value)) ?? v.name,
    price: harga.price,
    regularPrice: harga.regularPrice,
    salePrice: harga.salePrice,
    stock: stokBerlaku(v.stockStatus, v.stockQty, mode),
    image: v.images[0]?.url,
  }
}

export async function fetchBuilderProducts({
  categoryIds,
  requiredAttributeValueIds,
  configuredAttributeIds = [],
  searchQuery = "",
  limit = 20,
  page = 1,
  sort = "default"
}: {
  categoryIds: number[]
  requiredAttributeValueIds: number[]
  configuredAttributeIds?: number[]
  searchQuery?: string
  limit?: number
  page?: number
  sort?: "default" | "name_asc" | "name_desc" | "price_asc" | "price_desc"
}): Promise<{ products: BuilderProduct[], hasMore: boolean }> {
  const prisma = getPrisma()

  // Base where clause
  const where: Prisma.ProductWhereInput = {
    status: "PUBLISHED",
    /**
     * Dulu terkunci `type: "SIMPLE"`, dan penguncian itu punya alasan: wizard
     * belum punya cara memilih varian, sehingga produk VARIABLE yang bocor ke
     * sini akan masuk rakitan tanpa varian — dengan harga induk yang sering nol
     * dan bukan harga barang mana pun.
     *
     * Alasan itu sekarang sudah gugur: `VariationPickerDialog` menutup jalur
     * masuknya. Yang WAJIB tetap dijaga adalah dua-duanya bergerak bersama —
     * kalau pemilih variannya suatu hari dibongkar, kunci ini harus kembali.
     *
     * VARIATION tetap tidak ikut: ia dipilih lewat induknya, bukan berdiri
     * sendiri di grid. Kalau ikut, pelanggan melihat "1TB" dan "2TB" sebagai
     * dua produk terpisah tanpa tahu keduanya barang yang sama.
     */
    type: { in: ["SIMPLE", "VARIABLE"] },
    OR: [
      { regularPrice: { gt: 0 } },
      { salePrice: { gt: 0 } },
      // Induk VARIABLE sering berharga nol karena harganya ada di varian. Tanpa
      // cabang ini, seluruh produk bervarian tetap hilang dari grid walau
      // filter tipenya sudah dilonggarkan.
      {
        type: "VARIABLE",
        variations: {
          some: {
            status: "PUBLISHED",
            OR: [{ regularPrice: { gt: 0 } }, { salePrice: { gt: 0 } }],
          },
        },
      },
    ]
  }

  // Filter by categories if specified
  if (categoryIds.length > 0) {
    // 1. Fetch the paths of the selected categories
    const selectedCategories = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { path: true }
    })

    // 2. Find all categories that start with those paths (this includes the original categories and all children)
    const descendantCategories = await prisma.category.findMany({
      where: {
        OR: selectedCategories.map(cat => ({
          path: { startsWith: cat.path }
        }))
      },
      select: { id: true }
    })

    const allCategoryIds = descendantCategories.map(c => c.id)

    where.categories = {
      some: {
        categoryId: { in: allCategoryIds }
      }
    }
  }

  // Must match ALL required attributes from dependencies
  if (requiredAttributeValueIds.length > 0) {
    where.AND = requiredAttributeValueIds.map(valId => ({
      attributes: {
        some: { valueId: valId }
      }
    }))
  }

  // Text search
  if (searchQuery) {
    const searchTerms = searchQuery.trim().split(/\s+/).filter(Boolean)
    if (searchTerms.length > 0) {
      const nameConditions = searchTerms.map(term => ({ name: { contains: term } }))
      const attrConditions = searchTerms.map(term => ({
        attributes: {
          some: {
            value: {
              value: { contains: term }
            }
          }
        }
      }))

      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : (where.AND ? [where.AND] : [])),
        {
          OR: [
            { AND: nameConditions },
            { AND: attrConditions }
          ]
        }
      ]
    }
  }

  const orderBy: Prisma.ProductOrderByWithRelationInput[] = []
  if (sort === "name_asc") orderBy.push({ name: "asc" })
  if (sort === "name_desc") orderBy.push({ name: "desc" })
  if (sort === "price_asc") orderBy.push({ regularPrice: "asc" })
  if (sort === "price_desc") orderBy.push({ regularPrice: "desc" })
  if (sort === "default") orderBy.push({ viewCount: "desc" }) // default sorting

  const skip = (page - 1) * limit

  // Fetch products
  const products = await prisma.product.findMany({
    where,
    orderBy,
    skip,
    take: limit + 1, // Fetch one extra to check if there are more
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      regularPrice: true,
      salePrice: true,
      stockQty: true,
      stockStatus: true,
      viewCount: true,
      images: {
        orderBy: { position: "asc" },
        take: 1,
        select: { url: true }
      },
      attributes: configuredAttributeIds.length > 0 ? {
        where: { attributeId: { in: configuredAttributeIds } },
        select: PILIH_ATRIBUT
      } : { select: PILIH_ATRIBUT },
      // Kosong untuk produk SIMPLE — kartu memakai panjang array ini untuk
      // memutuskan apakah tombol Select membuka pemilih varian.
      variations: {
        where: { status: "PUBLISHED" },
        orderBy: { id: "asc" },
        select: PILIH_VARIAN,
      }
    }
  })

  // Sakelar tampilan stok di /admin/produk ikut berlaku di PC Builder: kartu
  // komponennya menurunkan ketersediaan dari `stock > 0`.
  const stockDisplayMode = await getStockDisplayMode()

  const hasMore = products.length > limit
  const paginatedProducts = products.slice(0, limit)

  // Format mapping
  const mappedProducts = paginatedProducts.map(p => {
    const variations = p.variations.map((v) => petakanVarian(v, stockDisplayMode))
    const harga = hargaBerlaku(p.regularPrice, p.salePrice)

    // Induk VARIABLE menumpang variannya untuk harga & ketersediaan: harganya
    // sendiri sering nol, dan stoknya tidak pernah dicatat di baris induk.
    const termurah = variations.length > 0 && harga.price <= 0 ? cheapestAvailableVariation(variations) : null

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      type: p.type,
      price: termurah?.price ?? harga.price,
      regularPrice: termurah?.regularPrice ?? harga.regularPrice,
      salePrice: termurah?.salePrice ?? harga.salePrice,
      sold: p.viewCount || 0, // Mocking sold with viewCount just for UI display if needed, though product table has no "sold" field natively here.
      stock: variations.length > 0
        // Kartu induk bisa ditekan selama MASIH ADA satu varian yang tersedia;
        // varian yang habis tetap ditandai satu per satu di dalam pemilihnya.
        ? variations.reduce((max, v) => Math.max(max, v.stock), 0)
        : stokBerlaku(p.stockStatus, p.stockQty, stockDisplayMode),
      image: p.images[0]?.url,
      attributes: p.attributes.map(a => ({
        attributeId: a.attribute.id,
        attributeName: a.attribute.name,
        valueId: a.value.id,
        valueName: a.value.value
      })),
      ...(variations.length > 0 ? { variations } : {}),
    }
  })

  return {
    products: mappedProducts,
    hasMore
  }
}

/**
 * Produk berdasarkan daftar id — dipakai memuat paket PC Prebuild ke wizard.
 *
 * Aturan harga & stoknya SAMA PERSIS dengan `fetchBuilderProducts` di atas
 * (keduanya lewat `hargaBerlaku`/`stokBerlaku`), supaya angka di kartu paket
 * sama dengan angka yang muncul begitu rakitannya masuk wizard.
 *
 * Menerima id INDUK maupun id VARIAN. Baris VARIATION yang diminta langsung
 * dipetakan menjadi pilihan varian yang utuh — nama & atribut kompatibilitas
 * dari induknya, harga & stok dari barisnya sendiri — sehingga paket prebuild
 * yang memuat barang bervarian mendarat di wizard dalam bentuk yang sama persis
 * dengan hasil memilihnya sendiri lewat `VariationPickerDialog`.
 *
 * Urutan hasilnya TIDAK dijamin sama dengan urutan `ids` — pemanggil
 * memetakannya sendiri lewat id.
 */
export async function fetchBuilderProductsByIds(ids: number[]): Promise<BuilderProduct[]> {
  const unik = [...new Set(ids)].filter((id) => Number.isFinite(id))
  if (unik.length === 0) return []

  const prisma = getPrisma()

  const products = await prisma.product.findMany({
    where: { id: { in: unik } },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      regularPrice: true,
      salePrice: true,
      stockQty: true,
      stockStatus: true,
      viewCount: true,
      images: {
        orderBy: { position: "asc" },
        take: 1,
        select: { url: true }
      },
      attributes: { select: PILIH_ATRIBUT },
      variations: {
        where: { status: "PUBLISHED" },
        orderBy: { id: "asc" },
        select: PILIH_VARIAN,
      },
      // Terisi hanya kalau barisnya sendiri sebuah VARIATION. Nama, atribut
      // kompatibilitas, dan daftar saudara variannya semua datang dari sini.
      parent: {
        select: {
          id: true,
          name: true,
          slug: true,
          images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
          attributes: { select: PILIH_ATRIBUT },
          variations: {
            where: { status: "PUBLISHED" },
            orderBy: { id: "asc" },
            select: PILIH_VARIAN,
          },
        },
      },
    }
  })

  const stockDisplayMode = await getStockDisplayMode()

  return products.map(p => {
    const harga = hargaBerlaku(p.regularPrice, p.salePrice)

    const atributInduk = (p.parent?.attributes ?? p.attributes).map(a => ({
      attributeId: a.attribute.id,
      attributeName: a.attribute.name,
      valueId: a.value.id,
      valueName: a.value.value
    }))

    if (p.parent) {
      const saudara = p.parent.variations.map((v) => petakanVarian(v, stockDisplayMode))

      return {
        id: p.id,
        // Nama induk, bukan nama barisnya sendiri: varian warisan impor
        // WooCommerce sering bernama sama persis dengan induknya, jadi
        // pembedanya HARUS `variationLabel`, bukan `name`.
        name: p.parent.name,
        slug: p.parent.slug,
        type: p.type,
        price: harga.price,
        regularPrice: harga.regularPrice,
        salePrice: harga.salePrice,
        sold: p.viewCount || 0,
        stock: stokBerlaku(p.stockStatus, p.stockQty, stockDisplayMode),
        image: p.images[0]?.url ?? p.parent.images[0]?.url,
        attributes: atributInduk,
        parentId: p.parent.id,
        parentName: p.parent.name,
        variationLabel:
          buildVariationLabel(p.attributes.map((a) => a.value.value)) ?? undefined,
        variations: saudara,
      }
    }

    const variations = p.variations.map((v) => petakanVarian(v, stockDisplayMode))
    const termurah = variations.length > 0 && harga.price <= 0 ? cheapestAvailableVariation(variations) : null

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      type: p.type,
      price: termurah?.price ?? harga.price,
      regularPrice: termurah?.regularPrice ?? harga.regularPrice,
      salePrice: termurah?.salePrice ?? harga.salePrice,
      sold: p.viewCount || 0,
      stock: variations.length > 0
        ? variations.reduce((max, v) => Math.max(max, v.stock), 0)
        : stokBerlaku(p.stockStatus, p.stockQty, stockDisplayMode),
      image: p.images[0]?.url,
      attributes: atributInduk,
      ...(variations.length > 0 ? { variations } : {}),
    }
  })
}
