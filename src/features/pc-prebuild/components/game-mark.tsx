import Image from "next/image"

import type { PrebuildGame } from "@/lib/pc-prebuild/games"

/**
 * Logo game, atau inisialnya kalau staff belum mengunggah logo.
 *
 * Logo memang OPSIONAL (lib/pc-prebuild/games.ts): fitur grid FPS tidak
 * menunggu aset. Yang tidak boleh terjadi adalah baris tanpa penanda sama
 * sekali — daftar dua belas nama tanpa jangkar visual jauh lebih lambat dibaca
 * daripada yang terlihat.
 *
 * Dipakai chart matriks dan daftar FPS di kartu `/pc-prebuild`.
 */
export function GameMark({ game, className = "" }: { game: PrebuildGame; className?: string }) {
  if (game.logo) {
    return (
      <Image
        src={game.logo}
        alt=""
        width={24}
        height={24}
        className={`h-6 w-6 shrink-0 rounded border bg-white object-contain ${className}`}
      />
    )
  }

  return (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border bg-muted text-[10px] font-bold text-muted-foreground ${className}`}
    >
      {game.name.slice(0, 2).toUpperCase()}
    </span>
  )
}
