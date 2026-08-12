"use client"

import { Share2 } from "lucide-react"

import { useToastManager } from "@/components/ui/toast"
import { useShareTarget } from "./share-target-provider"

/**
 * Tombol bagikan di bilah atas mobile.
 *
 * Memakai Web Share API (`navigator.share`), bukan deretan tombol per-platform.
 * Sheet bawaan Android/iOS memuat SEMUA aplikasi yang benar-benar terpasang di
 * ponsel pembeli — WhatsApp, Facebook, Telegram, Instagram, sampai "Salin" dan
 * AirDrop — jadi cakupannya selalu lebih luas daripada daftar apa pun yang bisa
 * kita tulis sendiri, dan tidak pernah menawarkan aplikasi yang tidak ada.
 *
 * Gambar produk sengaja TIDAK dikirim sebagai `files`. Sebagian besar target
 * berbagi menolak kombinasi file + URL dan akhirnya membuang tautannya — dan
 * tautan `/p/{id}` sudah membawa gambar produk sendiri lewat OG image saat
 * ditempel di WhatsApp maupun Facebook. Jadi thumbnail-nya tetap muncul, tanpa
 * mengorbankan tautan yang justru jadi inti dari berbaginya.
 */
export function ShareButton() {
  const target = useShareTarget()
  const toastManager = useToastManager()

  // Halaman tanpa sesuatu untuk dibagikan tidak menampilkan tombol ini.
  if (!target) return null

  const shareText = target.priceLabel
    ? `${target.title} — ${target.priceLabel}`
    : target.title

  const handleShare = async () => {
    // `navigator.share` hanya ada di konteks aman (HTTPS/localhost) dan
    // sebagian besar hanya di mobile; desktop jatuh ke penyalinan tautan.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: target.title,
          text: shareText,
          url: target.url,
        })
        return
      } catch (error) {
        // Pembeli menutup sheet berbagi — itu pembatalan yang disengaja, bukan
        // kegagalan. Memunculkan toast error di sini akan menegur orang karena
        // berubah pikiran.
        if (error instanceof DOMException && error.name === "AbortError") return
        // Kegagalan lain (mis. target menolak payload) jatuh ke salin tautan
        // di bawah, supaya tekanannya tetap membuahkan sesuatu.
      }
    }

    try {
      await navigator.clipboard.writeText(`${shareText}\n${target.url}`)
      toastManager.add({
        title: "Tautan disalin",
        description: "Tempel di WhatsApp, Facebook, atau aplikasi lain.",
        priority: "low",
        timeout: 3000,
      })
    } catch {
      // Clipboard bisa ditolak permission-nya. Tautannya ditampilkan supaya
      // masih bisa disalin manual, bukan gagal diam-diam.
      toastManager.add({
        title: "Gagal menyalin otomatis",
        description: target.url,
        priority: "low",
        timeout: 6000,
      })
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label={`Bagikan ${target.title}`}
      className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Share2 className="h-5 w-5" />
    </button>
  )
}
