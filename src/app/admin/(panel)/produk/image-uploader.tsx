"use client"

import * as React from "react"
import { Reorder } from "framer-motion"
import { Loader2, Star, X, Upload, GripHorizontal } from "lucide-react"

import { cn } from "@/lib/utils"
import { compressImage } from "@/lib/utils/image-compression"

export type ProductImageItem = {
  /** Stabil selama umur komponen — dipakai sebagai key React & nilai pengurut. */
  id: string
  /** URL untuk ditampilkan: URL R2 (gambar lama) atau object URL (belum diunggah). */
  previewUrl: string
  /** Terisi hanya untuk gambar yang belum diunggah. */
  file?: File
  /** Terisi hanya untuk gambar yang sudah ada di R2. */
  uploadedUrl?: string
}

type ImageUploaderProps = {
  images: ProductImageItem[]
  onChange: (images: ProductImageItem[]) => void
}

let localIdCounter = 0
function nextLocalId(): string {
  localIdCounter += 1
  return `local-${Date.now()}-${localIdCounter}`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Pemilih gambar produk.
 *
 * Berkas TIDAK langsung diunggah saat dipilih — hanya ditahan di browser
 * (dikompres, lalu dipratinjau lewat object URL) sampai formulir benar-benar
 * disimpan. Alasannya: staff sering menambah lalu membatalkan gambar sambil
 * menyusun produk, dan mengunggah setiap percobaan berarti menumpuk berkas
 * yatim di R2 yang tidak pernah dipakai produk manapun.
 *
 * Gambar pertama dalam urutan = gambar utama, mengikuti `position`/`isPrimary`
 * di `replaceProductRelations` (lib/api/woocommerce/products.ts) yang menandai
 * elemen pertama array sebagai utama.
 */
export function ImageUploader({ images, onChange }: ImageUploaderProps) {
  const [processing, setProcessing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Object URL yang dibuat komponen ini harus dilepas saat komponen dilepas,
  // kalau tidak berkasnya tetap ditahan di memori browser sampai tab ditutup.
  const createdUrls = React.useRef<Set<string>>(new Set())
  React.useEffect(() => {
    const urls = createdUrls.current
    return () => {
      for (const url of urls) URL.revokeObjectURL(url)
    }
  }, [])

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    setProcessing(true)
    setError(null)
    try {
      const prepared = await Promise.all(
        files.map(async (file) => {
          const { file: compressed, previewUrl } = await compressImage(file)
          createdUrls.current.add(previewUrl)
          return { id: nextLocalId(), previewUrl, file: compressed }
        })
      )
      onChange([...images, ...prepared])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memproses gambar")
    } finally {
      setProcessing(false)
      e.target.value = ""
    }
  }

  function removeImage(id: string) {
    const target = images.find((img) => img.id === id)
    if (target?.file && createdUrls.current.has(target.previewUrl)) {
      URL.revokeObjectURL(target.previewUrl)
      createdUrls.current.delete(target.previewUrl)
    }
    onChange(images.filter((img) => img.id !== id))
  }

  const pendingCount = images.filter((img) => img.file).length
  const pendingBytes = images.reduce((total, img) => total + (img.file?.size ?? 0), 0)

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3 overflow-x-auto pb-2">
        <Reorder.Group
          as="ul"
          axis="x"
          values={images}
          onReorder={onChange}
          className="flex shrink-0 list-none items-start gap-3"
        >
          {images.map((img, index) => (
            <Reorder.Item
              key={img.id}
              value={img}
              className="relative h-24 w-24 shrink-0 cursor-grab list-none active:cursor-grabbing"
              whileDrag={{ scale: 1.06, zIndex: 20 }}
            >
              <div
                className={cn(
                  "relative h-full w-full overflow-hidden rounded-xl border bg-muted/20",
                  index === 0 ? "border-primary ring-2 ring-primary/30" : "border-border"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- sumbernya object URL blob lokal & URL R2 dinamis, keduanya di luar jangkauan optimasi next/image */}
                <img
                  src={img.previewUrl}
                  alt=""
                  className="pointer-events-none h-full w-full object-cover"
                />
              </div>

              {/* Nomor urut — posisi inilah yang disimpan sebagai urutan galeri */}
              <span className="absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background shadow-sm">
                {index + 1}
              </span>

              {index === 0 && (
                <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 rounded-b-xl bg-primary/90 py-0.5 text-[9px] font-semibold text-primary-foreground">
                  <Star className="h-2.5 w-2.5 fill-current" />
                  Utama
                </span>
              )}

              {img.file && (
                <span className="absolute right-1 bottom-6 rounded bg-black/60 px-1 text-[9px] font-medium text-white">
                  baru
                </span>
              )}

              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => removeImage(img.id)}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
                aria-label={`Hapus gambar ${index + 1}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Reorder.Item>
          ))}
        </Reorder.Group>

        <label className="flex h-24 w-24 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-input text-muted-foreground transition-colors hover:border-primary hover:text-primary">
          {processing ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <Upload className="h-4 w-4" />
              <span className="text-[11px] font-medium">Upload</span>
            </>
          )}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFilesSelected}
            disabled={processing}
          />
        </label>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <GripHorizontal className="h-3 w-3 shrink-0" />
        Seret ke kiri/kanan untuk mengubah urutan — nomor 1 jadi gambar utama.
      </p>
      {pendingCount > 0 && (
        <p className="text-[11px] text-muted-foreground">
          {pendingCount} gambar baru ({formatBytes(pendingBytes)} setelah dikompres) akan diunggah
          saat produk disimpan.
        </p>
      )}
    </div>
  )
}
