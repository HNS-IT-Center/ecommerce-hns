import Image from "next/image"

import { cn } from "@/lib/utils"
import type { PromoPhase } from "@/lib/utils/promo"

type PromoHeroProps = {
  title: string
  imageUrl: string | null
  imageAlt: string | null
  phase: PromoPhase
}

/**
 * Banner di puncak halaman promo — wujudnya sama dengan slide hero beranda
 * (rasio 2:1, `rounded-3xl`, `shadow-xl`), supaya pengunjung yang baru
 * mengeklik banner merasa tiba di tempat yang sama.
 *
 * Promo yang sudah berakhir digambar abu-abu dengan cap "Promo berakhir":
 * banner aslinya berisi angka diskon yang dibakar ke gambar, dan menampilkannya
 * berwarna penuh seolah masih berlaku adalah janji yang tidak bisa dipenuhi.
 */
export function PromoHero({ title, imageUrl, imageAlt, phase }: PromoHeroProps) {
  const ended = phase === "ended"

  if (!imageUrl) {
    return (
      <div
        className={cn(
          "flex aspect-[3/1] w-full items-center rounded-3xl p-8 text-white shadow-xl md:p-14",
          ended ? "bg-slate-500" : "bg-primary"
        )}
      >
        <p className="text-3xl font-extrabold tracking-tight text-balance md:text-5xl">{title}</p>
      </div>
    )
  }

  return (
    <div className="relative aspect-[2/1] w-full overflow-hidden rounded-3xl bg-muted shadow-xl">
      {/* `sizes` & `quality` mengikuti hero beranda — lihat catatan di
          hero-carousel.tsx. Gambar ini LCP halaman promo, jadi `priority`. */}
      <Image
        src={imageUrl}
        alt={imageAlt ?? title}
        fill
        priority
        quality={90}
        sizes="(max-width: 767px) calc(100vw - 2rem), (max-width: 1279px) calc(100vw - 3rem), 1232px"
        className={cn("object-cover", ended && "brightness-90 grayscale")}
      />
      {ended && (
        <div className="absolute inset-0 grid place-items-center">
          <span className="-rotate-6 rounded-lg border-[3px] border-white bg-black/45 px-4 py-1.5 text-sm font-extrabold tracking-[0.12em] text-white md:text-2xl">
            PROMO BERAKHIR
          </span>
        </div>
      )}
    </div>
  )
}
