"use client"

import { usePathname } from "next/navigation"
import WhatsappIcon from "@/components/icons/whatsapp-icon"
import { buildWhatsAppUrl } from "@/lib/api/whatsapp"
import { cn } from "@/lib/utils"

interface FloatingWhatsAppButtonProps {
  whatsappNumber: string
}

export function FloatingWhatsAppButton({ whatsappNumber }: FloatingWhatsAppButtonProps) {
  const pathname = usePathname()

  if (pathname?.startsWith("/admin")) return null

  // (lihat ProductActions) — tombol mengambang ini akan tumpang tindih
  // dengannya di mobile, jadi disembunyikan khusus di sana.
  // We also hide it on /build-pc on mobile because it has its own floating UI.
  //
  // /register dan /login juga disembunyikan: formnya sudah punya tombol aksi
  // sendiri (Daftar/Masuk) yang sempat tertutup bubble ini di layar sempit —
  // bubble WA di sini cuma menambah ramai, bukan menambah jalan yang berguna.
  const hasOwnWhatsAppCta =
    pathname?.startsWith("/product/") ||
    pathname?.startsWith("/build-pc") ||
    pathname === "/register" ||
    pathname === "/login" ||
    false

  const waUrl = buildWhatsAppUrl(
    whatsappNumber,
    "Halo HNS IT Center, saya ingin bertanya."
  )

  return (
    <a
      href={waUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat via WhatsApp"
      className={cn(
        "no-print print:hidden fixed right-4 z-50 h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105 md:bottom-6 md:flex",
        hasOwnWhatsAppCta ? "hidden" : "bottom-[90px] flex"
      )}
    >
      <WhatsappIcon size={24} color="white" />
    </a>
  )
}
