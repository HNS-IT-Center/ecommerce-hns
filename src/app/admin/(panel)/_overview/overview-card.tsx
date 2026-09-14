import Link from "next/link"
import type { ComponentType, ReactNode } from "react"
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Kerangka bersama kartu-kartu Overview admin: pita ikon di sudut, judul,
 * keterangan, tempat penyaring di kanan, dan tautan "lihat semua" di bawah.
 *
 * Tidak memakai `Card` dari `components/ui`: kartu itu membawa bayangan yang
 * membesar saat di-hover, yang di sini terbaca seolah seluruh kartu bisa
 * diklik — padahal yang bisa diklik hanya baris dan tautan di dalamnya.
 *
 * Sengaja tanpa "use client" supaya bisa dipakai Server Component (kartu
 * produk terbaru) maupun Client Component (kartu berpenyaring).
 */

export type OverviewTone = "danger" | "warning" | "info" | "neutral"

const TONES: Record<OverviewTone, { ribbon: string; ring: string }> = {
  danger: { ribbon: "bg-destructive text-white", ring: "ring-destructive/25" },
  warning: { ribbon: "bg-warning text-white", ring: "ring-warning/30" },
  info: { ribbon: "bg-info text-white", ring: "ring-info/25" },
  neutral: { ribbon: "bg-foreground text-background", ring: "ring-foreground/10" },
}

type OverviewCardProps = {
  id: string
  tone: OverviewTone
  icon: ComponentType<{ className?: string }>
  title: string
  description: string
  /** Penyaring / kontrol di kanan judul. Turun ke bawah judul di layar kecil. */
  actions?: ReactNode
  isPending?: boolean
  error?: string | null
  className?: string
  children: ReactNode
}

export function OverviewCard({
  id,
  tone,
  icon: Icon,
  title,
  description,
  actions,
  isPending = false,
  error,
  className,
  children,
}: OverviewCardProps) {
  const toneClass = TONES[tone]
  const titleId = `${id}-title`

  return (
    <section
      aria-labelledby={titleId}
      aria-busy={isPending}
      className={cn(
        "relative flex min-w-0 flex-col rounded-2xl bg-card text-card-foreground shadow-sm ring-1",
        toneClass.ring,
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute left-4 top-0 flex h-10 w-8 justify-center pt-2 [clip-path:polygon(0_0,100%_0,100%_100%,50%_76%,0_100%)]",
          toneClass.ribbon
        )}
      >
        <Icon className="h-4 w-4" />
      </span>

      <header className="flex flex-col gap-3 px-4 pt-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div className="min-w-0 pl-10">
          <h3 id={titleId} className="flex items-center gap-2 text-base font-semibold leading-snug">
            {title}
            {isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {actions && <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
      </header>

      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col px-4 pb-4 pt-3 transition-opacity sm:px-5 sm:pb-5",
          isPending && "opacity-60"
        )}
      >
        {error && (
          <p role="alert" className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        {children}
      </div>
    </section>
  )
}

export type PillTone = OverviewTone | "success" | "muted"

const PILL_TONES: Record<PillTone, string> = {
  danger: "bg-destructive/10 text-destructive",
  warning: "bg-warning/10 text-warning",
  info: "bg-info/10 text-info",
  success: "bg-success/10 text-success",
  neutral: "bg-foreground/5 text-foreground",
  muted: "bg-muted text-muted-foreground",
}

export function Pill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums",
        PILL_TONES[tone]
      )}
    >
      {children}
    </span>
  )
}

/**
 * Daftar yang menggulir di dalam kartu. Tingginya dibatasi supaya kartu yang
 * bersebelahan tetap sejajar walau isinya berbeda panjang.
 */
export function OverviewList({ children, label }: { children: ReactNode; label: string }) {
  return (
    <ul
      aria-label={label}
      className="-mx-2 max-h-88 divide-y divide-border overflow-y-auto overscroll-contain px-2"
    >
      {children}
    </ul>
  )
}

export function OverviewRow({
  href,
  title,
  subtitle,
  trailing,
}: {
  href: string
  title: string
  subtitle: ReactNode
  trailing?: ReactNode
}) {
  return (
    <li>
      <Link
        href={href}
        className="-mx-2 flex min-w-0 items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={title}>
            {title}
          </p>
          <div className="truncate text-xs uppercase tracking-wide text-muted-foreground">{subtitle}</div>
        </div>
        {trailing && <div className="flex shrink-0 items-center gap-1.5">{trailing}</div>}
      </Link>
    </li>
  )
}

export function OverviewEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl bg-muted/40 px-4 py-10 text-center text-sm text-muted-foreground">
      <CheckCircle2 className="h-6 w-6 text-success" />
      {children}
    </div>
  )
}

export function OverviewFooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="mt-3 inline-flex w-fit items-center gap-1 text-sm font-medium text-foreground hover:underline"
    >
      {children}
      <ArrowRight className="h-4 w-4" />
    </Link>
  )
}

const NUMBER = new Intl.NumberFormat("id-ID")

export function formatCount(value: number) {
  return NUMBER.format(value)
}
