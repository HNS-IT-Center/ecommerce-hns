"use client"

import { useState } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Plus, Trash2, X } from "lucide-react"
import { useRouter } from "next/navigation"

import { productFormSchema, type ProductFormValues } from "@/lib/validators/product"
import type { ProductCategory } from "@/types/woocommerce"
import { CategoryPicker } from "./category-picker"
import { type BulkProductRow } from "./product-data-table"

const inputClass =
  "w-full rounded-xl border border-input bg-muted/50 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:bg-background"
const labelClass = "mb-1 block text-sm font-semibold"

type QuickEditModalProps = {
  product: BulkProductRow
  categories: ProductCategory[]
  onClose: () => void
}

export function QuickEditModal({ product, categories, onClose }: QuickEditModalProps) {
  const router = useRouter()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: product.name,
      description: product.rawProduct?.description || "",
      shortDescription: product.rawProduct?.short_description || "",
      regularPrice: product.rawProduct?.regular_price || String(product.price || ""),
      salePrice: product.rawProduct?.sale_price || "",
      stockQuantity: product.rawProduct?.stock_quantity || 0,
      status: (product.status === "publish" || product.status === "private" ? product.status : "draft") as "publish" | "draft" | "private",
      categoryIds: product.rawProduct?.categories?.map((c: { id: number }) => c.id) || [],
      attributes: product.rawProduct?.attributes?.map((attr: { name: string, options: string[] }) => ({
        name: attr.name,
        value: attr.options[0] || "",
      })) || [],
      imageIds: [], // We don't edit images in quick edit
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: "attributes" })
  const selectedCategoryIds = watch("categoryIds")
  const currentStatus = watch("status")

  async function onSubmit(values: ProductFormValues) {
    setSubmitError(null)

    const payload = {
      id: product.id,
      name: values.name,
      status: values.status,
      regular_price: values.regularPrice,
      sale_price: values.salePrice || "",
      stock_quantity: values.stockQuantity ?? 0,
      categories: values.categoryIds.map((id) => ({ id })),
      attributes: values.attributes.map((attr) => ({
        name: attr.name,
        options: [attr.value],
        visible: true,
      })),
      // We don't send descriptions or images to avoid overwriting them with empty data
    }

    try {
      const res = await fetch("/api/admin/products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan produk")

      router.refresh()
      onClose()
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Gagal menyimpan produk")
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-full w-full max-w-3xl flex-col rounded-2xl border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-lg font-bold">Quick Edit Produk</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-muted"
            aria-label="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 md:p-6">
          <form id="quick-edit-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {submitError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {submitError}
              </div>
            )}

            <div>
              <label className={labelClass} htmlFor="name">
                Nama Produk
              </label>
              <input id="name" {...register("name")} className={inputClass} />
              {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div>
              <p className={labelClass}>Status</p>
              <div className="flex gap-4">
                {(["publish", "draft", "private"] as const).map((status) => (
                  <label key={status} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      value={status}
                      checked={currentStatus === status}
                      {...register("status")}
                      className="h-4 w-4 text-primary"
                    />
                    <span className="capitalize">{status}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass} htmlFor="regularPrice">
                  Harga Normal (Rp)
                </label>
                <input id="regularPrice" {...register("regularPrice")} className={inputClass} />
                {errors.regularPrice && (
                  <p className="mt-1 text-xs text-destructive">{errors.regularPrice.message}</p>
                )}
              </div>
              <div>
                <label className={labelClass} htmlFor="salePrice">
                  Harga Obral (Rp, opsional)
                </label>
                <input id="salePrice" {...register("salePrice")} className={inputClass} />
              </div>
            </div>

            <div>
              <label className={labelClass} htmlFor="stockQuantity">
                Stok
              </label>
              <input
                id="stockQuantity"
                type="number"
                {...register("stockQuantity", { valueAsNumber: true })}
                className={inputClass}
              />
            </div>

            <div>
              <p className={labelClass}>Kategori</p>
              {errors.categoryIds && (
                <p className="mb-1 text-xs text-destructive">{errors.categoryIds.message}</p>
              )}
              <div className="max-h-[300px] overflow-y-auto rounded-xl border border-border">
                <CategoryPicker
                  categories={categories}
                  value={selectedCategoryIds ?? []}
                  onChange={(ids) => setValue("categoryIds", ids, { shouldValidate: true })}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <p className={labelClass}>Spesifikasi / Atribut</p>
                <button
                  type="button"
                  onClick={() => append({ name: "", value: "" })}
                  className="flex items-center gap-1 text-sm font-semibold text-brand-green hover:underline"
                >
                  <Plus className="h-4 w-4" />
                  Tambah Atribut
                </button>
              </div>
              <div className="space-y-2 mt-2">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-center gap-2">
                    <input
                      {...register(`attributes.${index}.name`)}
                      placeholder="Nama (mis. Warna)"
                      className={inputClass}
                    />
                    <input
                      {...register(`attributes.${index}.value`)}
                      placeholder="Nilai (mis. Hitam)"
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="shrink-0 rounded-lg p-2 text-destructive hover:bg-destructive/10"
                      aria-label="Hapus atribut"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {fields.length === 0 && (
                  <p className="text-sm text-muted-foreground">Belum ada atribut.</p>
                )}
              </div>
            </div>
          </form>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border p-4 bg-muted/20 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-semibold hover:bg-muted"
          >
            Batal
          </button>
          <button
            type="submit"
            form="quick-edit-form"
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Simpan
          </button>
        </div>
      </div>
    </div>
  )
}
