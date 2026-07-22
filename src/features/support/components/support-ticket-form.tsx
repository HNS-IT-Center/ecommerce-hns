"use client"

import { useState, type FormEvent } from "react"
import { Ticket, ArrowRight, ShieldCheck } from "lucide-react"

export function SupportTicketForm() {
  const [ticketCode, setTicketCode] = useState("")

  const handleSearch = (e: FormEvent) => {
    e.preventDefault()

    if (!ticketCode.trim()) return

    // Supabase placeholder URL. The user will replace this later.
    // Example: https://my-project.supabase.co/tiket/HNS-123
    const supabaseUrl = `https://[link-supabase-anda.com]/tiket/${encodeURIComponent(ticketCode.trim())}`

    // Redirect to the ticket URL
    window.location.href = supabaseUrl
  }

  return (
    <div className="bg-card border rounded-3xl shadow-xl overflow-hidden p-8 md:p-12 text-center">
      <div className="mx-auto w-20 h-20 bg-sale-red/10 rounded-full flex items-center justify-center mb-6">
        <ShieldCheck className="w-10 h-10 text-sale-red" />
      </div>

      <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4 text-foreground">
        Pusat Bantuan & Klaim Garansi
      </h1>
      <p className="text-muted-foreground mb-10 text-lg max-w-xl mx-auto">
        Silakan masukkan nomor tiket servis atau klaim garansi Anda untuk melacak status pengerjaan secara real-time.
      </p>

      <form onSubmit={handleSearch} className="max-w-xl mx-auto relative">
        <div className="relative flex items-center">
          <Ticket className="absolute left-4 w-6 h-6 text-muted-foreground" />
          <input
            type="text"
            placeholder="Contoh: HNS-240101-001"
            value={ticketCode}
            onChange={(e) => setTicketCode(e.target.value)}
            className="w-full h-16 pl-14 pr-32 rounded-2xl border-2 border-input bg-background text-lg outline-none focus:border-brand-green transition-colors"
            required
          />
          <button
            type="submit"
            className="absolute right-2 top-2 bottom-2 bg-foreground text-background px-6 rounded-xl font-bold flex items-center gap-2 hover:bg-foreground/90 transition-colors"
          >
            Cari <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>

      <div className="mt-8 text-sm text-muted-foreground">
        Belum punya tiket? Silakan hubungi admin kami melalui WhatsApp di menu Kontak.
      </div>
    </div>
  )
}
