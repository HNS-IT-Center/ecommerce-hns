import { MessageCircle } from "lucide-react"
import { buildWhatsAppUrl } from "@/lib/api/whatsapp"

interface FloatingWhatsAppButtonProps {
  whatsappNumber: string
}

export function FloatingWhatsAppButton({ whatsappNumber }: FloatingWhatsAppButtonProps) {
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
      className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105"
    >
      <MessageCircle className="h-7 w-7 fill-white" />
    </a>
  )
}
