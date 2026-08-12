import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toast } from "@/components/ui/toast";
import { Toaster } from "@/components/layout/toaster";
import { FloatingWhatsAppButton } from "@/components/layout/floating-whatsapp-button";
import { MobileDock } from "@/components/layout/mobile-dock";
import { FlyToCartProvider } from "@/components/providers/fly-to-cart-provider";
import { JsonLd } from "@/components/seo/json-ld";
import { env } from "@/config/env";
import { getActiveThemeCss, getThemeSettings } from "@/lib/theme/settings";
import { ChristmasSnow } from "@/components/theme/christmas-snow";
import NextTopLoader from "nextjs-toploader";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  title: {
    default:
      "HNS IT Center Batam — Toko Komputer, Laptop & Aksesoris Terlengkap",
    template: `%s | ${env.NEXT_PUBLIC_SITE_NAME}`,
  },
  description:
    "Jual Desktop PC, Gaming PC, Laptop, PC Components, Gaming Gear, Networking, Printer, Monitor, dan aksesoris komputer di Batam. Tersedia layanan rakit PC, service, dan upgrade hardware.",
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  // Jangkar bagi tiap cabang untuk menunjuk induknya lewat `parentOrganization`.
  // Tanpa `@id`, kedua toko terbaca sebagai dua badan usaha yang tidak
  // berhubungan — lihat `features/stores/lib/structured-data.ts`.
  "@id": `${env.NEXT_PUBLIC_SITE_URL}/#organization`,
  name: env.NEXT_PUBLIC_SITE_NAME,
  url: env.NEXT_PUBLIC_SITE_URL,
  description:
    "Pusat IT & Gaming terpercaya di Batam. Harga terbaik, garansi resmi, teknisi berpengalaman.",
  email: "cs@hnsitcenter.co.id",
  telephone: env.NEXT_PUBLIC_WHATSAPP_CS_NUMBER,
  address: {
    "@type": "PostalAddress",
    addressLocality: "Batam",
    addressRegion: "Kepulauan Riau",
    addressCountry: "ID",
  },
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: env.NEXT_PUBLIC_SITE_NAME,
  url: env.NEXT_PUBLIC_SITE_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: `${env.NEXT_PUBLIC_SITE_URL}/search?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  /**
   * CSS tema aktif, dibaca lewat `unstable_cache` (lihat lib/theme/settings.ts).
   *
   * Aman untuk rendering statis: tidak menyentuh `cookies()`/`headers()`, jadi
   * halaman storefront tetap statis/ISR.
   *
   * Disuntik di `<head>` sebagai HTML hasil render server — bukan lewat
   * `useEffect` atau localStorage — sehingga warnanya sudah benar pada lukisan
   * pertama dan tidak ada kedipan tema (FOUC).
   */
  const [themeCss, theme] = await Promise.all([
    getActiveThemeCss(),
    getThemeSettings(),
  ]);
  const isChristmas = theme.activeChromeThemeId === "christmas";

  return (
    <html
      lang="id"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* SELALU dirender, termasuk saat temanya "default".

            Dulu elemen ini hanya muncul kalau ada tema aktif, dan itu membuat
            "kembali ke default" mustahil menimpa halaman yang sudah tersimpan
            di cache: keadaan yang benar dinyatakan sebagai KETIADAAN elemen,
            dan ketiadaan tidak bisa membatalkan elemen yang masih ada di HTML
            lama. Akibatnya berganti ke tema berwarna terasa langsung sementara
            kembali ke default seperti tidak berpengaruh sampai cache server
            dibersihkan manual.

            Sekarang tema default mengirim blok reset (lihat `themeToCss`), jadi
            yang berubah antar tema hanya ISI elemen ini — dan isi yang berubah
            selalu menimpa isi sebelumnya. */}
        <style id="theme-vars" dangerouslySetInnerHTML={{ __html: themeCss }} />
      </head>
      {/* `theme-christmas` = penanda yang dipakai `globals.css` untuk membuat
          pembungkus halaman transparan, supaya pola salju di belakangnya
          terlihat. Ditaruh di `body` agar berlaku untuk seluruh halaman tanpa
          satu pun dari mereka perlu disunting. */}
      {/* `suppressHydrationWarning` HANYA untuk atribut `<body>` itu sendiri,
          bukan isinya: ekstensi browser (ColorZilla menulis `cz-shortcut-listen`,
          Grammarly dan LastPass punya penanda serupa) menyuntikkan atribut ke
          `<body>` sebelum React sempat hidrasi, dan React melaporkannya sebagai
          ketidakcocokan server/klien. Suntikan itu tidak berasal dari kode ini
          dan tidak ada di browser pengunjung, jadi yang dibungkam murni
          kebisingan di mesin developer.

          Cakupannya sengaja satu level — anak-anak `<body>` tetap diperiksa
          seperti biasa, sehingga bug hidrasi asli di dalam aplikasi tetap
          terdeteksi. Jangan menyebarkan atribut ini ke komponen lain untuk
          "mendiamkan" peringatan hidrasi: di sana ia menyembunyikan bug sungguhan. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <NextTopLoader color="#0000FF" showSpinner={false} />
        <JsonLd data={organizationJsonLd} />
        <JsonLd data={websiteJsonLd} />
        {/* Salju dipasang di root, bukan di dalam header: header `overflow`-nya
            terbatas dan tingginya hanya 4rem, sedangkan salju harus jatuh ke
            area di bawahnya. */}
        {isChristmas && <ChristmasSnow />}
        <FlyToCartProvider>
          <Toast limit={1}>
            {children}
            <Toaster />
          </Toast>
          {/* Keduanya membawa `print:hidden` sendiri supaya tidak ikut masuk ke
              PDF quotation (/build-pc/print). */}
          <FloatingWhatsAppButton whatsappNumber={env.NEXT_PUBLIC_WHATSAPP_CS_NUMBER} />
          <MobileDock isChristmas={isChristmas} />
        </FlyToCartProvider>
      </body>
    </html>
  );
}
