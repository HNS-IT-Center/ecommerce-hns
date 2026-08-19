import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import Link from "next/link"
import { MapPin, Mail, MessageCircle } from "lucide-react"
import { buildWhatsAppUrl } from "@/lib/api/whatsapp"
import { getActiveStores } from "@/lib/api/stores"
import { CS_EMAIL } from "@/lib/constants/contact"
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

        {/* Daftar toko lengkap tinggal di /stores — SATU rumah untuk alamat,
            jam buka, dan petunjuk arah. Data yang sama sebelumnya dirender di
            tiga halaman (/stores, /about, /contact). Sumbernya memang satu
            (`getActiveStores`), jadi isinya tidak pernah berselisih — tapi
            pembaca tetap harus menebak halaman mana yang paling lengkap, dan
            setiap perubahan tata letak harus dikerjakan tiga kali. */}
        <section className="border-t bg-muted/10 py-16">
          <div className="mx-auto max-w-5xl px-4 text-center md:px-6">
            <h2 className="text-2xl font-extrabold text-sale-red">Kunjungi Toko Kami</h2>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">
              {stores.length} cabang di Batam: {stores.map((s) => s.name).join(" dan ")}.
              Alamat lengkap, jam buka, dan petunjuk arah ada di halaman lokasi toko.
            </p>
            <Link
              href="/stores"
              className="mt-6 inline-flex items-center gap-2 rounded-xl border border-input bg-background px-6 py-3 text-sm font-bold shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <MapPin className="h-4 w-4 text-brand-green" />
              Lihat Lokasi Toko
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
