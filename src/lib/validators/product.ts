import { z } from "zod"

export const productFormSchema = z.object({
  name: z.string().min(1, "Nama produk wajib diisi"),
  description: z.string().optional(),
  shortDescription: z.string().optional(),
  regularPrice: z.string().min(1, "Harga wajib diisi"),
  salePrice: z.string().optional(),
  stockQuantity: z.number().int().min(0).optional(),
  status: z.enum(["publish", "draft"]),
  categoryIds: z.array(z.number()).min(1, "Pilih minimal 1 kategori"),
  attributes: z.array(z.object({ name: z.string().min(1), value: z.string().min(1) })),
  imageIds: z.array(z.number()),
})

export type ProductFormValues = z.infer<typeof productFormSchema>
