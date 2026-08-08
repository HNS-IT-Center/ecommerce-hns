"use client"

import * as React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Plus,
  Loader2,
  QrCode,
  Download,
  Sparkles,
  PackageSearch,
  Wallet,
  Layers,
  Lock,
  FolderTree,
  Images,
  CheckCircle2,
  XCircle,
  Tag,
  TriangleAlert,
} from "lucide-react"
import { productFormSchema, type ProductFormValues } from "@/lib/validators/product"
import type { ProductCategory, ProductAttributeTaxonomy } from "@/types/woocommerce"
import type { Brand } from "@/lib/api/woocommerce/brands"
import { UnsavedChangesGuard } from "@/components/admin/unsaved-changes-guard"
import { QRCodeCanvas } from "qrcode.react"
import { CategoryPicker } from "./category-picker"
import { AttributeRow } from "./attribute-row"
import { ImageUploader, type ProductImageItem } from "./image-uploader"
import { VideoUploader } from "./video-uploader"
import { SpecEditor } from "./spec-editor"
import { VariationEditor } from "./variation-editor"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { RupiahInput } from "@/components/ui/rupiah-input"
import { Combobox } from "@/components/ui/combobox"
import { useToastManager } from "@/components/ui/toast"
import { requestAi } from "@/lib/utils/ai-request"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn, formatRupiah } from "@/lib/utils"

type ProdukFormProps = {
  categories: ProductCategory[]
  attributeOptions: ProductAttributeTaxonomy[]
  brands: Brand[]
  productId?: number
  defaultValues?: Partial<ProductFormValues>
  defaultImages?: ProductImageItem[]
}

const STATUS_OPTIONS = [
  { value: "publish", label: "Publish", hint: "Langsung tayang di toko", color: "text-success" },
  { value: "draft", label: "Draft", hint: "Disimpan, belum tayang", color: "text-muted-foreground" },
  { value: "private", label: "Private", hint: "Tayang, tapi tersembunyi", color: "text-info" },
] as const

/** Ukuran teks isian di seluruh form ini. Perlu varian `md:` juga supaya menang
 *  atas `text-base md:text-sm` bawaan komponen Input saat kelasnya digabung. */
const FIELD_TEXT = "text-xs md:text-xs"

const TEXTAREA_CLASS =
  "w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

/** Oranye khas Groq — kedua aksi AI di form ini memang ditenagai Groq. */
const AI_BUTTON_CLASS =
  "gap-1.5 bg-[#F55036]/10 text-[#F55036] hover:bg-[#F55036]/20 dark:bg-[#F55036]/15 dark:text-[#FF8A6B] dark:hover:bg-[#F55036]/25"

function SectionHeading({
  icon: Icon,
  title,
  accent,
}: {
  icon: React.ElementType
  title: string
  accent: string
}) {
  return (
    <CardTitle className="flex items-center gap-2 text-[15px]">
      <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", accent)}>
        <Icon className="h-4 w-4" />
      </span>
      {title}
    </CardTitle>
  )
}

export function ProdukForm({
  categories,
  attributeOptions,
  brands,
  productId,
  defaultValues,
  defaultImages,
}: ProdukFormProps) {
  const router = useRouter()
  const toastManager = useToastManager()
  const isEdit = Boolean(productId)
  const [images, setImages] = useState<ProductImageItem[]>(defaultImages ?? [])
  const [isFormatting, setIsFormatting] = useState(false)
  const [isGeneratingShort, setIsGeneratingShort] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingValues, setPendingValues] = useState<ProductFormValues | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [aiWaitSeconds, setAiWaitSeconds] = useState(0)

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      type: "simple",
      description: "",
      shortDescription: "",
      regularPrice: "",
      salePrice: "",
      salePriceDateEnd: "",
      variationAttributes: [],
      variations: [],
      manageStock: false,
      stockStatus: "instock",
      stockQuantity: undefined,
      status: "publish",
      categoryIds: [],
      attributes: [],
      imageIds: defaultImages?.map((img) => img.id) ?? [],
      videoUrl: "",
      brand: "",
      ...defaultValues,
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: "attributes" })
  const selectedCategoryIds = watch("categoryIds")
  const productType = watch("type")
  const variationAttributes = watch("variationAttributes") ?? []
  const variations = watch("variations") ?? []
  const isVariableProduct = productType === "variable"
  const hasExistingVariations = (defaultValues?.variations?.length ?? 0) > 0

  /**
   * Pesan galat per baris varian, dikunci indeksnya.
   *
   * `errors.variations` dari react-hook-form adalah array JARANG (sparse):
   * indeks yang barisnya tidak bermasalah berisi lubang, dan `Array.prototype.map`
   * mempertahankan lubang itu apa adanya. Melewatkannya langsung ke
   * `Object.fromEntries` melempar "Iterator value undefined is not an entry
   * object" — persis yang terjadi saat admin menambah baris varian baru, karena
   * baris kosong itu membuat sebagian indeks bermasalah dan sebagian tidak.
   *
   * Karena itu dirakit dengan perulangan biasa yang melewati entri kosong,
   * bukan `map` + `fromEntries`.
   */
  const variationRowErrors = React.useMemo(() => {
    const rows = errors.variations
    if (!Array.isArray(rows)) return {}

    const result: Record<number, string | undefined> = {}
    rows.forEach((rowError, index) => {
      if (!rowError) return
      const message =
        rowError.message ??
        rowError.regularPrice?.message ??
        rowError.attributes?.message
      if (message) result[index] = message
    })
    return result
  }, [errors.variations])

  // Saran untuk baris Spesifikasi, tanpa atribut yang sedang dipakai sebagai
  // pembeda varian — perannya per produk, jadi penyaringan ini juga per produk
  // dan tidak mengubah master atribut.
  const selectableAttributeOptions = React.useMemo(() => {
    if (!isVariableProduct || variationAttributes.length === 0) return attributeOptions
    const taken = new Set(variationAttributes.map((name) => name.trim().toLowerCase()))
    return attributeOptions.filter((attr) => !taken.has(attr.name.trim().toLowerCase()))
  }, [isVariableProduct, variationAttributes, attributeOptions])
  const description = watch("description") ?? ""
  const regularPrice = watch("regularPrice") ?? ""
  const salePrice = watch("salePrice") ?? ""
  const salePriceDateEnd = watch("salePriceDateEnd") ?? ""
  const stockStatus = watch("stockStatus")
  const videoUrl = watch("videoUrl") ?? ""
  const status = watch("status")
  const brand = watch("brand") ?? ""

  const brandOptions = brands.map((b) => ({ id: b.id, label: b.name }))

  function syncImages(next: ProductImageItem[]) {
    setImages(next)
    // `shouldDirty` diperlukan: tanpa itu `setValue` mengubah nilainya tanpa
    // menandai formulir berubah, sehingga menambah/mengurutkan gambar lalu
    // berpindah halaman tidak memicu peringatan apa pun.
    setValue(
      "imageIds",
      next.map((img) => img.id),
      { shouldDirty: true }
    )
  }

  /**
   * Unggah gambar yang masih ditahan di browser, lalu kembalikan URL final
   * dalam urutan yang sama persis dengan yang terlihat di galeri — urutan itu
   * yang menentukan gambar utama di sisi pembeli.
   */
  /**
   * Unggah gambar varian yang masih ditahan di klien.
   *
   * Mengembalikan URL per indeks varian; indeks yang gambarnya tidak diganti
   * bernilai `undefined` sehingga pemanggil bisa mempertahankan URL lama.
   *
   * Dijalankan bersama unggahan galeri utama saat Simpan ditekan — bukan saat
   * berkas dipilih — supaya membatalkan form tidak meninggalkan berkas yatim
   * di R2.
   */
  async function uploadPendingVariationImages(
    variations: ProductFormValues["variations"],
  ): Promise<(string | undefined)[]> {
    const pending = variations.filter((v) => v.imageFile).length
    if (pending === 0) return variations.map(() => undefined)

    const urls: (string | undefined)[] = []
    let uploaded = 0

    for (const variation of variations) {
      if (!variation.imageFile) {
        urls.push(undefined)
        continue
      }

      uploaded += 1
      setUploadProgress(`Mengunggah gambar varian ${uploaded} dari ${pending}…`)

      const formData = new FormData()
      formData.append("file", variation.imageFile)
      const res = await fetch("/api/admin/media", { method: "POST", body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Upload gambar varian gagal")
      urls.push(data.source_url as string)
    }

    setUploadProgress(null)
    return urls
  }

  async function uploadPendingImages(): Promise<string[]> {
    const urls: string[] = []
    let uploaded = 0
    const pendingTotal = images.filter((img) => img.file).length

    for (const image of images) {
      if (!image.file) {
        if (image.uploadedUrl) urls.push(image.uploadedUrl)
        continue
      }

      uploaded += 1
      setUploadProgress(`Mengunggah gambar ${uploaded} dari ${pendingTotal}…`)

      const formData = new FormData()
      formData.append("file", image.file)
      const res = await fetch("/api/admin/media", { method: "POST", body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Upload gambar gagal")
      urls.push(data.source_url as string)
    }

    setUploadProgress(null)
    return urls
  }

  function onValidated(values: ProductFormValues) {
    setSubmitError(null)
    setPendingValues(values)
    setConfirmOpen(true)
  }

  async function saveProduct() {
    if (!pendingValues) return
    const values = pendingValues

    setConfirmOpen(false)
    setIsSaving(true)
    setSubmitError(null)

    try {
      const imageUrls = await uploadPendingImages()
      const variationImageUrls = await uploadPendingVariationImages(values.variations)

      const payload = {
        name: values.name,
        // Dulu dipatok "simple". Saat admin menyimpan produk bervariasi, tipenya
        // ikut turun jadi simple dan seluruh varian kehilangan induk — data
        // rusak diam-diam tanpa pesan error. Sekarang tipenya ikut pilihan form.
        type: values.type,
        status: values.status,
        description: values.description || "",
        short_description: values.shortDescription || "",
        regular_price: values.regularPrice,
        sale_price: values.salePrice || "",
        // Tanggal dari <input type="date"> tidak berzona waktu. Diakhiri pada
        // penghujung hari yang dipilih supaya obral masih berlaku sepanjang
        // tanggal itu, bukan berhenti pada dini hari.
        date_on_sale_to_gmt:
          values.salePrice && values.salePriceDateEnd
            ? new Date(`${values.salePriceDateEnd}T23:59:59`).toISOString()
            : "",
        manage_stock: values.stockStatus === "instock" && values.stockQuantity !== undefined,
        stock_status: values.stockStatus,
        // `null`, bukan 0, saat jumlah tidak diisi.
        //
        // "Tersedia" tanpa angka berarti stok TIDAK dilacak per jumlah — barang
        // ada, jumlahnya saja yang tidak dihitung. Mengirim 0 membuat server
        // membacanya sebagai "stok nol" lalu menurunkan statusnya jadi habis,
        // sehingga produk yang baru saja ditandai tersedia langsung tampil
        // "Stok Habis" di toko.
        stock_quantity: values.stockStatus === "instock" ? values.stockQuantity ?? null : null,
        categories: values.categoryIds.map((id) => ({ id })),
        // Baris tanpa nilai disaring: admin bisa saja mengetik nama atribut
        // lalu berpindah tanpa mengisinya, dan atribut kosong tidak punya arti
        // di halaman produk.
        attributes: values.attributes
          .filter((attr) => attr.name.trim() && attr.values.length > 0)
          .map((attr) => ({
            name: attr.name,
            options: attr.values,
            visible: true,
          })),
        // Dikirim hanya untuk produk bervariasi. Pada produk simple, field ini
        // sengaja dibiarkan undefined supaya server tidak menyentuh varian sama
        // sekali — mengirim array kosong justru berarti "hapus semua varian".
        ...(values.type === "variable" && {
          variation_attributes: values.variationAttributes,
          variations: values.variations.map((variation, index) => ({
            id: variation.id,
            attributes: variation.attributes,
            sku: variation.sku || "",
            regular_price: variation.regularPrice,
            sale_price: variation.salePrice || "",
            stock_status: variation.stockStatus,
            stock_quantity: variation.stockQuantity,
            // URL hasil unggahan menang atas URL lama: kalau admin mengganti
            // gambar varian, berkas baru itulah yang dipakai.
            image_url: variationImageUrls[index] ?? variation.imageUrl ?? null,
          })),
        }),
        images: imageUrls.map((url) => ({ url })),
        video_url: values.videoUrl || null,
        brand: values.brand || null,
      }

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
      setUploadProgress(null)
      setIsSaving(false)
      setSubmitError(error instanceof Error ? error.message : "Gagal menyimpan produk")
    }
  }

  async function handleFormatSpecs() {
    if (!description.trim()) {
      setSubmitError("Silakan tulis spesifikasi terlebih dahulu sebelum merapikan dengan AI.")
      return
    }

    setIsFormatting(true)
    setSubmitError(null)
    try {
      const data = await requestAi<{ html: string; count: number }>(
        "/api/admin/format-specs",
        { text: description },
        { onWaiting: setAiWaitSeconds }
      )
      setValue("description", data.html, { shouldDirty: true, shouldValidate: true })
      toastManager.add({
        title: "Spesifikasi berhasil dirapikan",
        description: `${data.count} baris spesifikasi berhasil disusun.`,
        data: { variant: "success" },
      })
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Gagal merapikan spesifikasi")
    } finally {
      setAiWaitSeconds(0)
      setIsFormatting(false)
    }
  }

  async function handleGenerateShortDescription() {
    if (!description.trim()) {
      setSubmitError("Isi Deskripsi Lengkap (Spesifikasi) dulu — AI memakainya sebagai referensi.")
      return
    }

    setIsGeneratingShort(true)
    setSubmitError(null)
    try {
      const data = await requestAi<{ text: string }>(
        "/api/admin/generate-short-description",
        { description },
        { onWaiting: setAiWaitSeconds }
      )
      setValue("shortDescription", data.text, { shouldDirty: true, shouldValidate: true })
      toastManager.add({
        title: "Deskripsi singkat berhasil dibuat",
        description: "Diringkas dari Deskripsi Lengkap (Spesifikasi).",
        data: { variant: "success" },
      })
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Gagal membuat deskripsi singkat")
    } finally {
      setAiWaitSeconds(0)
      setIsGeneratingShort(false)
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

  // Origin yang sedang dibuka lebih dulu, baru env sebagai cadangan saat SSR:
  // urutan sebaliknya membuat QR di panel production ikut menunjuk localhost
  // kalau NEXT_PUBLIC_SITE_URL belum disesuaikan per-lingkungan.
  const siteUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL || ""
  const qrLink = `${siteUrl}/p/${productId}`

  return (
    <UnsavedChangesGuard isDirty={isDirty && !isSaving}>
      <form onSubmit={handleSubmit(onValidated)} className="space-y-6">
        {/* Bilah aksi di atas & lengket: formulir ini panjang, dan tombol simpan
            di dasar halaman berarti harus menggulir jauh ke bawah setiap kali
            ingin menyimpan. */}
        <div className="sticky top-0 z-30 -mx-1 flex items-center justify-between gap-3 rounded-xl border border-border bg-background/85 px-3 py-2.5 backdrop-blur-md">
          <p className="text-xs text-muted-foreground">
            {isDirty ? "Ada perubahan yang belum disimpan." : "Belum ada perubahan."}
          </p>
          <div className="flex items-center gap-3">
            {uploadProgress && (
              <span className="text-xs text-muted-foreground">{uploadProgress}</span>
            )}
            <Button type="submit" disabled={isSaving} className="gap-2">
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Simpan Perubahan" : "Buat Produk"}
            </Button>
          </div>
        </div>

        {aiWaitSeconds > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-xs text-warning">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            Kuota AI per menit sedang penuh — mencoba lagi otomatis dalam {aiWaitSeconds} detik…
          </div>
        )}

        {submitError && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {submitError}
          </div>
        )}

        {isEdit && productId && (
          <Card>
            <CardContent className="flex items-start gap-4">
              <div className="shrink-0 rounded-lg bg-white p-2">
                <QRCodeCanvas
                  id="product-qr-code"
                  value={qrLink}
                  size={350}
                  level="H"
                  marginSize={1}
                  style={{ width: 110, height: 110 }}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-primary">
                  <QrCode className="h-5 w-5" />
                  <h3 className="text-base font-semibold">QR Code Produk</h3>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Tautan pintar ke produk ini. Tetap berfungsi walau nama/URL produk berubah, karena
                  memakai ID permanen.
                </p>
                <div className="flex items-center gap-3 pt-1">
                  <Button type="button" variant="secondary" size="sm" onClick={downloadQRCode}>
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </Button>
                  <code
                    className="max-w-[200px] truncate rounded bg-muted px-2 py-1 text-[11px]"
                    title={qrLink}
                  >
                    {qrLink}
                  </code>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
          {/* Kolom Kiri — info utama */}
          <div className="min-w-0 space-y-6">
            <Card>
              <CardHeader>
                <SectionHeading
                  icon={PackageSearch}
                  title="Informasi Dasar"
                  accent="bg-primary/10 text-primary"
                />
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="name" className="mb-1.5">
                    Nama Produk
                  </Label>
                  {/* Textarea 2 baris, bukan input 1 baris: nama produk IT panjang
                      ("LAPTOP ASUS ROG STRIX G16 i9-13980HX RTX4070 …") dan kalau
                      hanya satu baris, ujungnya tidak pernah terlihat saat diperiksa. */}
                  <textarea
                    id="name"
                    rows={2}
                    {...register("name", {
                      setValueAs: (v: unknown) => String(v ?? "").replace(/\s*\n+\s*/g, " ").trim(),
                    })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.preventDefault()
                    }}
                    className={cn(TEXTAREA_CLASS, "resize-none")}
                  />
                  {errors.name && (
                    <p className="mt-1 text-[11px] text-destructive">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <Label className="mb-2">Status</Label>
                  <RadioGroup
                    value={status}
                    onValueChange={(val) =>
                      setValue("status", val as ProductFormValues["status"], { shouldDirty: true })
                    }
                    className="flex flex-col gap-2 sm:flex-row sm:gap-3"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className={cn(
                          "flex flex-1 cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-colors",
                          status === opt.value
                            ? "border-primary bg-primary/5"
                            : "border-input hover:bg-muted/40"
                        )}
                      >
                        <RadioGroupItem value={opt.value} />
                        <span>
                          <span
                            className={cn(
                              "block text-xs font-semibold",
                              status === opt.value && opt.color
                            )}
                          >
                            {opt.label}
                          </span>
                          <span className="block text-[11px] text-muted-foreground">{opt.hint}</span>
                        </span>
                      </label>
                    ))}
                  </RadioGroup>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <Label htmlFor="shortDescription">Deskripsi Singkat</Label>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleGenerateShortDescription}
                      disabled={isGeneratingShort}
                      className={AI_BUTTON_CLASS}
                    >
                      {isGeneratingShort ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      Buat dengan AI
                    </Button>
                  </div>
                  <textarea
                    id="shortDescription"
                    {...register("shortDescription")}
                    rows={5}
                    className={TEXTAREA_CLASS}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Tombol AI meringkas dari Deskripsi Lengkap (Spesifikasi) di bawah.
                  </p>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <Label htmlFor="description">Deskripsi Lengkap (Spesifikasi)</Label>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleFormatSpecs}
                      disabled={isFormatting}
                      className={AI_BUTTON_CLASS}
                    >
                      {isFormatting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      Rapikan dengan AI
                    </Button>
                  </div>
                  <SpecEditor
                    value={description}
                    onChange={(html) => setValue("description", html, { shouldDirty: true })}
                    placeholder="Tulis atau tempel spesifikasi produk di sini…"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <SectionHeading icon={Wallet} title="Harga & Stok" accent="bg-success/10 text-success" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="mb-2">Tipe Produk</Label>
                  <RadioGroup
                    value={productType}
                    onValueChange={(val) =>
                      setValue("type", val as ProductFormValues["type"], {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    className="flex flex-col gap-2 sm:flex-row sm:gap-3"
                  >
                    {[
                      { value: "simple", label: "Produk Biasa", hint: "Satu harga, satu stok" },
                      {
                        value: "variable",
                        label: "Produk Bervariasi",
                        hint: "Punya pilihan (warna/ukuran) dengan harga & stok sendiri",
                      },
                    ].map((option) => (
                      <label
                        key={option.value}
                        className={cn(
                          "flex flex-1 cursor-pointer items-start gap-2 rounded-lg border p-2.5 transition-colors",
                          productType === option.value
                            ? "border-primary bg-primary/5"
                            : "border-input hover:border-primary/50",
                        )}
                      >
                        <RadioGroupItem value={option.value} className="mt-0.5" />
                        <span>
                          <span className="block text-xs font-semibold">{option.label}</span>
                          <span className="block text-[11px] text-muted-foreground">{option.hint}</span>
                        </span>
                      </label>
                    ))}
                  </RadioGroup>
                  {isVariableProduct && hasExistingVariations && (
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      Produk ini punya {defaultValues?.variations?.length} varian. Untuk mengubahnya jadi
                      produk biasa, hapus semua varian dulu di tabel di bawah.
                    </p>
                  )}
                </div>

                {isVariableProduct && (
                  <div className="rounded-xl border border-border p-3">
                    <Label className="mb-2 block">Varian Produk</Label>
                    <VariationEditor
                      attributes={variationAttributes}
                      onAttributesChange={(next) =>
                        setValue("variationAttributes", next, { shouldDirty: true, shouldValidate: true })
                      }
                      variations={variations}
                      onVariationsChange={(next) =>
                        setValue("variations", next, { shouldDirty: true, shouldValidate: true })
                      }
                      attributeOptions={attributeOptions}
                      // Hanya gambar yang sudah punya URL: berkas yang masih
                      // menunggu diunggah belum bisa dirujuk varian.
                      galleryImages={images
                        .filter((img) => img.uploadedUrl)
                        .map((img) => ({ id: img.id, url: img.uploadedUrl! }))}
                      attributesError={errors.variationAttributes?.message}
                      variationsError={
                        Array.isArray(errors.variations)
                          ? undefined
                          : errors.variations?.message
                      }
                      errors={variationRowErrors}
                    />
                  </div>
                )}

                <div
                  className={cn(
                    "grid grid-cols-1 gap-4 sm:grid-cols-2",
                    // Produk bervariasi tidak punya harga sendiri — harganya nempel
                    // di tiap varian, dan halaman produk menampilkan "mulai dari"
                    // varian termurah.
                    isVariableProduct && "hidden",
                  )}
                >
                  <div>
                    <Label htmlFor="regularPrice" className="mb-1.5">
                      Harga Normal
                    </Label>
                    <RupiahInput
                      id="regularPrice"
                      className={FIELD_TEXT}
                      value={regularPrice}
                      onValueChange={(v) =>
                        setValue("regularPrice", v, { shouldDirty: true, shouldValidate: true })
                      }
                    />
                    {errors.regularPrice && (
                      <p className="mt-1 text-[11px] text-destructive">
                        {errors.regularPrice.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="salePrice" className="mb-1.5">
                      Harga Obral (opsional)
                    </Label>
                    <RupiahInput
                      id="salePrice"
                      className={FIELD_TEXT}
                      value={salePrice}
                      onValueChange={(v) => setValue("salePrice", v, { shouldDirty: true })}
                    />
                  </div>
                </div>

                {/* Selalu terlihat, tidak lagi muncul-hilang mengikuti Harga
                    Obral: kolom yang menampakkan diri sendiri membuat orang
                    mengira fiturnya tidak ada. Dinonaktifkan saja saat belum
                    relevan, lengkap dengan alasannya. */}
                <div>
                  <Label htmlFor="salePriceDateEnd" className="mb-1.5">
                    Obral Berlaku Sampai (opsional)
                  </Label>
                  <Input
                    id="salePriceDateEnd"
                    type="date"
                    disabled={!salePrice}
                    className={cn(FIELD_TEXT, "w-full sm:w-56")}
                    {...register("salePriceDateEnd")}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {salePrice
                      ? "Lewat tanggal ini harga otomatis kembali ke Harga Normal — tanpa perlu diubah manual. Kosongkan kalau obral tidak dibatasi waktu."
                      : "Isi Harga Obral dulu untuk mengatur batas waktunya."}
                  </p>
                </div>

                <div>
                  <Label className="mb-2">Ketersediaan Stok</Label>
                  <RadioGroup
                    value={stockStatus}
                    onValueChange={(val) =>
                      setValue("stockStatus", val as ProductFormValues["stockStatus"], {
                        shouldDirty: true,
                      })
                    }
                    className="flex flex-col gap-2 sm:flex-row sm:gap-3"
                  >
                    <label
                      className={cn(
                        "flex flex-1 cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-colors",
                        stockStatus === "instock"
                          ? "border-success bg-success/5"
                          : "border-input hover:bg-muted/40"
                      )}
                    >
                      <RadioGroupItem value="instock" />
                      <CheckCircle2
                        className={cn(
                          "h-4 w-4",
                          stockStatus === "instock" ? "text-success" : "text-muted-foreground"
                        )}
                      />
                      <span className="text-xs font-semibold">Tersedia</span>
                    </label>
                    <label
                      className={cn(
                        "flex flex-1 cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-colors",
                        stockStatus === "outofstock"
                          ? "border-destructive bg-destructive/5"
                          : "border-input hover:bg-muted/40"
                      )}
                    >
                      <RadioGroupItem value="outofstock" />
                      <XCircle
                        className={cn(
                          "h-4 w-4",
                          stockStatus === "outofstock" ? "text-destructive" : "text-muted-foreground"
                        )}
                      />
                      <span className="text-xs font-semibold">Stok Habis</span>
                    </label>
                  </RadioGroup>

                  {stockStatus === "instock" && (
                    <div className="mt-3">
                      <Label htmlFor="stockQuantity" className="mb-1.5">
                        Jumlah Stok (opsional)
                      </Label>
                      <Input
                        id="stockQuantity"
                        type="number"
                        className={FIELD_TEXT}
                        placeholder="Kosongkan jika tidak dilacak per jumlah"
                        {...register("stockQuantity", {
                          setValueAs: (v) => (v === "" || v === null ? undefined : Number(v)),
                        })}
                        onWheel={(e) => e.currentTarget.blur()}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Kolom Kanan — kategori, brand & media */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <SectionHeading icon={FolderTree} title="Kategori" accent="bg-warning/10 text-warning" />
              </CardHeader>
              <CardContent>
                {errors.categoryIds && (
                  <p className="mb-1 text-[11px] text-destructive">{errors.categoryIds.message}</p>
                )}
                <CategoryPicker
                  categories={categories}
                  value={selectedCategoryIds ?? []}
                  onChange={(ids) =>
                    setValue("categoryIds", ids, { shouldValidate: true, shouldDirty: true })
                  }
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <SectionHeading icon={Tag} title="Brand" accent="bg-info/10 text-info" />
              </CardHeader>
              <CardContent>
                <Combobox
                  value={brand}
                  onValueChange={(v) => setValue("brand", v, { shouldDirty: true })}
                  options={brandOptions}
                  placeholder="Pilih atau ketik brand baru…"
                  createHint={(q) => `Brand baru: "${q}"`}
                  inputClassName={FIELD_TEXT}
                />
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Pilih dari brand yang sudah ada, atau ketik nama baru untuk membuatnya.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <SectionHeading
                  icon={Images}
                  title="Gambar & Video Produk"
                  accent="bg-sale-red/10 text-sale-red"
                />
              </CardHeader>
              <CardContent className="space-y-4">
                <ImageUploader images={images} onChange={syncImages} />
                <div className="h-px bg-border" />
                <div>
                  <Label className="mb-1.5">Video Produk (opsional)</Label>
                  <VideoUploader
                    value={videoUrl}
                    onChange={(url) => setValue("videoUrl", url, { shouldDirty: true })}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Atribut melebar penuh di bawah kedua kolom — barisnya butuh dua
            dropdown bersebelahan, yang tidak muat di kolom kanan. */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <SectionHeading icon={Layers} title="Spesifikasi Produk" accent="bg-info/10 text-info" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ name: "", values: [] })}
            >
              <Plus className="h-3.5 w-3.5" />
              Tambah Atribut
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Spesifikasi berlaku untuk <strong>semua varian</strong> produk ini — mis. &ldquo;DDR 5&rdquo;
              atau &ldquo;16 GB&rdquo;, yang sama di tiap pilihan warna.
            </p>

            {/* Atribut pembeda varian ikut ditampilkan tapi dikunci.
                Menyembunyikannya sama sekali membuat admin bingung kenapa WARNA
                "tidak ada" di spesifikasi padahal tampil di halaman produk;
                membiarkannya bisa diedit membuat dua sumber kebenaran yang akan
                berselisih dengan tabel varian. */}
            {isVariableProduct && variationAttributes.length > 0 && (
              <div className="rounded-xl border border-info/30 bg-info/5 px-3 py-2.5">
                <p className="mb-1.5 text-[11px] font-semibold text-info">
                  Dipakai sebagai pembeda varian
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {variationAttributes.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 rounded-md bg-info/10 px-2 py-1 text-[11px] font-medium text-info"
                    >
                      <Lock className="h-3 w-3" />
                      {name}
                    </span>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Nilainya diatur per varian di bagian <strong>Harga &amp; Stok</strong> di atas, jadi
                  tidak bisa diubah dari sini.
                </p>
              </div>
            )}

            {fields.length === 0 && (
              <p className="rounded-xl border border-dashed border-input px-3 py-3 text-center text-xs text-muted-foreground">
                Belum ada spesifikasi. Klik &quot;Tambah Atribut&quot; untuk menambahkan.
              </p>
            )}
            {fields.map((field, index) => (
              <AttributeRow
                key={field.id}
                name={watch(`attributes.${index}.name`) ?? ""}
                values={watch(`attributes.${index}.values`) ?? []}
                onNameChange={(v) =>
                  setValue(`attributes.${index}.name`, v, { shouldDirty: true })
                }
                onValuesChange={(v) =>
                  setValue(`attributes.${index}.values`, v, { shouldDirty: true })
                }
                onRemove={() => remove(index)}
                // Atribut yang sudah jadi pembeda varian dikeluarkan dari saran,
                // supaya admin tidak memilihnya lagi di sini dan membuat nilai
                // spesifikasi yang bertabrakan dengan nilai per varian.
                attributeOptions={selectableAttributeOptions}
              />
            ))}
          </CardContent>
        </Card>

      </form>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-primary/10 text-primary">
              <PackageSearch />
            </AlertDialogMedia>
            <AlertDialogTitle>
              {isEdit ? "Simpan perubahan produk?" : "Buat produk ini sekarang?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Periksa sekali lagi sebelum data dikirim.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {pendingValues && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 rounded-lg bg-muted/50 p-3 text-xs">
              <dt className="text-muted-foreground">Nama</dt>
              <dd className="font-medium break-words">{pendingValues.name}</dd>

              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-medium">
                {STATUS_OPTIONS.find((o) => o.value === pendingValues.status)?.label}
              </dd>

              <dt className="text-muted-foreground">Harga</dt>
              <dd className="font-medium">
                {formatRupiah(Number(pendingValues.regularPrice || 0))}
                {pendingValues.salePrice && (
                  <span className="text-sale-red">
                    {" → "}
                    {formatRupiah(Number(pendingValues.salePrice))}
                    {pendingValues.salePriceDateEnd && ` (s/d ${pendingValues.salePriceDateEnd})`}
                  </span>
                )}
              </dd>

              <dt className="text-muted-foreground">Stok</dt>
              <dd className="font-medium">
                {pendingValues.stockStatus === "instock"
                  ? `Tersedia${
                      pendingValues.stockQuantity !== undefined
                        ? ` (${pendingValues.stockQuantity})`
                        : ""
                    }`
                  : "Stok Habis"}
              </dd>

              {pendingValues.brand && (
                <>
                  <dt className="text-muted-foreground">Brand</dt>
                  <dd className="font-medium">{pendingValues.brand}</dd>
                </>
              )}

              <dt className="text-muted-foreground">Kategori</dt>
              <dd className="font-medium">{pendingValues.categoryIds.length} dipilih</dd>

              <dt className="text-muted-foreground">Gambar</dt>
              <dd className="font-medium">
                {images.length} gambar
                {images.some((i) => i.file) &&
                  ` (${images.filter((i) => i.file).length} baru akan diunggah)`}
              </dd>
            </dl>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Periksa Lagi</AlertDialogCancel>
            <AlertDialogAction onClick={saveProduct}>
              {isEdit ? "Ya, Simpan" : "Ya, Buat Produk"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </UnsavedChangesGuard>
  )
}
