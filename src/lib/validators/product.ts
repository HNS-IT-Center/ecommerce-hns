import { z } from "zod"

/**
 * Satu baris varian pada produk bertipe "variable".
 *
 * Tiap varian adalah baris produk penuh di database (`type: VARIATION` yang
 * menunjuk induk lewat `parent_id`), jadi field-nya cerminan produk: punya
 * harga, SKU, stok, dan gambar sendiri.
 *
 * `id` hanya terisi untuk varian yang sudah ada di database — varian yang baru
 * ditambahkan lewat form belum punya id sampai disimpan.
 */
export const productVariationSchema = z.object({
  id: z.number().int().optional(),
  /** Nilai atribut pembeda, mis. { WARNA: "MERAH" }. */
  attributes: z.record(z.string(), z.string().min(1, "Nilai varian wajib diisi")),
  sku: z.string().optional(),
  regularPrice: z.string().min(1, "Harga varian wajib diisi"),
  salePrice: z.string().optional(),
  stockStatus: z.enum(["instock", "outofstock", "onbackorder"]),
  stockQuantity: z.number().int().min(0).optional(),
  /** URL gambar varian. Kosong = ikut gambar utama induk. */
  imageUrl: z.string().optional(),
})

export type ProductVariationValues = z.infer<typeof productVariationSchema>

const baseProductFormSchema = z.object({
  name: z.string().min(1, "Nama produk wajib diisi"),
  /**
   * Tipe produk. Sebelumnya form selalu mengirim "simple" — termasuk saat
   * mengedit produk variable, yang membuat induknya berubah jadi produk biasa
   * dan seluruh varian kehilangan induk. Sekarang tipenya eksplisit.
   */
  type: z.enum(["simple", "variable"]),
  description: z.string().optional(),
  shortDescription: z.string().optional(),
  /** Wajib untuk produk simple; produk variable memakai harga tiap varian. */
  regularPrice: z.string(),
  salePrice: z.string().optional(),
  salePriceDateEnd: z.string().optional(),
  /** Nama atribut yang membedakan varian, mis. ["WARNA"]. */
  variationAttributes: z.array(z.string().min(1)),
  variations: z.array(productVariationSchema),
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

/**
 * Aturan yang bergantung pada tipe produk.
 *
 * Produk simple butuh harga sendiri; produk variable tidak — harganya nempel di
 * tiap varian, dan harga induk ditampilkan sebagai "mulai dari" hasil agregat.
 * Sebaliknya, produk variable tanpa satu pun varian tidak ada gunanya: ia tidak
 * bisa dibeli dan tidak punya harga untuk ditampilkan.
 */
export const productFormSchema = baseProductFormSchema.superRefine((values, ctx) => {
  if (values.type === "simple") {
    if (!values.regularPrice.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["regularPrice"],
        message: "Harga wajib diisi",
      })
    }
    return
  }

  if (values.variationAttributes.length === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["variationAttributes"],
      message: "Pilih minimal 1 atribut pembeda varian (mis. WARNA)",
    })
  }

  if (values.variations.length === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["variations"],
      message: "Produk bervariasi wajib punya minimal 1 varian",
    })
  }

  // Kombinasi atribut yang sama persis membuat pilihan di halaman produk
  // ambigu — varian mana yang dipakai saat pembeli memilih kombinasi itu?
  const seen = new Set<string>()
  values.variations.forEach((variation, index) => {
    for (const attributeName of values.variationAttributes) {
      if (!variation.attributes[attributeName]?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["variations", index, "attributes", attributeName],
          message: `${attributeName} wajib diisi`,
        })
      }
    }

    const key = values.variationAttributes
      .map((name) => (variation.attributes[name] ?? "").trim().toLowerCase())
      .join("|")
    if (seen.has(key)) {
      ctx.addIssue({
        code: "custom",
        path: ["variations", index],
        message: "Kombinasi varian ini sudah ada",
      })
    }
    seen.add(key)
  })
})

export type ProductFormValues = z.infer<typeof productFormSchema>

/**
 * Skema untuk Quick Edit, yang hanya menyunting sebagian field dan TIDAK
 * menyentuh varian sama sekali.
 *
 * Aturan "produk bervariasi wajib punya minimal 1 varian" sengaja dilewati di
 * sini: Quick Edit tidak memuat daftar varian, jadi menerapkannya akan menolak
 * penyuntingan harga/status produk bervariasi yang varian-nya baik-baik saja.
 * Kewajiban harga untuk produk simple tetap berlaku.
 */
export const quickEditFormSchema = baseProductFormSchema.superRefine((values, ctx) => {
  if (values.type === "simple" && !values.regularPrice.trim()) {
    ctx.addIssue({
      code: "custom",
      path: ["regularPrice"],
      message: "Harga wajib diisi",
    })
  }
})
