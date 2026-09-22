"use client"

import { useEffect, useRef } from "react"

import { useToastManager } from "@/components/ui/toast"

/**
 * Memantau apakah hak akses akun yang sedang membuka panel berubah, lalu
 * memuat ulang halamannya.
 *
 * MASALAHNYA BUKAN DI SERVER. Izin dibaca ulang dari database pada SETIAP
 * permintaan (`getCurrentUser` + `muatIzinUser`) — tidak ada peran yang ikut
 * ditandatangani di dalam cookie sesi, justru supaya pencabutan berlaku
 * seketika. Yang tertinggal adalah tampilan di peramban: menu sidebar dirender
 * di layout panel, dan Next.js menyimpan potongan RSC yang sudah pernah diambil
 * di Router Cache. Selama orangnya cuma berpindah halaman di dalam panel,
 * layout itu tidak pernah diambil ulang — jadi menu, tombol, dan tab yang
 * terlihat masih milik peran yang lama.
 *
 * Itulah sebabnya dulu "harus logout dulu baru dapat akses baru": logout
 * kebetulan memaksa muat ulang penuh. Yang sebenarnya dibutuhkan cuma muat
 * ulang itu — sesinya sendiri tidak pernah salah.
 *
 * Cara kerjanya: server menitipkan "cap izin" saat halaman dimuat, komponen ini
 * menanyakan cap terbaru secara berkala, dan begitu keduanya berbeda ia
 * memunculkan toast lalu memuat ulang.
 *
 * Yang dijaga supaya tetap murah:
 *
 * - Berhenti TOTAL saat tab tidak terlihat. Panel yang ditinggal terbuka
 *   semalaman di komputer kasir tidak mengirim satu permintaan pun.
 * - Bertanya sekali lagi begitu tabnya kembali dibuka, jadi orang yang baru
 *   kembali ke mejanya tidak perlu menunggu giliran timer berikutnya.
 * - Satu query kunci primer per pertanyaan, lewat Route Handler biasa — bukan
 *   server action, yang akan menyeret render ulang pohon RSC.
 *
 * Kegagalan jaringan sengaja DIDIAMKAN. Kalau wifi toko putus sebentar,
 * memunculkan pesan merah di pojok layar staff tidak menolong siapa pun —
 * pertanyaan berikutnya akan berjalan seperti biasa.
 */

/** Jarak antar pemeriksaan, hanya berjalan selama tab terlihat. */
const JEDA_PERIKSA_MS = 30_000

/**
 * Jeda antara toast muncul dan halaman dimuat ulang.
 *
 * Bukan nol: halaman yang tiba-tiba berkedip tanpa keterangan terbaca sebagai
 * kerusakan, dan orang akan mengira pekerjaannya hilang karena panelnya rusak,
 * bukan karena aksesnya diubah. Dua detik cukup untuk membaca satu baris.
 */
const JEDA_MUAT_ULANG_MS = 2_000

export function PermissionWatcher({ versiAwal }: { versiAwal: string | null }) {
  const toast = useToastManager()

  // Manajer toast belum tentu objek yang sama di tiap render; disimpan di ref
  // supaya efek di bawah tidak perlu memasang ulang timer-nya setiap kali.
  const toastRef = useRef(toast)
  useEffect(() => {
    toastRef.current = toast
  }, [toast])

  const versiRef = useRef(versiAwal)
  /** Sekali memutuskan muat ulang, berhenti bertanya — jangan bertumpuk. */
  const sudahMemicuRef = useRef(false)

  useEffect(() => {
    let dibatalkan = false

    async function periksa() {
      if (dibatalkan || sudahMemicuRef.current) return
      if (document.visibilityState !== "visible") return

      let versiBaru: string | null
      try {
        const res = await fetch("/api/admin/permission-version", { cache: "no-store" })
        if (res.status === 401) {
          // Sesinya sudah tidak berlaku. Muat ulang tetap benar: penjaga
          // halaman yang akan mengantarnya ke layar masuk, bukan komponen ini.
          versiBaru = null
        } else if (!res.ok) {
          return
        } else {
          const data = (await res.json()) as { version?: string | null }
          versiBaru = data.version ?? null
        }
      } catch {
        return
      }

      if (dibatalkan || sudahMemicuRef.current) return
      if (versiBaru === versiRef.current) return

      sudahMemicuRef.current = true
      toastRef.current.add({
        title: "Peran diperbarui",
        description: "Akses Anda baru saja diubah. Halaman dimuat ulang sebentar…",
        data: { variant: "success" },
        timeout: JEDA_MUAT_ULANG_MS,
      })
      window.setTimeout(() => {
        // Muat ulang PENUH, bukan `router.refresh()`. Yang basi justru layout
        // panel beserta menunya, dan `refresh()` tidak selalu menyentuhnya.
        window.location.reload()
      }, JEDA_MUAT_ULANG_MS)
    }

    const timer = window.setInterval(periksa, JEDA_PERIKSA_MS)
    const saatKembali = () => {
      if (document.visibilityState === "visible") void periksa()
    }
    document.addEventListener("visibilitychange", saatKembali)
    window.addEventListener("focus", saatKembali)

    return () => {
      dibatalkan = true
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", saatKembali)
      window.removeEventListener("focus", saatKembali)
    }
  }, [])

  return null
}
