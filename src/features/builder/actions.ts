"use server"

import { getPrisma } from "@/lib/prisma/client"
import { BuilderProduct } from "@/store/new-builder"
import { Prisma } from "@prisma/client"

export async function fetchBuilderProducts({
  categoryIds,
  requiredAttributeValueIds,
  searchQuery = "",
  limit = 20
}: {
  categoryIds: number[]
  requiredAttributeValueIds: number[]
  searchQuery?: string
  limit?: number
}): Promise<BuilderProduct[]> {
  const prisma = getPrisma()

  // Base where clause
  const where: Prisma.ProductWhereInput = {
    status: "PUBLISHED",
  }

  // Filter by categories if specified
  if (categoryIds.length > 0) {
    where.categories = {
      some: {
        categoryId: { in: categoryIds }
      }
    }
  }

  // Must match ALL required attributes from dependencies
  // Prisma doesn't have a direct "contains all these relations" operator easily without ANDing them
  if (requiredAttributeValueIds.length > 0) {
    where.AND = requiredAttributeValueIds.map(valId => ({
      attributes: {
        some: { valueId: valId }
      }
    }))
  }

  // Text search
  if (searchQuery) {
    where.name = { contains: searchQuery }
  }

  // Fetch products
  const products = await prisma.product.findMany({
    where,
    take: limit,
    select: {
      id: true,
      name: true,
      regularPrice: true,
      salePrice: true,
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

  // Format mapping
  return products.map(p => ({
    id: p.id,
    name: p.name,
    price: p.salePrice ? Number(p.salePrice) : Number(p.regularPrice || 0),
    image: p.images[0]?.url,
    attributes: p.attributes.map(a => ({
      attributeId: a.attribute.id,
      attributeName: a.attribute.name,
      valueId: a.value.id,
      valueName: a.value.value
    }))
  }))
}
