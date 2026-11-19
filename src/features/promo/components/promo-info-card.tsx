import { ChevronDown } from "lucide-react"

import WhatsappIcon from "@/components/icons/whatsapp-icon"
import { buildWhatsAppUrl } from "@/lib/api/whatsapp"
import { cn } from "@/lib/utils"
import { parsePromoTerms, type PromoPhase } from "@/lib/utils/promo"
import { PromoSchedule } from "./promo-schedule"
import { PromoShareButton } from "./promo-share-button"

const PHASE_LABEL: Record<PromoPhase, string> = {
  live: "Sedang berlangsung",
  upcoming: "Segera dimulai",
  ended: "Sudah berakhir",
}

type PromoInfoCardProps = {
  title: string
  description: string | null
  terms: string | null
  startsAt: Date | null
  endsAt: Date | null
  phase: PromoPhase
  shareUrl: string
}

/**
 * Kartu di bawah banner: status, judul, hitung mundur, durasi, dan syarat.
 *
 * Susunannya memakai area grid, bukan urutan DOM, supaya satu markup melayani
 * dua tata letak: di HP hitung mundur naik tepat di bawah judul (itu yang
 * dicari orang setelah mengeklik banner), di desktop ia berdiri di kanan.
 */
export function PromoInfoCard({
  title,
  description,
  terms,
  startsAt,
  endsAt,
  phase,
  shareUrl,
}: PromoInfoCardProps) {
  const termList = parsePromoTerms(terms)
  const waMessage = `Halo, saya ingin bertanya soal promo "${title}".\n${shareUrl}`

  return (
    <section
      aria-labelledby="promo-title"
      className={cn(
        "mt-4 grid gap-5 rounded-2xl bg-card p-5 shadow-sm",
        "[grid-template-areas:'head'_'cd'_'tl'_'about'_'terms']",
        "md:grid-cols-[1fr_auto] md:gap-x-10 md:gap-y-0 md:px-7 md:py-6",
        "md:[grid-template-areas:'head_cd'_'about_cd'_'tl_tl'_'terms_terms']"
      )}
    >
      <div className="[grid-area:head]">
        <p
          className={cn(
            "inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider",
            phase === "ended" ? "text-muted-foreground" : "text-primary"
          )}
        >
          <span className="relative flex h-2 w-2">
            {phase === "live" && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
            )}
            <span
              className={cn(
                "relative inline-flex h-2 w-2 rounded-full",
                phase === "live" ? "bg-red-500" : phase === "upcoming" ? "bg-primary" : "bg-muted-foreground/50"
              )}
            />
          </span>
          {PHASE_LABEL[phase]}
        </p>
        <h1 id="promo-title" className="mt-2 text-2xl font-extrabold tracking-tight text-balance md:text-3xl">
          {title}
        </h1>
      </div>

      <div className="[grid-area:about] md:mt-1.5">
        {description && (
          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{description}</p>
        )}
        <div className="mt-3.5 flex flex-wrap gap-2">
          <PromoShareButton title={title} url={shareUrl} />
          <a
            href={buildWhatsAppUrl(process.env.NEXT_PUBLIC_WHATSAPP_CS_NUMBER || "", waMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 text-xs font-semibold transition-colors hover:bg-muted"
          >
            {/* Hijau WhatsApp tidak ikut tema — lihat catatan di product-card.tsx. */}
            <WhatsappIcon size={14} className="text-whatsapp" />
            <span>
              Tanya CS<span className="hidden sm:inline"> soal promo</span>
            </span>
          </a>
        </div>
      </div>

      <PromoSchedule
        startsAt={startsAt?.toISOString() ?? null}
        endsAt={endsAt?.toISOString() ?? null}
        initialPhase={phase}
        countdownClassName="[grid-area:cd]"
        timelineClassName="[grid-area:tl] md:mt-5"
      />

      {termList.length > 0 && (
        <details className="group [grid-area:terms] md:mt-4">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-semibold text-primary [&::-webkit-details-marker]:hidden">
            Syarat & ketentuan
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <ul className="mt-2.5 list-disc space-y-1 pl-5 text-xs leading-relaxed text-muted-foreground">
            {termList.map((term, index) => (
              <li key={index}>{term}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
