"use client"

import Image from "next/image"
import { useRef, useState } from "react"
import { Reorder } from "framer-motion"
import { GripHorizontal, ImagePlus, Loader2, Star, TriangleAlert, Upload, X } from "lucide-react"

import { MAX_PREBUILD_IMAGES } from "@/lib/pc-prebuild/limits"
import { compressImage } from "@/lib/utils/image-compression"
import { IMAGE_ACCEPT_ATTRIBUTE } from "@/lib/validators/media-upload"

/**
 * Foto rakitan jadi untuk satu paket.
 *
 * ## Bentuknya menyalin galeri produk
 *
 * Deretan ubin 96px yang bisa DISERET untuk diurutkan, nomor urut di tiap
 * ubin, ubin pertama bertanda "Utama", dan ubin "Upload" di ujung — sama
 * persis dengan `admin/produk/image-uploader.tsx`.
 *
 * Versi sebelumnya berbentuk lain: satu kotak besar untuk foto utama, lalu
 * grid kecil di bawahnya yang BARU MUNCUL setelah foto utama ada, dan urutan
 * hanya bisa diubah lewat tombol bintang per foto. Dua akibatnya nyata. Staff
 * yang belum punya foto sama sekali tidak melihat satu pun ubin tambah, jadi
 * "bagaimana menambah foto" tidak terjawab di layar. Dan staff yang sudah
 * terbiasa mengurutkan foto produk dengan menyeret mencoba menyeret di sini,
 * tidak terjadi apa-apa, lalu menyimpulkan urutannya memang tidak bisa diubah.
 *
 * Satu perilaku yang dipakai bersama galeri produk dan halaman pelanggan:
 * **yang pertama adalah foto utama.** Tidak ada penanda terpisah untuk itu —
 * urutan yang menentukan, di sini maupun di `parsePrebuildConfig`.
 *
 * ## Yang SENGAJA tetap berbeda: unggahannya tidak ditahan
 *
 * Form produk menahan berkas di browser sampai "Simpan" ditekan, karena staff
 * sering menambah lalu membatalkan banyak gambar sekaligus sehingga R2 penuh
 * berkas yatim. Di sini berkasnya diunggah SAAT DIPILIH: jumlahnya paling
 * banyak empat, dan preset menyimpan `images: string[]` — menahan berkas
 * berarti panel harus memegang objek File di state induk dan mengunggahnya di
 * jalur simpan, satu jalur baru yang bisa gagal separuh.
 *
 * **Konsekuensinya diterima:** foto yang diunggah lalu dihapus meninggalkan
 * berkas tak terpakai di R2.
 *
 * Jalurnya tetap Cloudflare R2 lewat `POST /api/admin/media` — satu-satunya
 * jalur unggah foto di project ini (CLAUDE.md §2.2), dan dikompres dulu di
 * browser seperti foto produk dan banner.
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

  /**
   * SATU input berkas untuk dua pemicu: ubin bertitik-titik di ujung deretan,
   * dan tombol "Tambah foto" di bawahnya.
   *
   * Ubinnya saja tidak cukup. Ia kotak kosong bergaris putus-putus di antara
   * kotak-kotak foto — terbaca sebagai tempat foto berikutnya akan muncul,
   * bukan sebagai sesuatu yang bisa ditekan, dan itulah yang membuat
   * pertanyaan "mana tombol tambah fotonya" wajar muncul. Tombol bertulisan
   * menjawabnya tanpa perlu ditebak.
   *
   * Dua `<input>` terpisah akan membuat dialog berkas kedua kadang membuka
   * pilihan yang masih tersisa dari yang pertama, jadi keduanya menunjuk input
   * yang sama.
   */
  const inputRef = useRef<HTMLInputElement>(null)

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

  const penuh = urls.length >= MAX_PREBUILD_IMAGES

  return (
    <div className="space-y-2">
      {/* Judul kolom. Tanpa ini bagian foto cuma sederet kotak abu-abu di
          samping dua kolom teks, dan tidak ada satu kata pun di layar yang
          menyebut bahwa paket ini bisa berfoto. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <span className="text-xs font-semibold">
          Foto paket <span className="font-normal text-muted-foreground">(opsional)</span>
        </span>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {urls.length} / {MAX_PREBUILD_IMAGES}
        </span>
      </div>

      {/*
        `px-2 pt-2` BUKAN hiasan.

        Nomor urut dan tombol hapus duduk di LUAR tepi ubinnya (`-left-1
        -top-1`), dan wadah ini `overflow-x-auto` — apa pun yang melewati tepi
        wadah dipotong, bukan ditampilkan. Tanpa ruang ini, angka "1" terpangkas
        di tepi kiri dan ubin terakhir menabrak tepi kanan.

        Jaraknya `gap-4`, bukan `gap-3`: badge ubin berikutnya menjorok 4px ke
        dalam celah, jadi celah 12px menyisakan 8px dan angkanya terbaca
        menempel pada tombol hapus ubin sebelumnya.
      */}
      <div className="flex items-start gap-4 overflow-x-auto px-2 pt-2 pb-2">
        <Reorder.Group
          as="ul"
          axis="x"
          values={urls}
          onReorder={onChange}
          className="flex shrink-0 list-none items-start gap-4"
        >
          {urls.map((url, index) => (
            <Reorder.Item
              key={url}
              value={url}
              className="relative h-24 w-24 shrink-0 cursor-grab list-none active:cursor-grabbing"
              whileDrag={{ scale: 1.06, zIndex: 20 }}
            >
              <div
                className={`relative h-full w-full overflow-hidden rounded-xl border bg-white ${
                  index === 0 ? "border-brand-green ring-2 ring-brand-green/30" : "border-border"
                }`}
              >
                {/* `p-2`: foto produk kebanyakan berlatar putih dan penuh
                    sampai tepi berkasnya. Tanpa padding, barangnya menempel
                    garis ubin dan ubin bersebelahan terlihat menyatu. */}
                <Image
                  src={url}
                  alt=""
                  fill
                  sizes="96px"
                  className="pointer-events-none object-contain p-2"
                />
              </div>

              {/* Nomor urut — posisi inilah yang tersimpan sebagai urutan galeri. */}
              <span className="absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background shadow-sm">
                {index + 1}
              </span>

              {index === 0 && (
                <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 rounded-b-xl bg-brand-green/90 py-0.5 text-[9px] font-semibold text-primary-foreground">
                  <Star className="h-2.5 w-2.5 fill-current" />
                  Utama
                </span>
              )}

              {/* `onPointerDown` dihentikan: tanpa itu, menekan tombol hapus
                  terbaca sebagai awal seretan dan klik-nya tidak pernah
                  sampai. Pola yang sama dipakai galeri produk. */}
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onChange(urls.filter((u) => u !== url))}
                aria-label={`Hapus foto ${index + 1}`}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white transition-colors hover:bg-black/80"
              >
                <X className="h-3 w-3" />
              </button>
            </Reorder.Item>
          ))}
        </Reorder.Group>

        {/* Ubin tambah SELALU ada selama jatahnya belum penuh — termasuk saat
            belum ada foto sama sekali. Itu satu-satunya jawaban di layar untuk
            "bagaimana cara menambah foto". */}
        {!penuh && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            aria-label="Tambah foto paket"
            className="flex h-24 w-24 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-input text-muted-foreground transition-colors hover:border-brand-green hover:text-brand-green disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Upload className="h-4 w-4" />
                <span className="text-[11px] font-medium">Upload</span>
              </>
            )}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_ACCEPT_ATTRIBUTE}
        multiple
        onChange={pilih}
        disabled={uploading}
        className="hidden"
      />

      {/* Tombol bertulisan, bukan cuma ubin bergaris putus-putus. */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading || penuh}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors hover:border-brand-green hover:text-brand-green disabled:cursor-not-allowed disabled:opacity-50"
      >
        {uploading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Mengunggah…
          </>
        ) : (
          <>
            <ImagePlus className="h-3.5 w-3.5" />
            {penuh ? `Jatah ${MAX_PREBUILD_IMAGES} foto sudah penuh` : "Tambah foto"}
          </>
        )}
      </button>

      {error && (
        <p className="flex items-start gap-1.5 text-xs text-sale-red">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}

      {urls.length > 1 && (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <GripHorizontal className="h-3 w-3 shrink-0" />
          Seret ke kiri/kanan untuk mengubah urutan — nomor 1 jadi foto utama.
        </p>
      )}

      <p className="text-[11px] text-muted-foreground">
        Foto PC-nya utuh: tampak depan, dalam casing, tata kabel, belakang. Boleh dikosongkan —
        foto komponen satu per satu sudah ada di katalog.
      </p>
    </div>
  )
}
