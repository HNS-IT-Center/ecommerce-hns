import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { SupportTicketForm } from "@/features/support/components/support-ticket-form"
import { buildWhatsAppUrl } from "@/lib/api/whatsapp"
import { env } from "@/config/env"

export const metadata = {
  title: "Pusat Bantuan & Klaim Garansi — HNS IT Center",
  description:
    "Klaim garansi, servis, dan status pengerjaan di HNS IT Center — hubungi tim kami lewat WhatsApp.",
}

export default function SupportPage() {
  // Dibangun di sini, bukan di dalam komponennya: komponen tidak boleh
  // menyentuh env atau layer API sendiri (CLAUDE.md §2.5). Pola yang sama
  // dipakai halaman /contact.
  const waUrl = buildWhatsAppUrl(
    env.NEXT_PUBLIC_WHATSAPP_CS_NUMBER,
    "Halo HNS IT Center, saya ingin menanyakan klaim garansi/servis."
  )

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 flex items-center justify-center py-20 bg-muted/20">
        <div className="container mx-auto px-4 max-w-3xl">
          <SupportTicketForm waUrl={waUrl} />
        </div>
      </main>
      <Footer />
    </div>
  )
}
