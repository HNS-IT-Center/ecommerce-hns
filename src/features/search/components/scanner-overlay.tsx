"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { CameraOff, Loader2, RotateCcw, ScanLine, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
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
 * Lama layar tunggu ditahan sebelum halaman produk dibuka.
 *
 * Pembacaan kode sering selesai dalam puluhan milidetik, dan berpindah halaman
 * secepat itu terasa seperti layar melompat sendiri — staff tidak sempat
 * melihat bahwa pemindaiannya berhasil, apalagi barang apa yang terbaca. Jeda
 * ini bukan penundaan sia-sia: ia yang mengubah lompatan mendadak menjadi
 * urutan yang bisa diikuti mata.
 */
const FEEDBACK_MS = 700

/** Pilihan perbesaran. 1x = bidang pandang penuh kamera, tanpa perbesaran. */
const ZOOM_STEPS = [1, 2, 3]

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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

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
  const [zoom, setZoom] = useState(1)

  /**
   * Layar tunggu setelah kode terbaca. `null` berarti masih memindai.
   * `name` menyusul begitu produknya diketahui, jadi teksnya berubah dari
   * sekadar "Memuat produk…" menjadi nama barang yang benar-benar dituju.
   */
  const [pending, setPending] = useState<{ name: string | null } | null>(null)

  /** Kotak bidik. HANYA isi kotak inilah yang dibaca — lihat `useCodeScanner`. */
  const frameRef = useRef<HTMLDivElement | null>(null)

  /** Menandai bahwa lapisan ini menaruh satu entri riwayat miliknya sendiri. */
  const historyEntryRef = useRef(false)

  /**
   * Menandai bahwa pengguna menutup pemindai selagi layar tunggu berjalan.
   *
   * Tanpa ini, menutup panel di tengah jeda tetap berakhir dengan perpindahan
   * halaman beberapa ratus milidetik kemudian — halaman produk muncul sendiri
   * padahal orangnya jelas-jelas sudah membatalkan.
   */
  const cancelledRef = useRef(false)

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
      if (!options?.isNavigating) cancelledRef.current = true

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

    // Dibuka berarti belum ada yang dibatalkan. Ditaruh di sini, bukan di
    // penyesuaian selama render di bawah, karena menulis ref selama render
    // tidak diperbolehkan — nilainya bisa terbuang saat React mengulang render.
    cancelledRef.current = false

    window.history.pushState({ hnsScanner: true }, "")
    historyEntryRef.current = true

    const handlePopState = () => {
      // Entri sudah lepas oleh pop itu sendiri, jadi cukup dinolkan — memanggil
      // `finish()` di sini akan memicu `history.back()` kedua.
      historyEntryRef.current = false
      cancelledRef.current = true
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
   * Keadaan sisa dari pemindaian sebelumnya dibersihkan saat panel dibuka lagi.
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
      setPending(null)
    }
  }

  const handleDetect = useCallback(
    async (raw: string) => {
      setMessage(null)
      setPending({ name: null })

      const scanned = parseScannedCode(raw, window.location.hostname)

      /**
       * Tahan layar tunggu sejenak, lalu berpindah — di tab yang sama, tanpa
       * muat ulang. Dibatalkan diam-diam kalau panelnya sudah ditutup orang.
       */
      const go = async (path: string) => {
        await sleep(FEEDBACK_MS)
        if (cancelledRef.current) return
        finish({ isNavigating: true })
        router.push(path)
      }

      try {
        switch (scanned.kind) {
          case "product-slug":
            await go(`/product/${encodeURIComponent(scanned.slug)}`)
            return

          case "product-id": {
            const target = await resolveScannedProduct({ id: scanned.id })
            if (!target) {
              setMessage("Produk untuk QR ini sudah tidak ada di katalog.")
              break
            }
            setPending({ name: target.name })
            await go(`/product/${encodeURIComponent(target.slug)}`)
            return
          }

          case "sku": {
            const target = await resolveScannedProduct({ sku: scanned.sku })

            // SKU yang tidak cocok persis bukan jalan buntu: pencarian biasa
            // juga mencocokkan SKU secara longgar, jadi staff tetap mendapat
            // sesuatu untuk ditindaklanjuti.
            if (!target) {
              await go(`/search?q=${encodeURIComponent(scanned.sku)}`)
              return
            }

            setPending({ name: target.name })
            const path = `/product/${encodeURIComponent(target.slug)}`
            await go(
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

      setPending(null)
    },
    [finish, router]
  )

  const onDetect = useCallback(
    (raw: string) => {
      void handleDetect(raw)
    },
    [handleDetect]
  )

  const { videoRef, state, retry, cssZoom } = useCodeScanner({
    active: open,
    onDetect,
    frameRef,
    zoom,
  })

  const handleRetry = () => {
    setMessage(null)
    setPending(null)
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
        className="absolute top-4 right-4 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
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
              sudah benar, sebelum hook sempat berjalan.

              `cssZoom` hanya terpakai di perangkat yang kameranya tidak bisa
              zoom sendiri (semua iPhone) — di perangkat lain nilainya 1 dan
              perbesarannya dikerjakan lensa. Perhitungan potongan di
              `computeSourceRect` memakai faktor yang sama, jadi yang terbaca
              selalu sama dengan yang terlihat di dalam kotak. */}
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            style={cssZoom !== 1 ? { transform: `scale(${cssZoom})` } : undefined}
            className="h-full w-full object-cover"
          />

          {/* Bingkai bidik. `pointer-events-none` supaya tidak menghalangi
              tombol tutup dan kontrol zoom di atasnya. */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-6">
            <div
              ref={frameRef}
              className="relative h-48 w-[80vw] max-w-sm rounded-2xl border-2 border-white/80 shadow-[0_0_0_100vmax_rgba(0,0,0,0.55)]"
            >
              <ScanLine className="absolute inset-0 m-auto h-8 w-8 text-white/40" />
            </div>

            <div className="max-w-xs px-6 text-center">
              <p className="text-sm text-white/80">
                {state.status === "starting"
                  ? "Menyalakan kamera…"
                  : "Posisikan kode di dalam kotak — hanya isi kotak yang dibaca."}
              </p>
            </div>
          </div>

          {/* Kontrol perbesaran. Sengaja di luar wadah ber-`pointer-events-none`
              di atas supaya tetap bisa ditekan. */}
          <div className="absolute inset-x-0 bottom-8 z-20 flex justify-center">
            <div className="flex items-center gap-1 rounded-full bg-black/55 p-1 backdrop-blur-sm">
              {ZOOM_STEPS.map((step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => setZoom(step)}
                  aria-pressed={zoom === step}
                  className={cn(
                    "h-9 w-12 rounded-full text-sm font-semibold transition-colors",
                    zoom === step
                      ? "bg-white text-black"
                      : "text-white/80 hover:bg-white/15 hover:text-white"
                  )}
                >
                  {step}x
                </button>
              ))}
            </div>
          </div>

          {/* Layar tunggu. Menutupi kamera supaya jelas bahwa pemindaian sudah
              berhasil dan halaman sedang dibuka — bukan lompatan tanpa aba-aba. */}
          {pending && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/85 px-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-white/80" />
              <div className="space-y-1">
                <p className="text-base font-semibold">Memuat produk…</p>
                {pending.name && (
                  <p className="line-clamp-2 text-sm text-white/70">{pending.name}</p>
                )}
              </div>
            </div>
          )}

          {message && (
            <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-3 bg-black/85 px-6 pt-4 pb-8 text-center">
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
