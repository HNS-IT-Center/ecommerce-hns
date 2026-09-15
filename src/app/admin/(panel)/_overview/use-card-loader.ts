"use client"

import { useRef, useState, useTransition } from "react"
import type { DashboardResult } from "./actions"

/**
 * Keadaan satu kartu berpenyaring: nilai penyaring, data terakhir, dan galat.
 *
 * Data awal datang dari render server, jadi kartu tidak pernah berkedip kosong
 * saat halaman pertama dibuka — action baru dipanggil ketika penyaringnya
 * diganti.
 *
 * `requestId` menjaga urutan: staff yang mengganti kategori dua kali dengan
 * cepat bisa menerima jawaban permintaan pertama SETELAH yang kedua. Tanpa
 * penjaga ini kartu menampilkan data kategori lama di bawah label kategori
 * baru.
 */
export function useCardLoader<TParam, TData>(
  initialParam: TParam,
  initialData: TData,
  load: (param: TParam) => Promise<DashboardResult<TData>>
) {
  const [param, setParam] = useState(initialParam)
  const [data, setData] = useState(initialData)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const latestRequest = useRef(0)

  function update(next: TParam) {
    setParam(next)
    const requestId = ++latestRequest.current

    startTransition(async () => {
      const result = await load(next)
      if (requestId !== latestRequest.current) return

      if (result.ok) {
        setData(result.data)
        setError(null)
      } else {
        setError(result.error)
      }
    })
  }

  return { param, data, error, isPending, update }
}
