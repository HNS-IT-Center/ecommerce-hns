"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

import { useNow } from "@/hooks/use-now"
import { cn } from "@/lib/utils"
import { formatPromoDate, promoPhase, type PromoPhase } from "@/lib/utils/promo"

const DAY_MS = 86_400_000

type PromoScheduleProps = {
  /** ISO string — `Date` tidak bisa menyeberang ke Client Component. */
  startsAt: string | null
  endsAt: string | null
  /** Status saat server merender; dipakai sampai jam klien tersedia. */
  initialPhase: PromoPhase
  /** Kelas penempatan grid untuk kotak hitung mundur & timeline. */
  countdownClassName?: string
  timelineClassName?: string
}

function pad(n: number) {
  return n.toString().padStart(2, "0")
}

/**
 * Hitung mundur + timeline durasi promo.
 *
 * Mengembalikan DUA blok (fragment) supaya kartu info bisa menaruhnya di area
 * grid yang berbeda — di HP timeline turun ke bawah hitung mundur, di desktop
 * hitung mundur berdiri di kanan judul.
 *
 * Saat jam melewati batas mulai/berakhir, halaman di-refresh sekali supaya
 * bagian yang dirender server (status, pemberitahuan, harga katalog) ikut
 * berganti — bukan hanya angka di sini.
 */
export function PromoSchedule({
  startsAt,
  endsAt,
  initialPhase,
  countdownClassName,
  timelineClassName,
}: PromoScheduleProps) {
  const router = useRouter()
  const now = useNow()
  const phase = now === null ? initialPhase : promoPhase({ startsAt, endsAt }, now)

  const refreshedFor = useRef<PromoPhase>(initialPhase)
  useEffect(() => {
    if (phase !== refreshedFor.current) {
      refreshedFor.current = phase
      router.refresh()
    }
  }, [phase, router])

  const start = startsAt ? new Date(startsAt).getTime() : null
  const end = endsAt ? new Date(endsAt).getTime() : null
  const target = phase === "upcoming" ? start : phase === "live" ? end : null
  const remaining = target !== null && now !== null ? Math.max(0, Math.floor((target - now) / 1000)) : null

  const units =
    remaining === null
      ? null
      : {
          d: Math.floor(remaining / 86400),
          h: Math.floor((remaining % 86400) / 3600),
          m: Math.floor((remaining % 3600) / 60),
          s: remaining % 60,
        }

  return (
    <>
      <div className={countdownClassName}>
        {phase === "ended" ? (
          <div className="max-w-72 text-sm text-muted-foreground">
            <p className="text-base font-bold text-foreground">Promo sudah berakhir</p>
            {endsAt && (
              <p>
                Berakhir {formatPromoDate(endsAt).date}, {formatPromoDate(endsAt).time} WIB.
              </p>
            )}
          </div>
        ) : target === null ? (
          <p className="max-w-72 text-sm text-muted-foreground">
            {phase === "live" ? "Berlaku selama persediaan masih ada." : null}
          </p>
        ) : (
          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">
              {phase === "upcoming" ? "Dimulai dalam" : "Berakhir dalam"}
            </p>
            <div className="flex items-start gap-1 md:gap-1.5" aria-label="Sisa waktu promo">
              {(
                [
                  ["d", "Hari"],
                  ["h", "Jam"],
                  ["m", "Menit"],
                  ["s", "Detik"],
                ] as const
              )
                // Kotak hari dibuang di hari terakhir — "00" hari hanya memakan
                // tempat dan mengaburkan bahwa waktunya tinggal jam.
                .filter(([key]) => key !== "d" || units === null || units.d > 0)
                .map(([key, label], index) => (
                  <div key={key} className="flex flex-1 items-start gap-1 md:flex-none md:gap-1.5">
                    {index > 0 && (
                      <span className="flex h-12 w-2 items-center justify-center font-bold text-muted-foreground/50">
                        :
                      </span>
                    )}
                    <div className="flex flex-1 flex-col items-center gap-1">
                      <span
                        className={cn(
                          "flex h-12 w-full items-center justify-center rounded-lg font-mono text-xl font-bold tabular-nums text-white shadow-sm md:w-12",
                          phase === "upcoming" ? "bg-primary" : "bg-red-500"
                        )}
                      >
                        {units ? pad(units[key]) : "--"}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {label}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {start !== null && end !== null && (
        <PromoTimeline
          start={start}
          end={end}
          now={now}
          phase={phase}
          startsAt={startsAt!}
          endsAt={endsAt!}
          className={timelineClassName}
        />
      )}
    </>
  )
}

function PromoTimeline({
  start,
  end,
  now,
  phase,
  startsAt,
  endsAt,
  className,
}: {
  start: number
  end: number
  now: number | null
  phase: PromoPhase
  startsAt: string
  endsAt: string
  className?: string
}) {
  const totalDays = Math.max(1, Math.round((end - start) / DAY_MS))
  const progress =
    phase === "ended" ? 100 : phase === "upcoming" || now === null ? 0 : ((now - start) / (end - start)) * 100
  const dayIndex = now === null ? null : Math.min(totalDays, Math.floor((now - start) / DAY_MS) + 1)
  const lastDay = phase === "live" && now !== null && end - now < DAY_MS

  const startLabel = formatPromoDate(startsAt)
  const endLabel = formatPromoDate(endsAt)

  return (
    <div className={cn("border-t border-dashed border-border pt-4", className)}>
      <div className="flex justify-between gap-3 text-xs">
        <div>
          <p className="text-[11px] text-muted-foreground">Mulai</p>
          <p className="font-semibold">
            {startLabel.date} · {startLabel.time}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-muted-foreground">Berakhir</p>
          <p className="font-semibold">
            {endLabel.date} · {endLabel.time} WIB
          </p>
        </div>
      </div>

      <div className="relative mt-2.5 h-1.5 rounded-full bg-muted" aria-hidden="true">
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full",
            phase === "ended" ? "bg-muted-foreground/40" : "bg-red-500"
          )}
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
        {phase === "live" && now !== null && (
          <div
            className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-red-500 bg-white shadow"
            style={{ left: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        )}
      </div>

      <p className="mt-2.5 text-xs text-muted-foreground">
        {phase === "upcoming" ? (
          <>
            Durasi promo <strong className="text-foreground">{totalDays} hari</strong>.
          </>
        ) : phase === "ended" ? (
          <>
            Promo berlangsung selama <strong className="text-foreground">{totalDays} hari</strong> dan sudah
            selesai.
          </>
        ) : lastDay ? (
          <strong className="text-red-600">Hari terakhir — promo ditutup pukul {endLabel.time} WIB.</strong>
        ) : dayIndex !== null ? (
          <>
            Hari ke-<strong className="text-foreground">{dayIndex}</strong> dari {totalDays}.
          </>
        ) : (
          <>Durasi promo {totalDays} hari.</>
        )}
      </p>
    </div>
  )
}
