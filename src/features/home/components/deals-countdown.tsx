"use client"

import { useEffect, useState } from "react"
import { Clock } from "lucide-react"

function pad(n: number) {
  return n.toString().padStart(2, "0")
}

export function DealsCountdown() {
  const [remaining, setRemaining] = useState(5 * 3600 + 22 * 60 + 10)

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining((r) => (r <= 0 ? 8 * 3600 : r - 1))
    }, 1000)
    return () => clearInterval(id)
  }, [])

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
