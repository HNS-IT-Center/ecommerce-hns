"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Printer } from "lucide-react"

/**
 * Memicu dialog cetak setelah semua gambar selesai dimuat, lalu menyediakan
 * toolbar supaya pengguna punya jalan keluar dari halaman ini.
 *
 * Gambar ditunggu karena thumbnail produk berasal dari host eksternal; dulu
 * dipakai `setTimeout` 500ms yang sering kurang, sehingga thumbnail tercetak
 * sebagai kotak abu-abu. Ada batas waktu keras supaya satu gambar yang gagal
 * tidak membuat dialog cetak tidak pernah terbuka.
 *
 * Toolbar-nya WAJIB ada. `window.print()` memblokir tab pemanggilnya sampai
 * dialog ditutup, jadi tanpa tautan keluar yang terlihat, satu-satunya cara
 * pergi dari sini adalah tombol Back — dan menavigasi ke halaman lain selagi
 * dialog masih menggantung membuat halaman tujuan tampak "loading putih" tanpa
 * henti, padahal yang terjadi tab-nya sedang menunggu dialog yang tak terlihat.
 */
export function PrintClientComponent() {
  const [status, setStatus] = useState<"loading" | "ready">("loading")
  // Strict Mode menjalankan effect dua kali di dev. Tanpa penjaga ini dialog
  // cetak kedua terbuka menimpa yang pertama, dan tab tetap terkunci walau
  // pengguna sudah menutup dialog yang terlihat.
  const hasPrinted = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function waitForImages() {
      const images = Array.from(document.querySelectorAll("img"))

      await Promise.all(
        images.map((img) => {
          if (img.complete && img.naturalWidth > 0) return Promise.resolve()
          return new Promise<void>((resolve) => {
            // `error` juga me-resolve: gambar rusak tidak boleh memblokir cetak.
            img.addEventListener("load", () => resolve(), { once: true })
            img.addEventListener("error", () => resolve(), { once: true })
          })
        })
      )

      // Satu frame tambahan supaya layout & dekode selesai sebelum snapshot cetak.
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
    }

    // Batas waktu keras: apapun yang terjadi, dialog cetak tetap terbuka.
    const timeout = new Promise((resolve) => setTimeout(resolve, 5000))

    Promise.race([waitForImages(), timeout]).then(() => {
      if (cancelled || hasPrinted.current) return
      hasPrinted.current = true
      setStatus("ready")
      window.print()
    })

    return () => {
      cancelled = true
    }
  }, [])

  if (status === "loading") {
    return (
      <div className="no-print print:hidden fixed inset-x-0 top-0 z-50 bg-[#0d2959] py-2 text-center text-xs font-semibold text-white">
        Menyiapkan dokumen…
      </div>
    )
  }

  return (
    <div className="no-print print:hidden sticky top-0 z-50 border-b border-neutral-200 bg-white/95 backdrop-blur supports-backdrop-filter:bg-white/80">
      <div className="mx-auto flex max-w-[210mm] items-center justify-between gap-3 px-4 py-2.5">
        <Link
          href="/build-pc"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Kembali ke Rakit PC
        </Link>

        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-[#0d2959] px-3.5 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90"
        >
          <Printer className="h-3.5 w-3.5" />
          Cetak ulang
        </button>
      </div>
    </div>
  )
}
