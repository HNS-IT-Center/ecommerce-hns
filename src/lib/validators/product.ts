import { z } from "zod"

export const productFormSchema = z.object({
  name: z.string().min(1, "Nama produk wajib diisi"),
  description: z.string().optional(),
  shortDescription: z.string().optional(),
  regularPrice: z.string().min(1, "Harga wajib diisi"),
  salePrice: z.string().optional(),
  salePriceDateEnd: z.string().optional(),
  manageStock: z.boolean(),
  // UI cuma menampilkan 2 pilihan (Tersedia/Stok Habis) — "onbackorder" tetap
  // ada di enum supaya kompatibel dengan data lama, tapi form tidak
  // menawarkannya.
  stockStatus: z.enum(["instock", "outofstock", "onbackorder"]),
  stockQuantity: z.number().int().min(0).optional(),
  // "private" ikut didukung karena admin sekarang menampilkan produk private;
  // tanpa opsi ini, menyimpan salah satunya diam-diam menurunkannya jadi draft.
  status: z.enum(["publish", "draft", "private"]),
  categoryIds: z.array(z.number()).min(1, "Pilih minimal 1 kategori"),
  attributes: z.array(z.object({ name: z.string().min(1), value: z.string().min(1) })),
  // Id lokal gambar (bukan id database): gambar baru belum punya id server
  // sampai benar-benar diunggah saat form disimpan. Field ini cuma dipakai
  // supaya react-hook-form ikut menandai form "berubah" ketika galeri diubah.
  imageIds: z.array(z.string()),
  videoUrl: z.string().optional(),
  /** Nama brand apa adanya — boleh nama baru, di-upsert saat disimpan. */
  brand: z.string().optional(),
})

export type ProductFormValues = z.infer<typeof productFormSchema>
