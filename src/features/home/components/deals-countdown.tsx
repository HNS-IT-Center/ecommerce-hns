"use client"

import { useSyncExternalStore } from "react"
import { Clock } from "lucide-react"

function pad(n: number) {
  return n.toString().padStart(2, "0")
}

// --- Shared 1-second clock, exposed as an external store ---
// getSnapshot must return a stable value between ticks (React compares with
// Object.is), so we cache the timestamp and only refresh it when the interval
// fires. Reading "current time" this way avoids a setState inside useEffect.
let cachedNow = Date.now()

function subscribe(onTick: () => void) {
  const id = setInterval(() => {
    cachedNow = Date.now()
    onTick()
  }, 1000)
  return () => clearInterval(id)
}

function getSnapshot(): number {
  return cachedNow
}

// On the server (and the first client render during hydration) we don't know
// the client's clock yet, so return null and render nothing time-related.
function getServerSnapshot(): number | null {
  return null
}

interface DealsCountdownProps {
  endDate?: string | null
}

export function DealsCountdown({ endDate }: DealsCountdownProps) {
  const now = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  // Derive the remaining seconds during render instead of syncing it via an effect.
  const remaining =
    endDate && now !== null
      ? Math.max(0, Math.floor((new Date(endDate).getTime() - now) / 1000))
      : null

  // If no endDate provided, or time is up, we hide the timer completely (or could show "Berakhir")
  if (remaining === null || remaining <= 0) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-3">
          <Clock className="h-6 w-6 text-sale-red" />
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Deals of the Day
          </h2>
        </div>
      </div>
    )
  }

  const h = Math.floor(remaining / 3600)
  const m = Math.floor((remaining % 3600) / 60)
  const s = remaining % 60

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
      <div className="flex items-center gap-3">
        <Clock className="h-6 w-6 text-sale-red" />
        <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
          Deals of the Day
        </h2>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Berakhir:</span>
        <div className="flex gap-1" aria-label="Sisa waktu promo">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-foreground text-background font-mono font-bold">
            {pad(h)}
          </span>
          <span className="flex h-7 w-7 items-center justify-center rounded bg-foreground text-background font-mono font-bold">
            {pad(m)}
          </span>
          <span className="flex h-7 w-7 items-center justify-center rounded bg-foreground text-background font-mono font-bold">
            {pad(s)}
          </span>
        </div>
      </div>
    </div>
  )
}
