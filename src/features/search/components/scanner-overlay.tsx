"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { CameraOff, Loader2, RotateCcw, ScanLine, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useCodeScanner, type ScannerFailure } from "@/features/search/hooks/use-code-scanner"
import { parseScannedCode } from "@/features/search/lib/parse-scanned-code"
import { resolveScannedProduct } from "@/features/search/services/search-service"

type ScannerOverlayProps = {
  open: boolean
  /**
   * `isNavigating` diteruskan ke induk supaya overlay pencarian di belakangnya
   * bisa ikut ditutup dengan disiplin riwayat yang sama — lihat `finish()`.
   */
  onOpenChange: (open: boolean, options?: { isNavigating?: boolean }) => void
}

/**
 * Pesan kegagalan kamera. Tiap sebab dapat kalimatnya sendiri — satu kalimat
 * "gagal membuka kamera" untuk semua sebab hanya membuat staff menebak-nebak
 * apa yang sebenarnya harus mereka perbaiki.
 */
const FAILURE_MESSAGE: Record<ScannerFailure, { title: string; hint: string }> = {
  "insecure-context": {
    title: "Kamera butuh koneksi HTTPS",
    hint: "Halaman ini dibuka lewat alamat yang tidak aman (mis. http://192.168.x.x). Buka lewat alamat https:// resminya, lalu coba lagi.",
  },
  unsupported: {
    title: "Browser ini belum mendukung kamera",
    hint: "Coba buka lewat Chrome (Android) atau Safari (iPhone). Peramban di dalam aplikasi seperti Instagram sering memblokir kamera.",
  },
  "permission-denied": {
    title: "Izin kamera ditolak",
    hint: "Aktifkan izin kamera untuk situs ini lewat setelan browser, lalu tekan Coba Lagi.",
  },
  "no-camera": {
    title: "Kamera tidak ditemukan",
    hint: "Perangkat ini tidak punya kamera yang bisa dipakai memindai.",
  },
  "camera-busy": {
    title: "Kamera sedang dipakai aplikasi lain",
    hint: "Tutup aplikasi yang sedang memakai kamera, lalu tekan Coba Lagi.",
  },
  unknown: {
    title: "Gagal membuka kamera",
    hint: "Coba tutup panel ini lalu buka kembali.",
  },
}

/**
 * Pemindai QR & barcode produk, tampil sebagai lapisan penuh layar.
 *
 * **Kenapa tidak memakai `Sheet` yang sudah ada?** `Sheet` memasang
 * `useBackToClose`, yang saat ditutup menarik entri riwayatnya lewat
 * `history.back()` kecuali `window.location.href` sudah berubah. Di sini alamat
 * itu BELUM berubah pada saat penutupan: `router.push()` bersifat asinkron,
 * jadi pembersihannya menjalankan `history.back()` lebih dulu, lalu pop yang
 * sudah diantrekan itu memakan entri hasil push — pemindai berhasil membaca,
 * halaman produk terlihat sekejap, lalu terlempar balik. Persis bug yang sudah
 * dicatat panjang di `search-bar.tsx`.
 *
 * `Sheet` tidak punya cara menyatakan "menutup karena berpindah halaman", jadi
 * lapisan ini mengurus riwayatnya sendiri dengan disiplin yang sama seperti
 * overlay pencarian di `search-bar.tsx` — lihat `finish()`.
 *
 * Catatan keamanan: hasil pindaian TIDAK PERNAH dipakai sebagai alamat tujuan
 * secara langsung. Yang diambil hanya identitas produk (id atau SKU), lalu
 * path-nya disusun ulang di sini sebagai path relatif. Lihat catatan panjang di
 * `parse-scanned-code.ts`.
 */
export function ScannerOverlay({ open, onOpenChange }: ScannerOverlayProps) {
  const router = useRouter()
  const [message, setMessage] = useState<string | null>(null)
  const [isResolving, setIsResolving] = useState(false)

  /** Menandai bahwa lapisan ini menaruh satu entri riwayat miliknya sendiri. */
  const historyEntryRef = useRef(false)

  /**
   * Menutup lapisan.
   *
   * `isNavigating` menandai bahwa pemanggil akan berpindah halaman setelah ini,
   * dan di situ entri riwayatnya justru TIDAK boleh ditarik — lihat catatan di
   * kepala berkas ini dan penjelasan lengkapnya di `search-bar.tsx`.
   *
   * Penandanya dimatikan SEBELUM `history.back()` supaya listener `popstate`
   * yang ikut terpanggil tahu pop ini sudah ditangani.
   */
  const finish = useCallback(
    (options?: { isNavigating?: boolean }) => {
      onOpenChange(false, options)

      if (historyEntryRef.current) {
        historyEntryRef.current = false
        if (!options?.isNavigating) {
          window.history.back()
        }
      }
    },
    [onOpenChange]
  )

  /** Tombol Back menutup pemindai, bukan meninggalkan halaman. */
  useEffect(() => {
    if (!open) return

    window.history.pushState({ hnsScanner: true }, "")
    historyEntryRef.current = true

    const handlePopState = () => {
      // Entri sudah lepas oleh pop itu sendiri, jadi cukup dinolkan — memanggil
      // `finish()` di sini akan memicu `history.back()` kedua.
      historyEntryRef.current = false
      onOpenChange(false)
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [open, onOpenChange])

  /** Kunci gulir latar selama kamera menutupi layar. */
  useEffect(() => {
    if (!open) return

    document.body.style.overflow = "hidden"
    document.documentElement.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = ""
      document.documentElement.style.overflow = ""
    }
  }, [open])

  /** Escape menutup pemindai di desktop. */
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, finish])

  /**
   * Pesan sisa dari pemindaian sebelumnya dibersihkan saat panel dibuka lagi.
   *
   * Disesuaikan SELAMA RENDER, bukan lewat `useEffect`: menyetel state dari
   * dalam efek menghasilkan render bertingkat, dan pola ini yang dipakai di
   * seluruh komponen sekitar (lihat penyetelan ulang `highlightedIndex` di
   * `search-bar.tsx`). Dikunci ke `open` yang primitif dan stabil.
   */
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setMessage(null)
      setIsResolving(false)
    }
  }

  const handleDetect = useCallback(
    async (raw: string) => {
      setIsResolving(true)
      setMessage(null)

      const scanned = parseScannedCode(raw, window.location.hostname)

      /** Tutup lalu berpindah — di tab yang sama, tanpa muat ulang halaman. */
      const go = (path: string) => {
        finish({ isNavigating: true })
        router.push(path)
      }

      try {
        switch (scanned.kind) {
          case "product-slug":
            go(`/product/${encodeURIComponent(scanned.slug)}`)
            return

          case "product-id": {
            const target = await resolveScannedProduct({ id: scanned.id })
            if (!target) {
              setMessage("Produk untuk QR ini sudah tidak ada di katalog.")
              break
            }
            go(`/product/${encodeURIComponent(target.slug)}`)
            return
          }

          case "sku": {
            const target = await resolveScannedProduct({ sku: scanned.sku })

            // SKU yang tidak cocok persis bukan jalan buntu: pencarian biasa
            // juga mencocokkan SKU secara longgar, jadi staff tetap mendapat
            // sesuatu untuk ditindaklanjuti.
            if (!target) {
              go(`/search?q=${encodeURIComponent(scanned.sku)}`)
              return
            }

            const path = `/product/${encodeURIComponent(target.slug)}`
            go(
              target.variationSku
                ? `${path}?sku=${encodeURIComponent(target.variationSku)}`
                : path
            )
            return
          }

          case "foreign-url":
            setMessage(
              `Kode ini menunjuk ke ${scanned.hostname}, bukan produk HNS. Pemindaian dibatalkan.`
            )
            break

          case "unknown":
            setMessage("Kode terbaca, tapi bukan QR atau barcode produk HNS.")
            break
        }
      } catch {
        setMessage("Gagal menghubungi server. Periksa koneksi, lalu coba lagi.")
      }

      setIsResolving(false)
    },
    [finish, router]
  )

  const onDetect = useCallback(
    (raw: string) => {
      void handleDetect(raw)
    },
    [handleDetect]
  )

  const { videoRef, state, retry } = useCodeScanner({ active: open, onDetect })

  const handleRetry = () => {
    setMessage(null)
    setIsResolving(false)
    retry()
  }

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pindai QR atau barcode produk"
      className="fixed inset-0 z-[110] flex h-[100dvh] w-full items-center justify-center overflow-hidden bg-black text-white"
    >
      <button
        type="button"
        onClick={() => finish()}
        aria-label="Tutup pemindai"
        className="absolute top-4 right-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
      >
        <X className="h-5 w-5" />
      </button>

      {state.status === "failed" ? (
        <div className="mx-auto flex max-w-xs flex-col items-center gap-3 px-6 text-center">
          <CameraOff className="h-10 w-10 text-white/70" />
          <p className="text-base font-semibold">{FAILURE_MESSAGE[state.reason].title}</p>
          <p className="text-sm leading-relaxed text-white/70">
            {FAILURE_MESSAGE[state.reason].hint}
          </p>
          <Button variant="secondary" size="sm" className="mt-2" onClick={handleRetry}>
            <RotateCcw className="h-4 w-4" />
            Coba Lagi
          </Button>
        </div>
      ) : (
        <>
          {/* `playsInline` & `muted` juga dipasang di hook lewat atribut DOM —
              di iPhone keduanya yang mencegah video direbut ke pemutar layar
              penuh milik iOS. Ditulis ulang di sini supaya render pertamanya
              sudah benar, sebelum hook sempat berjalan. */}
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="h-full w-full object-cover"
          />

          {/* Bingkai bidik. `pointer-events-none` supaya tidak menghalangi
              tombol tutup di atasnya. */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-6">
            <div className="relative h-56 w-56 max-w-[70vw] rounded-2xl border-2 border-white/80 shadow-[0_0_0_100vmax_rgba(0,0,0,0.55)]">
              <ScanLine className="absolute inset-0 m-auto h-8 w-8 text-white/50" />
            </div>

            <div className="max-w-xs px-6 text-center">
              {isResolving ? (
                <p className="flex items-center justify-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Membuka produk…
                </p>
              ) : (
                <p className="text-sm text-white/80">
                  {state.status === "starting"
                    ? "Menyalakan kamera…"
                    : "Arahkan ke QR atau barcode pada label produk."}
                </p>
              )}
            </div>
          </div>

          {message && (
            <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 bg-black/80 px-6 pt-4 pb-8 text-center">
              <p className="text-sm leading-relaxed text-white">{message}</p>
              <Button variant="secondary" size="sm" onClick={handleRetry}>
                <RotateCcw className="h-4 w-4" />
                Pindai Lagi
              </Button>
            </div>
          )}
        </>
      )}
    </div>,
    document.body
  )
}
