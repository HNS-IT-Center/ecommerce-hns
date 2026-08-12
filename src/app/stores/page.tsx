import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { JsonLd } from "@/components/seo/json-ld";
import { getActiveStores } from "@/lib/api/stores";
import { getDirectionsUrl, getWhatsAppUrl } from "@/features/stores/lib/maps";
import { buildStoreJsonLd } from "@/features/stores/lib/structured-data";
import { StorePanel } from "@/features/stores/components/store-panel";
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

/** Pertanyaan yang benar-benar ditanyakan sebelum orang berangkat ke toko. */
const FAQ_KUNJUNGAN = [
  {
    q: "Bisa cek stok dulu sebelum datang?",
    a: "Bisa, dan untuk barang tertentu memang disarankan. Chat WhatsApp cabang yang dituju sambil menyebutkan tipe barangnya — stok tiap cabang berbeda.",
  },
  {
    q: "Ada tempat parkir?",
    a: "Ada di kedua cabang. Untuk cabang yang berada di dalam mal, ikuti area parkir mal seperti biasa.",
  },
  {
    q: "Jam berapa paling sepi?",
    a: "Pagi menjelang siang di hari kerja biasanya paling lengang. Akhir pekan sore paling ramai, terutama untuk konsultasi rakit PC.",
  },
  {
    q: "Mau servis, langsung bawa unitnya saja?",
    a: "Boleh langsung datang. Bawa kelengkapan yang berkaitan dengan keluhannya — adaptor, kabel, atau media instalasi — supaya teknisi tidak perlu menebak.",
  },
];

export default async function StoresPage() {
  const stores = await getActiveStores();

  const panels = stores.map((store) => ({
    id: store.id,
    name: store.name,
    address: store.address,
    hours: store.hours,
    mapsUrl: store.mapsUrl,
    phone: store.phone,
    googlePlaceId: store.googlePlaceId,
    latitude: store.latitude,
    longitude: store.longitude,
    waUrl: getWhatsAppUrl(store),
    directionsUrl: getDirectionsUrl(store),
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
        <section className="bg-brand-green py-12 text-center text-primary-foreground">
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl lg:text-5xl">
            TOKO &amp; CABANG KAMI
          </h1>
          <p className="mt-4 text-lg text-primary-foreground/80">
            Temukan lokasi toko terdekat kami di kota Anda
          </p>
        </section>

        {/*
          Seluruh isi halaman berbagi satu lebar. Susunan lama menaruh peta
          selebar layar penuh di atas konten yang menyempit di tengah, dan
          perbedaan lebar itulah yang membuat halamannya terasa kosong.
        */}
        <div className="mx-auto w-full max-w-6xl px-4 py-10 md:py-14">
          {stores.length === 0 ? (
            <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
              Data toko belum tersedia. Hubungi kami lewat WhatsApp untuk
              menanyakan lokasi cabang terdekat.
            </p>
          ) : (
            <>
              {/* Fakta ringkas: menjawab "ada berapa" dan "kapan buka" sebelum
                  orang menggulir. Sengaja tanpa angka rating — angka presisi yang
                  tidak ada yang memperbaruinya lebih merusak daripada tidak ada. */}
              <dl className="flex flex-wrap gap-x-8 gap-y-2 rounded-xl border bg-card px-5 py-3.5 text-sm text-muted-foreground">
                <div className="flex gap-1.5">
                  <dt>Jumlah cabang</dt>
                  <dd className="font-bold text-foreground">{stores.length}</dd>
                </div>
                <div className="flex gap-1.5">
                  <dt>Buka</dt>
                  <dd className="font-bold text-foreground">setiap hari</dd>
                </div>
                <div className="flex gap-1.5">
                  <dt>Wilayah</dt>
                  <dd className="font-bold text-foreground">Batam</dd>
                </div>
              </dl>

              {/* Grid meregangkan anaknya sama tinggi secara bawaan; `h-full` di
                  dalam panel dan `mt-auto` pada barisan tombol yang membuat
                  tombolnya rata di dasar walau alamatnya berbeda panjang. */}
              <div className="mt-6 grid gap-6 md:grid-cols-2">
                {panels.map((store) => (
                  <StorePanel key={store.id} store={store} />
                ))}
              </div>
            </>
          )}

          <section className="mt-12">
            <h2 className="text-xl font-bold md:text-2xl">
              Sebelum berkunjung
            </h2>
            <div className="mt-4 divide-y rounded-2xl border bg-card">
              {FAQ_KUNJUNGAN.map((item) => (
                <details key={item.q} className="group px-5 py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                    {item.q}
                    <span
                      className="shrink-0 text-xl leading-none text-muted-foreground transition-transform group-open:rotate-45"
                      aria-hidden="true"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
