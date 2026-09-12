"use client"

import * as React from "react"
import { Loader2, Upload, X, ImageIcon, Megaphone, CalendarClock, Palette, MonitorPlay, Layers, Plus } from "lucide-react"
import type { PromoBanner, BannerDisplayMode } from "@prisma/client"

import { BANNER_BG_OPTIONS, toDateInputValue } from "@/lib/utils/banner"
import { compressImage } from "@/lib/utils/image-compression"
// Hanya TIPE — lihat catatan di `banner-list.tsx`.
import type { BatchOption } from "@/lib/api/banner-batches"
import { BatchFormDialog } from "./batch-form-dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { IMAGE_ACCEPT_ATTRIBUTE } from "@/lib/validators/media-upload"

const FIELD_TEXT = "text-xs md:text-xs"
const TEXTAREA_CLASS =
  "w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

type BannerFormProps = {
  banner?: PromoBanner
  action: (formData: FormData) => void
  /** Kampanye yang bisa dipilih. Kosong berarti belum ada satu pun dibuat. */
  batches: BatchOption[]
}

/**
 * Dua nilai semu di dalam dropdown kampanye.
 *
 * Keduanya TIDAK pernah ikut tersimpan: "none" diterjemahkan jadi string
 * kosong (kolomnya nullable), dan "new" hanya membuka dialog tanpa mengubah
 * pilihan. Diawali garis bawah supaya tidak mungkin bertabrakan dengan uuid.
 */
const NO_BATCH_VALUE = "__none__"
const NEW_BATCH_VALUE = "__new__"

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

export function BannerForm({ banner, action, batches }: BannerFormProps) {
  const isEdit = Boolean(banner)

  /**
   * Daftar kampanye ditahan di state, bukan dipakai langsung dari prop:
   * kampanye yang baru dibuat lewat dialog harus langsung muncul di dropdown
   * ini tanpa memuat ulang halaman — formulir banner yang sedang diisi akan
   * hilang kalau halamannya dimuat ulang.
   */
  const [batchOptions, setBatchOptions] = React.useState<BatchOption[]>(batches)
  const [batchId, setBatchId] = React.useState(banner?.batchId ?? "")
  const [newBatchOpen, setNewBatchOpen] = React.useState(false)

  /**
   * Banner ini menunjuk kampanye yang sudah dihapus (soft delete) — barisnya
   * masih ada sebagai catatan, tapi tidak lagi ditawarkan di dropdown. Tetap
   * ditampilkan sebagai pilihan supaya menyimpan formulir tidak diam-diam
   * melepas kaitannya, dan staff bisa melepaskannya sendiri kalau memang mau.
   */
  const hasArchivedBatch = Boolean(batchId) && !batchOptions.some((b) => b.id === batchId)

  const [imageUrl, setImageUrl] = React.useState(banner?.imageUrl ?? "")
  const [uploading, setUploading] = React.useState(false)
  const [uploadError, setUploadError] = React.useState<string | null>(null)
  const [bgClass, setBgClass] = React.useState(banner?.bgClass ?? "bg-primary")
  const [displayMode, setDisplayMode] = React.useState<BannerDisplayMode>(banner?.displayMode ?? "IMAGE_TEXT")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // Pratinjau langsung — supaya staff tahu hasilnya sebelum menyimpan.
  const [tag, setTag] = React.useState(banner?.tag ?? "")
  const [title, setTitle] = React.useState(banner?.title ?? "")
  const [subtitle, setSubtitle] = React.useState(banner?.subtitle ?? "")
  const [ctaLabel, setCtaLabel] = React.useState(banner?.ctaLabel ?? "")

  const isImageOnly = displayMode === "IMAGE_ONLY"

  async function handleImageSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadError(null)
    try {
      // Dikompres di browser dulu — banner beresolusi kamera bisa berukuran
      // beberapa MB dan itu yang dimuat pertama kali oleh setiap pengunjung
      // beranda.
      //
      // Batasnya SENGAJA lebih tinggi dari gambar produk (1600). Banner tampil
      // selebar container beranda (1232 CSS px), yang di layar DPR 2 menuntut
      // ~2464 piksel nyata; di 1600 peramban memperbesarnya dan teks yang sudah
      // dibakar ke dalam gambar (mode "Gambar Saja") terlihat pecah. Kualitas
      // 0.95 juga dinaikkan karena banner promo berisi bidang warna rata dan
      // huruf tajam — bagian yang paling cepat rusak oleh WebP lossy.
      const { file: compressed } = await compressImage(file, {
        maxDimension: 2560,
        quality: 0.95,
      })
      const formData = new FormData()
      formData.append("file", compressed)
      const res = await fetch("/api/admin/media", { method: "POST", body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Upload gambar gagal")
      setImageUrl(data.source_url as string)
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload gambar gagal")
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  return (
    <form action={action} onSubmit={() => setIsSubmitting(true)} className="space-y-6">
      {banner && <input type="hidden" name="id" value={banner.id} />}
      <input type="hidden" name="imageUrl" value={imageUrl} />
      <input type="hidden" name="bgClass" value={bgClass} />
      <input type="hidden" name="displayMode" value={displayMode} />
      <input type="hidden" name="batchId" value={batchId} />

      <div className="sticky top-0 z-30 -mx-1 flex items-center justify-between gap-3 rounded-xl border border-border bg-background/85 px-3 py-2.5 backdrop-blur-md">
        <p className="text-xs text-muted-foreground">
          {isEdit ? "Menyunting banner" : "Banner baru"}
        </p>
        <Button type="submit" disabled={isSubmitting || uploading} className="gap-2">
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEdit ? "Simpan Perubahan" : "Buat Banner"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          {/* Mode Tampilan */}
          <Card>
            <CardHeader>
              <SectionHeading icon={MonitorPlay} title="Mode Tampilan" accent="bg-violet-500/10 text-violet-500" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {([
                  { value: "IMAGE_TEXT" as const, label: "Gambar + Teks", desc: "Overlay teks di atas gambar" },
                  { value: "IMAGE_ONLY" as const, label: "Gambar Saja", desc: "Gambar mengisi seluruh slide" },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDisplayMode(opt.value)}
                    className={cn(
                      "flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-start transition-colors",
                      displayMode === opt.value
                        ? "border-primary bg-primary/5 font-semibold"
                        : "border-input hover:bg-muted/40"
                    )}
                  >
                    <span className="text-xs font-semibold">{opt.label}</span>
                    <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Pilih <strong>Gambar Saja</strong> kalau banner sudah mengandung teks di dalam gambarnya.
                Ukuran ideal: <strong>2560 × 1280 px</strong> (rasio 2:1). Jangan di bawah 1920 px —
                gambar yang lebih kecil akan terlihat pecah di layar beresolusi tinggi.
              </p>
            </CardContent>
          </Card>

          {/* Isi Banner */}
          <Card>
            <CardHeader>
              <SectionHeading icon={Megaphone} title="Isi Banner" accent="bg-primary/10 text-primary" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title" className="mb-1.5">
                  Judul
                </Label>
                <textarea
                  id="title"
                  name="title"
                  required
                  rows={2}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="mis. Garansi Resmi 2 Tahun"
                  className={cn(TEXTAREA_CLASS, "resize-none")}
                />
                {isImageOnly && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Judul hanya untuk identifikasi di panel admin, tidak ditampilkan di beranda.
                  </p>
                )}
              </div>

              {!isImageOnly && (
                <>
                  <div>
                    <Label htmlFor="tag" className="mb-1.5">
                      Tag (opsional)
                    </Label>
                    <Input
                      id="tag"
                      name="tag"
                      value={tag}
                      onChange={(e) => setTag(e.target.value)}
                      placeholder="mis. PROMO MINGGU INI"
                      className={FIELD_TEXT}
                    />
                  </div>

                  <div>
                    <Label htmlFor="subtitle" className="mb-1.5">
                      Subjudul (opsional)
                    </Label>
                    <textarea
                      id="subtitle"
                      name="subtitle"
                      rows={3}
                      value={subtitle}
                      onChange={(e) => setSubtitle(e.target.value)}
                      className={TEXTAREA_CLASS}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="ctaLabel" className="mb-1.5">
                        Teks Tombol (opsional)
                      </Label>
                      <Input
                        id="ctaLabel"
                        name="ctaLabel"
                        value={ctaLabel}
                        onChange={(e) => setCtaLabel(e.target.value)}
                        placeholder="mis. Cek Katalog"
                        className={FIELD_TEXT}
                      />
                    </div>
                    <div>
                      <Label htmlFor="ctaHref" className="mb-1.5">
                        Link Tombol
                      </Label>
                      <Input
                        id="ctaHref"
                        name="ctaHref"
                        defaultValue={banner?.ctaHref ?? ""}
                        placeholder="/shop"
                        className={FIELD_TEXT}
                      />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <SectionHeading
                icon={CalendarClock}
                title="Jadwal & Status"
                accent="bg-warning/10 text-warning"
              />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="startsAt" className="mb-1.5">
                    Mulai Tayang (opsional)
                  </Label>
                  <Input
                    id="startsAt"
                    name="startsAt"
                    type="date"
                    defaultValue={toDateInputValue(banner?.startsAt)}
                    className={FIELD_TEXT}
                  />
                </div>
                <div>
                  <Label htmlFor="endsAt" className="mb-1.5">
                    Berhenti Tayang (opsional)
                  </Label>
                  <Input
                    id="endsAt"
                    name="endsAt"
                    type="date"
                    defaultValue={toDateInputValue(banner?.endsAt)}
                    className={FIELD_TEXT}
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Di luar rentang tanggal ini banner otomatis hilang dari beranda — tidak perlu
                dimatikan manual. Kosongkan keduanya kalau banner tayang terus.
              </p>

              <div>
                <Label className="mb-1.5">Aktif</Label>
                <div className="flex h-8 items-center gap-2">
                  <Switch name="isActive" defaultChecked={banner?.isActive ?? true} />
                  <span className="text-xs text-muted-foreground">
                    Matikan untuk menyembunyikan tanpa menghapus.
                  </span>
                </div>
              </div>

              {/* Kolom "Urutan Tampil" sengaja tidak ada di sini. Kotak angka
                  dan daftar seret adalah dua sumber kebenaran untuk hal yang
                  sama, dan yang satu akan menimpa yang lain tanpa diketahui
                  staff. Penulisnya sekarang hanya daftar di halaman Banner. */}
              <p className="text-[11px] text-muted-foreground">
                Urutan tampil diatur dengan menyeret banner di halaman{" "}
                <strong>Banner Promo</strong>, bukan di formulir ini. Banner baru masuk ke
                urutan paling bawah.
              </p>
            </CardContent>
          </Card>

          {/* Kampanye */}
          <Card>
            <CardHeader>
              <SectionHeading icon={Layers} title="Kampanye" accent="bg-primary/10 text-primary" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Select
                value={batchId || NO_BATCH_VALUE}
                onValueChange={(value: string | null) => {
                  if (!value) return
                  // Membuka dialog TANPA mengubah pilihan — nilai semu ini
                  // tidak boleh mendarat di state, apalagi ikut tersimpan.
                  if (value === NEW_BATCH_VALUE) {
                    setNewBatchOpen(true)
                    return
                  }
                  setBatchId(value === NO_BATCH_VALUE ? "" : value)
                }}
              >
                <SelectTrigger className="w-full" aria-label="Kampanye">
                  <SelectValue placeholder="Tanpa kampanye" />
                </SelectTrigger>
                <SelectContent
                  side="bottom"
                  align="start"
                  sideOffset={4}
                  alignItemWithTrigger={false}
                >
                  <SelectItem value={NO_BATCH_VALUE}>Tanpa kampanye</SelectItem>

                  {hasArchivedBatch && (
                    <SelectItem value={batchId}>Kampanye yang sudah dihapus</SelectItem>
                  )}

                  {batchOptions.map((batch) => (
                    <SelectItem key={batch.id} value={batch.id}>
                      {batch.name}
                      {!batch.isActive && " · nonaktif"}
                    </SelectItem>
                  ))}

                  <SelectSeparator />
                  <SelectItem value={NEW_BATCH_VALUE}>
                    <Plus className="h-3.5 w-3.5" />
                    Buat kampanye baru…
                  </SelectItem>
                </SelectContent>
              </Select>

              <p className="text-[11px] text-muted-foreground">
                Opsional. Banner yang punya kampanye baru tayang kalau kampanye induknya juga
                sedang tayang — berguna untuk mematikan satu promo berisi beberapa banner
                sekaligus, tanpa menyentuh banner lain.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <SectionHeading
                icon={ImageIcon}
                title="Gambar Latar"
                accent="bg-sale-red/10 text-sale-red"
              />
            </CardHeader>
            <CardContent className="space-y-3">
              {imageUrl ? (
                <div className="relative overflow-hidden rounded-xl border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element -- URL R2 dinamis, di luar jangkauan optimasi next/image */}
                  <img src={imageUrl} alt="" className="h-32 w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImageUrl("")}
                    className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                    aria-label="Hapus gambar"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex h-32 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-input text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                  {uploading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      <span className="text-[11px] font-medium">Upload gambar banner</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept={IMAGE_ACCEPT_ATTRIBUTE}
                    className="hidden"
                    onChange={handleImageSelected}
                    disabled={uploading}
                  />
                </label>
              )}
              {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
              <p className="text-[11px] text-muted-foreground">
                Opsional. Tanpa gambar, banner memakai warna solid di bawah. Gambar dikompres
                otomatis sebelum diunggah.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <SectionHeading icon={Palette} title="Warna Latar" accent="bg-info/10 text-info" />
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {BANNER_BG_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setBgClass(option.value)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-start text-xs transition-colors",
                    bgClass === option.value
                      ? "border-primary bg-primary/5 font-semibold"
                      : "border-input hover:bg-muted/40"
                  )}
                >
                  <span className={cn("h-4 w-4 shrink-0 rounded", option.value)} />
                  {option.label}
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-[15px]">Pratinjau</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={cn(
                  "relative flex aspect-[2/1] flex-col justify-center overflow-hidden rounded-xl p-5 text-white",
                  bgClass
                )}
              >
                {imageUrl && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element -- pratinjau dari URL R2 dinamis */}
                    <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    {!isImageOnly && <div className="absolute inset-0 bg-black/45" />}
                  </>
                )}
                {!isImageOnly && (
                  <div className="relative z-10 space-y-1.5">
                    {tag && (
                      <span className="inline-block rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold tracking-wider backdrop-blur-sm">
                        {tag}
                      </span>
                    )}
                    <p className="line-clamp-2 text-lg font-extrabold leading-tight">
                      {title || "Judul banner"}
                    </p>
                    {subtitle && <p className="line-clamp-2 text-[11px] text-white/90">{subtitle}</p>}
                    {ctaLabel && (
                      <span className="mt-1 inline-block rounded-full bg-white px-3 py-1 text-[10px] font-bold text-slate-900">
                        {ctaLabel}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dirender di dalam <form> banner, tapi isinya keluar lewat portal —
          lihat catatan `stopPropagation` di batch-form-dialog.tsx. */}
      <BatchFormDialog
        open={newBatchOpen}
        onOpenChange={setNewBatchOpen}
        batch={null}
        onSaved={(batch) => {
          setBatchOptions((previous) => [batch, ...previous])
          setBatchId(batch.id)
        }}
      />
    </form>
  )
}
