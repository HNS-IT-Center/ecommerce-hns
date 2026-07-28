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
    default: "HNS IT Center Batam — Toko Komputer, Laptop & Aksesoris Terlengkap",
    template: `%s | ${env.NEXT_PUBLIC_SITE_NAME}`,
  },
  description:
    "Jual Desktop PC, Gaming PC, Laptop, PC Components, Gaming Gear, Networking, Printer, Monitor, dan aksesoris komputer di Batam. Tersedia layanan rakit PC, service, dan upgrade hardware.",
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <JsonLd data={organizationJsonLd} />
        <JsonLd data={websiteJsonLd} />
        <FlyToCartProvider>
          <Toast limit={1}>
            {children}
            <Toaster />
          </Toast>
          <FloatingWhatsAppButton whatsappNumber={env.NEXT_PUBLIC_WHATSAPP_CS_NUMBER} />
          <MobileDock />
        </FlyToCartProvider>
      </body>
    </html>
  );
}
