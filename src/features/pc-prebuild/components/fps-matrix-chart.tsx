"use client"

import { useMemo, useState } from "react"
import { Pencil, Check } from "lucide-react"

import type { PrebuildGame } from "@/lib/pc-prebuild/games"
import {
  findFpsEntry,
  PREBUILD_FPS_QUALITIES,
  PREBUILD_FPS_RESOLUTIONS,
  type PrebuildFpsEntry,
  type PrebuildFpsQuality,
  type PrebuildFpsResolution,
} from "@/lib/pc-prebuild/performance"
import { fpsTone } from "../lib/fps-tone"
import { GameMark } from "./game-mark"

/**
 * Matriks estimasi FPS sebagai batang horizontal, dengan dua sumbu filter.
 *
 * DIPAKAI DUA TEMPAT: panel analisis di `/admin/pc-prebuild/<id>` (dengan
 * `onChange`, jadi angkanya bisa disunting staff) dan halaman paket di
 * `/pc-prebuild/<id>` (tanpa `onChange`, baca-saja). Karena itu ia tinggal di
 * `features/`, bukan di folder `_components` milik panel admin — halaman
 * pelanggan yang mengimpor dari dalam `app/admin/` adalah jalur yang akan
 * diputus orang berikutnya yang merapikan panel.
 *
 * Kalau disalin jadi dua, ambang warna FPS-nya pelan-pelan berbeda antara yang
 * dilihat staff saat menyusun paket dan yang dilihat pelanggan saat membelinya.
 *
 * ## Skalanya TETAP, bukan mengikuti isi filter
 *
 * Lebar batang dihitung terhadap FPS tertinggi di SELURUH matriks paket ini,
 * bukan terhadap yang tertinggi pada kombinasi yang sedang dilihat. Kalau
 * skalanya ikut berubah, berpindah dari "1440p High" ke "720p Low" akan
 * menampilkan batang dengan panjang yang mirip — padahal angkanya berlipat.
 * Justru perubahan panjang itulah yang membuat filter ini ada gunanya.
 *
 * ## Sel kosong ≠ nol
 *
 * Kombinasi yang tidak dihitung model ditandai "—", bukan batang nol. Batang
 * nol berarti "tidak sanggup menjalankan", dan itu pernyataan yang sama sekali
 * berbeda dari "tidak ditanyakan".
 */

type Props = {
  fps: PrebuildFpsEntry[]
  games: PrebuildGame[]
  /** Kosongkan untuk tampilan baca-saja (mis. pratinjau). */
  onChange?: (fps: PrebuildFpsEntry[]) => void
}

export function FpsMatrixChart({ fps, games, onChange }: Props) {
  const [resolution, setResolution] = useState<PrebuildFpsResolution>("1080p")
  const [quality, setQuality] = useState<PrebuildFpsQuality>("High")
  const [menyunting, setMenyunting] = useState(false)

  // Puncak seluruh matriks — lihat catatan "skalanya tetap" di kepala berkas.
  const puncak = useMemo(() => Math.max(60, ...fps.map((f) => f.avg)), [fps])

  // Game yang sudah dihapus staff dari daftar TIDAK dirender, tapi entrinya
  // tidak dibuang dari data: menyembunyikan satu game sementara tidak boleh
  // menghapus angka yang sudah dihitung untuknya.
  const baris = games.map((game) => ({
    game,
    entry: findFpsEntry(fps, game.id, resolution, quality),
  }))

  function ubahEntry(gameId: string, patch: { avg?: number; low?: number }) {
    if (!onChange) return

    const adaEntry = fps.some(
      (f) => f.gameId === gameId && f.resolution === resolution && f.quality === quality
    )

    if (!adaEntry) {
      const avg = patch.avg ?? 0
      onChange([
        ...fps,
        { gameId, resolution, quality, avg, low: Math.min(patch.low ?? avg, avg) },
      ])
      return
    }

    onChange(
      fps.map((f) => {
        if (f.gameId !== gameId || f.resolution !== resolution || f.quality !== quality) return f
        const avg = patch.avg ?? f.avg
        // `low` tidak pernah melebihi `avg` — dijepit di sini juga, bukan cuma
        // di parser, supaya angkanya sudah benar sebelum disimpan.
        return { ...f, avg, low: Math.min(patch.low ?? f.low, avg) }
      })
    )
  }

  if (games.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
        Daftar game masih kosong, jadi grid FPS tidak bisa ditampilkan.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {/* Dua baris filter. Di layar sempit keduanya menggulir mendatar sendiri
          alih-alih memaksa seluruh halaman ikut menggulir. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <FilterGroup
            label="Resolusi"
            options={PREBUILD_FPS_RESOLUTIONS}
            value={resolution}
            onChange={setResolution}
          />
          <FilterGroup
            label="Setelan"
            options={PREBUILD_FPS_QUALITIES}
            value={quality}
            onChange={setQuality}
          />
        </div>

        {onChange && (
          <button
            type="button"
            onClick={() => setMenyunting((m) => !m)}
            className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors hover:border-brand-green hover:text-brand-green sm:self-auto"
          >
            {menyunting ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
            {menyunting ? "Selesai" : "Sunting angka"}
          </button>
        )}
      </div>

      <div className="space-y-2.5">
        {baris.map(({ game, entry }) => {
          const nada = fpsTone(entry?.avg ?? 0)
          const lebarAvg = entry ? Math.max(2, (entry.avg / puncak) * 100) : 0
          const lebarLow = entry ? Math.max(1, (entry.low / puncak) * 100) : 0

          return (
            <div key={game.id} className="flex min-w-0 items-center gap-2 sm:gap-3">
              <div className="flex w-24 shrink-0 items-center gap-2 sm:w-40">
                <GameMark game={game} />
                <span className="min-w-0 flex-1 truncate text-xs font-semibold" title={game.name}>
                  {game.name}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                {entry ? (
                  <div className="relative h-6 overflow-hidden rounded-md bg-muted">
                    <div
                      className={`h-full rounded-md transition-all duration-300 ${nada.bar}`}
                      style={{ width: `${lebarAvg}%` }}
                    />
                    {/* Garis 1% low DI ATAS batang rata-rata, bukan batang kedua
                        di baris sendiri: yang ingin dilihat adalah seberapa jauh
                        ia tertinggal dari rata-rata, dan itu paling terbaca
                        kalau keduanya berbagi satu sumbu. */}
                    <div
                      className="absolute inset-y-0 border-r-2 border-foreground/40"
                      style={{ width: `${lebarLow}%` }}
                      title={`1% low: ${entry.low} FPS`}
                    />
                  </div>
                ) : (
                  <div className="flex h-6 items-center rounded-md border border-dashed px-2 text-[11px] text-muted-foreground">
                    Belum dihitung untuk kombinasi ini
                  </div>
                )}
              </div>

              {menyunting ? (
                <div className="flex shrink-0 items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    value={entry?.avg ?? 0}
                    onChange={(e) => ubahEntry(game.id, { avg: Number(e.target.value) })}
                    aria-label={`FPS rata-rata ${game.name}`}
                    className="w-14 rounded-md border px-1.5 py-1 text-right text-xs tabular-nums outline-none focus:border-brand-green"
                  />
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    value={entry?.low ?? 0}
                    onChange={(e) => ubahEntry(game.id, { low: Number(e.target.value) })}
                    aria-label={`1% low ${game.name}`}
                    className="w-14 rounded-md border px-1.5 py-1 text-right text-xs tabular-nums text-muted-foreground outline-none focus:border-brand-green"
                  />
                </div>
              ) : (
                <div className="w-20 shrink-0 text-right">
                  {entry ? (
                    <>
                      <span className={`text-sm font-extrabold tabular-nums ${nada.text}`}>
                        {entry.avg}
                      </span>
                      <span className="ml-1 text-[11px] text-muted-foreground tabular-nums">
                        / {entry.low}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Angka besar = FPS rata-rata, angka kecil = 1% low (yang menentukan terasa patah atau
        tidak). Garis gelap di dalam batang menandai 1% low.
        {menyunting && " Kolom kiri mengubah rata-rata, kolom kanan mengubah 1% low."}
      </p>
    </div>
  )
}

function FilterGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly T[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="inline-flex rounded-lg border p-0.5">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
              opt === value
                ? "bg-brand-green text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

