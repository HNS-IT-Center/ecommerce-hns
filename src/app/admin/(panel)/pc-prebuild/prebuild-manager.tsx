"use client"

import { useRef, useState, useTransition } from "react"
import { ChevronDown, ChevronRight, Plus, Save, Trash2, TriangleAlert } from "lucide-react"

import { Combobox, type ComboboxOption } from "@/components/ui/combobox"
import { fetchBuilderProducts } from "@/features/builder/actions"
import type { PcBuilderStepConfig } from "@/lib/pc-builder/config"
import type { PcPrebuildConfig, PcPrebuildPreset } from "@/lib/pc-prebuild/config"

import { savePcPrebuildConfig } from "./actions"

type PilihanAwal = Record<string, ComboboxOption[]>

type Props = {
  initialConfig: PcPrebuildConfig
  steps: PcBuilderStepConfig[]
  /** Saran produk awal per stepId, dimuat di server supaya daftarnya tidak kosong saat dibuka. */
  initialOptions: PilihanAwal
  /** Nama produk yang sudah terpakai di preset, supaya pickernya menampilkan pilihan tersimpan. */
  productNames: Record<number, string>
}

function idBaru(): string {
  // `crypto.randomUUID` tersedia di semua browser yang didukung project ini.
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `preset-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function PrebuildManager({ initialConfig, steps, initialOptions, productNames }: Props) {
  const [enabled, setEnabled] = useState(initialConfig.enabled)
  const [presets, setPresets] = useState<PcPrebuildPreset[]>(initialConfig.presets)
  const [openId, setOpenId] = useState<string | null>(initialConfig.presets[0]?.id ?? null)
  const [nama, setNama] = useState<Record<number, string>>(productNames)
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

  /**
   * Menyunting pilihan PERTAMA sebuah slot, dan MEMPERTAHANKAN sisanya.
   *
   * Editor ini belum punya antarmuka multi-pilihan. Kalau ia menulis ulang
   * seluruh slot, pilihan kedua dan ketiga yang tidak bisa ia tampilkan akan
   * terhapus diam-diam setiap kali staff menyimpan.
   */
  function setItem(presetId: string, stepId: string, productId: number | null, label?: string) {
    if (productId !== null && label) setNama((lama) => ({ ...lama, [productId]: label }))

    setPresets((lama) =>
      lama.map((preset) => {
        if (preset.id !== presetId) return preset

        if (productId === null) {
          return { ...preset, slots: preset.slots.filter((slot) => slot.stepId !== stepId) }
        }

        const slotLama = preset.slots.find((slot) => slot.stepId === stepId)
        const sisaPilihan = (slotLama?.options ?? [])
          .slice(1)
          .filter((option) => option.productId !== productId)
        const qtyLama = slotLama?.options[0]?.quantity ?? 1
        const slotBaru = {
          stepId,
          options: [{ productId, quantity: qtyLama }, ...sisaPilihan],
        }

        return slotLama
          ? { ...preset, slots: preset.slots.map((slot) => (slot.stepId === stepId ? slotBaru : slot)) }
          : { ...preset, slots: [...preset.slots, slotBaru] }
      })
    )
  }

  function setQty(presetId: string, stepId: string, quantity: number) {
    if (!Number.isFinite(quantity) || quantity < 1) return
    setPresets((lama) =>
      lama.map((preset) =>
        preset.id === presetId
          ? {
              ...preset,
              slots: preset.slots.map((slot) =>
                slot.stepId === stepId
                  ? {
                      ...slot,
                      options: slot.options.map((option, i) =>
                        i === 0 ? { ...option, quantity } : option
                      ),
                    }
                  : slot
              ),
            }
          : preset
      )
    )
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
                    <span className="sr-only">{terbuka ? "Tutup" : "Buka"} {preset.name}</span>
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
                  <div className="space-y-2 border-t border-input bg-muted/20 p-3">
                    {steps.map((step) => {
                      const slot = preset.slots.find((s) => s.stepId === step.id)
                      const item = slot?.options[0]
                      return (
                        <StepPicker
                          key={step.id}
                          step={step}
                          options={initialOptions[step.id] ?? []}
                          productId={item?.productId ?? null}
                          productLabel={item ? (nama[item.productId] ?? "") : ""}
                          quantity={item?.quantity ?? 1}
                          onPick={(id, label) => setItem(preset.id, step.id, id, label)}
                          onQty={(n) => setQty(preset.id, step.id, n)}
                        />
                      )
                    })}
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

type StepPickerProps = {
  step: PcBuilderStepConfig
  options: ComboboxOption[]
  productId: number | null
  productLabel: string
  quantity: number
  onPick: (productId: number | null, label?: string) => void
  onQty: (quantity: number) => void
}

/**
 * Satu baris langkah: pemilih produk + jumlah.
 *
 * Daftar awalnya dimuat di server (20 teratas per langkah) supaya dropdownnya
 * tidak kosong saat dibuka. Begitu staff mengetik 3 huruf atau lebih, daftarnya
 * diperbarui lewat `fetchBuilderProducts` — server action yang SAMA dengan yang
 * dipakai wizard pelanggan, jadi produk yang bisa dipilih di sini persis produk
 * yang bisa dipilih di sana.
 */
function StepPicker({
  step,
  options,
  productId,
  productLabel,
  quantity,
  onPick,
  onQty,
}: StepPickerProps) {
  const [teks, setTeks] = useState(productLabel)
  const [daftar, setDaftar] = useState<ComboboxOption[]>(options)
  const [nilaiTerakhir, setNilaiTerakhir] = useState(productLabel)
  const queryTerakhir = useRef("")

  // Diselaraskan saat render, bukan lewat useEffect — aturan lint repo ini
  // menolak setState di dalam efek (`react-hooks/set-state-in-effect`).
  if (productLabel !== nilaiTerakhir) {
    setNilaiTerakhir(productLabel)
    setTeks(productLabel)
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
  }

  return (
    <div className="grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)_5rem_auto] sm:items-center">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {step.name}
      </span>

      <Combobox
        requireOption
        value={teks}
        onValueChange={(v) => {
          setTeks(v)
          if (v.trim().length >= 3) void cari(v.trim())
        }}
        onCommit={(label) => {
          const cocok = daftar.find((o) => o.label.toLowerCase() === label.trim().toLowerCase())
          onPick(cocok ? Number(cocok.id) : null, cocok?.label)
        }}
        options={daftar}
        placeholder="Ketik untuk mencari produk…"
        inputClassName="h-9 text-sm"
      />

      <input
        type="number"
        min={1}
        value={quantity}
        onChange={(e) => onQty(Number(e.target.value))}
        disabled={productId === null}
        aria-label={`Jumlah ${step.name}`}
        className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm tabular-nums outline-none focus:border-primary disabled:opacity-50"
      />

      <button
        type="button"
        onClick={() => {
          setTeks("")
          onPick(null)
        }}
        disabled={productId === null}
        className="rounded-lg border border-input px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-40"
      >
        Kosongkan
      </button>
    </div>
  )
}
