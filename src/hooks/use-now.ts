"use client"

import { useSyncExternalStore } from "react"

/**
 * Jam bersama berdetak tiap detik, untuk hitung mundur.
 *
 * Satu interval untuk seluruh halaman, berapa pun komponen yang membacanya.
 * Dibaca lewat `useSyncExternalStore` — bukan `setState` di dalam efek — dan
 * `getSnapshot` mengembalikan nilai yang sama di antara detak supaya React
 * tidak merender ulang tanpa henti. Polanya sama dengan `DealsCountdown`.
 */
let cachedNow = Date.now()
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | null = null

function subscribe(onTick: () => void) {
  listeners.add(onTick)
  if (timer === null) {
    cachedNow = Date.now()
    timer = setInterval(() => {
      cachedNow = Date.now()
      for (const listener of listeners) listener()
    }, 1000)
  }
  return () => {
    listeners.delete(onTick)
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }
}

function getSnapshot(): number {
  return cachedNow
}

/** Server & render hidrasi pertama belum tahu jam pengunjung. */
function getServerSnapshot(): number | null {
  return null
}

/** Waktu sekarang dalam milidetik, atau `null` sebelum hidrasi selesai. */
export function useNow(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
