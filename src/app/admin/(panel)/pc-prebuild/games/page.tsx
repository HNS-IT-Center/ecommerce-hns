import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { getPcPrebuildGames } from "@/lib/pc-prebuild/config"

import { GamesManager } from "../_components/games-manager"

export const metadata = {
  title: "Daftar Game — PC Prebuild Admin HNS",
}

/**
 * Daftar game untuk grid estimasi FPS.
 *
 * Rute sendiri, bukan tab kedua di halaman deck. Ia bukan milik salah satu
 * paket melainkan SATU daftar yang berlaku untuk semuanya, dan sebagai tab ia
 * terlihat seperti bagian dari paket yang sedang dibuka.
 *
 * Nilai grid ini justru pada perbandingan: pelanggan yang membuka dua paket
 * melihat game yang sama pada baris yang sama. Karena itu daftarnya satu, dan
 * karena itu pula ia disimpan di baris `settings` sendiri — lihat
 * `lib/pc-prebuild/config.ts`.
 */
export default async function PrebuildGamesPage() {
  const games = await getPcPrebuildGames()

  return (
    <div className="flex-1 space-y-6">
      <div>
        <Link
          href="/admin/pc-prebuild"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Semua paket
        </Link>

        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Daftar Game</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Dipakai grid estimasi FPS di semua paket. Mengganti nama game TIDAK mengubah id-nya, jadi
          angka FPS yang sudah dihitung tidak ikut hilang saat kamu membetulkan ejaan.
        </p>
      </div>

      <div className="max-w-3xl">
        <GamesManager initialGames={games} />
      </div>
    </div>
  )
}
