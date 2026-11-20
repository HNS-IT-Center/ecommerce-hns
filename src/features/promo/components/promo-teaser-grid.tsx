import Image from "next/image"
import Link from "next/link"

import type { PromoTeaser } from "@/lib/api/promos"
import { formatPromoDate, promoHref } from "@/lib/utils/promo"
import { cn } from "@/lib/utils"

/**
 * Deretan promo yang sedang berlangsung. Di HP digeser ke samping, di desktop
 * jadi grid tiga kolom. Dipakai di bawah halaman promo dan di `/promo`.
 */
export function PromoTeaserGrid({ promos, scroll = true }: { promos: PromoTeaser[]; scroll?: boolean }) {
  return (
    <div
      className={cn(
        scroll
          ? "-mx-4 grid auto-cols-[78%] grid-flow-col gap-3.5 overflow-x-auto px-4 pb-1.5 [scrollbar-width:none] snap-x snap-mandatory md:mx-0 md:grid-flow-row md:grid-cols-3 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden"
          : "grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
      )}
    >
      {promos.map((promo) => (
        <Link key={promo.id} href={promoHref(promo.slug)} className="group block snap-start">
          <div className="relative aspect-[2/1] overflow-hidden rounded-2xl bg-muted shadow-sm">
            {promo.bannerImageUrl ? (
              <Image
                src={promo.bannerImageUrl}
                alt={promo.bannerAlt ?? promo.title}
                fill
                sizes="(max-width: 767px) 78vw, 400px"
                className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
            ) : (
              <div className="flex h-full items-center bg-primary p-5 text-lg font-extrabold text-white">
                {promo.title}
              </div>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-[13px] font-semibold">
            <span className="line-clamp-1 group-hover:text-primary">{promo.title}</span>
            {promo.endsAt && (
              <span className="shrink-0 text-[11px] text-red-500">
                s/d {formatPromoDate(promo.endsAt).date.replace(/^\w+, /, "")}
              </span>
            )}
          </div>
        </Link>
      ))}
    </div>
  )
}
