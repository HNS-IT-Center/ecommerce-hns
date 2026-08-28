"use server"

import { getPrisma } from "@/lib/prisma/client"
import { BuilderProduct } from "@/store/new-builder"
import { Prisma } from "@prisma/client"
import { displayStockCount, getStockDisplayMode } from "@/lib/api/stock-display"

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
    type: "SIMPLE",
    OR: [
      { regularPrice: { gt: 0 } },
      { salePrice: { gt: 0 } }
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
        select: {
          attribute: { select: { id: true, name: true } },
          value: { select: { id: true, value: true } }
        }
      } : {
        select: {
          attribute: { select: { id: true, name: true } },
          value: { select: { id: true, value: true } }
        }
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
    const salePriceNum = p.salePrice ? Number(p.salePrice) : 0;
    const regularPriceNum = p.regularPrice ? Number(p.regularPrice) : 0;
    const currentPrice = salePriceNum > 0 ? salePriceNum : regularPriceNum;

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      type: p.type,
      price: currentPrice,
      regularPrice: regularPriceNum,
      salePrice: salePriceNum,
      sold: p.viewCount || 0, // Mocking sold with viewCount just for UI display if needed, though product table has no "sold" field natively here.
      stock: displayStockCount(
        p.stockStatus === "OUTOFSTOCK" ? 0 : (p.stockQty ?? 10),
        stockDisplayMode
      ),
      image: p.images[0]?.url,
      attributes: p.attributes.map(a => ({
        attributeId: a.attribute.id,
        attributeName: a.attribute.name,
        valueId: a.value.id,
        valueName: a.value.value
      }))
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
 * Bentuk `select` dan pemetaannya SAMA PERSIS dengan `fetchBuilderProducts`
 * di atas, termasuk aturan harga (`salePrice > 0 ? salePrice : regularPrice`)
 * dan stok (`OUTOFSTOCK` → 0). Kalau salah satunya diubah, ubah keduanya:
 * angka di kartu paket harus sama persis dengan angka yang muncul begitu
 * rakitannya masuk wizard. Aturan yang sama juga dicerminkan di
 * `lib/pc-prebuild/resolve.ts`.
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
      attributes: {
        select: {
          attribute: { select: { id: true, name: true } },
          value: { select: { id: true, value: true } }
        }
      }
    }
  })

  const stockDisplayMode = await getStockDisplayMode()

  return products.map(p => {
    const salePriceNum = p.salePrice ? Number(p.salePrice) : 0;
    const regularPriceNum = p.regularPrice ? Number(p.regularPrice) : 0;
    const currentPrice = salePriceNum > 0 ? salePriceNum : regularPriceNum;

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      type: p.type,
      price: currentPrice,
      regularPrice: regularPriceNum,
      salePrice: salePriceNum,
      sold: p.viewCount || 0,
      stock: displayStockCount(
        p.stockStatus === "OUTOFSTOCK" ? 0 : (p.stockQty ?? 10),
        stockDisplayMode
      ),
      image: p.images[0]?.url,
      attributes: p.attributes.map(a => ({
        attributeId: a.attribute.id,
        attributeName: a.attribute.name,
        valueId: a.value.id,
        valueName: a.value.value
      }))
    }
  })
}
