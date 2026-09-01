"use client"

import * as React from "react"
import { ImagePlus, Images, Plus, Trash2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Combobox, type ComboboxOption } from "@/components/ui/combobox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RupiahInput } from "@/components/ui/rupiah-input"
import { cn } from "@/lib/utils"
import type { ProductVariationValues } from "@/lib/validators/product"
import { IMAGE_ACCEPT_ATTRIBUTE } from "@/lib/validators/media-upload"
import type { ProductAttributeTaxonomy } from "@/types/woocommerce"
import { useAttributeValues } from "./use-attribute-values"

type VariationEditorProps = {
  /** Nama atribut pembeda, mis. ["WARNA"]. */
  attributes: string[]
  onAttributesChange: (attributes: string[]) => void
  variations: ProductVariationValues[]
  onVariationsChange: (variations: ProductVariationValues[]) => void
  attributeOptions: ProductAttributeTaxonomy[]
  /**
   * Gambar yang sudah ada di galeri produk ini.
   *
   * Sebagian besar varian memakai foto yang sudah diunggah untuk produknya —
   * memaksa admin mengunggah ulang berkas yang sama hanya menggandakan berkas
   * di R2 dan memakan waktu.
   */
  galleryImages?: { id: string; url: string }[]
  /** Pesan galat per baris dari react-hook-form, dikunci indeks varian. */
  errors?: Record<number, string | undefined>
  attributesError?: string
  variationsError?: string
}

const FIELD_CLASS = "text-xs md:text-xs"

function emptyVariation(attributes: string[]): ProductVariationValues {
  return {
    attributes: Object.fromEntries(attributes.map((name) => [name, ""])),
    sku: "",
    regularPrice: "",
    salePrice: "",
    stockStatus: "instock",
    stockQuantity: undefined,
    imageUrl: "",
  }
}

/** Label ringkas untuk judul kartu varian, mis. "MERAH / XL". */
function variationLabel(variation: ProductVariationValues, attributes: string[]): string {
  const parts = attributes.map((name) => variation.attributes[name]?.trim()).filter(Boolean)
  return parts.length > 0 ? parts.join(" / ") : "Varian baru"
}

/**
 * Editor varian untuk produk bertipe "variable".
 *
 * Tiap varian adalah baris produk tersendiri di database (`type: VARIATION`
 * menunjuk induk lewat `parent_id`), jadi masing-masing punya harga, SKU, stok,
 * dan gambar sendiri — mengikuti struktur 2.077 varian warisan WooCommerce.
 *
 * Ditampilkan sebagai kartu bertumpuk, bukan tabel menyamping. Alasannya
 * konkret: dengan 6 kolom isian ditambah kolom per atribut, tabel memaksa
 * gulir horizontal bahkan di layar lebar, dan di ponsel praktis tidak terpakai.
 * Kartu membuat tiap varian terbaca utuh tanpa menggulir ke samping.
 */
export function VariationEditor({
  attributes,
  onAttributesChange,
  variations,
  onVariationsChange,
  attributeOptions,
  galleryImages = [],
  errors,
  attributesError,
  variationsError,
}: VariationEditorProps) {
  const [attributeDraft, setAttributeDraft] = React.useState("")
  /** Indeks varian yang sedang membuka pemilih gambar dari galeri produk. */
  const [pickerIndex, setPickerIndex] = React.useState<number | null>(null)

  const attributeChoices: ComboboxOption[] = React.useMemo(
    () => attributeOptions.map((attr) => ({ id: attr.id, label: attr.name })),
    [attributeOptions],
  )

  // Nilai yang sudah ada untuk tiap atribut pembeda, mis. 296 nilai WARNA.
  const valuesByAttribute = useAttributeValues(attributes, attributeOptions)

  /**
   * Dipanggil HANYA dari `onCommit` combobox (klik saran / Enter / blur),
   * bukan dari `onValueChange`. Kalau dipanggil per ketikan, mengetik "WARNA"
   * akan menambahkan lima atribut: W, WA, WAR, WARN, WARNA.
   */
  function addAttribute(name: string) {
    const trimmed = name.trim()
    setAttributeDraft("")
    if (!trimmed) return
    // Dibandingkan tanpa huruf besar/kecil supaya "Warna" dan "WARNA" tidak
    // jadi dua kolom yang isinya sama.
    if (attributes.some((a) => a.trim().toLowerCase() === trimmed.toLowerCase())) return

    onAttributesChange([...attributes, trimmed])
    // Varian yang sudah ada ikut mendapat kolom baru dengan nilai kosong,
    // supaya bentuk datanya seragam dan validasi bisa menandainya.
    onVariationsChange(
      variations.map((v) => ({ ...v, attributes: { ...v.attributes, [trimmed]: "" } })),
    )
  }

  function removeAttribute(name: string) {
    onAttributesChange(attributes.filter((a) => a !== name))
    onVariationsChange(
      variations.map((v) => {
        const next = { ...v.attributes }
        delete next[name]
        return { ...v, attributes: next }
      }),
    )
  }

  function updateVariation(index: number, patch: Partial<ProductVariationValues>) {
    onVariationsChange(variations.map((v, i) => (i === index ? { ...v, ...patch } : v)))
  }

  function updateVariationAttribute(index: number, name: string, value: string) {
    onVariationsChange(
      variations.map((v, i) =>
        i === index ? { ...v, attributes: { ...v.attributes, [name]: value } } : v,
      ),
    )
  }

  /**
   * Simpan berkas di klien, JANGAN unggah sekarang.
   *
   * Sama seperti galeri produk utama: pengunggahan ditunda sampai tombol Simpan
   * ditekan. Mengunggah seketika berarti setiap gambar yang dipilih lalu
   * dibatalkan admin tetap tinggal di R2 sebagai berkas yatim yang tak pernah
   * dirujuk baris mana pun.
   */
  function pickImage(index: number, file: File) {
    const previous = variations[index]?.imagePreview
    if (previous) URL.revokeObjectURL(previous)

    updateVariation(index, {
      imageFile: file,
      imagePreview: URL.createObjectURL(file),
    })
  }

  function clearImage(index: number) {
    const previous = variations[index]?.imagePreview
    if (previous) URL.revokeObjectURL(previous)
    updateVariation(index, { imageUrl: "", imageFile: undefined, imagePreview: undefined })
  }

  /**
   * Pakai gambar yang sudah ada di galeri produk.
   *
   * Berkas yang tertunda dibuang: memilih dari galeri berarti admin membatalkan
   * unggahan yang belum jadi, dan meninggalkannya akan menimpa pilihan ini saat
   * form disimpan.
   */
  function pickFromGallery(index: number, url: string) {
    const previous = variations[index]?.imagePreview
    if (previous) URL.revokeObjectURL(previous)
    updateVariation(index, { imageUrl: url, imageFile: undefined, imagePreview: undefined })
    setPickerIndex(null)
  }

  return (
    <div className="space-y-4">
      {/* Langkah 1 — atribut pembeda */}
      <div className="rounded-xl border border-border bg-muted/30 p-3">
        <Label className="mb-1">1. Atribut pembeda varian</Label>
        <p className="mb-2.5 text-[11px] leading-relaxed text-muted-foreground">
          Contoh: WARNA, UKURAN, PANJANG. Atribut inilah yang jadi pilihan pembeli di halaman produk.
          Pilih dari daftar atau ketik baru, lalu tekan Enter. Kalau nilai yang diketik sudah pernah
          dipakai dengan ejaan berbeda (mis. &ldquo;Hitam&rdquo;), ejaan lama yang dipakai supaya tidak
          muncul dua pilihan yang sebenarnya sama.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {attributes.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary"
            >
              {name}
              <button
                type="button"
                onClick={() => removeAttribute(name)}
                aria-label={`Hapus atribut ${name}`}
                className="rounded p-0.5 hover:bg-primary/20"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}

          <div className="w-56">
            <Combobox
              value={attributeDraft}
              onValueChange={setAttributeDraft}
              onCommit={addAttribute}
              options={attributeChoices}
              placeholder="Pilih atau ketik atribut…"
              createHint={(q) => `Tekan Enter untuk membuat atribut baru: "${q}"`}
              inputClassName={FIELD_CLASS}
            />
          </div>
        </div>

        {attributesError && <p className="mt-2 text-xs text-destructive">{attributesError}</p>}
      </div>

      {/* Langkah 2 — daftar varian */}
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <Label>
            2. Daftar varian
            {variations.length > 0 && (
              <span className="ml-1.5 font-normal text-muted-foreground">
                ({variations.length})
              </span>
            )}
          </Label>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1.5"
            disabled={attributes.length === 0}
            onClick={() => onVariationsChange([...variations, emptyVariation(attributes)])}
          >
            <Plus className="h-4 w-4" />
            Tambah Varian
          </Button>
        </div>

        {attributes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
            Tambah atribut pembeda dulu di langkah 1, baru varian bisa diisi.
          </p>
        ) : variations.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
            Belum ada varian. Klik &ldquo;Tambah Varian&rdquo; untuk mulai.
          </p>
        ) : (
          <div className="space-y-2.5">
            {variations.map((variation, index) => (
              <div
                key={variation.id ?? `new-${index}`}
                className="rounded-xl border border-border p-3"
              >
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-semibold">
                    {variationLabel(variation, attributes)}
                    {variation.id === undefined && (
                      <span className="ml-1.5 rounded bg-success/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-success">
                        Baru
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => onVariationsChange(variations.filter((_, i) => i !== index))}
                    className="shrink-0 rounded-lg p-1.5 text-destructive hover:bg-destructive/10"
                    aria-label={`Hapus varian ${variationLabel(variation, attributes)}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  {/* Gambar varian */}
                  <div className="shrink-0">
                    <label className="flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-input hover:bg-muted">
                      {variation.imagePreview || variation.imageUrl ? (
                        /* URL gambar datang dari media eksternal (R2/WordPress)
                           dengan host bermacam-macam; next/image butuh daftar
                           host tetap di next.config, jadi <img> biasa dipakai.
                           Pratinjau lokal (blob:) juga tidak bisa lewat next/image. */
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={variation.imagePreview || variation.imageUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="flex flex-col items-center gap-1 text-muted-foreground">
                          <ImagePlus className="h-5 w-5" />
                          <span className="text-[10px]">Gambar</span>
                        </span>
                      )}
                      <input
                        type="file"
                        accept={IMAGE_ACCEPT_ATTRIBUTE}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) pickImage(index, file)
                          e.target.value = ""
                        }}
                      />
                    </label>
                    {galleryImages.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setPickerIndex(pickerIndex === index ? null : index)}
                        className="mt-1 flex w-20 items-center justify-center gap-1 rounded-md border border-input py-0.5 text-[10px] text-muted-foreground hover:bg-muted"
                      >
                        <Images className="h-3 w-3" />
                        Galeri
                      </button>
                    )}
                    {(variation.imagePreview || variation.imageUrl) && (
                      <button
                        type="button"
                        onClick={() => clearImage(index)}
                        className="mt-1 w-20 text-[10px] text-muted-foreground hover:text-destructive"
                      >
                        Hapus gambar
                      </button>
                    )}
                    {variation.imagePreview && (
                      <p className="mt-0.5 w-20 text-[10px] text-muted-foreground">
                        Diunggah saat simpan
                      </p>
                    )}
                  </div>

                  {/* Isian varian */}
                  <div className="grid min-w-0 flex-1 grid-cols-2 gap-2.5 lg:grid-cols-4">
                    {attributes.map((name) => {
                      const options = valuesByAttribute[name.trim().toLowerCase()] ?? []
                      return (
                        <div key={name} className="col-span-1">
                          <Label className="mb-1 text-[11px] text-muted-foreground">{name}</Label>
                          {/* Combobox, bukan input bebas: nilai dipilih dari yang
                              sudah ada supaya "Black"/"BLACK"/"Hitam" tidak jadi
                              tiga pilihan berbeda di halaman produk. Nilai baru
                              tetap boleh diketik — backend meng-upsert-nya. */}
                          <Combobox
                            value={variation.attributes[name] ?? ""}
                            onValueChange={(v) => updateVariationAttribute(index, name, v)}
                            options={options}
                            placeholder={options.length > 0 ? "Pilih atau ketik…" : "Ketik nilai…"}
                            createHint={(q) => `Nilai baru: "${q}"`}
                            inputClassName={FIELD_CLASS}
                          />
                        </div>
                      )
                    })}

                    <div>
                      <Label className="mb-1 text-[11px] text-muted-foreground">SKU</Label>
                      <Input
                        value={variation.sku ?? ""}
                        onChange={(e) => updateVariation(index, { sku: e.target.value })}
                        placeholder="Opsional"
                        className={FIELD_CLASS}
                      />
                    </div>

                    <div>
                      <Label className="mb-1 text-[11px] text-muted-foreground">Harga</Label>
                      <RupiahInput
                        value={variation.regularPrice}
                        onValueChange={(v) => updateVariation(index, { regularPrice: v })}
                        className={FIELD_CLASS}
                      />
                    </div>

                    <div>
                      <Label className="mb-1 text-[11px] text-muted-foreground">Harga Obral</Label>
                      <RupiahInput
                        value={variation.salePrice ?? ""}
                        onValueChange={(v) => updateVariation(index, { salePrice: v })}
                        className={FIELD_CLASS}
                      />
                    </div>

                    <div>
                      <Label className="mb-1 text-[11px] text-muted-foreground">Stok</Label>
                      <select
                        value={variation.stockStatus}
                        onChange={(e) =>
                          updateVariation(index, {
                            stockStatus: e.target.value as ProductVariationValues["stockStatus"],
                          })
                        }
                        className="h-9 w-full rounded-lg border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring"
                      >
                        <option value="instock">Tersedia</option>
                        <option value="outofstock">Habis</option>
                      </select>
                    </div>
                  </div>
                </div>

                {errors?.[index] && (
                  <p className="mt-2 text-[11px] text-destructive">{errors[index]}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {variationsError && <p className="mt-2 text-xs text-destructive">{variationsError}</p>}
      </div>

      {/* Pemilih gambar sebagai dialog, bukan panel yang menyeruak di antara
          baris varian. Panel inline menggeser tata letak kartu setiap kali
          dibuka dan thumbnail-nya terjepit; dialog memberi ruang penuh dan
          menutup sendiri setelah gambar dipilih. */}
      <Dialog
        open={pickerIndex !== null}
        onOpenChange={(open) => !open && setPickerIndex(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pilih Gambar Varian</DialogTitle>
            <DialogDescription>
              Gambar diambil dari galeri produk ini. Untuk memakai gambar lain, tutup dialog dan
              gunakan tombol unggah pada varian.
            </DialogDescription>
          </DialogHeader>

          <div className="grid max-h-[60vh] grid-cols-3 gap-2 overflow-y-auto py-1 sm:grid-cols-4 md:grid-cols-5">
            {galleryImages.map((img) => {
              const isActive =
                pickerIndex !== null && variations[pickerIndex]?.imageUrl === img.url
              return (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => pickerIndex !== null && pickFromGallery(pickerIndex, img.url)}
                  className={cn(
                    "aspect-square overflow-hidden rounded-lg border-2 transition-colors",
                    isActive
                      ? "border-primary ring-2 ring-primary/40"
                      : "border-transparent hover:border-primary/50",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                </button>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
