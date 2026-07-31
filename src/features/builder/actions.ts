"use server"

import { getPrisma } from "@/lib/prisma/client"
import { BuilderProduct } from "@/store/new-builder"
import { Prisma } from "@prisma/client"

export async function fetchBuilderProducts({
  categoryIds,
  requiredAttributeValueIds,
  searchQuery = "",
  limit = 20,
  page = 1,
  sort = "default"
}: {
  categoryIds: number[]
  requiredAttributeValueIds: number[]
  searchQuery?: string
  limit?: number
  page?: number
  sort?: "default" | "name_asc" | "name_desc" | "price_asc" | "price_desc"
}): Promise<{ products: BuilderProduct[], hasMore: boolean }> {
  const prisma = getPrisma()

  // Base where clause
  const where: Prisma.ProductWhereInput = {
    status: "PUBLISHED",
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
    where.OR = [
      { name: { contains: searchQuery } },
      {
        attributes: {
          some: {
            value: {
              value: { contains: searchQuery }
            }
          }
        }
      }
    ]
  }

  const orderBy: Prisma.ProductOrderByWithRelationInput[] = []
  if (sort === "name_asc") orderBy.push({ name: "asc" })
  if (sort === "name_desc") orderBy.push({ name: "desc" })
  if (sort === "price_asc") orderBy.push({ salePrice: "asc" }, { regularPrice: "asc" })
  if (sort === "price_desc") orderBy.push({ salePrice: "desc" }, { regularPrice: "desc" })
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
      attributes: {
        select: {
          attribute: { select: { id: true, name: true } },
          value: { select: { id: true, value: true } }
        }
      }
    }
  })

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
      stock: p.stockStatus === "OUTOFSTOCK" ? 0 : (p.stockQty ?? 10), // Treat null as having some stock for now
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
