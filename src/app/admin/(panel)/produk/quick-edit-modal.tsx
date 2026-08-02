"use client"

import { useState } from "react"
import { useForm, useFieldArray, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Plus, Trash2, X } from "lucide-react"
import { useRouter } from "next/navigation"

import { productFormSchema, type ProductFormValues } from "@/lib/validators/product"
import type { ProductCategory } from "@/types/woocommerce"
import { CategoryPicker } from "./category-picker"
import { type BulkProductRow } from "./product-data-table"
import { formatRupiah, parseRupiah } from "@/lib/utils"

const inputClass =
  "w-full rounded-xl border border-input bg-muted/50 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:bg-background"
const labelClass = "mb-1 block text-sm font-semibold"

type QuickEditModalProps = {
  product: BulkProductRow
  categories: ProductCategory[]
  onClose: () => void
}

function formatPriceInput(value: string | number) {
  const parsed = parseRupiah(String(value))
  if (parsed === 0 && !String(value).includes("0")) return ""
  return formatRupiah(parsed)
}

export function QuickEditModal({ product, categories, onClose }: QuickEditModalProps) {
  const router = useRouter()
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Derive initial stock mode
  let initialStockMode: "instock" | "outofstock" | "manage" = "instock"
  if (product.rawProduct?.manage_stock) {
    initialStockMode = "manage"
  } else if (product.rawProduct?.stock_status === "outofstock") {
    initialStockMode = "outofstock"
  }

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
      salePriceDateEnd: product.rawProduct?.date_on_sale_to_gmt ? product.rawProduct.date_on_sale_to_gmt.split("T")[0] : "",
      manageStock: product.rawProduct?.manage_stock || false,
      stockStatus: (product.rawProduct?.stock_status as any) || "instock",
      stockQuantity: product.rawProduct?.stock_quantity || 0,
      status: (product.status === "publish" || product.status === "private" ? product.status : "draft") as "publish" | "draft" | "private",
      categoryIds: product.rawProduct?.categories?.map((c: { id: number }) => c.id) || [],
      attributes: product.rawProduct?.attributes?.map((attr: { name: string, options: string[] }) => ({
        name: attr.name,
        value: attr.options[0] || "",
      })) || [],
      imageIds: [],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: "attributes" })
  const selectedCategoryIds = watch("categoryIds")
  const currentStatus = watch("status")

  const [stockMode, setStockMode] = useState<"instock" | "outofstock" | "manage">(initialStockMode)

  async function onSubmit(values: ProductFormValues) {
    setSubmitError(null)

    // Parse the display prices back to raw numeric strings for the API
    const rawRegularPrice = String(parseRupiah(values.regularPrice))
    const rawSalePrice = values.salePrice ? String(parseRupiah(values.salePrice)) : ""

    const payload = {
      id: product.id,
      name: values.name,
      status: values.status,
      regular_price: rawRegularPrice,
      sale_price: rawSalePrice,
      date_on_sale_to_gmt: values.salePriceDateEnd || "",
      manage_stock: stockMode === "manage",
      stock_status: stockMode === "manage" ? undefined : (stockMode === "outofstock" ? "outofstock" : "instock"),
      stock_quantity: stockMode === "manage" ? values.stockQuantity : undefined,
      categories: values.categoryIds.map((id) => ({ id })),
      attributes: values.attributes.map((attr) => ({
        name: attr.name,
        options: [attr.value],
        visible: true,
      })),
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
      <div className="flex max-h-full w-full max-w-4xl flex-col rounded-2xl border border-border bg-background shadow-2xl">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="space-y-4">
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
                      Harga Normal
                    </label>
                    <Controller
                      name="regularPrice"
                      control={control}
                      render={({ field }) => (
                        <input
                          id="regularPrice"
                          value={field.value ? formatPriceInput(field.value) : ""}
                          onChange={(e) => field.onChange(e.target.value)}
                          className={inputClass}
                          placeholder="Rp 0"
                        />
                      )}
                    />
                    {errors.regularPrice && (
                      <p className="mt-1 text-xs text-destructive">{errors.regularPrice.message}</p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="salePrice">
                      Harga Obral
                    </label>
                    <Controller
                      name="salePrice"
                      control={control}
                      render={({ field }) => (
                        <input
                          id="salePrice"
                          value={field.value ? formatPriceInput(field.value) : ""}
                          onChange={(e) => field.onChange(e.target.value)}
                          className={inputClass}
                          placeholder="Rp 0"
                        />
                      )}
                    />
                  </div>
                </div>
                
                <div>
                  <label className={labelClass} htmlFor="salePriceDateEnd">
                    Batas Akhir Obral (Opsional)
                  </label>
                  <input 
                    id="salePriceDateEnd" 
                    type="date"
                    {...register("salePriceDateEnd")} 
                    className={inputClass} 
                  />
                  <p className="text-xs text-muted-foreground mt-1">Setelah tanggal ini, harga akan kembali ke Harga Normal secara otomatis.</p>
                </div>

                <div>
                  <p className={labelClass}>Status Stok</p>
                  <div className="flex flex-col gap-2">
                    <select
                      value={stockMode}
                      onChange={(e) => setStockMode(e.target.value as any)}
                      className={inputClass}
                    >
                      <option value="instock">Tersedia (In Stock)</option>
                      <option value="outofstock">Kosong (Out of Stock)</option>
                      <option value="manage">Isi Jumlah Stok</option>
                    </select>
                    
                    {stockMode === "manage" && (
                      <div className="mt-2">
                        <label className="mb-1 block text-xs font-semibold" htmlFor="stockQuantity">
                          Jumlah Stok Saat Ini
                        </label>
                        <input
                          id="stockQuantity"
                          type="text"
                          pattern="[0-9]*"
                          inputMode="numeric"
                          {...register("stockQuantity", { valueAsNumber: true })}
                          className={inputClass}
                          placeholder="0"
                        />
                      </div>
                    )}
                  </div>
                </div>

              </div>

              <div className="space-y-4">
                <div>
                  <p className={labelClass}>Kategori</p>
                  {errors.categoryIds && (
                    <p className="mb-1 text-xs text-destructive">{errors.categoryIds.message}</p>
                  )}
                  <div className="max-h-[400px] overflow-y-auto rounded-xl border border-border p-2">
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
                      <div key={field.id} className="flex flex-col gap-2 rounded-xl border border-border p-3 bg-muted/10">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-muted-foreground">Atribut #{index + 1}</span>
                          <button
                            type="button"
                            onClick={() => remove(index)}
                            className="rounded p-1 text-destructive hover:bg-destructive/10"
                            aria-label="Hapus atribut"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
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
                        </div>
                      </div>
                    ))}
                    {fields.length === 0 && (
                      <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-xl border border-border border-dashed text-center">
                        Belum ada atribut khusus untuk produk ini.
                      </p>
                    )}
                  </div>
                </div>
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
