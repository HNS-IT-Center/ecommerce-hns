"use client"

import * as React from "react"
import { useState, useTransition } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Loader2,
  Plus,
  X,
  PackageSearch,
  Wallet,
  FolderTree,
  Layers,
  CheckCircle2,
  XCircle,
  TriangleAlert,
} from "lucide-react"
import { useRouter } from "next/navigation"

import { quickEditFormSchema, type ProductFormValues } from "@/lib/validators/product"
import type {
  ProductCategory,
  ProductAttributeTaxonomy,
  ProductVariation,
} from "@/types/woocommerce"
import { CategoryPicker } from "./category-picker"
import { AttributeRow } from "./attribute-row"
import { VariationEditor } from "./variation-editor"
import { type BulkProductRow } from "./product-data-table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { RupiahInput } from "@/components/ui/rupiah-input"
import { cn } from "@/lib/utils"

/** Disamakan dengan formulir produk penuh — lihat produk-form.tsx. */
const FIELD_TEXT = "text-xs md:text-xs"

const STATUS_OPTIONS = [
  { value: "publish", label: "Publish", color: "text-success" },
  { value: "draft", label: "Draft", color: "text-muted-foreground" },
  { value: "private", label: "Private", color: "text-info" },
] as const

type QuickEditModalProps = {
  product: BulkProductRow
  categories: ProductCategory[]
  attributeOptions: ProductAttributeTaxonomy[]
  onClose: () => void
}

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
    <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold">
      <span className={cn("flex h-6 w-6 items-center justify-center rounded-md", accent)}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      {title}
    </div>
  )
}

export function QuickEditModal({
  product,
  categories,
  attributeOptions,
  onClose,
}: QuickEditModalProps) {
  const router = useRouter()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const raw = product.rawProduct
  const isVariable = raw?.type === "variable"

  // Atribut pembeda varian tidak disunting sebagai spesifikasi biasa: daftar
  // pilihan varian di induk dibangun dari sini, dan menyimpannya sebagai satu
  // nilai tunggal akan memangkas pilihan pembeli jadi satu opsi saja. Nilainya
  // diatur lewat tabel varian di bawah.
  const variationAttributeNames = (raw?.attributes ?? [])
    .filter((attr) => attr.variation)
    .map((attr) => attr.name)
  const variationAttributeKeys = new Set(
    variationAttributeNames.map((name) => name.trim().toLowerCase()),
  )

  // Varian tidak ikut dibawa baris tabel produk (25 baris x varian lengkap
  // terlalu mahal untuk data yang jarang dibuka), jadi dimuat saat modal ini
  // benar-benar terbuka.
  const [isLoadingVariations, setIsLoadingVariations] = useState(isVariable)
  const [variationsError, setVariationsError] = useState<string | null>(null)

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(quickEditFormSchema),
    defaultValues: {
      name: product.name,
      // Tipe asli ikut dibawa supaya validasi memakai aturan yang benar —
      // produk bervariasi tidak diwajibkan punya harga sendiri. Varian tidak
      // disunting di sini, jadi daftarnya dibiarkan apa adanya dan tidak ikut
      // dikirim ke server (lihat catatan di payload).
      type: raw?.type === "variable" ? "variable" : "simple",
      variationAttributes: variationAttributeNames,
      variations: [],
      description: raw?.description || "",
      shortDescription: raw?.short_description || "",
      regularPrice: raw?.regular_price || String(product.price || ""),
      salePrice: raw?.sale_price || "",
      salePriceDateEnd: raw?.date_on_sale_to_gmt ? raw.date_on_sale_to_gmt.split("T")[0] : "",
      manageStock: false,
      // Quick Edit kini memakai dua keadaan yang sama dengan formulir penuh
      // (Tersedia / Stok Habis) — sebelumnya ada mode ketiga "Isi Jumlah Stok"
      // yang membingungkan, padahal jumlah stok cuma pelengkap dari "Tersedia".
      stockStatus: raw?.stock_status === "outofstock" ? "outofstock" : "instock",
      stockQuantity: raw?.stock_quantity ?? undefined,
      status:
        product.status === "publish" || product.status === "private" ? product.status : "draft",
      categoryIds: raw?.categories?.map((c) => c.id) ?? [],
      attributes: (raw?.attributes ?? [])
        .filter((attr) => !attr.variation)
        .map((attr) => ({
          name: attr.name,
          values: attr.options,
        })),
      imageIds: [],
      videoUrl: raw?.video_url ?? "",
      brand: raw?.brands?.[0]?.name ?? "",
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: "attributes" })
  const selectedCategoryIds = watch("categoryIds")
  const status = watch("status")
  const stockStatus = watch("stockStatus")
  const regularPrice = watch("regularPrice") ?? ""
  const salePrice = watch("salePrice") ?? ""
  const variationAttributes = watch("variationAttributes") ?? []
  const variations = watch("variations") ?? []

  React.useEffect(() => {
    if (!isVariable) return
    let cancelled = false

    async function load() {
      try {
        const res = await fetch(`/api/admin/products/variations?id=${product.id}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Gagal memuat varian")
        if (cancelled) return

        // Nama atribut diambil dari varian kalau induk tidak mencatatnya —
        // 85 induk warisan Woo tidak punya atribut di barisnya sendiri.
        const namesFromVariations: string[] = []
        for (const variation of data as ProductVariation[]) {
          for (const attr of variation.attributes) {
            if (attr.name && !namesFromVariations.some((n) => n.toLowerCase() === attr.name.toLowerCase())) {
              namesFromVariations.push(attr.name)
            }
          }
        }
        const names = variationAttributeNames.length > 0 ? variationAttributeNames : namesFromVariations

        setValue("variationAttributes", names)
        setValue(
          "variations",
          (data as ProductVariation[]).map((variation) => ({
            id: variation.id,
            attributes: Object.fromEntries(
              names.map((name) => [
                name,
                variation.attributes.find(
                  (a) => a.name.trim().toLowerCase() === name.trim().toLowerCase(),
                )?.option ?? "",
              ]),
            ),
            sku: variation.sku ?? "",
            regularPrice: variation.regular_price ?? "",
            salePrice: variation.sale_price ?? "",
            stockStatus: variation.stock_status === "outofstock" ? "outofstock" : "instock",
            stockQuantity: variation.stock_quantity ?? undefined,
            imageUrl: variation.image?.src ?? "",
          })),
        )
      } catch (error) {
        if (!cancelled) {
          setVariationsError(error instanceof Error ? error.message : "Gagal memuat varian")
        }
      } finally {
        if (!cancelled) setIsLoadingVariations(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
    // `variationAttributeNames` diturunkan dari `raw` yang tidak berubah selama
    // modal terbuka, jadi tidak perlu ikut jadi dependensi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVariable, product.id, setValue])

  /**
   * Unggah gambar varian yang masih ditahan di klien, sama seperti di formulir
   * penuh — berkas baru menunggu tombol Simpan supaya membatalkan modal tidak
   * meninggalkan berkas yatim di R2.
   */
  async function uploadPendingVariationImages(
    rows: ProductFormValues["variations"],
  ): Promise<(string | undefined)[]> {
    const urls: (string | undefined)[] = []
    for (const variation of rows) {
      if (!variation.imageFile) {
        urls.push(undefined)
        continue
      }
      const formData = new FormData()
      formData.append("file", variation.imageFile)
      const res = await fetch("/api/admin/media", { method: "POST", body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Upload gambar varian gagal")
      urls.push(data.source_url as string)
    }
    return urls
  }

  async function onSubmit(values: ProductFormValues) {
    setSubmitError(null)

    // Varian hanya dikirim kalau benar-benar termuat. Mengirim array kosong
    // berarti "hapus semua varian" bagi server, jadi kegagalan pemuatan tidak
    // boleh diam-diam berubah jadi penghapusan.
    const sendVariations =
      isVariable && !isLoadingVariations && variationsError === null && values.variations.length > 0

    const variationImageUrls = sendVariations
      ? await uploadPendingVariationImages(values.variations)
      : []

    const payload = {
      id: product.id,
      name: values.name,
      status: values.status,
      regular_price: values.regularPrice,
      sale_price: values.salePrice || "",
      // Diakhiri pada penghujung hari yang dipilih supaya obral masih berlaku
      // sepanjang tanggal itu — sama seperti di formulir produk penuh.
      date_on_sale_to_gmt:
        values.salePrice && values.salePriceDateEnd
          ? new Date(`${values.salePriceDateEnd}T23:59:59`).toISOString()
          : "",
      manage_stock: values.stockStatus === "instock" && values.stockQuantity !== undefined,
      stock_status: values.stockStatus,
      // `null`, bukan 0 — sama seperti formulir penuh. "Tersedia" tanpa angka
      // berarti stok tidak dilacak per jumlah, dan mengirim 0 membuat server
      // menandainya habis.
      stock_quantity: values.stockStatus === "instock" ? values.stockQuantity ?? null : null,
      categories: values.categoryIds.map((id) => ({ id })),
      // Hanya atribut spesifikasi. Untuk produk bervariasi, daftar pilihan di
      // induk ditulis ulang oleh `syncProductVariations` dari data varian yang
      // dikirim di bawah — mengirimnya dua kali membuat keduanya berebut.
      //
      // Kalau varian TIDAK ikut dikirim (produk bervariasi yang varian-nya gagal
      // dimuat), atribut pembeda dikembalikan apa adanya supaya penyimpanan
      // tidak menghapus daftar pilihan di halaman produk.
      attributes: [
        ...values.attributes
          .filter((attr) => attr.name.trim() && attr.values.length > 0)
          .map((attr) => ({
            name: attr.name,
            options: attr.values,
            visible: true,
          })),
        ...(sendVariations
          ? []
          : (raw?.attributes ?? [])
              .filter((attr) => variationAttributeKeys.has(attr.name.trim().toLowerCase()))
              .map((attr) => ({ name: attr.name, options: attr.options, visible: true }))),
      ],
      ...(sendVariations && {
        type: "variable" as const,
        variation_attributes: values.variationAttributes,
        variations: values.variations.map((variation, index) => ({
          id: variation.id,
          attributes: variation.attributes,
          sku: variation.sku || "",
          regular_price: variation.regularPrice,
          sale_price: variation.salePrice || "",
          stock_status: variation.stockStatus,
          stock_quantity: variation.stockQuantity,
          image_url: variationImageUrls[index] ?? variation.imageUrl ?? null,
        })),
      }),
    }

    try {
      const res = await fetch("/api/admin/products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan produk")

      startTransition(() => {
        router.refresh()
        onClose()
      })
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Gagal menyimpan produk")
    }
  }

  const isBusy = isSubmitting || isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      {/* Lebih lebar dari 4xl sejak editor varian masuk ke sini: tiap baris
          varian membawa kolom atribut + SKU + harga + obral + stok, dan di
          `max-w-4xl` semuanya terjepit di setengah lebar dialog. Ponsel tidak
          terpengaruh — di sana tata letaknya memang satu kolom. */}
      <div className="flex max-h-full w-full max-w-6xl flex-col rounded-2xl border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-base font-bold">Quick Edit Produk</h2>
            <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{product.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" form="quick-edit-form" disabled={isBusy} className="gap-2">
              {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan
            </Button>
            <button
              onClick={onClose}
              className="rounded-lg p-2 hover:bg-muted"
              aria-label="Tutup"
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* `pb-10` memberi ruang bernapas di bawah isian terakhir. Tanpa itu
            baris paling bawah menempel persis pada tepi dialog, dan saran
            dropdown yang terbuka di sana tidak punya tempat untuk muncul. */}
        <div className="flex-1 overflow-auto p-4 pb-10 md:p-6 md:pb-10">
          <form id="quick-edit-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {submitError && (
              <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                {submitError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-5">
                <div>
                  <SectionHeading
                    icon={PackageSearch}
                    title="Informasi Dasar"
                    accent="bg-primary/10 text-primary"
                  />
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="qe-name" className="mb-1.5">
                        Nama Produk
                      </Label>
                      <textarea
                        id="qe-name"
                        rows={2}
                        {...register("name", {
                          setValueAs: (v: unknown) =>
                            String(v ?? "").replace(/\s*\n+\s*/g, " ").trim(),
                        })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.preventDefault()
                        }}
                        className="w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
                          setValue("status", val as ProductFormValues["status"], {
                            shouldDirty: true,
                          })
                        }
                        className="flex flex-row gap-2"
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <label
                            key={opt.value}
                            className={cn(
                              "flex flex-1 cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors",
                              status === opt.value
                                ? "border-primary bg-primary/5"
                                : "border-input hover:bg-muted/40"
                            )}
                          >
                            <RadioGroupItem value={opt.value} />
                            <span
                              className={cn(
                                "text-xs font-semibold",
                                status === opt.value && opt.color
                              )}
                            >
                              {opt.label}
                            </span>
                          </label>
                        ))}
                      </RadioGroup>
                    </div>
                  </div>
                </div>

                {/* Produk bervariasi tidak punya harga & stok sendiri — keduanya
                    nempel di tiap varian, dan halaman produk menampilkan "mulai
                    dari" varian termurah. Menampilkan kolom yang tidak berpengaruh
                    hanya mengundang staff mengisinya lalu bingung kenapa harga di
                    toko tidak berubah. */}
                <div className={cn(isVariable && "hidden")}>
                  <SectionHeading
                    icon={Wallet}
                    title="Harga & Stok"
                    accent="bg-success/10 text-success"
                  />
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="qe-regularPrice" className="mb-1.5">
                          Harga Normal
                        </Label>
                        <RupiahInput
                          id="qe-regularPrice"
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
                        <Label htmlFor="qe-salePrice" className="mb-1.5">
                          Harga Obral
                        </Label>
                        <RupiahInput
                          id="qe-salePrice"
                          className={FIELD_TEXT}
                          value={salePrice}
                          onValueChange={(v) => setValue("salePrice", v, { shouldDirty: true })}
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="qe-salePriceDateEnd" className="mb-1.5">
                        Obral Berlaku Sampai (opsional)
                      </Label>
                      <Input
                        id="qe-salePriceDateEnd"
                        type="date"
                        disabled={!salePrice}
                        className={cn(FIELD_TEXT, "w-full sm:w-56")}
                        {...register("salePriceDateEnd")}
                      />
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {salePrice
                          ? "Lewat tanggal ini harga otomatis kembali ke Harga Normal."
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
                        className="flex flex-row gap-2"
                      >
                        <label
                          className={cn(
                            "flex flex-1 cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors",
                            stockStatus === "instock"
                              ? "border-success bg-success/5"
                              : "border-input hover:bg-muted/40"
                          )}
                        >
                          <RadioGroupItem value="instock" />
                          <CheckCircle2
                            className={cn(
                              "h-3.5 w-3.5",
                              stockStatus === "instock" ? "text-success" : "text-muted-foreground"
                            )}
                          />
                          <span className="text-xs font-semibold">Tersedia</span>
                        </label>
                        <label
                          className={cn(
                            "flex flex-1 cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors",
                            stockStatus === "outofstock"
                              ? "border-destructive bg-destructive/5"
                              : "border-input hover:bg-muted/40"
                          )}
                        >
                          <RadioGroupItem value="outofstock" />
                          <XCircle
                            className={cn(
                              "h-3.5 w-3.5",
                              stockStatus === "outofstock"
                                ? "text-destructive"
                                : "text-muted-foreground"
                            )}
                          />
                          <span className="text-xs font-semibold">Stok Habis</span>
                        </label>
                      </RadioGroup>

                      {stockStatus === "instock" && (
                        <div className="mt-2.5">
                          <Label htmlFor="qe-stockQuantity" className="mb-1.5">
                            Jumlah Stok (opsional)
                          </Label>
                          <Input
                            id="qe-stockQuantity"
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
                  </div>
                </div>

                {/* Spesifikasi ditempatkan di kolom ini, bukan di kanan bersama
                    Kategori. Pada produk bervariasi, "Harga & Stok" di atas
                    disembunyikan (harganya per varian), sehingga kolom kiri
                    tinggal berisi Status dan menyisakan area kosong panjang di
                    bawahnya. */}
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <SectionHeading
                      icon={Layers}
                      title="Spesifikasi / Atribut"
                      accent="bg-info/10 text-info"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => append({ name: "", values: [] })}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Tambah
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {fields.length === 0 && (
                      <p className="rounded-xl border border-dashed border-input px-3 py-3 text-center text-xs text-muted-foreground">
                        Belum ada atribut khusus untuk produk ini.
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
                        attributeOptions={attributeOptions}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <SectionHeading
                    icon={FolderTree}
                    title="Kategori"
                    accent="bg-warning/10 text-warning"
                  />
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
                </div>

              </div>
            </div>

            {/* Varian sengaja DI LUAR grid dua kolom: tiap barisnya membawa
                kolom atribut + SKU + harga + obral + stok, dan di setengah lebar
                dialog semuanya terjepit sampai tidak terbaca. Di ponsel tata
                letaknya tetap satu kolom, jadi tidak ada yang berubah di sana. */}
            {isVariable && (
              <div>
                <SectionHeading
                  icon={Layers}
                  title="Varian Produk"
                  accent="bg-info/10 text-info"
                />
                {isLoadingVariations ? (
                  <p className="flex items-center gap-2 rounded-xl border border-dashed border-input px-3 py-4 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Memuat varian…
                  </p>
                ) : variationsError ? (
                  <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-3 text-xs text-destructive">
                    {variationsError} — varian tidak akan diubah saat menyimpan.
                  </p>
                ) : (
                  <>
                    <p className="mb-2 text-[11px] text-muted-foreground">
                      Harga &amp; stok produk ini ditentukan per varian, bukan dari kolom di atas.
                    </p>
                    <VariationEditor
                      attributes={variationAttributes}
                      onAttributesChange={(next) =>
                        setValue("variationAttributes", next, { shouldDirty: true })
                      }
                      variations={variations}
                      onVariationsChange={(next) =>
                        setValue("variations", next, { shouldDirty: true })
                      }
                      attributeOptions={attributeOptions}
                      galleryImages={(raw?.images ?? []).map((img) => ({
                        id: String(img.id),
                        url: img.src,
                      }))}
                    />
                  </>
                )}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
