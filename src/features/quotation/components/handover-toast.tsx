"use client"

import { useCallback, useEffect, useRef } from "react"

import { useToastManager } from "@/components/ui/toast"
import { formatRupiah } from "@/lib/utils"

import { markHandoverSeenAction } from "../actions"

type UnseenHandover = {
  code: string
  customerName: string | null
  dariCs: string | null
  total: number
  createdAt: string
}

/** 60 detik. Operan adalah peristiwa yang terjadi beberapa kali sehari, bukan per detik. */
const JEDA_POLLING_MS = 60_000

/**
 * Toast "Dapat operan Customer dari CS" untuk sales penerima.
 *
 * **Tidak hilang sendiri** (`timeout: 0`). Toast yang lenyap setelah lima detik
 * akan terlewat oleh sales yang sedang melayani pelanggan di depan meja —
 * padahal justru itu keadaan saat operan paling sering datang. Satu-satunya
 * cara menutupnya adalah menekan Close, dan penekanan itulah yang dicatat
 * server sebagai "sudah dibaca".
 *
 * Status terbaca disimpan di SERVER, bukan di localStorage: operan yang datang
 * saat sales belum login tetap sampai ketika ia login, dan yang sudah ditutup
 * tidak muncul lagi di perangkat lain.
 *
 * Memakai polling biasa, bukan TanStack Query. Paketnya memang ada di
 * dependensi, tapi belum ada `QueryClientProvider` di mana pun di aplikasi ini
 * — memasang provider global demi satu komponen adalah harga yang tidak
 * sebanding dengan sebuah `setInterval`.
 */
export function HandoverToast() {
  const toastManager = useToastManager()
  /** Kode yang toast-nya sudah dimunculkan, supaya polling tidak menumpuknya. */
  const sudahTampil = useRef<Set<string>>(new Set())

  const tampilkan = useCallback(
    (operan: UnseenHandover) => {
      if (sudahTampil.current.has(operan.code)) return
      sudahTampil.current.add(operan.code)

      toastManager.add({
        title: "Dapat operan Customer dari CS",
        description: [
          operan.customerName ?? "Tanpa nama pelanggan",
          operan.dariCs ? `dari ${operan.dariCs}` : null,
          `${operan.code} · ${formatRupiah(operan.total)}`,
        ]
          .filter(Boolean)
          .join(" · "),
        // 0 = tidak pernah menutup sendiri.
        timeout: 0,
        onClose: () => {
          /**
           * Ditandai terbaca saat DITUTUP, bukan saat ditampilkan. Sales yang
           * layarnya kebetulan menyala di ruang lain tidak dianggap sudah
           * membacanya; yang dihitung adalah tindakan menutupnya.
           */
          void markHandoverSeenAction(operan.code)
        },
      })
    },
    [toastManager],
  )

  useEffect(() => {
    let aktif = true

    const periksa = async () => {
      try {
        const res = await fetch("/api/quotation/operan-baru", { cache: "no-store" })
        if (!res.ok || !aktif) return
        const data = (await res.json()) as { operan: UnseenHandover[] }
        if (!aktif) return
        for (const operan of data.operan) tampilkan(operan)
      } catch {
        // Diam. Jaringan yang putus sesaat bukan hal yang perlu dilaporkan ke
        // sales — pemeriksaan berikutnya akan menyusul sendiri.
      }
    }

    void periksa()
    const timer = setInterval(periksa, JEDA_POLLING_MS)

    /**
     * Ikut memeriksa saat tab kembali aktif. Tanpa ini, sales yang membiarkan
     * tab terbuka semalaman baru melihat operan pagi hari pada detik ke-60
     * setelah ia kembali.
     */
    const onFocus = () => void periksa()
    window.addEventListener("focus", onFocus)

    return () => {
      aktif = false
      clearInterval(timer)
      window.removeEventListener("focus", onFocus)
    }
  }, [tampilkan])

  return null
}
