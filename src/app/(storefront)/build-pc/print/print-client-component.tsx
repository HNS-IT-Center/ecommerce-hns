"use client"

import { useEffect, useState } from "react"

/**
 * Memicu dialog cetak hanya setelah semua gambar selesai dimuat.
 *
 * Sebelumnya dipakai `setTimeout` 500ms, yang sering kurang untuk thumbnail
 * produk dari host eksternal — akibatnya thumbnail muncul sebagai kotak abu-abu
 * di preview cetak. Di sini kita menunggu `decode()` setiap <img> benar-benar
 * selesai, dengan batas waktu supaya satu gambar yang gagal tidak membuat
 * dialog cetak tidak pernah terbuka.
 */
export function PrintClientComponent() {
  const [status, setStatus] = useState<"loading" | "ready">("loading")

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
      if (cancelled) return
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

  return null
}
