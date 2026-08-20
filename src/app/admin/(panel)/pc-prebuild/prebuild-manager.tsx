"use client"

import Image from "next/image"
import { useRef, useState, useTransition } from "react"
import { ChevronDown, ChevronRight, ImagePlus, Plus, Save, Trash2, TriangleAlert, X } from "lucide-react"

import { Combobox, type ComboboxOption } from "@/components/ui/combobox"
import { fetchBuilderProducts } from "@/features/builder/actions"
import { formatRupiah } from "@/lib/utils"
import { compressImage } from "@/lib/utils/image-compression"
import type { PcBuilderStepConfig } from "@/lib/pc-builder/config"
// NILAI dari limits.ts, TIPE dari config.ts. Mengimpor nilai dari config.ts
// akan menyeret getPrisma() ke bundle browser dan menggagalkan build.
import {
  MAX_BRANCHING_SLOTS,
  MAX_OPTIONS_PER_SLOT,
  MAX_PREBUILD_IMAGES,
} from "@/lib/pc-prebuild/limits"
import type {
  PcPrebuildConfig,
  PcPrebuildOption,
  PcPrebuildPreset,
} from "@/lib/pc-prebuild/config"

import { savePcPrebuildConfig } from "./actions"

type PilihanAwal = Record<string, ComboboxOption[]>

type Props = {
  initialConfig: PcPrebuildConfig
  steps: PcBuilderStepConfig[]
  /** Saran produk awal per stepId, dimuat di server supaya daftarnya tidak kosong saat dibuka. */
  initialOptions: PilihanAwal
  /** Nama produk yang sudah terpakai di preset, supaya pickernya menampilkan pilihan tersimpan. */
  productNames: Record<number, string>
  /** Harga katalog produk yang sudah terpakai. Keterangan layar saja — tidak ikut tersimpan. */
  productPrices: Record<number, number>
}

function idBaru(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `preset-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function PrebuildManager({
  initialConfig,
  steps,
  initialOptions,
  productNames,
  productPrices,
}: Props) {
  const [enabled, setEnabled] = useState(initialConfig.enabled)
  const [presets, setPresets] = useState<PcPrebuildPreset[]>(initialConfig.presets)
  const [openId, setOpenId] = useState<string | null>(initialConfig.presets[0]?.id ?? null)
  const [nama, setNama] = useState<Record<number, string>>(productNames)
  const [harga, setHarga] = useState<Record<number, number>>(productPrices)
  const [flash, setFlash] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function ubahPreset(id: string, patch: Partial<PcPrebuildPreset>) {
    setPresets((lama) => lama.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  function tambahPreset() {
    const preset: PcPrebuildPreset = {
      id: idBaru(),
      name: "Paket baru",
      summary: "",
      images: [],
      order: presets.length,
      slots: [],
    }
    setPresets((lama) => [...lama, preset])
    setOpenId(preset.id)
  }

  function hapusPreset(id: string) {
    setPresets((lama) => lama.filter((p) => p.id !== id).map((p, i) => ({ ...p, order: i })))
    if (openId === id) setOpenId(null)
  }

  function geser(index: number, arah: -1 | 1) {
    const tujuan = index + arah
    if (tujuan < 0 || tujuan >= presets.length) return
    setPresets((lama) => {
      const salinan = [...lama]
      const [diambil] = salinan.splice(index, 1)
      salinan.splice(tujuan, 0, diambil)
      return salinan.map((p, i) => ({ ...p, order: i }))
    })
  }

  /** Ubah daftar pilihan satu slot. Daftar kosong = slotnya dibuang. */
  function ubahSlot(presetId: string, stepId: string, options: PcPrebuildOption[]) {
    setPresets((lama) =>
      lama.map((preset) => {
        if (preset.id !== presetId) return preset

        if (options.length === 0) {
          return { ...preset, slots: preset.slots.filter((slot) => slot.stepId !== stepId) }
        }

        const ada = preset.slots.some((slot) => slot.stepId === stepId)
        return ada
          ? {
              ...preset,
              slots: preset.slots.map((slot) =>
                slot.stepId === stepId ? { ...slot, options } : slot
              ),
            }
          : { ...preset, slots: [...preset.slots, { stepId, options }] }
      })
    )
  }

  /**
   * Berapa paket ini jatuhnya.
   *
   * `termurah` dipakai untuk paket yang punya komponen berpilihan — pelanggan
   * melihat "mulai dari", jadi staff perlu melihat angka yang sama.
   *
   * `lengkap: false` berarti ada komponen yang harganya belum diketahui layar
   * ini (produk baru dipilih dan daftarnya belum memuat harganya). Angkanya
   * ditandai, bukan disembunyikan — staff tetap butuh perkiraan.
   */
  function hitung(preset: PcPrebuildPreset, termurah: boolean) {
    let total = 0
    let lengkap = true

    for (const slot of preset.slots) {
      const kandidat = termurah ? slot.options : slot.options.slice(0, 1)
      const angka = kandidat
        .map((o) => (harga[o.productId] === undefined ? null : harga[o.productId] * o.quantity))
        .filter((n): n is number => n !== null)

      if (angka.length === 0) {
        lengkap = false
        continue
      }
      total += termurah ? Math.min(...angka) : angka[0]
    }

    return { total, lengkap }
  }

  function simpan() {
    setFlash(null)
    startTransition(async () => {
      const hasil = await savePcPrebuildConfig({
        enabled,
        presets: presets.map((p, i) => ({ ...p, order: i })),
      })
      setFlash(hasil.success ? `Tersimpan — ${hasil.presets} paket.` : "Gagal menyimpan.")
    })
  }

  return (
    <div className="space-y-4">
      {/* Sakelar. Mematikan BUKAN menghapus: presetnya tetap tersimpan, hanya
          rute publiknya yang ditutup — pola yang sama dipakai
          REGISTER_MANUAL_ENABLED. */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-input bg-muted/30 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Tampilkan di situs</p>
          <p className="text-xs text-muted-foreground">
            Saat mati, <code className="text-[11px]">/pc-prebuild</code> melempar ke{" "}
            <code className="text-[11px]">/build-pc</code>. Paket di bawah tetap tersimpan.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEnabled((v) => !v)}
          aria-pressed={enabled}
          className={`relative h-7 w-14 shrink-0 rounded-full border transition-colors ${
            enabled ? "border-primary bg-primary" : "border-input bg-background"
          }`}
        >
          <span className="sr-only">Tampilkan PC Prebuild di situs</span>
          <span
            aria-hidden="true"
            className={`absolute top-0.5 h-5 w-5 rounded-full transition-transform ${
              enabled ? "left-0.5 translate-x-7 bg-white" : "left-0.5 bg-muted-foreground"
            }`}
          />
        </button>
      </div>

      {steps.length === 0 && (
        <p className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          Belum ada langkah di PC Builder. Atur dulu di /admin/pc-builder — paket di sini menumpang
          langkah yang sama.
        </p>
      )}

      <div className="rounded-xl border border-input">
        {presets.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Belum ada paket. Tambahkan satu, lalu pilih komponennya per langkah.
          </p>
        ) : (
          presets.map((preset, index) => {
            const terbuka = openId === preset.id
            const bercabang = preset.slots.filter((slot) => slot.options.length > 1).length

            return (
              <div key={preset.id} className="border-b border-input last:border-b-0">
                <div className="flex flex-wrap items-center gap-2 p-3">
                  <button
                    type="button"
                    onClick={() => setOpenId(terbuka ? null : preset.id)}
                    aria-expanded={terbuka}
                    className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted"
                  >
                    {terbuka ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <span className="sr-only">
                      {terbuka ? "Tutup" : "Buka"} {preset.name}
                    </span>
                  </button>

                  <input
                    value={preset.name}
                    onChange={(e) => ubahPreset(preset.id, { name: e.target.value })}
                    aria-label="Nama paket"
                    className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-semibold outline-none focus:border-primary"
                  />
                  <input
                    value={preset.summary}
                    onChange={(e) => ubahPreset(preset.id, { summary: e.target.value })}
                    placeholder="Ringkasan satu kalimat"
                    aria-label="Ringkasan paket"
                    className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
                  />

                  <span className="shrink-0 rounded-full border border-input bg-muted/40 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                    {preset.slots.length} komponen
                  </span>
                  {preset.slots.length > 0 &&
                    (() => {
                      const { total, lengkap } = hitung(preset, false)
                      const murah = bercabang > 0 ? hitung(preset, true).total : total
                      return (
                        <span
                          title={
                            bercabang > 0
                              ? "Angka pertama = kombinasi bawaan; angka kedua = kombinasi termurah, yang dilihat pelanggan sebagai 'mulai dari'."
                              : "Total harga katalog paket ini."
                          }
                          className="shrink-0 rounded-full border border-sale-red/30 bg-sale-red/10 px-2 py-0.5 text-[11px] font-bold tabular-nums text-sale-red"
                        >
                          {formatRupiah(total)}
                          {bercabang > 0 && murah !== total && ` · dari ${formatRupiah(murah)}`}
                          {!lengkap && " *"}
                        </span>
                      )
                    })()}
                  {bercabang > 0 && (
                    <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-primary">
                      {bercabang} bisa dipilih
                    </span>
                  )}

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => geser(index, -1)}
                      disabled={index === 0}
                      className="rounded border border-input px-2 py-1 text-xs disabled:opacity-40"
                    >
                      ↑<span className="sr-only">Naikkan urutan</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => geser(index, 1)}
                      disabled={index === presets.length - 1}
                      className="rounded border border-input px-2 py-1 text-xs disabled:opacity-40"
                    >
                      ↓<span className="sr-only">Turunkan urutan</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => hapusPreset(preset.id)}
                      className="rounded border border-destructive/30 px-2 py-1 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="sr-only">Hapus {preset.name}</span>
                    </button>
                  </div>
                </div>

                {terbuka && (
                  <div className="space-y-3 border-t border-input bg-muted/20 p-3">
                    <FotoPaket
                      urls={preset.images}
                      onChange={(images) => ubahPreset(preset.id, { images })}
                    />

                    {steps.map((step) => (
                      <SlotEditor
                        key={step.id}
                        step={step}
                        options={preset.slots.find((s) => s.stepId === step.id)?.options ?? []}
                        saranAwal={initialOptions[step.id] ?? []}
                        namaProduk={nama}
                        hargaProduk={harga}
                        onHargaProduk={(peta) => setHarga((l) => ({ ...l, ...peta }))}
                        // Batas slot bercabang ditegakkan di parser juga; di sini
                        // supaya staff tahu SEBELUM menyimpan, bukan setelah
                        // pilihannya diam-diam dikunci.
                        bolehTambahCabang={bercabang < MAX_BRANCHING_SLOTS}
                        onNamaProduk={(id, label) => setNama((l) => ({ ...l, [id]: label }))}
                        onChange={(opts) => ubahSlot(preset.id, step.id, opts)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={tambahPreset}
          className="flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold hover:bg-muted"
        >
          <Plus className="h-4 w-4" />
          Tambah paket
        </button>
        <button
          type="button"
          onClick={simpan}
          disabled={pending}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {pending ? "Menyimpan…" : "Simpan"}
        </button>
        {flash && <span className="text-sm text-muted-foreground">{flash}</span>}
      </div>
    </div>
  )
}

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
 * banyak gambar sekaligus; di sini cuma satu foto per paket, dan menahannya
 * berarti pratinjaunya hilang setiap kali panel ini dirender ulang.
 */
function FotoPaket({
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
    <div className="space-y-2 rounded-lg border border-input bg-background p-2.5">
      <div>
        <p className="text-xs font-semibold">Foto rakitan</p>
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
              className="h-24 w-24 rounded-lg border bg-white object-contain"
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
          <label className="grid h-24 w-24 cursor-pointer place-items-center rounded-lg border border-dashed border-input bg-muted/40 text-center text-[11px] font-semibold text-muted-foreground hover:bg-muted">
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

type SlotEditorProps = {
  step: PcBuilderStepConfig
  options: PcPrebuildOption[]
  saranAwal: ComboboxOption[]
  namaProduk: Record<number, string>
  hargaProduk: Record<number, number>
  onHargaProduk: (peta: Record<number, number>) => void
  bolehTambahCabang: boolean
  onNamaProduk: (productId: number, label: string) => void
  onChange: (options: PcPrebuildOption[]) => void
}

/**
 * Satu langkah = satu slot, berisi satu sampai tiga pilihan.
 *
 * Pilihan PERTAMA adalah bawaan; itulah yang dipakai kalau pelanggan tidak
 * memilih apa-apa. Pilihan kedua dan seterusnya muncul sebagai tombol di
 * halaman paket — "16 GB / 32 GB", "Hitam / Putih".
 */
function SlotEditor({
  step,
  options,
  saranAwal,
  namaProduk,
  hargaProduk,
  onHargaProduk,
  bolehTambahCabang,
  onNamaProduk,
  onChange,
}: SlotEditorProps) {
  const terpakai = options.map((o) => o.productId)
  const bercabang = options.length > 1
  const bisaTambah =
    options.length > 0 &&
    options.length < MAX_OPTIONS_PER_SLOT &&
    (bercabang || bolehTambahCabang)

  function ubahIndeks(i: number, patch: Partial<PcPrebuildOption>) {
    onChange(options.map((o, idx) => (idx === i ? { ...o, ...patch } : o)))
  }

  return (
    <div className="rounded-lg border border-input bg-background p-2.5">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {step.name}
        </span>
        {bercabang && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
            pelanggan memilih
          </span>
        )}
      </div>

      <div className="space-y-2">
        {(options.length === 0 ? [null] : options).map((option, i) => (
          <OptionRow
            key={option ? `${option.productId}-${i}` : "kosong"}
            step={step}
            saranAwal={saranAwal}
            option={option}
            index={i}
            isBawaan={i === 0}
            /** Produk yang sudah dipakai pilihan lain di slot ini — tidak boleh kembar. */
            terlarang={terpakai.filter((_, idx) => idx !== i)}
            namaProduk={namaProduk}
            hargaProduk={hargaProduk}
            onHargaProduk={onHargaProduk}
            onNamaProduk={onNamaProduk}
            onPilih={(productId, label) => {
              if (productId === null) {
                onChange(options.filter((_, idx) => idx !== i))
                return
              }
              if (option) ubahIndeks(i, { productId })
              else onChange([...options, { productId, quantity: 1 }])
              if (label) onNamaProduk(productId, label)
            }}
            onLabel={(label) => ubahIndeks(i, { label: label || undefined })}
            onQty={(quantity) => ubahIndeks(i, { quantity })}
          />
        ))}
      </div>

      {bisaTambah && (
        <button
          type="button"
          onClick={() => onChange([...options, { productId: 0, quantity: 1 }])}
          className="mt-2 flex items-center gap-1 rounded-lg border border-dashed border-input px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
        >
          <Plus className="h-3.5 w-3.5" />
          Tambah pilihan
        </button>
      )}

      {options.length >= MAX_OPTIONS_PER_SLOT && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Maksimal {MAX_OPTIONS_PER_SLOT} pilihan per komponen.
        </p>
      )}
      {!bercabang && options.length > 0 && !bolehTambahCabang && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Sudah ada {MAX_BRANCHING_SLOTS} komponen yang bisa dipilih di paket ini — batasnya
          tercapai.
        </p>
      )}
    </div>
  )
}

type OptionRowProps = {
  step: PcBuilderStepConfig
  saranAwal: ComboboxOption[]
  option: PcPrebuildOption | null
  index: number
  isBawaan: boolean
  terlarang: number[]
  namaProduk: Record<number, string>
  hargaProduk: Record<number, number>
  onHargaProduk: (peta: Record<number, number>) => void
  onNamaProduk: (productId: number, label: string) => void
  onPilih: (productId: number | null, label?: string) => void
  onLabel: (label: string) => void
  onQty: (quantity: number) => void
}

/**
 * Satu baris pilihan: produk + label tombol + jumlah.
 *
 * Daftar produknya dimuat di server (20 teratas per langkah) supaya dropdown
 * tidak kosong saat dibuka; begitu staff mengetik tiga huruf, daftarnya
 * diperbarui lewat `fetchBuilderProducts` — server action yang SAMA dengan yang
 * dipakai wizard pelanggan.
 */
function OptionRow({
  step,
  saranAwal,
  option,
  isBawaan,
  terlarang,
  namaProduk,
  hargaProduk,
  onHargaProduk,
  onPilih,
  onLabel,
  onQty,
}: OptionRowProps) {
  const labelProduk = option && option.productId ? (namaProduk[option.productId] ?? "") : ""
  const [teks, setTeks] = useState(labelProduk)
  const [daftar, setDaftar] = useState<ComboboxOption[]>(saranAwal)
  const [nilaiTerakhir, setNilaiTerakhir] = useState(labelProduk)
  const queryTerakhir = useRef("")

  // Diselaraskan saat render, bukan lewat useEffect — aturan lint repo ini
  // menolak setState di dalam efek (`react-hooks/set-state-in-effect`).
  if (labelProduk !== nilaiTerakhir) {
    setNilaiTerakhir(labelProduk)
    setTeks(labelProduk)
  }

  async function cari(q: string) {
    queryTerakhir.current = q
    const { products } = await fetchBuilderProducts({
      categoryIds: step.categoryIds ?? [],
      requiredAttributeValueIds: [],
      searchQuery: q,
      limit: 20,
    })
    // Balasan yang datang terlambat diabaikan, supaya hasil ketikan lama tidak
    // menimpa hasil ketikan terbaru.
    if (queryTerakhir.current !== q) return
    setDaftar(products.map((p) => ({ id: p.id, label: p.name })))

    // Harga ikut dicatat dari hasil pencarian. Tanpa ini, produk yang baru
    // dipilih staff tidak punya angka sampai halaman dimuat ulang — dan total
    // paketnya terlihat lebih murah dari yang sebenarnya.
    onHargaProduk(Object.fromEntries(products.map((p) => [p.id, p.price])))
  }

  // Produk yang sudah dipakai pilihan lain disembunyikan dari daftar. `productId`
  // adalah identitas pilihan — termasuk di URL nanti — jadi dua pilihan dengan
  // produk yang sama tidak bisa dibedakan satu sama lain.
  const daftarBersih = daftar.filter((o) => !terlarang.includes(Number(o.id)))

  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_4.5rem_6.5rem_auto] sm:items-center">
      <Combobox
        requireOption
        value={teks}
        onValueChange={(v) => {
          setTeks(v)
          if (v.trim().length >= 3) void cari(v.trim())
        }}
        onCommit={(label) => {
          const cocok = daftarBersih.find(
            (o) => o.label.toLowerCase() === label.trim().toLowerCase()
          )
          onPilih(cocok ? Number(cocok.id) : null, cocok?.label)
        }}
        options={daftarBersih}
        placeholder={isBawaan ? "Komponen bawaan…" : "Pilihan lain…"}
        inputClassName="h-9 text-sm"
      />

      <input
        value={option?.label ?? ""}
        onChange={(e) => onLabel(e.target.value)}
        placeholder={isBawaan ? "Label (ops.)" : "Label"}
        aria-label={`Label pilihan untuk ${step.name}`}
        disabled={!option?.productId}
        title="Teks tombol pilihan — mis. 16 GB, Hitam, Samsung. Kosong = pakai nama produk."
        className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary disabled:opacity-50"
      />

      <input
        type="number"
        min={1}
        value={option?.quantity ?? 1}
        onChange={(e) => onQty(Number(e.target.value))}
        disabled={!option?.productId}
        aria-label={`Jumlah ${step.name}`}
        className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm tabular-nums outline-none focus:border-primary disabled:opacity-50"
      />

      {/* Keterangan untuk staff, dibaca dari katalog. TIDAK ikut tersimpan ke
          preset — lihat lib/pc-prebuild/config.ts. */}
      <span className="text-right text-sm font-semibold tabular-nums text-sale-red sm:text-xs">
        {option?.productId && hargaProduk[option.productId] !== undefined
          ? formatRupiah(hargaProduk[option.productId] * option.quantity)
          : "—"}
      </span>

      <button
        type="button"
        onClick={() => {
          setTeks("")
          onPilih(null)
        }}
        disabled={!option?.productId}
        aria-label={`Hapus pilihan ${step.name}`}
        className="rounded-lg border border-input px-2 py-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
