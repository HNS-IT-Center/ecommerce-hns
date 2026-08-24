"use client"

import Image from "next/image"
import { useState } from "react"
import { ImagePlus, X } from "lucide-react"

import { MAX_PREBUILD_IMAGES } from "@/lib/pc-prebuild/limits"
import { compressImage } from "@/lib/utils/image-compression"

/**
 * Foto rakitan jadi untuk satu paket.
 *
 * Diunggah ke Cloudflare R2 lewat `POST /api/admin/media` — satu-satunya jalur
 * unggah foto di project ini (CLAUDE.md §2.2). Dikompres dulu di browser, sama
 * seperti foto banner dan foto produk: berkas dari kamera bisa beberapa MB, dan
 * ini gambar yang dimuat pertama kali oleh setiap pengunjung halaman paket.
 *
 * BEDA dari form produk, unggahannya terjadi SAAT DIPILIH, bukan ditahan sampai
 * "Simpan". Form produk menahannya karena staff sering menambah lalu membatalkan
 * banyak gambar sekaligus; di sini jumlahnya sedikit, dan menahannya berarti
 * pratinjaunya hilang setiap kali panel ini dirender ulang.
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
      e.target.value = ""
    }
  }

  const penuh = urls.length >= MAX_PREBUILD_IMAGES

  return (
    <div className="space-y-2 rounded-xl border bg-card p-3">
      <div>
        <p className="text-xs font-bold">Foto rakitan</p>
        <p className="text-[11px] text-muted-foreground">
          Foto PC-nya utuh. Yang pertama jadi foto utama — itu yang tampil di kartu daftar paket.
          Maksimal {MAX_PREBUILD_IMAGES}, dan boleh dikosongkan.
        </p>
      </div>

      <div className="flex flex-wrap items-start gap-2">
        {urls.map((url, i) => (
          <div key={url} className="relative">
            <Image
              src={url}
              alt=""
              width={96}
              height={96}
              className="h-24 w-24 rounded-xl border bg-white object-contain"
            />

            {i === 0 ? (
              <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                Utama
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onChange([url, ...urls.filter((u) => u !== url)])}
                className="absolute left-1 top-1 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-semibold hover:bg-background"
              >
                Jadikan utama
              </button>
            )}

            <button
              type="button"
              onClick={() => onChange(urls.filter((u) => u !== url))}
              aria-label="Hapus foto"
              className="absolute right-1 top-1 rounded bg-background/90 p-1 text-muted-foreground hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {!penuh && (
          <label className="grid h-24 w-24 cursor-pointer place-items-center rounded-xl border border-dashed border-input bg-muted/40 text-center text-[11px] font-semibold text-muted-foreground hover:bg-muted">
            {uploading ? (
              "Mengunggah…"
            ) : (
              <span className="flex flex-col items-center gap-1">
                <ImagePlus className="h-5 w-5" />
                Tambah foto
              </span>
            )}
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={pilih}
              disabled={uploading}
              className="sr-only"
            />
          </label>
        )}
      </div>

      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  )
}
