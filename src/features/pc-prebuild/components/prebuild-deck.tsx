import Link from "next/link"
import { PackageOpen, Wrench } from "lucide-react"

import type { PrebuildGame } from "@/lib/pc-prebuild/games"

import type { PrebuildView } from "../lib/types"
import { PrebuildCard } from "./prebuild-card"

/**
 * Deck kartu di `/pc-prebuild`.
 *
 * Server Component: tidak ada state di tingkat daftar, dan setiap kartu
 * mengurus sisinya sendiri. Membungkus seluruh deck jadi Client Component akan
 * menyeret seluruh daftar paket ke bundle browser tanpa satu pun kegunaan
 * tambahan.
 */

type Props = {
  views: PrebuildView[]
  games: PrebuildGame[]
}

export function PrebuildDeck({ views, games }: Props) {
  if (views.length === 0) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <PackageOpen className="h-9 w-9" strokeWidth={1.5} />
        </span>
        <div>
          <h2 className="text-xl font-bold">Belum ada paket rakitan</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Paket siap pakai sedang disiapkan teknisi kami. Sementara itu, Anda tetap bisa merakit
            sendiri dari nol lewat PC Builder.
          </p>
        </div>
        <Link
          href="/build-pc"
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-md transition-opacity hover:opacity-90"
        >
          <Wrench className="h-4 w-4" />
          Rakit PC Sendiri
        </Link>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {views.map((view) => (
        <PrebuildCard key={view.id} view={view} games={games} />
      ))}
    </div>
  )
}
