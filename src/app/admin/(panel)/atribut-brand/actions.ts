"use server"

import { revalidatePath, revalidateTag } from "next/cache"
import { z } from "zod"

import { requirePermission } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma/client"
import { TAXONOMY_CACHE_TAG } from "@/lib/api/taxonomy"
import { slugify } from "@/lib/utils/slug"

export type ActionResult = { success: true } | { success: false; error: string }

/**
 * Menyegarkan pembaca taksonomi.
 *
 * `shop-brands` ikut disegarkan: `lib/api/woocommerce/brands.ts` memakai tag
 * itu untuk daftar brand di storefront dan form produk. Tanpa ini, brand yang
 * baru ditambah tidak muncul di sana sampai cache-nya kedaluwarsa sendiri.
 */
function revalidateTaxonomy() {
  revalidateTag(TAXONOMY_CACHE_TAG, "max")
  revalidateTag("shop-brands", "max")
  revalidatePath("/admin/atribut-brand")
}

/** Prisma melempar P2002 saat sebuah kolom unik dilanggar. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  )
}

const NameSchema = z.string().trim().min(1, "Nama wajib diisi").max(191, "Nama terlalu panjang")

// --------------------------------------------------------------------------- attribute

export async function createAttribute(name: string): Promise<ActionResult> {
  await requirePermission("atribut-brand", "edit")

  const parsed = NameSchema.safeParse(name)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  try {
    await getPrisma().attribute.create({ data: { name: parsed.data } })
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { success: false, error: `Atribut "${parsed.data}" sudah ada.` }
    }
    throw error
  }

  revalidateTaxonomy()
  return { success: true }
}

export async function renameAttribute(id: number, name: string): Promise<ActionResult> {
  await requirePermission("atribut-brand", "edit")

  const parsed = NameSchema.safeParse(name)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  try {
    await getPrisma().attribute.update({ where: { id }, data: { name: parsed.data } })
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { success: false, error: `Atribut "${parsed.data}" sudah ada.` }
    }
    throw error
  }

  revalidateTaxonomy()
  return { success: true }
}

/**
 * Menghapus atribut beserta seluruh nilainya.
 *
 * `AttributeValue` dan `ProductAttribute` ber-`onDelete: Cascade` ke atribut
 * ini, jadi menghapusnya juga MELEPAS atribut tersebut dari setiap produk yang
 * memakainya. Itu perilaku yang disengaja (dikonfirmasi saat perancangan);
 * dialog konfirmasi di UI menyebutkan jumlah produk yang terdampak supaya
 * angkanya terlihat sebelum tombol ditekan.
 */
export async function deleteAttribute(id: number): Promise<ActionResult> {
  await requirePermission("atribut-brand", "edit")

  await getPrisma().attribute.delete({ where: { id } })

  revalidateTaxonomy()
  return { success: true }
}

// --------------------------------------------------------------------------- attribute value

export async function createAttributeValue(
  attributeId: number,
  value: string
): Promise<ActionResult> {
  await requirePermission("atribut-brand", "edit")

  const parsed = NameSchema.safeParse(value)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  try {
    await getPrisma().attributeValue.create({
      data: { attributeId, value: parsed.data },
    })
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { success: false, error: `Nilai "${parsed.data}" sudah ada di atribut ini.` }
    }
    throw error
  }

  revalidateTaxonomy()
  return { success: true }
}

export async function renameAttributeValue(id: number, value: string): Promise<ActionResult> {
  await requirePermission("atribut-brand", "edit")

  const parsed = NameSchema.safeParse(value)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  try {
    await getPrisma().attributeValue.update({ where: { id }, data: { value: parsed.data } })
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { success: false, error: `Nilai "${parsed.data}" sudah ada di atribut ini.` }
    }
    throw error
  }

  revalidateTaxonomy()
  return { success: true }
}

/**
 * Menghapus satu nilai atribut.
 *
 * Cascade ke `ProductAttribute` — nilai ini ikut lepas dari produk yang
 * memakainya. Disepakati: "cascade so it will be clean".
 */
export async function deleteAttributeValue(id: number): Promise<ActionResult> {
  await requirePermission("atribut-brand", "edit")

  await getPrisma().attributeValue.delete({ where: { id } })

  revalidateTaxonomy()
  return { success: true }
}

// --------------------------------------------------------------------------- brand

const BrandSchema = z.object({
  name: NameSchema,
  /** Kosong berarti "buatkan dari nama" — lihat `slugify`. */
  slug: z.string().trim().max(191, "Slug terlalu panjang"),
  logoUrl: z
    .string()
    .trim()
    .max(500, "URL logo terlalu panjang")
    .nullable(),
})

export type BrandInput = z.infer<typeof BrandSchema>

export async function createBrand(input: BrandInput): Promise<ActionResult> {
  await requirePermission("atribut-brand", "edit")

  const parsed = BrandSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  const slug = parsed.data.slug || slugify(parsed.data.name)
  if (!slug) return { success: false, error: "Slug tidak bisa dibuat dari nama tersebut." }

  try {
    await getPrisma().brand.create({
      data: {
        name: parsed.data.name,
        slug,
        logoUrl: parsed.data.logoUrl || null,
      },
    })
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { success: false, error: `Slug "${slug}" sudah dipakai brand lain.` }
    }
    throw error
  }

  revalidateTaxonomy()
  return { success: true }
}

export async function updateBrand(id: number, input: BrandInput): Promise<ActionResult> {
  await requirePermission("atribut-brand", "edit")

  const parsed = BrandSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  const slug = parsed.data.slug || slugify(parsed.data.name)
  if (!slug) return { success: false, error: "Slug tidak bisa dibuat dari nama tersebut." }

  try {
    await getPrisma().brand.update({
      where: { id },
      data: {
        name: parsed.data.name,
        slug,
        logoUrl: parsed.data.logoUrl || null,
      },
    })
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { success: false, error: `Slug "${slug}" sudah dipakai brand lain.` }
    }
    throw error
  }

  revalidateTaxonomy()
  return { success: true }
}

/**
 * Menghapus brand.
 *
 * `Product.brandId` ber-`onDelete: SetNull`, jadi produknya TIDAK ikut
 * terhapus — hanya kehilangan brand-nya. Dialog konfirmasi menyebutkan jumlah
 * produk yang akan menjadi tanpa-brand.
 */
export async function deleteBrand(id: number): Promise<ActionResult> {
  await requirePermission("atribut-brand", "edit")

  await getPrisma().brand.delete({ where: { id } })

  revalidateTaxonomy()
  return { success: true }
}
