"use client"

import { useState } from "react"
import { Eye, EyeOff, RefreshCw, Sparkles, Trash2, TriangleAlert, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { PerformancePanel } from "@/features/pc-prebuild/components/performance/performance-panel"
import type { PcBuilderStepConfig } from "@/lib/pc-builder/config"
import {
  COMPONENT_ROLE_LABELS,
  detectComponentRole,
  missingRequiredRoles,
} from "@/lib/pc-prebuild/component-roles"
import type { PcPrebuildSlot } from "@/lib/pc-prebuild/config"
import type { PrebuildGame } from "@/lib/pc-prebuild/games"
import {
  MAX_UPGRADE_SUGGESTIONS,
  PREBUILD_QUALITY_PRESETS,
  PREBUILD_RESOLUTION_TIERS,
  PREBUILD_UPGRADE_PRIORITIES,
  PREBUILD_USE_CASES,
  fingerprintSlots,
  type PrebuildPerformance,
  type PrebuildQuality,
  type PrebuildResolutionTierId,
  type PrebuildUpgradePriority,
  type PrebuildUseCaseId,
} from "@/lib/pc-prebuild/performance"

/**
 * Tombol "Hitung Performa dengan AI" beserta penyuntingan hasilnya.
 *
 * ## Kenapa hasilnya bisa disunting sama sekali
 *
 * Karena angkanya perkiraan sebuah model, bukan pengukuran. Staff HNS yang
 * pernah merakit PC-nya tahu hal yang tidak diketahui model — bahwa unit ini
 * memakai casing berventilasi sempit, atau bahwa game tertentu sedang bermasalah
 * di driver terbaru. Tanpa jalan menyunting, satu angka yang meleset cuma bisa
 * diperbaiki dengan menghitung ulang dan berharap.
 *
 * ## Kenapa ada dialog konfirmasi
 *
 * Bukan karena berbahaya, tapi karena tidak bisa dibatalkan: hasil lama tertimpa,
 * kuota AI terpakai, dan suntingan tangan yang sudah dikerjakan staff hilang.
 * Tombol ini duduk di antara tombol-tombol lain yang semuanya murah.
 */

const INPUT_KECIL = "h-8 text-xs"

type Props = {
  slots: PcPrebuildSlot[]
  steps: PcBuilderStepConfig[]
  /** Nama produk yang sudah dikenal panel — dipakai menebak peran komponen. */
  productNames: Record<number, string>
  games: PrebuildGame[]
  performance: PrebuildPerformance | null
  onChange: (performance: PrebuildPerformance | null) => void
}

export function PerformanceEditor({
  slots,
  steps,
  productNames,
  games,
  performance,
  onChange,
}: Props) {
  const [memproses, setMemproses] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const [konfirmasi, setKonfirmasi] = useState(false)
  const [hapusTerbuka, setHapusTerbuka] = useState(false)

  const namaStep = new Map(steps.map((step) => [step.id, step.name]))

  // Peran ditebak dari aturan yang SAMA dengan yang dipakai endpoint AI
  // (lib/pc-prebuild/component-roles.ts). Kalau tombolnya menyala di sini tapi
  // servernya menolak, yang salah adalah dua daftar kata kunci yang berbeda —
  // dan itulah yang dicegah dengan memakai satu berkas untuk keduanya.
  const peran = slots
    .filter((slot) => slot.options.length > 0)
    .map((slot) =>
      detectComponentRole(
        namaStep.get(slot.stepId),
        productNames[slot.options[0].productId]
      )
    )
  const kurang = missingRequiredRoles(peran)
  const bisaHitung = kurang.length === 0 && !memproses

  // Sidik jari dihitung ulang di sini supaya status "basi" muncul SEKETIKA saat
  // staff mengganti komponen — bukan setelah disimpan dan halaman dimuat ulang.
  const basi = performance !== null && performance.fingerprint !== fingerprintSlots(slots)

  async function hitung() {
    setMemproses(true)
    setGalat(null)
    try {
      const res = await fetch("/api/admin/pc-prebuild-performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal menghitung performa")
      onChange(data.performance as PrebuildPerformance)
    } catch (err) {
      setGalat(err instanceof Error ? err.message : "Gagal menghitung performa")
    } finally {
      setMemproses(false)
    }
  }

  function ubah(patch: Partial<PrebuildPerformance>) {
    if (!performance) return
    onChange({ ...performance, ...patch })
  }

  return (
    <div className="space-y-3 rounded-xl border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold">Analisis Performa</span>
          <StatusBadge performance={performance} basi={basi} />
        </div>

        <div className="flex items-center gap-1.5">
          {performance && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setHapusTerbuka(true)}
              disabled={memproses}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Hapus
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={() => setKonfirmasi(true)}
            disabled={!bisaHitung}
          >
            {performance ? (
              <RefreshCw className={`h-3.5 w-3.5 ${memproses ? "animate-spin" : ""}`} />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {memproses ? "Menghitung…" : performance ? "Hitung ulang" : "Hitung dengan AI"}
          </Button>
        </div>
      </div>

      {kurang.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Lengkapi dulu{" "}
          <span className="font-semibold">
            {kurang.map((r) => COMPONENT_ROLE_LABELS[r]).join(", ")}
          </span>{" "}
          untuk bisa menghitung performa.
        </p>
      )}

      {galat && (
        <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {galat}
        </p>
      )}

      {basi && (
        <p className="flex items-start gap-2 rounded-lg border border-(--chart-3)/40 bg-(--chart-3)/10 px-3 py-2 text-xs">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--chart-3)" />
          Komponen paket berubah sejak analisis ini dibuat. Pelanggan tidak melihat panel performa
          sampai dihitung ulang.
        </p>
      )}

      {performance && (
        <>
          {/* Langkah terakhir yang paling gampang terlewat.
              Versi pertama menaruhnya sebagai baris abu-abu tenang di antara
              blok-blok lain, dan akibatnya persis seperti yang bisa diduga:
              analisis dihitung, disimpan, terlihat sempurna di pratinjau —
              lalu tidak muncul di halaman paket, dan tidak ada yang tahu
              kenapa. Selama masih draf, baris ini SENGAJA berwarna dan
              berbunyi seperti tugas yang belum selesai. */}
          <label
            className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
              performance.published
                ? "border-input bg-muted/30"
                : "border-primary/40 bg-primary/5"
            }`}
          >
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-xs font-bold">
                {performance.published ? (
                  <Eye className="h-3.5 w-3.5" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5 text-primary" />
                )}
                {performance.published
                  ? "Tampil di halaman paket"
                  : "Belum tampil — masih draf"}
              </span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                {performance.published
                  ? basi
                    ? "Tertahan karena komponennya berubah. Hitung ulang supaya tampil lagi."
                    : "Pelanggan melihat panel ini setelah kamu menekan Simpan."
                  : "Nyalakan sakelar ini, lalu tekan Simpan di bawah, supaya pelanggan bisa melihatnya."}
              </span>
            </span>
            <Switch
              checked={performance.published}
              onCheckedChange={(checked) => ubah({ published: checked })}
            />
          </label>

          <EditorRingkas performance={performance} onChange={ubah} games={games} />

          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">
              {performance.published && !basi
                ? "Pratinjau — persis yang dilihat pelanggan"
                : "Pratinjau — BELUM dilihat pelanggan"}
            </p>
            <PerformancePanel performance={performance} games={games} />
          </div>
        </>
      )}

      <ConfirmDialog
        open={konfirmasi}
        onOpenChange={setKonfirmasi}
        title={performance ? "Hitung ulang performa paket ini?" : "Hitung performa paket ini?"}
        description={
          performance
            ? "Hasil yang sekarang — termasuk angka yang sudah kamu sunting sendiri — akan tertimpa hasil baru. Sakelar tampil ke pelanggan akan kembali mati."
            : "Komponen paket ini dikirim ke AI untuk dianalisis. Hasilnya masuk sebagai draf; tidak langsung terlihat pelanggan."
        }
        confirmLabel="Ya, hitung"
        onConfirm={hitung}
      />

      <ConfirmDialog
        open={hapusTerbuka}
        onOpenChange={setHapusTerbuka}
        title="Hapus analisis performa paket ini?"
        description="Panel performa hilang dari halaman paket. Paket dan komponennya tidak terpengaruh, dan analisisnya bisa dihitung lagi kapan saja."
        confirmLabel="Hapus"
        destructive
        onConfirm={() => onChange(null)}
      />
    </div>
  )
}

function StatusBadge({
  performance,
  basi,
}: {
  performance: PrebuildPerformance | null
  basi: boolean
}) {
  if (!performance) return <Badge variant="outline">Belum dianalisis</Badge>
  if (basi) return <Badge variant="destructive">Perlu hitung ulang</Badge>
  if (!performance.published) return <Badge variant="secondary">Draf</Badge>
  return <Badge>Tayang</Badge>
}

/**
 * Penyuntingan hasil. Sengaja padat: ini layar perbaikan, bukan layar isian —
 * yang lazim terjadi adalah membetulkan satu-dua angka, bukan mengisi ulang
 * semuanya dari nol.
 */
function EditorRingkas({
  performance,
  onChange,
  games,
}: {
  performance: PrebuildPerformance
  onChange: (patch: Partial<PrebuildPerformance>) => void
  games: PrebuildGame[]
}) {
  const namaGame = new Map(games.map((g) => [g.id, g.name]))

  function ubahUseCase(id: PrebuildUseCaseId, score: number) {
    const ada = performance.useCases.some((u) => u.id === id)
    const daftar = ada
      ? performance.useCases.map((u) => (u.id === id ? { ...u, score } : u))
      : [...performance.useCases, { id, score }]
    onChange({ useCases: daftar })
  }

  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-3">
      {/* --- Resolusi & setelan grafis --- */}
      <div className="space-y-2">
        <p className="text-xs font-semibold">Kelas performa</p>
        <div className="flex flex-wrap gap-1.5">
          {PREBUILD_RESOLUTION_TIERS.map((tier) => (
            <PilihanKecil
              key={tier.id}
              aktif={performance.resolution.tier === tier.id}
              title={tier.description}
              onClick={() =>
                onChange({
                  resolution: { ...performance.resolution, tier: tier.id as PrebuildResolutionTierId },
                })
              }
            >
              {tier.label}
            </PilihanKecil>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PREBUILD_QUALITY_PRESETS.map((quality) => (
            <PilihanKecil
              key={quality}
              aktif={performance.resolution.quality === quality}
              onClick={() =>
                onChange({
                  resolution: { ...performance.resolution, quality: quality as PrebuildQuality },
                })
              }
            >
              {quality}
            </PilihanKecil>
          ))}
        </div>
      </div>

      {/* --- Ringkasan --- */}
      <label className="block space-y-1">
        <span className="text-xs font-semibold">Ringkasan untuk pelanggan</span>
        <textarea
          value={performance.headline}
          onChange={(e) => onChange({ headline: e.target.value })}
          rows={2}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
        />
      </label>

      {/* --- Use case --- */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold">Kecocokan (0-100)</p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {PREBUILD_USE_CASES.map((useCase) => {
            const nilai = performance.useCases.find((u) => u.id === useCase.id)?.score ?? 0
            return (
              <label key={useCase.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-xs" title={useCase.description}>
                  {useCase.label}
                </span>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={nilai}
                  onChange={(e) => ubahUseCase(useCase.id, Number(e.target.value))}
                  className={`w-16 ${INPUT_KECIL}`}
                />
              </label>
            )
          })}
        </div>
      </div>

      {/* --- FPS --- */}
      {performance.gaming.fps.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold">Estimasi FPS</p>
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <input
                type="checkbox"
                checked={performance.gaming.suitable}
                onChange={(e) =>
                  onChange({ gaming: { ...performance.gaming, suitable: e.target.checked } })
                }
                className="h-3.5 w-3.5 accent-[var(--primary)]"
              />
              Layak untuk gaming
            </label>
          </div>

          <div className="space-y-1">
            {performance.gaming.fps.map((entry, i) => (
              <div key={entry.gameId} className="flex items-center gap-1.5">
                <span className="min-w-0 flex-1 truncate text-xs">
                  {namaGame.get(entry.gameId) ?? entry.gameId}
                </span>
                <Input
                  type="number"
                  min={0}
                  value={entry.avg}
                  aria-label={`FPS rata-rata ${entry.gameId}`}
                  onChange={(e) => {
                    const fps = performance.gaming.fps.map((f, idx) =>
                      idx === i ? { ...f, avg: Number(e.target.value) } : f
                    )
                    onChange({ gaming: { ...performance.gaming, fps } })
                  }}
                  className={`w-16 ${INPUT_KECIL}`}
                />
                <Input
                  type="number"
                  min={0}
                  value={entry.low}
                  aria-label={`1% low ${entry.gameId}`}
                  onChange={(e) => {
                    const fps = performance.gaming.fps.map((f, idx) =>
                      idx === i ? { ...f, low: Number(e.target.value) } : f
                    )
                    onChange({ gaming: { ...performance.gaming, fps } })
                  }}
                  className={`w-16 ${INPUT_KECIL}`}
                />
                <select
                  value={entry.quality}
                  aria-label={`Setelan grafis ${entry.gameId}`}
                  onChange={(e) => {
                    const fps = performance.gaming.fps.map((f, idx) =>
                      idx === i ? { ...f, quality: e.target.value as PrebuildQuality } : f
                    )
                    onChange({ gaming: { ...performance.gaming, fps } })
                  }}
                  className="h-8 rounded-lg border border-input bg-background px-1.5 text-xs outline-none focus:border-primary"
                >
                  {PREBUILD_QUALITY_PRESETS.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Hapus baris ${entry.gameId}`}
                  onClick={() =>
                    onChange({
                      gaming: {
                        ...performance.gaming,
                        fps: performance.gaming.fps.filter((_, idx) => idx !== i),
                      },
                    })
                  }
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <Input
            value={performance.gaming.note}
            placeholder="Catatan gaming (opsional)"
            aria-label="Catatan gaming"
            onChange={(e) =>
              onChange({ gaming: { ...performance.gaming, note: e.target.value } })
            }
            className={INPUT_KECIL}
          />
        </div>
      )}

      {/* --- Bottleneck --- */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold">Keseimbangan komponen</p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs">
            CPU
            <Input
              type="number"
              min={0}
              max={100}
              value={performance.bottleneck.cpu}
              onChange={(e) =>
                onChange({
                  bottleneck: { ...performance.bottleneck, cpu: Number(e.target.value) },
                })
              }
              className={`w-16 ${INPUT_KECIL}`}
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs">
            GPU
            <Input
              type="number"
              min={0}
              max={100}
              value={performance.bottleneck.gpu}
              onChange={(e) =>
                onChange({
                  bottleneck: { ...performance.bottleneck, gpu: Number(e.target.value) },
                })
              }
              className={`w-16 ${INPUT_KECIL}`}
            />
          </label>
        </div>
        <Input
          value={performance.bottleneck.verdict}
          placeholder="Satu kalimat kesimpulan"
          aria-label="Kesimpulan keseimbangan"
          onChange={(e) =>
            onChange({ bottleneck: { ...performance.bottleneck, verdict: e.target.value } })
          }
          className={INPUT_KECIL}
        />
      </div>

      {/* --- Saran upgrade --- */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold">
          Saran upgrade ({performance.upgrades.length}/{MAX_UPGRADE_SUGGESTIONS})
        </p>
        {performance.upgrades.map((upgrade, i) => (
          <div
            key={`${upgrade.component}-${i}`}
            className="grid gap-1.5 rounded-lg border bg-background p-2 sm:grid-cols-[8rem_1fr_1fr_6rem_auto]"
          >
            <Input
              value={upgrade.component}
              aria-label="Komponen"
              placeholder="Komponen"
              onChange={(e) =>
                onChange({
                  upgrades: performance.upgrades.map((u, idx) =>
                    idx === i ? { ...u, component: e.target.value } : u
                  ),
                })
              }
              className={INPUT_KECIL}
            />
            <Input
              value={upgrade.from}
              aria-label="Dari"
              placeholder="Dari"
              onChange={(e) =>
                onChange({
                  upgrades: performance.upgrades.map((u, idx) =>
                    idx === i ? { ...u, from: e.target.value } : u
                  ),
                })
              }
              className={INPUT_KECIL}
            />
            <Input
              value={upgrade.to}
              aria-label="Menjadi"
              placeholder="Menjadi"
              onChange={(e) =>
                onChange({
                  upgrades: performance.upgrades.map((u, idx) =>
                    idx === i ? { ...u, to: e.target.value } : u
                  ),
                })
              }
              className={INPUT_KECIL}
            />
            <select
              value={upgrade.priority}
              aria-label="Prioritas"
              onChange={(e) =>
                onChange({
                  upgrades: performance.upgrades.map((u, idx) =>
                    idx === i ? { ...u, priority: e.target.value as PrebuildUpgradePriority } : u
                  ),
                })
              }
              className="h-8 rounded-lg border border-input bg-background px-1.5 text-xs outline-none focus:border-primary"
            >
              {PREBUILD_UPGRADE_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Hapus saran ${upgrade.component}`}
              onClick={() =>
                onChange({ upgrades: performance.upgrades.filter((_, idx) => idx !== i) })
              }
            >
              <X className="h-3.5 w-3.5" />
            </Button>

            <Input
              value={upgrade.impact}
              aria-label="Dampak"
              placeholder="Dampaknya satu kalimat"
              onChange={(e) =>
                onChange({
                  upgrades: performance.upgrades.map((u, idx) =>
                    idx === i ? { ...u, impact: e.target.value } : u
                  ),
                })
              }
              className={`${INPUT_KECIL} sm:col-span-5`}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function PilihanKecil({
  aktif,
  title,
  onClick,
  children,
}: {
  aktif: boolean
  title?: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={aktif}
      className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
        aktif
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background hover:bg-muted"
      }`}
    >
      {children}
    </button>
  )
}
