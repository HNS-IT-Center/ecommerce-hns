import type { Metadata } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { JsonLd } from "@/components/seo/json-ld";
import { env } from "@/config/env";
import { ToolsView } from "@/features/tools/components/tools-view";
import { ToolsCrossSell } from "@/features/tools/components/tools-cross-sell";

const PAGE_PATH = "/tools";

/**
 * Judul & deskripsi memakai kata yang benar-benar DIKETIK orang Indonesia
 * ("tes keyboard online", "cek mouse"), bukan istilah internal yang dipakai di
 * dalam kode ("hardware testing tools"). Keduanya menggambarkan hal yang sama,
 * tapi hanya satu yang muncul di kotak pencarian.
 *
 * Nama kota sengaja TIDAK dimasukkan. Kueri seperti "tes keyboard" tidak punya
 * maksud lokal — Google menyajikan hasil yang sama untuk pencari di Batam dan
 * di mana pun, jadi menyisipkan nama kota hanya mengencerkan judul tanpa
 * menambah peluang. Kaitan lokal usaha ini sudah dinyatakan lewat
 * Organization + LocalBusiness schema di tempat yang memang untuk itu.
 */
export const metadata: Metadata = {
  title: "Tes Keyboard, Mouse & Gamepad Online — Gratis",
  description:
    "Alat tes hardware gratis di browser: cek tombol keyboard yang rusak, uji klik & scroll mouse, dan tes tombol serta analog gamepad. Tanpa install, langsung jalan.",
  keywords: [
    "tes keyboard online",
    "cek keyboard rusak",
    "tes mouse online",
    "cek klik mouse",
    "tes gamepad online",
    "keyboard tester",
    "mouse tester",
    "gamepad tester",
  ],
  alternates: { canonical: PAGE_PATH },
  openGraph: {
    title: "Tes Keyboard, Mouse & Gamepad Online — Gratis",
    description:
      "Cek tombol keyboard yang rusak, uji klik & scroll mouse, dan tes gamepad langsung dari browser. Gratis, tanpa install.",
    url: PAGE_PATH,
    type: "website",
    siteName: env.NEXT_PUBLIC_SITE_NAME,
    locale: "id_ID",
  },
};

/**
 * `WebApplication` — bukan `Product` atau `Article`.
 *
 * Yang ditawarkan halaman ini adalah alat yang dijalankan di browser, dan tipe
 * inilah yang menyatakan hal itu. `offers` dengan harga 0 adalah cara skema ini
 * menyatakan "gratis"; menghilangkannya membuat harga jadi tidak diketahui,
 * bukan berarti tanpa biaya.
 */
function buildToolJsonLd(baseUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Tes Keyboard, Mouse & Gamepad Online",
    url: `${baseUrl}${PAGE_PATH}`,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Web Browser",
    inLanguage: "id-ID",
    description:
      "Alat tes hardware gratis berbasis browser untuk memeriksa keyboard, mouse, dan gamepad.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "IDR",
    },
    publisher: {
      // Menunjuk Organization yang sudah dideklarasikan di root layout lewat
      // `@id`-nya, alih-alih menuliskan ulang datanya. Menyalin nama & alamat
      // ke sini berarti ada dua sumber yang bisa berselisih diam-diam.
      "@id": `${baseUrl}/#organization`,
    },
  };
}

/**
 * Pertanyaan yang memang ditanyakan orang, dijawab singkat.
 *
 * Berpeluang tampil sebagai hasil kaya di Google, dan sekaligus menaruh frasa
 * yang diketik pencari ke dalam teks halaman secara wajar — bukan tumpukan kata
 * kunci yang dijejalkan.
 */
const FAQ_ITEMS = [
  {
    question: "Bagaimana cara mengetes keyboard yang rusak?",
    answer:
      "Buka tab Keyboard, lalu tekan tombol satu per satu. Tombol yang menyala di layar berarti terbaca dengan baik; tombol yang tidak bereaksi saat ditekan kemungkinan bermasalah.",
  },
  {
    question: "Apakah alat tes ini gratis?",
    answer:
      "Ya, seluruh alat di halaman ini gratis dan berjalan langsung di browser. Tidak perlu mendaftar atau memasang aplikasi apa pun.",
  },
  {
    question: "Apakah data saya dikirim ke server?",
    answer:
      "Tidak. Seluruh pengujian berjalan di dalam browser Anda dan tidak ada tombol atau gerakan yang dikirim maupun disimpan di server kami.",
  },
  {
    question: "Kenapa gamepad saya tidak terdeteksi?",
    answer:
      "Browser baru mengenali gamepad setelah ada tombol yang ditekan. Sambungkan gamepad, tekan salah satu tombolnya, lalu buka tab Gamepad. Pastikan juga memakai browser berbasis Chrome, Edge, atau Firefox versi terbaru.",
  },
];

function buildFaqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

export default function ToolsPage() {
  const baseUrl = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <JsonLd data={buildToolJsonLd(baseUrl)} />
      <JsonLd data={buildFaqJsonLd()} />
      <Header />
      <main className="flex-1 pb-16">
        <div className="mx-auto w-full px-4 py-8 md:px-6 2xl:px-8">
          <div className="mx-auto mb-8 max-w-3xl space-y-3 text-center">
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              Tes Keyboard, Mouse &amp; Gamepad Online
            </h1>
            <p className="text-muted-foreground">
              Cek tombol keyboard yang rusak, uji klik dan scroll mouse, serta tes tombol dan
              analog gamepad — gratis, langsung dari browser, tanpa perlu install apa pun.
            </p>
          </div>

          <ToolsView />

          <div className="mt-24 space-y-16">
            <ToolsCrossSell
              title="Cari Keyboard Baru"
              searchQuery="keyboard"
              categorySlug="aksessories-komputer-keyboard"
            />
            <ToolsCrossSell
              title="Cari Mouse Baru"
              searchQuery="mouse"
              categorySlug="aksessories-komputer-mouse"
            />
            <ToolsCrossSell
              title="Cari Gamepad Baru"
              searchQuery="gamepad"
              categorySlug="aksessories-komputer-gamepad"
            />
          </div>

          {/* Teks FAQ ini sengaja ada di HTML, bukan hanya di dalam JSON-LD:
              Google memverifikasi bahwa isi structured data benar-benar terlihat
              di halaman, dan FAQ yang cuma hidup di skema bisa diabaikan. */}
          <section className="mx-auto mt-24 max-w-3xl">
            <h2 className="mb-6 text-2xl font-bold tracking-tight">Pertanyaan Umum</h2>
            <dl className="space-y-6">
              {FAQ_ITEMS.map((item) => (
                <div key={item.question} className="rounded-xl border bg-card p-5">
                  <dt className="font-semibold text-foreground">{item.question}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {item.answer}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
