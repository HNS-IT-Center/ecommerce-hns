import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { MapPin, Clock, Mail, MessageCircle, Navigation } from "lucide-react"
import { buildWhatsAppUrl } from "@/lib/api/whatsapp"
import { getActiveStores } from "@/lib/api/stores"
import { CS_EMAIL } from "@/lib/constants/contact"
import { formatOpeningHours } from "@/lib/utils/opening-hours"
import { env } from "@/config/env"

export const metadata = {
  title: "Kontak Kami — HNS IT Center",
  description: "Hubungi HNS IT Center via WhatsApp, email, atau kunjungi toko kami di Batam.",
}

/** Alasannya sama dengan di `/stores` — lihat catatan revalidate di sana. */
export const revalidate = 3600


export default async function ContactPage() {
  const stores = await getActiveStores()
  const waUrl = buildWhatsAppUrl(
    env.NEXT_PUBLIC_WHATSAPP_CS_NUMBER,
    "Halo HNS IT Center, saya ingin bertanya."
  )

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        {/* Title Section */}
        <section className="bg-brand-green py-12 text-center text-primary-foreground">
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl lg:text-5xl">
            KONTAK KAMI
          </h1>
          <p className="mt-4 text-lg text-primary-foreground/80">
            Ada pertanyaan? Tim kami siap membantu.
          </p>
        </section>

        {/* WhatsApp + Email */}
        <section className="mx-auto max-w-5xl px-4 py-16 md:px-6">
          <div className="grid gap-6 md:grid-cols-2">
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-4 rounded-2xl border bg-card p-8 text-center shadow-sm transition-all hover:shadow-md"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366]/10 text-[#25D366]">
                <MessageCircle className="h-7 w-7" />
              </div>
              <div>
                <h3 className="text-lg font-bold">WhatsApp</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Respon tercepat untuk tanya produk, harga, atau servis.
                </p>
              </div>
              <span className="rounded-xl bg-[#25D366] px-6 py-2.5 text-sm font-bold text-white">
                Chat Sekarang
              </span>
            </a>

            <a
              href={`mailto:${CS_EMAIL}`}
              className="flex flex-col items-center gap-4 rounded-2xl border bg-card p-8 text-center shadow-sm transition-all hover:shadow-md"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-green/10 text-brand-green">
                <Mail className="h-7 w-7" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Email</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Untuk pertanyaan formal atau kerja sama bisnis.
                </p>
              </div>
              <span className="rounded-xl border border-brand-green px-6 py-2.5 text-sm font-bold text-brand-green">
                {CS_EMAIL}
              </span>
            </a>
          </div>
        </section>

        {/* Store Addresses */}
        <section className="border-t bg-muted/10 py-16">
          <div className="mx-auto max-w-5xl px-4 md:px-6">
            <h2 className="mb-8 text-center text-2xl font-extrabold text-sale-red">
              Kunjungi Toko Kami
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {stores.map((store) => (
                <div key={store.id} className="rounded-2xl border bg-card p-6 shadow-sm">
                  <h3 className="text-lg font-bold">{store.name}</h3>
                  <div className="mt-4 flex items-start gap-3 text-sm text-muted-foreground">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-green" />
                    <p className="leading-relaxed">{store.address}</p>
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-sm font-medium text-foreground">
                    <Clock className="h-4 w-4 text-sale-red" />
                    <p>{formatOpeningHours(store.hours)}</p>
                  </div>
                  <a
                    href={store.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-input bg-background px-4 py-3 text-sm font-bold shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <Navigation className="h-4 w-4" />
                    Google Maps
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
