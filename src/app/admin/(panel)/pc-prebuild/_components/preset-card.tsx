"use client"

import { ChevronDown, ChevronRight, ChevronUp, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { ComboboxOption } from "@/components/ui/combobox"
import { Input } from "@/components/ui/input"
import type { PcBuilderStepConfig } from "@/lib/pc-builder/config"
import type { PcPrebuildOption, PcPrebuildPreset } from "@/lib/pc-prebuild/config"
import type { PrebuildGame } from "@/lib/pc-prebuild/games"
import { MAX_BRANCHING_SLOTS } from "@/lib/pc-prebuild/limits"
import { fingerprintSlots, type PrebuildPerformance } from "@/lib/pc-prebuild/performance"
import { formatRupiah } from "@/lib/utils"

import { PerformanceEditor } from "./performance-editor"
import { PresetImages } from "./preset-images"
import { SlotEditor } from "./slot-editor"

/**
 * Satu paket: kepala yang selalu terlihat, dan isinya yang terbuka saat diklik.
 *
 * Kepalanya memuat yang dibutuhkan staff untuk MENGENALI paket tanpa membukanya
 * — nama, jumlah komponen, harga jatuhnya, dan status analisis performa.
 * Sebelumnya kepala ini juga memuat kotak ringkasan, dan akibatnya baris itu
 * penuh sesak sementara informasi yang benar-benar membedakan satu paket dari
 * yang lain justru terdesak ke pinggir.
 */

type Props = {
  preset: PcPrebuildPreset
  index: number
  jumlahPreset: number
  terbuka: boolean
  onToggle: () => void
  steps: PcBuilderStepConfig[]
  initialOptions: Record<string, ComboboxOption[]>
  games: PrebuildGame[]
  namaProduk: Record<number, string>
  hargaProduk: Record<number, number>
  onNamaProduk: (productId: number, label: string) => void
  onHargaProduk: (peta: Record<number, number>) => void
  hitung: (preset: PcPrebuildPreset, termurah: boolean) => { total: number; lengkap: boolean }
  onUbah: (patch: Partial<PcPrebuildPreset>) => void
  onUbahSlot: (stepId: string, options: PcPrebuildOption[]) => void
  onHapus: () => void
  onGeser: (arah: -1 | 1) => void
}

export function PresetCard({
  preset,
  index,
  jumlahPreset,
  terbuka,
  onToggle,
  steps,
  initialOptions,
  games,
  namaProduk,
  hargaProduk,
  onNamaProduk,
  onHargaProduk,
  hitung,
  onUbah,
  onUbahSlot,
  onHapus,
  onGeser,
}: Props) {
  const bercabang = preset.slots.filter((slot) => slot.options.length > 1).length
  const { total, lengkap } = hitung(preset, false)
  const murah = bercabang > 0 ? hitung(preset, true).total : total

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center gap-2 p-3">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onToggle}
          aria-expanded={terbuka}
          aria-label={`${terbuka ? "Tutup" : "Buka"} ${preset.name}`}
        >
          {terbuka ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>

        <Input
          value={preset.name}
          onChange={(e) => onUbah({ name: e.target.value })}
          aria-label="Nama paket"
          className="h-9 min-w-48 flex-1 text-sm font-semibold"
        />

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="tabular-nums">
            {preset.slots.length} komponen
          </Badge>

          {preset.slots.length > 0 && (
            <Badge
              variant="outline"
              className="border-sale-red/30 bg-sale-red/10 font-bold tabular-nums text-sale-red"
              title={
                bercabang > 0
                  ? "Angka pertama = kombinasi bawaan; angka kedua = kombinasi termurah, yang dilihat pelanggan sebagai 'mulai dari'."
                  : "Total harga katalog paket ini."
              }
            >
              {formatRupiah(total)}
              {bercabang > 0 && murah !== total && ` · dari ${formatRupiah(murah)}`}
              {!lengkap && " *"}
            </Badge>
          )}

          {bercabang > 0 && (
            <Badge variant="secondary" className="tabular-nums">
              {bercabang} bisa dipilih
            </Badge>
          )}

          <PerformanceBadge preset={preset} />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => onGeser(-1)}
            disabled={index === 0}
            aria-label="Naikkan urutan"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => onGeser(1)}
            disabled={index === jumlahPreset - 1}
            aria-label="Turunkan urutan"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="icon-sm"
            onClick={onHapus}
            aria-label={`Hapus ${preset.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {terbuka && (
        <div className="space-y-3 border-t bg-muted/20 p-3">
          <Input
            value={preset.summary}
            onChange={(e) => onUbah({ summary: e.target.value })}
            placeholder="Ringkasan satu kalimat — muncul di bawah nama paket."
            aria-label="Ringkasan paket"
            className="h-9 text-sm"
          />

          <PresetImages urls={preset.images} onChange={(images) => onUbah({ images })} />

          <PerformanceEditor
            slots={preset.slots}
            steps={steps}
            productNames={namaProduk}
            games={games}
            performance={preset.performance ?? null}
            onChange={(performance) =>
              // `undefined`, bukan `null`: bidangnya opsional, dan menyimpan
              // null berarti menuliskan kunci kosong ke kolom JSON yang lalu
              // harus ditangani setiap pembaca berikutnya.
              onUbah({ performance: performance ?? undefined })
            }
          />

          <div className="grid gap-2">
            {steps.map((step) => (
              <SlotEditor
                key={step.id}
                step={step}
                options={preset.slots.find((s) => s.stepId === step.id)?.options ?? []}
                saranAwal={initialOptions[step.id] ?? []}
                namaProduk={namaProduk}
                hargaProduk={hargaProduk}
                onHargaProduk={onHargaProduk}
                // Batas slot bercabang ditegakkan di parser juga; di sini supaya
                // staff tahu SEBELUM menyimpan, bukan setelah pilihannya
                // diam-diam dikunci.
                bolehTambahCabang={bercabang < MAX_BRANCHING_SLOTS}
                onNamaProduk={onNamaProduk}
                onChange={(opts) => onUbahSlot(step.id, opts)}
              />
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

/**
 * Status analisis performa, terlihat tanpa membuka paketnya.
 *
 * Status "perlu hitung ulang" ikut ditampilkan di sini — bukan cuma di dalam
 * editor — karena itulah satu-satunya keadaan yang membuat panel performa
 * menghilang dari halaman pelanggan. Staff yang mengganti satu komponen di lima
 * paket harus bisa melihat akibatnya tanpa membuka kelimanya satu per satu.
 */
function PerformanceBadge({ preset }: { preset: PcPrebuildPreset }) {
  const performance: PrebuildPerformance | null = preset.performance ?? null
  if (!performance) return null

  if (performance.fingerprint !== fingerprintSlots(preset.slots)) {
    return <Badge variant="destructive">Performa: perlu hitung ulang</Badge>
  }
  if (!performance.published) return <Badge variant="secondary">Performa: draf</Badge>
  return <Badge>Performa: tayang</Badge>
}
