"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, Trash2, Loader2, X } from "lucide-react"
import { productFormSchema, type ProductFormValues } from "@/lib/validators/product"
import type { ProductCategory } from "@/types/woocommerce"

type ExistingImage = { id: number; source_url: string }

type ProdukFormProps = {
  categories: ProductCategory[]
  productId?: number
  defaultValues?: Partial<ProductFormValues>
  defaultImages?: ExistingImage[]
}

const inputClass =
  "w-full rounded-xl border border-input bg-muted/50 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:bg-background"
const labelClass = "mb-1 block text-sm font-semibold"

export function ProdukForm({ categories, productId, defaultValues, defaultImages }: ProdukFormProps) {
  const router = useRouter()
  const isEdit = Boolean(productId)
  const [images, setImages] = useState<ExistingImage[]>(defaultImages ?? [])
  const [uploading, setUploading] = useState(false)
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
      name: "",
      description: "",
      shortDescription: "",
      regularPrice: "",
      salePrice: "",
      stockQuantity: 0,
      status: "draft",
      categoryIds: [],
      attributes: [],
      imageIds: defaultImages?.map((img) => img.id) ?? [],
      ...defaultValues,
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: "attributes" })
  const selectedCategoryIds = watch("categoryIds")

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setSubmitError(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/admin/media", { method: "POST", body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Upload gagal")

      const newImages = [...images, { id: data.id, source_url: data.source_url }]
      setImages(newImages)
      setValue(
        "imageIds",
        newImages.map((img) => img.id)
      )
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Upload gambar gagal")
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  function removeImage(id: number) {
    const newImages = images.filter((img) => img.id !== id)
    setImages(newImages)
    setValue(
      "imageIds",
      newImages.map((img) => img.id)
    )
  }

  function toggleCategory(id: number) {
    const current = selectedCategoryIds ?? []
    setValue(
      "categoryIds",
      current.includes(id) ? current.filter((c) => c !== id) : [...current, id]
    )
  }

  async function onSubmit(values: ProductFormValues) {
    setSubmitError(null)

    const payload = {
      name: values.name,
      type: "simple" as const,
      status: values.status,
      description: values.description || "",
      short_description: values.shortDescription || "",
      regular_price: values.regularPrice,
      sale_price: values.salePrice || "",
      manage_stock: true,
      stock_quantity: values.stockQuantity ?? 0,
      categories: values.categoryIds.map((id) => ({ id })),
      attributes: values.attributes.map((attr) => ({
        name: attr.name,
        options: [attr.value],
        visible: true,
      })),
      images: images.map((img) => ({ url: img.source_url })),
    }

    try {
      const res = await fetch("/api/admin/products", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit ? { id: productId, ...payload } : payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan produk")

      router.push("/admin/produk")
      router.refresh()
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Gagal menyimpan produk")
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-6">
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
        <label className={labelClass} htmlFor="status">
          Status
        </label>
        <select id="status" {...register("status")} className={inputClass}>
          <option value="draft">Draft</option>
          <option value="publish">Publish</option>
        </select>
      </div>

      <div>
        <label className={labelClass} htmlFor="shortDescription">
          Deskripsi Singkat
        </label>
        <textarea id="shortDescription" {...register("shortDescription")} rows={2} className={inputClass} />
      </div>

      <div>
        <label className={labelClass} htmlFor="description">
          Deskripsi Lengkap
        </label>
        <textarea id="description" {...register("description")} rows={6} className={inputClass} />
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
        <div className="max-h-60 space-y-1 overflow-y-auto rounded-xl border border-input p-3">
          {categories.map((cat) => (
            <label key={cat.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedCategoryIds?.includes(cat.id) ?? false}
                onChange={() => toggleCategory(cat.id)}
              />
              {cat.name}
            </label>
          ))}
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
        <div className="space-y-2">
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
        </div>
      </div>

      <div>
        <p className={labelClass}>Gambar Produk</p>
        <div className="flex flex-wrap gap-3">
          {images.map((img) => (
            <div key={img.id} className="relative h-20 w-20 overflow-hidden rounded-lg border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element -- preview thumbnail dari URL WordPress dinamis */}
              <img src={img.source_url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(img.id)}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"
                aria-label="Hapus gambar"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg border border-dashed border-input text-xs text-muted-foreground hover:border-primary">
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Upload"}
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
          </label>
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
      >
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {isEdit ? "Simpan Perubahan" : "Buat Produk"}
      </button>
    </form>
  )
}
