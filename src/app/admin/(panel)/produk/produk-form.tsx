"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, Trash2, Loader2, X, QrCode, Download } from "lucide-react"
import { productFormSchema, type ProductFormValues } from "@/lib/validators/product"
import type { ProductCategory } from "@/types/woocommerce"
import { UnsavedChangesGuard } from "@/components/admin/unsaved-changes-guard"
import { QRCodeCanvas } from "qrcode.react"
import { CategoryPicker } from "./category-picker"

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
  const [isFormatting, setIsFormatting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      description: "",
      shortDescription: "",
      regularPrice: "",
      salePrice: "",
      manageStock: false,
      stockStatus: "instock",
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
      // `shouldDirty` diperlukan: tanpa itu `setValue` mengubah nilainya tanpa
      // menandai formulir berubah, sehingga mengunggah gambar lalu berpindah
      // halaman tidak memicu peringatan apa pun — padahal kaitan gambar yang
      // baru diunggah itu justru yang hilang.
      setValue(
        "imageIds",
        newImages.map((img) => img.id),
        { shouldDirty: true }
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
    // Lihat catatan `shouldDirty` pada handler unggah di atas.
    setValue(
      "imageIds",
      newImages.map((img) => img.id),
      { shouldDirty: true }
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

  async function handleFormatSpecs() {
    const currentDescription = watch("description")
    if (!currentDescription || currentDescription.trim() === "") {
      alert("Silakan masukkan teks spesifikasi ke dalam kotak deskripsi terlebih dahulu.")
      return
    }

    setIsFormatting(true)
    setSubmitError(null)

    try {
      const res = await fetch("/api/admin/format-specs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: currentDescription }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Gagal merapikan spesifikasi")
      }

      // Gunakan shouldDirty agar peringatan form berubah ikut aktif
      setValue("description", data.html, { shouldDirty: true, shouldValidate: true })
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Gagal merapikan spesifikasi")
    } finally {
      setIsFormatting(false)
    }
  }

  function downloadQRCode() {
    const canvas = document.getElementById("product-qr-code") as HTMLCanvasElement
    if (!canvas) return
    const pngUrl = canvas.toDataURL("image/png")
    const downloadLink = document.createElement("a")
    downloadLink.href = pngUrl
    downloadLink.download = `qr-produk-${productId}.png`
    document.body.appendChild(downloadLink)
    downloadLink.click()
    document.body.removeChild(downloadLink)
  }

  // URL untuk QR code. Jika belum disetel di .env, kita pakai origin window (walau berisiko kalau didownload di localhost)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "")
  const qrLink = `${siteUrl}/p/${productId}`

  // `isDirty` dari react-hook-form dipakai di sini, bukan pengamatan DOM milik
  // UnsavedChangesGuard: ia tahu bedanya "diubah" dengan "diubah lalu
  // dikembalikan ke nilai semula", jadi tidak memperingatkan tanpa sebab.
  //
  // `isSubmitting` dikurangkan supaya penyimpanan yang sedang berjalan tidak
  // memicu peringatan tepat saat `router.push` memindahkan halaman setelah
  // berhasil — formulir masih "berubah" pada detik itu, tapi perubahannya sudah
  // tersimpan.
  return (
    <UnsavedChangesGuard isDirty={isDirty && !isSubmitting}>
      <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-6">
        {submitError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {submitError}
          </div>
        )}

        {isEdit && productId && (
          <div className="rounded-xl border border-border p-4 bg-muted/20">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-white p-2 shrink-0">
                <QRCodeCanvas 
                  id="product-qr-code" 
                  value={qrLink} 
                  size={350} 
                  level="H" 
                  marginSize={1}
                  style={{ width: 120, height: 120 }}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-primary">
                  <QrCode className="h-5 w-5" />
                  <h3 className="font-semibold text-lg">QR Code Produk</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  QR Code ini berisi tautan pintar ke produk ini. Jika Anda mengubah nama atau URL produk di masa depan, QR Code ini <strong>tetap akan berfungsi</strong> karena menggunakan ID permanen.
                </p>
                <div className="pt-2 flex items-center gap-3">
                  <button 
                    type="button" 
                    onClick={downloadQRCode}
                    className="flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
                  >
                    <Download className="h-4 w-4" />
                    Download QR Code
                  </button>
                  <code className="text-xs px-2 py-1 bg-muted rounded truncate max-w-[200px]" title={qrLink}>
                    {qrLink}
                  </code>
                </div>
              </div>
            </div>
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
            <option value="private">Private</option>
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="shortDescription">
            Deskripsi Singkat
          </label>
          <textarea id="shortDescription" {...register("shortDescription")} rows={2} className={inputClass} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-semibold" htmlFor="description">
              Deskripsi Lengkap (Spesifikasi)
            </label>
            <button
              type="button"
              onClick={handleFormatSpecs}
              disabled={isFormatting}
              className="flex items-center gap-1.5 rounded-md bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700 transition-colors hover:bg-purple-200 disabled:opacity-50"
            >
              {isFormatting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <span className="text-sm leading-none">✨</span>
              )}
              Rapikan dengan AI
            </button>
          </div>
          <textarea id="description" {...register("description")} rows={8} className={inputClass} placeholder="Paste spesifikasi berantakan di sini, lalu klik Rapikan dengan AI..." />
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
          <CategoryPicker
            categories={categories}
            value={selectedCategoryIds ?? []}
            onChange={(ids) => setValue("categoryIds", ids, { shouldValidate: true })}
          />
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
    </UnsavedChangesGuard>
  )
}
