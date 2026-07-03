import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { MapPin, Clock, MessageCircle, Navigation } from "lucide-react"

export const metadata = {
  title: "Lokasi Toko — HNS IT Center",
  description: "Temukan lokasi toko cabang HNS IT Center di Batam.",
}

const stores = [
  {
    id: "nagoya-gateway",
    name: "Nagoya Gateway (Pusat)",
    address: "Komplek Nagoya Gateway, Blk. E No.9, Kp. Seraya, Kec. Batu Ampar, Kota Batam, Kepulauan Riau 29444",
    hours: "Setiap Hari : 09:00 - 21:00 WIB",
    mapsUrl: "https://maps.app.goo.gl/xxx", // Replace with real URL
    waUrl: "https://wa.me/6281170000000",
    phone: "0811-7000-0000",
  },
  {
    id: "nagoya-hill",
    name: "Nagoya Hill Mall",
    address: "Nagoya Hill Mall Lt. Dasar, Lubuk Baja Kota, Kec. Lubuk Baja, Kota Batam, Kepulauan Riau 29444",
    hours: "Setiap Hari : 10:00 - 21:30 WIB",
    mapsUrl: "https://maps.app.goo.gl/yyy", // Replace with real URL
    waUrl: "https://wa.me/6281170000001",
    phone: "0811-7000-0001",
  }
]

export default function StoresPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        {/* Title Section */}
        <section className="bg-brand-green py-12 text-center text-primary-foreground">
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl lg:text-5xl">
            OUR STORE & BRANCH
          </h1>
          <p className="mt-4 text-lg text-primary-foreground/80">
            Temukan lokasi toko terdekat kami di kota Anda
          </p>
        </section>

        {/* Global Map Section */}
        <section className="w-full">
          <div className="h-[400px] w-full bg-muted lg:h-[500px]">
            {/* Embed Google Maps for Batam Region */}
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d127641.17387440938!2d103.9317584102604!3d1.0827284451022378!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31d98d75a1334f51%3A0xc34cc420a3240e94!2sBatam%2C%20Batam%20City%2C%20Riau%20Islands!5e0!3m2!1sen!2sid!4v1717000000000!5m2!1sen!2sid"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen={true}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="grayscale hover:grayscale-0 transition-all duration-500"
            ></iframe>
          </div>
        </section>

        {/* Store Grid Section */}
        <section className="mx-auto max-w-7xl px-4 py-16 md:px-6">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {stores.map((store) => (
              <div key={store.id} className="overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:shadow-md">
                {/* Store Image Placeholder */}
                <div className="relative h-48 w-full bg-muted">
                  <div className="flex h-full w-full flex-col items-center justify-center bg-brand-green/10 text-brand-green">
                    <MapPin className="mb-2 h-10 w-10 opacity-50" />
                    <span className="font-semibold">{store.name}</span>
                  </div>
                </div>

                <div className="p-6">
                  <h3 className="text-xl font-bold">{store.name}</h3>
                  
                  <div className="mt-4 flex items-start gap-3 text-sm text-muted-foreground">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-green" />
                    <p className="leading-relaxed">{store.address}</p>
                  </div>
                  
                  <div className="mt-4 flex items-center gap-3 text-sm font-medium text-foreground">
                    <Clock className="h-4 w-4 text-sale-red" />
                    <p>{store.hours}</p>
                  </div>

                  {/* Actions */}
                  <div className="mt-8 grid grid-cols-2 gap-3">
                    <a
                      href={store.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 rounded-xl border border-input bg-background px-4 py-3 text-sm font-bold shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <Navigation className="h-4 w-4" />
                      Google Maps
                    </a>
                    <a
                      href={store.waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#25D366]/90"
                    >
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
