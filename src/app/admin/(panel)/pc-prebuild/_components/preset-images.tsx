"use client"

import Image from "next/image"
import { useState } from "react"
import { ImagePlus, Loader2, Star, TriangleAlert, X } from "lucide-react"

import { MAX_PREBUILD_IMAGES } from "@/lib/pc-prebuild/limits"
import { compressImage } from "@/lib/utils/image-compression"
import { IMAGE_ACCEPT_ATTRIBUTE } from "@/lib/validators/media-upload"

/**
 * Foto rakitan jadi untuk satu paket.
 *
 * Diunggah ke Cloudflare R2 lewat `POST /api/admin/media` — satu-satunya jalur
 * unggah foto di project ini (CLAUDE.md §2.2). Dikompres dulu di browser, sama
 * seperti foto banner dan foto produk: berkas dari kamera bisa beberapa MB, dan
 * ini gambar yang dimuat pertama kali oleh setiap pengunjung halaman paket.
 *
 * BEDA dari form produk, unggahannya terjadi SAAT DIPILIH, bukan ditahan sampai
 * "Simpan". Form produk menahannya karena staff sering menambah lalu
 * membatalkan banyak gambar sekaligus sehingga R2 penuh berkas yatim; di sini
 * jumlahnya sedikit, dan menahannya membuat pratinjaunya hilang setiap kali
 * panel dirender ulang. **Konsekuensinya diterima:** foto yang diunggah lalu
 * dihapus meninggalkan berkas tak terpakai di R2.
 */
export function PresetImages({
  urls,
  onChange,
}: {
  urls: string[]
  onChange: (urls: string[]) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function pilih(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    setUploading(true)
    setError(null)
    try {
      const sisa = MAX_PREBUILD_IMAGES - urls.length
      const terunggah: string[] = []

      for (const file of files.slice(0, Math.max(sisa, 0))) {
        const { file: compressed } = await compressImage(file)
        const formData = new FormData()
        formData.append("file", compressed)
        const res = await fetch("/api/admin/media", { method: "POST", body: formData })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Upload gambar gagal")
        terunggah.push(data.source_url as string)
      }

      if (terunggah.length > 0) onChange([...urls, ...terunggah])
      if (files.length > sisa) {
        setError(`Maksimal ${MAX_PREBUILD_IMAGES} foto — sisanya tidak ikut diunggah.`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload gambar gagal")
    } finally {
      setUploading(false)
      // Dikosongkan supaya memilih berkas yang SAMA lagi tetap memicu onChange.
      e.target.value = ""
    }
  }

  const utama = urls[0] ?? null
  const penuh = urls.length >= MAX_PREBUILD_IMAGES

  return (
    <div className="space-y-3">
      {/* Foto utama tampil BESAR, bukan sebagai kotak 96px sejajar yang lain.
          Ia foto yang mewakili paket di deck dan di halaman pelanggan; staff
          harus bisa menilainya tanpa membuka berkasnya. */}
      <div className="relative aspect-16/10 w-full overflow-hidden rounded-xl border bg-muted">
        {utama ? (
          <>
            <Image src={utama} alt="" fill sizes="(max-width: 768px) 100vw, 33vw" className="object-contain" />
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-brand-green px-2 py-1 text-[11px] font-bold text-primary-foreground shadow-sm">
              <Star className="h-3 w-3 fill-current" />
              Foto utama
            </span>
            <button
              type="button"
              onClick={() => onChange(urls.slice(1))}
              aria-label="Hapus foto utama"
              className="absolute right-2 top-2 rounded-full bg-background/90 p-1.5 text-muted-foreground shadow-sm transition-colors hover:text-sale-red"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <label className="flex h-full cursor-pointer flex-col items-center justify-center gap-2 text-muted-foreground transition-colors hover:bg-muted/70">
            {uploading ? (
              <>
                <Loader2 className="h-7 w-7 animate-spin" />
                <span className="text-sm font-semibold">Mengunggah…</span>
              </>
            ) : (
              <>
                <ImagePlus className="h-7 w-7" strokeWidth={1.5} />
                <span className="text-sm font-semibold">Tambah foto rakitan</span>
                <span className="px-6 text-center text-xs">
                  Foto PC-nya utuh. Boleh dikosongkan.
                </span>
              </>
            )}
            <input
              type="file"
              accept={IMAGE_ACCEPT_ATTRIBUTE}
              multiple
              onChange={pilih}
              disabled={uploading}
              className="sr-only"
            />
          </label>
        )}
      </div>

      {/* Baris pendamping. Hanya muncul kalau foto utama sudah ada — deretan
          kotak kosong di bawah kotak kosong tidak memberi tahu apa pun. */}
      {utama && (
        <div className="grid grid-cols-4 gap-2">
          {urls.slice(1).map((url) => (
            <div key={url} className="group relative aspect-square overflow-hidden rounded-lg border bg-muted">
              <Image src={url} alt="" fill sizes="80px" className="object-contain" />
              <div className="absolute inset-0 flex items-center justify-center gap-1 bg-foreground/60 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <button
                  type="button"
                  onClick={() => onChange([url, ...urls.filter((u) => u !== url)])}
                  aria-label="Jadikan foto utama"
                  className="rounded-md bg-background/90 p-1.5 hover:bg-background"
                >
                  <Star className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onChange(urls.filter((u) => u !== url))}
                  aria-label="Hapus foto"
                  className="rounded-md bg-background/90 p-1.5 text-muted-foreground hover:bg-background hover:text-sale-red"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}

          {!penuh && (
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-muted-foreground transition-colors hover:border-brand-green hover:text-brand-green">
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <ImagePlus className="h-4 w-4" />
                  <span className="text-[10px] font-semibold">Tambah</span>
                </>
              )}
              <input
                type="file"
                accept={IMAGE_ACCEPT_ATTRIBUTE}
                multiple
                onChange={pilih}
                disabled={uploading}
                className="sr-only"
              />
            </label>
          )}
        </div>
      )}

      {error && (
        <p className="flex items-start gap-1.5 text-xs text-sale-red">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}
