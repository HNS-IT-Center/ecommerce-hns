"use client"

import Image from "next/image"

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { PrebuildGame } from "@/lib/pc-prebuild/games"
import type { PrebuildFpsEntry } from "@/lib/pc-prebuild/performance"

/**
 * Perkiraan FPS per game.
 *
 * Lima baris terlihat sekaligus, sisanya digulir ke bawah. Angka lima bukan
 * selera: panel ini duduk di kolom kanan halaman paket, dan daftar yang lebih
 * panjang dari itu mendorong bagian bottleneck serta saran upgrade keluar dari
 * layar pertama — padahal keduanya justru yang menjelaskan angka-angka ini.
 *
 * Nama gamenya DITULIS, tidak hanya di tooltip. Tooltip tetap ada untuk nama
 * yang terpotong dan untuk logo yang tidak dikenali, tapi menyembunyikan nama
 * di balik hover berarti pengguna layar sentuh — mayoritas pengunjung toko ini
 * — tidak pernah bisa membacanya.
 */

/** Lima baris + sedikit potongan baris keenam, supaya jelas daftarnya masih berlanjut. */
const TINGGI_MAKSIMAL = "max-h-[19.5rem]"

function inisial(nama: string): string {
  return nama
    .split(/\s+/)
    .slice(0, 2)
    .map((kata) => kata[0] ?? "")
    .join("")
    .toUpperCase()
}

export function FpsGrid({
  entries,
  games,
}: {
  entries: PrebuildFpsEntry[]
  games: PrebuildGame[]
}) {
  const peta = new Map(games.map((g) => [g.id, g]))

  // Entri untuk game yang sudah dihapus staff dari daftar disaring DI SINI,
  // bukan di parser: daftarnya bisa berubah kapan saja, dan membuang entrinya
  // secara permanen berarti analisis harus dihitung ulang hanya karena satu
  // game sempat dikeluarkan.
  const baris = entries
    .map((entry) => ({ entry, game: peta.get(entry.gameId) }))
    .filter((b): b is { entry: PrebuildFpsEntry; game: PrebuildGame } => b.game !== undefined)
    .sort((a, b) => a.game.order - b.game.order)

  if (baris.length === 0) return null

  // Skala batang mengikuti angka tertinggi di daftar ini, bukan angka tetap.
  // Patokan tetap membuat paket kelas kantor tampil sebagai deretan batang
  // nyaris kosong yang tidak bisa dibandingkan satu sama lain.
  const tertinggi = Math.max(...baris.map((b) => b.entry.avg), 1)

  return (
    <TooltipProvider>
      <ul className={`${TINGGI_MAKSIMAL} space-y-1.5 overflow-y-auto pr-1`}>
        {baris.map(({ entry, game }) => (
          <li
            key={game.id}
            className="flex items-center gap-3 rounded-xl border bg-card px-2.5 py-2"
          >
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted/40 text-[11px] font-bold text-muted-foreground" />
                }
              >
                {game.logo ? (
                  <Image
                    src={game.logo}
                    alt=""
                    width={36}
                    height={36}
                    className="h-9 w-9 object-contain"
                  />
                ) : (
                  inisial(game.name)
                )}
              </TooltipTrigger>
              <TooltipContent>{game.name}</TooltipContent>
            </Tooltip>

            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{game.name}</p>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.round((entry.avg / tertinggi) * 100)}%` }}
                />
              </div>
            </div>

            <div className="shrink-0 text-right">
              <p className="text-sm font-extrabold tabular-nums leading-none">
                {entry.avg}
                <span className="ml-0.5 text-[10px] font-semibold text-muted-foreground">FPS</span>
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
                {entry.quality} · 1% low {entry.low}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </TooltipProvider>
  )
}
