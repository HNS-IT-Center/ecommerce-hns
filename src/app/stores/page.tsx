import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { MapPin, Clock, MessageCircle, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getActiveStores } from "@/lib/api/stores";
import { getStoreEmbedUrl, getWhatsAppUrl } from "@/features/stores/lib/maps";
import { StoresOverviewMapLoader } from "@/features/stores/components/stores-overview-map-loader";
import { buildStoreJsonLd } from "@/features/stores/lib/structured-data";
import { JsonLd } from "@/components/seo/json-ld";
import { formatOpeningHours } from "@/lib/utils/opening-hours";
import { env } from "@/config/env";

export const metadata = {
  title: "Lokasi Toko — HNS IT Center",
  description: "Temukan lokasi toko cabang HNS IT Center di Batam.",
};

/**
 * Halaman ini dulunya statis. Sekarang membaca database, jadi tanpa ISR ia akan
 * memukul MariaDB tiap kunjungan — padahal daftar toko berubah beberapa kali
 * setahun. Satu jam adalah batas atas keterlambatan yang tidak akan pernah
 * terpakai: `revalidateStorePages()` di aksi admin sudah membuang cache ini
 * seketika setiap kali toko disimpan.
 */
export const revalidate = 3600;

export default async function StoresPage() {
  const stores = (await getActiveStores()).map((store) => ({
    ...store,
    waUrl: getWhatsAppUrl(store),
    mapEmbedUrl: getStoreEmbedUrl(store),
  }));

  /**
   * Hanya toko berkoordinat yang bisa digambar di peta ikhtisar. Yang belum
   * diisi tidak menggagalkan apa pun — ia sekadar tidak muncul di peta, dan
   * kartunya di bawah tetap lengkap.
   */
  const storesOnMap = stores
    .filter((s) => s.latitude !== null && s.longitude !== null)
    .map((s) => ({
      id: s.id,
      name: s.name,
      address: s.address,
      phone: s.phone,
      googlePlaceId: s.googlePlaceId,
      latitude: s.latitude as number,
      longitude: s.longitude as number,
    }));

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {stores.map((store) => (
        <JsonLd
          key={store.id}
          data={buildStoreJsonLd(store, env.NEXT_PUBLIC_SITE_URL)}
        />
      ))}
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

        {/*
          Peta ikhtisar: seluruh cabang sekaligus, dengan penanda yang kita
          pasang sendiri. Tingginya dibatasi 45vh di desktop — peta yang memakan
          seluruh layar mendorong kartu toko, yang berisi informasi sebenarnya,
          ke bawah lipatan.

          Di layar sempit tingginya 260px, bukan disembunyikan: peta memberi
          jawaban "jauh atau dekat dari saya" yang tidak bisa diberikan alamat
          tertulis, dan justru pengguna ponsel yang paling sering menanyakannya.
        */}
        {storesOnMap.length > 0 && (
          <section className="w-full">
            <div className="h-[260px] w-full bg-muted md:h-[45vh]">
              <StoresOverviewMapLoader stores={storesOnMap} />
            </div>
          </section>
        )}

        {/* Store Grid Section */}
        <section className="mx-auto max-w-7xl px-4 py-16 md:px-6">
          {stores.length === 0 && (
            <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
              Belum ada data toko. Hubungi kami lewat WhatsApp untuk menanyakan
              lokasi terdekat.
            </p>
          )}
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {stores.map((store) => (
              <div
                key={store.id}
                className="overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:shadow-md"
              >
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

                  {/* Jam kosong bukan galat, cuma data yang belum diisi — jadi
                      warnanya muted, bukan merah. Merah menyuruh orang bertindak,
                      dan di sini tidak ada yang bisa dilakukan pengunjung. */}
                  <div
                    className={`mt-4 flex items-center gap-3 text-sm ${
                      store.hours.length === 0
                        ? "text-muted-foreground"
                        : "font-medium text-foreground"
                    }`}
                  >
                    <Clock
                      className={`h-4 w-4 shrink-0 ${
                        store.hours.length === 0
                          ? "text-muted-foreground"
                          : "text-sale-red"
                      }`}
                    />
                    <p>{formatOpeningHours(store.hours)}</p>
                  </div>

                  {/* WhatsApp jalur konversi utama HNS, jadi ia yang solid; peta
                      pendukung, jadi outline. Hierarkinya jangan dibalik. */}
                  <div className="mt-8 grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      size="lg"
                      render={
                        <a
                          href={store.mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        />
                      }
                    >
                      <Navigation className="h-4 w-4" />
                      Google Maps
                    </Button>
                    <Button
                      variant="whatsapp"
                      size="lg"
                      render={
                        <a
                          href={store.waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        />
                      }
                    >
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
