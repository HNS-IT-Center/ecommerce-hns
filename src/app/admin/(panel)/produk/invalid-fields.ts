import type { FieldErrors } from "react-hook-form"
import type { useToastManager } from "@/components/ui/toast"
import type { ProductFormValues } from "@/lib/validators/product"
import { revealInvalidFields } from "@/lib/utils/reveal-invalid-fields"

type ToastManager = ReturnType<typeof useToastManager>

/**
 * Kolom yang gagal validasi: `key` sama dengan `data-field` pembungkusnya di
 * form (dibaca `revealInvalidFields`), `label` untuk toast ke staff.
 */
export type InvalidField = { key: string; label: string }

const LABELS: Partial<Record<keyof ProductFormValues, string>> = {
  name: "Nama Produk",
  sku: "SKU",
  regularPrice: "Harga Normal",
  salePrice: "Harga Promo",
  stockQuantity: "Jumlah Stok",
  categoryIds: "Kategori",
  variationAttributes: "Atribut pembeda varian",
  variations: "Daftar varian",
  attributes: "Spesifikasi",
  videoUrl: "Video",
  brand: "Brand",
}

/**
 * Daftar kolom bermasalah dari `errors` react-hook-form — dipakai form produk
 * dan Quick Edit.
 *
 * Kolom array (`variations`, `attributes`) dipecah per baris supaya barisnya
 * yang dinyalakan, bukan seluruh daftar. Galat array-nya JARANG (sparse): baris
 * yang benar berupa lubang, jadi dilewati dengan `forEach` (yang melompati
 * lubang), sama seperti `variationRowErrors` di produk-form.tsx.
 */
export function listInvalidProductFields(errors: FieldErrors<ProductFormValues>): InvalidField[] {
  const result: InvalidField[] = []

  for (const key of Object.keys(errors) as (keyof ProductFormValues)[]) {
    const error = errors[key]
    if (!error) continue
    const label = LABELS[key] ?? key

    if ((key === "variations" || key === "attributes") && Array.isArray(error)) {
      const rowLabel = key === "variations" ? "Varian" : "Spesifikasi baris"
      error.forEach((row: unknown, index: number) => {
        if (row) result.push({ key: `${key}.${index}`, label: `${rowLabel} #${index + 1}` })
      })
      continue
    }

    result.push({ key, label })
  }

  return result
}

/**
 * `onInvalid` untuk `handleSubmit` form produk & Quick Edit: gulir ke kolom
 * bermasalah pertama, nyalakan semuanya 3 detik, dan sebutkan semuanya di
 * toast — kolom yang jauh di bawah mungkin sudah padam sebelum staff sampai ke
 * sana, tapi namanya tetap terbaca di toast.
 *
 * Form-nya wajib memasang `shouldFocusError: false`: bawaan react-hook-form
 * memfokuskan kolom ber-ref SETELAH `onInvalid` berjalan, dan fokus itu
 * menggulir halaman ke Nama Produk walau kolom pertama di layar adalah yang lain.
 */
export function announceInvalidProductFields(
  errors: FieldErrors<ProductFormValues>,
  root: ParentNode | null,
  toastManager: ToastManager,
) {
  const fields = listInvalidProductFields(errors)
  if (fields.length === 0) return
  revealInvalidFields(
    root,
    fields.map((f) => f.key),
  )
  toastManager.add({
    title: "Belum bisa disimpan",
    description: `${fields.length === 1 ? "Periksa kolom" : `Periksa ${fields.length} kolom`}: ${joinFieldLabels(fields)}.`,
    data: { variant: "danger" },
  })
}

/** "a", "a dan b", "a, b dan c" — untuk deskripsi toast. */
function joinFieldLabels(fields: InvalidField[]): string {
  const labels = fields.map((f) => f.label)
  if (labels.length <= 1) return labels[0] ?? ""
  return `${labels.slice(0, -1).join(", ")} dan ${labels[labels.length - 1]}`
}
