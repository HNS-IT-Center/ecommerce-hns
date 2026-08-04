import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { MapPin, Clock, MessageCircle, Navigation } from "lucide-react"
import { buildWhatsAppUrl } from "@/lib/api/whatsapp"
import { getStores } from "@/lib/api/stores"
import { buildMapEmbedUrl } from "@/lib/utils/maps"
import { formatOpeningHours } from "@/lib/utils/opening-hours"
import { env } from "@/config/env"

export const metadata = {
  title: "Lokasi Toko — HNS IT Center",
  description: "Temukan lokasi toko cabang HNS IT Center di Batam.",
}

/**
 * Halaman ini dulunya statis. Sekarang membaca database, jadi tanpa ISR ia akan
 * memukul MariaDB tiap kunjungan — padahal daftar toko berubah beberapa kali
 * setahun. Satu jam adalah batas atas keterlambatan yang tidak akan pernah
 * terpakai: `revalidateStorePages()` di aksi admin sudah membuang cache ini
 * seketika setiap kali toko disimpan.
 */
export const revalidate = 3600

export default async function StoresPage() {
  const stores = (await getStores()).map((store) => ({
    ...store,
    waUrl: buildWhatsAppUrl(
      env.NEXT_PUBLIC_WHATSAPP_CS_NUMBER,
      `Halo HNS IT Center, saya ingin bertanya tentang toko ${store.name}.`
    ),
    mapEmbedUrl: buildMapEmbedUrl(store.name, store.address),
  }))

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

        {/* Peta utama — menunjuk toko pertama (urutan `sortOrder`), bukan lagi
            tampilan kota Batam yang tidak terkait toko mana pun. */}
        {stores.length > 0 && (
          <section className="w-full">
            <div className="h-[400px] w-full bg-muted lg:h-[500px]">
              <iframe
                src={stores[0].mapEmbedUrl}
                title={`Peta lokasi ${stores[0].name}`}
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
        )}

        {/* Store Grid Section */}
        <section className="mx-auto max-w-7xl px-4 py-16 md:px-6">
          {stores.length === 0 && (
            <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
              Belum ada data toko. Hubungi kami lewat WhatsApp untuk menanyakan lokasi terdekat.
            </p>
          )}
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {stores.map((store) => (
              <div key={store.id} className="overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:shadow-md">
                {/* Peta tiap toko menggantikan gambar penampung: yang dicari orang
                    di halaman ini adalah "di mana persisnya", dan itu dijawab peta
                    bertitik, bukan kotak abu-abu berisi nama yang sudah tertulis
                    di bawahnya. */}
                <div className="relative h-48 w-full bg-muted">
                  <iframe
                    src={store.mapEmbedUrl}
                    title={`Peta lokasi ${store.name}`}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  ></iframe>
                </div>

                <div className="p-6">
                  <h3 className="text-xl font-bold">{store.name}</h3>
                  
                  <div className="mt-4 flex items-start gap-3 text-sm text-muted-foreground">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-green" />
                    <p className="leading-relaxed">{store.address}</p>
                  </div>
                  
                  <div className="mt-4 flex items-center gap-3 text-sm font-medium text-foreground">
                    <Clock className="h-4 w-4 text-sale-red" />
                    <p>{formatOpeningHours(store.hours)}</p>
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
