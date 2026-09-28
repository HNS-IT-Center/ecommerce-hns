"use client"

import { useMemo, useState } from "react"
import {
  Cpu,
  FileText,
  Info,
  Loader2,
  MonitorCog,
  Sparkles,
  TriangleAlert,
} from "lucide-react"

import { RichTextEditor } from "@/components/admin/rich-text-editor"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Switch } from "@/components/ui/switch"
import type { PcPrebuildSlot } from "@/lib/pc-prebuild/config"
import { checkFpsPlausibility, type FpsWarning } from "@/lib/pc-prebuild/fps-plausibility"
import type { PrebuildGame } from "@/lib/pc-prebuild/games"
import {
  PREBUILD_FPS_QUALITIES,
  PREBUILD_FPS_RESOLUTIONS,
  PREBUILD_QUALITY_PRESETS,
  PREBUILD_RESOLUTION_TIERS,
  PREBUILD_USE_CASES,
  type PrebuildPerformance,
  type PrebuildQuality,
  type PrebuildResolutionTierId,
} from "@/lib/pc-prebuild/performance"
import { stripHtml } from "@/lib/utils/html"
import { FpsMatrixChart } from "@/features/pc-prebuild/components/fps-matrix-chart"

/**
 * Panel "Analisis dengan AI" untuk satu paket.
 *
 * ## Konfirmasi sebelum menembak Groq — dan kenapa
 *
 * Satu klik menghabiskan jatah token yang nyata: matriksnya
 * `game × 3 resolusi × 3 setelan`, jadi dua belas game berarti 108 angka yang
 * harus dikeluarkan model. Tombol yang langsung menembak membuat klik iseng
 * — atau klik ganda karena hasilnya belum muncul — berharga sama dengan analisis
 * sungguhan. Dialognya menyebut angkanya, bukan sekadar bertanya "yakin?".
 *
 * ## Hasilnya selalu DRAF
 *
 * `published` bawaannya `false` dan tidak pernah diisi model. Yang memutuskan
 * sebuah perkiraan layak dilihat pelanggan adalah staff, dan seluruh angkanya
 * bisa disunting lebih dulu — teknisi HNS tahu hal yang tidak diketahui model:
 * casing berventilasi sempit, driver yang sedang bermasalah.
 */

type Props = {
  presetId: string
  presetName: string
  slots: PcPrebuildSlot[]
  games: PrebuildGame[]
  performance: PrebuildPerformance | null
  stale: boolean
  /** Barang yang punya pilihan tukar. Yang dianalisis hanya BAWAANNYA. */
  branchingCount: number
  onChange: (performance: PrebuildPerformance) => void
  /** Deskripsi performa tulisan staff — milik PRESET, bukan milik `performance`. */
  performanceDescription: string
  onDescriptionChange: (value: string) => void
}

export function AnalysisPanel({
  presetId,
  presetName,
  slots,
  games,
  performance,
  stale,
  branchingCount,
  onChange,
  performanceDescription,
  onDescriptionChange,
}: Props) {
  const [konfirmasi, setKonfirmasi] = useState(false)
  const [menghitung, setMenghitung] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const jumlahSel = games.length * PREBUILD_FPS_RESOLUTIONS.length * PREBUILD_FPS_QUALITIES.length

  // Dihitung ulang setiap kali angkanya berubah — termasuk saat staff menyunting
  // manual, bukan cuma setelah AI menjawab. Suntingan tangan bisa keliru dengan
  // cara yang sama persis, dan justru itu yang paling sulit ditangkap mata.
  const peringatanFps = useMemo(
    () => (performance ? checkFpsPlausibility(performance.gaming.fps, games) : []),
    [performance, games]
  )

  async function hitung() {
    setMenghitung(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/pc-prebuild-performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presetId, name: presetName, slots }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Analisis gagal.")

      onChange(data.performance as PrebuildPerformance)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analisis gagal.")
    } finally {
      setMenghitung(false)
    }
  }

  const tier = performance
    ? PREBUILD_RESOLUTION_TIERS.find((t) => t.id === performance.resolution.tier)
    : null

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-bold">Estimasi performa</h3>
          <p className="text-xs text-muted-foreground">
            Dihitung AI dari komponen paket. Angkanya perkiraan dan bisa kamu sunting.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setKonfirmasi(true)}
          disabled={menghitung || slots.length === 0}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-green px-4 py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {menghitung ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Menghitung…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              {performance ? "Hitung ulang" : "Analisis dengan AI"}
            </>
          )}
        </button>
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-xl border border-sale-red/30 bg-sale-red/5 px-3 py-2.5 text-sm text-sale-red">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      {stale && performance && (
        <p className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 px-3 py-2.5 text-sm">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>
            Komponen yang memengaruhi performa berubah sejak analisis ini dibuat. Angkanya{" "}
            <strong>masih tayang untuk pelanggan</strong> — jadi ia menjelaskan susunan yang lama
            sampai Anda menghitung ulang.
          </span>
        </p>
      )}

      {/* Batas yang harus terlihat SEBELUM staff menekan tombolnya, bukan
          disimpulkan sendiri dari angka yang keluar. Analisis hanya membaca
          BAWAAN tiap barang — pilihan tukarnya tidak ikut dihitung, jadi paket
          dengan prosesor bercabang punya satu angka FPS yang cuma berlaku untuk
          prosesor bawaannya. Menghitung seluruh kombinasi berarti satu panggilan
          AI per kombinasi (2 CPU × 2 RAM = 4), dan itu belum dibuat. */}
      {branchingCount > 0 && (
        <p className="flex items-start gap-2 rounded-xl border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {branchingCount} komponen punya pilihan tukar. Yang dianalisis hanya{" "}
            <strong className="text-foreground">pilihan bawaannya</strong> — angka di bawah tidak
            berlaku untuk komponen penggantinya.
          </span>
        </p>
      )}

      {!performance ? (
        <div className="space-y-5">
          <div className="rounded-xl border border-dashed px-4 py-10 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
            <p className="mt-3 text-sm font-semibold">Paket ini belum pernah dianalisis</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
              Analisis menghasilkan kelas resolusi, kecocokan per kebutuhan, estimasi FPS per game,
              dan perkiraan keseimbangan CPU/GPU.
            </p>
          </div>

          {/* Tetap dirender untuk paket yang belum pernah dianalisis: ini
              tulisan tangan staff, bukan jawaban model. Kalau ia hanya muncul
              bersama hasil analisis, satu-satunya cara menulis deskripsi PDF
              adalah menjalankan analisis AI lebih dulu. */}
          <PdfDescriptionCard value={performanceDescription} onChange={onDescriptionChange} />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Sakelar tayang paling atas: ia keputusan terpenting di panel ini,
              dan yang paling mudah terlupakan kalau ditaruh di bawah setelah
              layar penuh angka. */}
          <label className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
            <span className="min-w-0">
              <span className="block text-sm font-semibold">Tampilkan ke pelanggan</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {performance.published
                  ? "Panel ini akan tampil di halaman paket."
                  : "Masih draf — hanya terlihat di panel admin."}
              </span>
            </span>
            <Switch
              checked={performance.published}
              onCheckedChange={(v) => onChange({ ...performance, published: v === true })}
              aria-label="Tampilkan estimasi performa ke pelanggan"
            />
          </label>

          <PdfDescriptionCard value={performanceDescription} onChange={onDescriptionChange} />

          {/*
            Tag sasaran dan kalimat pembuka BISA DISUNTING TANGAN.

            Keduanya jawaban model, dan model tidak tahu hal yang diketahui
            teknisi HNS: casing berventilasi sempit, panel 75 Hz yang membuat
            "1440p High" tidak ada gunanya, driver yang sedang bermasalah.
            Sebelumnya keduanya cuma bisa diubah dengan menjalankan ulang
            seluruh analisis — satu panggilan Groq penuh untuk membetulkan satu
            kata, dan itu pun hasilnya belum tentu berubah.

            Yang disunting tersimpan bersama presetnya dan bertahan sampai
            analisis dijalankan ulang; dialog konfirmasi "Hitung ulang" sudah
            menyebutkan itu.
          */}
          <div className="rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-0">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Sasaran resolusi
                </span>
                <select
                  value={performance.resolution.tier}
                  onChange={(e) =>
                    onChange({
                      ...performance,
                      resolution: {
                        ...performance.resolution,
                        tier: e.target.value as PrebuildResolutionTierId,
                      },
                    })
                  }
                  className="h-9 rounded-lg border bg-background px-2.5 text-sm font-semibold outline-none transition-colors focus:border-brand-green"
                >
                  {PREBUILD_RESOLUTION_TIERS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="min-w-0">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Setelan
                </span>
                <select
                  value={performance.resolution.quality}
                  onChange={(e) =>
                    onChange({
                      ...performance,
                      resolution: {
                        ...performance.resolution,
                        quality: e.target.value as PrebuildQuality,
                      },
                    })
                  }
                  className="h-9 rounded-lg border bg-background px-2.5 text-sm font-semibold outline-none transition-colors focus:border-brand-green"
                >
                  {PREBUILD_QUALITY_PRESETS.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                </select>
              </label>

              {/* Pratinjau tag persis seperti yang dilihat pelanggan — dua
                  select di atas tidak menunjukkan bentuk jadinya, dan inilah
                  satu-satunya bagian analisis yang tampil sebagai label tunggal
                  di halaman paket. */}
              <span className="inline-flex items-center gap-1.5 self-center rounded-full bg-brand-green px-3 py-1 text-xs font-bold text-primary-foreground">
                <MonitorCog className="h-3.5 w-3.5" />
                {tier?.label ?? performance.resolution.tier} {performance.resolution.quality}
              </span>

              {performance.generatedAt && (
                <span className="self-center text-[11px] text-muted-foreground">
                  Dihitung {new Date(performance.generatedAt).toLocaleString("id-ID")}
                </span>
              )}
            </div>

            <label className="mt-3 block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Kalimat pembuka
              </span>
              <textarea
                value={performance.headline}
                onChange={(e) => onChange({ ...performance, headline: e.target.value })}
                rows={2}
                placeholder="Satu-dua kalimat, gaya konsultan IT."
                className="w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-brand-green"
              />
            </label>
          </div>

          {performance.useCases.length > 0 && (
            <div className="rounded-xl border bg-card p-4">
              <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Cocok untuk
              </h4>
              <div className="space-y-2">
                {performance.useCases.map((uc) => {
                  const meta = PREBUILD_USE_CASES.find((u) => u.id === uc.id)
                  return (
                    <div key={uc.id} className="flex items-center gap-3">
                      <span className="w-32 shrink-0 truncate text-xs font-semibold sm:w-40">
                        {meta?.label ?? uc.id}
                      </span>
                      <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-brand-green transition-all duration-300"
                          style={{ width: `${uc.score}%` }}
                        />
                      </div>
                      <span className="w-9 shrink-0 text-right text-xs font-bold tabular-nums">
                        {uc.score}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="rounded-xl border bg-card p-4">
            <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Estimasi FPS
            </h4>
            {performance.gaming.suitable === false && performance.gaming.note && (
              <p className="mb-3 flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {performance.gaming.note}
              </p>
            )}
            <FpsMatrixChart
              fps={performance.gaming.fps}
              games={games}
              onChange={(fps) =>
                onChange({ ...performance, gaming: { ...performance.gaming, fps } })
              }
            />
          </div>

          {/*
            Keseimbangan CPU/GPU dan "Perlu diperiksa" BERBAGI satu baris.

            Keduanya catatan pinggir untuk staff, bukan isi paket: yang satu
            angka bantu menilai susunan, yang satu daftar sel FPS yang polanya
            mencurigakan. Masing-masing sebagai kartu selebar panel membuat
            keduanya terbaca sepenting matriks FPS di atasnya, sekaligus
            mendorong kolom deskripsi dan tombol hitung ulang jauh ke bawah.

            Kalau tidak ada peringatan sama sekali, kartu keseimbangan kembali
            selebar panel — kolom kosong di sebelahnya cuma menyisakan lubang.
          */}
          <div className={`grid gap-4 ${peringatanFps.length > 0 ? "lg:grid-cols-2" : ""}`}>
            <div className="rounded-xl border bg-card p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Keseimbangan CPU &amp; GPU
                </h4>
                {/* Ditandai di layar, bukan cuma di komentar kode: yang membangun
                    halaman pelanggan nanti belum tentu membaca berkas ini. */}
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Khusus admin
                </span>
              </div>
              <BottleneckBar cpu={performance.bottleneck.cpu} gpu={performance.bottleneck.gpu} />
              {performance.bottleneck.verdict && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {performance.bottleneck.verdict}
                </p>
              )}
            </div>

            <FpsWarnings warnings={peringatanFps} />
          </div>

        </div>
      )}

      <ConfirmDialog
        open={konfirmasi}
        onOpenChange={setKonfirmasi}
        title={performance ? "Hitung ulang analisis paket ini?" : "Analisis paket ini dengan AI?"}
        description={
          <>
            Sekali jalan model menghitung <strong>{jumlahSel} angka FPS</strong> ({games.length}{" "}
            game × {PREBUILD_FPS_RESOLUTIONS.length} resolusi × {PREBUILD_FPS_QUALITIES.length}{" "}
            setelan). Jatah token Groq terbatas, jadi jalankan setelah komponennya benar-benar
            final.
            {performance && " Hasil yang sekarang akan ditimpa, termasuk angka yang sudah kamu sunting."}
          </>
        }
        confirmLabel={performance ? "Hitung ulang" : "Jalankan analisis"}
        onConfirm={hitung}
      />
    </div>
  )
}

/**
 * Temuan kewajaran matriks FPS — MENANDAI, bukan memperbaiki.
 *
 * Yang muncul di sini cuma hal yang bisa diputuskan mesin: urutan sel yang
 * terbalik, rasio 1% low yang mustahil, sel yang belum terisi. Apakah angkanya
 * sendiri tepat untuk paket ini tetap penilaian staff — dan justru itu sebabnya
 * daftar ini tidak boleh menghalangi penyimpanan. Peringatan yang memblokir
 * akan mendorong orang mengarang angka supaya lolos, bukan memeriksanya.
 *
 * Tidak dirender sama sekali kalau tidak ada temuan: kotak kosong bertuliskan
 * "tidak ada masalah" cuma menambah yang harus dibaca staff setiap kali.
 */
/**
 * Deskripsi performa untuk lembar PDF — tulisan tangan staff.
 *
 * Komponen sendiri karena dirender DUA KALI: di bawah sakelar tayang saat
 * analisisnya sudah ada, dan di bawah keadaan kosong saat paketnya belum
 * pernah dianalisis. Ia tidak boleh bergantung pada ada-tidaknya hasil AI.
 *
 * Letaknya tepat di bawah "Tampilkan ke pelanggan" dan bukan di dasar panel:
 * keduanya keputusan yang diambil staff sendiri, sementara semua yang di
 * bawahnya adalah angka yang dibaca. Menaruhnya paling bawah membuatnya
 * ditemukan setelah layar penuh angka — dan kolom yang tidak ditemukan sama
 * saja dengan kolom yang tidak ada.
 *
 * Rich text, sama seperti deskripsi produk dan halaman kebijakan: isinya masuk
 * ke PDF sebagai paragraf dan daftar, dan teks polos memaksa staff menyerahkan
 * penataannya ke lembar cetak.
 */
function PdfDescriptionCard({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  // Yang dihitung teksnya, bukan HTML-nya: staff menulis kalimat, dan angka
  // yang melonjak karena satu tombol tebal ditekan tidak berarti apa-apa
  // baginya.
  const panjangTeks = stripHtml(value).length

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <h4 className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <FileText className="h-3.5 w-3.5" />
          Deskripsi performa untuk PDF
        </h4>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          Ditulis staff
        </span>
      </div>

      <p className="mb-2 text-[11px] text-muted-foreground">
        Uraian performa PC ini untuk lembar PDF paket — bukan{" "}
        <span className="font-semibold">Ringkasan</span> di bagian 1, yang menjelaskan paket ini
        untuk siapa. Tidak ikut ditimpa saat analisis AI dijalankan ulang.
      </p>

      <RichTextEditor
        value={value}
        onChange={onChange}
        placeholder="Mis. Rakitan ini dirancang untuk gaming 1440p pada setelan tinggi…"
        heightClass="min-h-40 max-h-[20rem]"
        emptyPreviewHtml="<p>Belum ada deskripsi performa.</p>"
      />

      <p className="mt-1 text-right text-[11px] tabular-nums text-muted-foreground">
        {panjangTeks} karakter teks
      </p>
    </div>
  )
}

function FpsWarnings({ warnings }: { warnings: FpsWarning[] }) {
  if (warnings.length === 0) return null

  // Kartu penuh, bukan kotak kecil yang menempel di bawah matriks: sejak ia
  // berbagi baris dengan kartu keseimbangan, keduanya harus punya bingkai yang
  // sama tingginya supaya barisnya tidak terlihat pincang. Nada kuningnya
  // dipertahankan — ini tetap peringatan, bukan keterangan.
  return (
    <div className="rounded-xl border border-warning/40 bg-warning/5 p-4">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-warning">
        <TriangleAlert className="h-3.5 w-3.5" />
        Perlu diperiksa ({warnings.length})
      </p>
      <ul className="space-y-1">
        {warnings.map((w, i) => (
          <li key={`${w.gameId}-${i}`} className="text-[11px] leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">{w.gameName}</span> — {w.message}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Dua batang berhadapan, bukan satu batang bertingkat.
 *
 * Yang ingin dibaca staff adalah SELISIHNYA — komponen mana yang menahan yang
 * lain. Selisih paling terbaca kalau kedua angka berbagi sumbu yang sama dan
 * ditumpuk, bukan kalau keduanya jadi potongan dari satu batang seratus persen
 * (yang justru menyiratkan keduanya berbagi satu kue).
 */
function BottleneckBar({ cpu, gpu }: { cpu: number; gpu: number }) {
  const selisih = Math.abs(cpu - gpu)

  return (
    <div className="space-y-2">
      <Baris label="CPU" icon={<Cpu className="h-3.5 w-3.5" />} value={cpu} />
      <Baris label="GPU" icon={<MonitorCog className="h-3.5 w-3.5" />} value={gpu} />
      {selisih >= 20 && (
        <p className="text-[11px] font-semibold text-warning">
          Selisih {selisih} poin — {cpu > gpu ? "CPU" : "GPU"} bekerja jauh lebih berat.
        </p>
      )}
    </div>
  )
}

function Baris({ label, icon, value }: { label: string; icon: React.ReactNode; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex w-16 shrink-0 items-center gap-1.5 text-xs font-semibold">
        {icon}
        {label}
      </span>
      <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-brand-green transition-all duration-300"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="w-9 shrink-0 text-right text-xs font-bold tabular-nums">{value}</span>
    </div>
  )
}
