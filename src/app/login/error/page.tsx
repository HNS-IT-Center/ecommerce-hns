import Link from "next/link";
import { AlertTriangle, MessageCircle } from "lucide-react";

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { buildWhatsAppUrl } from "@/lib/api/whatsapp";
import { env } from "@/config/env";

export const metadata = {
  title: "Gagal masuk — HNS IT Center",
  robots: { index: false, follow: false },
};

/**
 * Satu halaman untuk semua cara alur login Google bisa gagal — docs/09 §9.1.
 * Tidak pernah halaman kosong atau redirect diam-diam: setiap kegagalan
 * menjelaskan apa yang terjadi DAN menawarkan jalan lain (WhatsApp) yang
 * tidak butuh akun.
 *
 * `reason` datang dari /api/auth/google/callback. Alasan yang tidak dikenal
 * jatuh ke pesan umum — bukan detail teknis dari Google (docs/09 §9.1: itu
 * masuk log server, bukan layar pelanggan).
 */
const MESSAGES: Record<string, string> = {
  access_denied: "Anda membatalkan proses masuk.",
  state_invalid: "Sesi masuk kedaluwarsa. Coba lagi.",
  network: "Gagal menghubungi Google. Coba beberapa saat lagi.",
  rate_limit: "Terlalu banyak percobaan. Coba beberapa menit lagi.",
};

const DEFAULT_MESSAGE = "Gagal masuk dengan Google. Coba beberapa saat lagi.";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const message = (reason && MESSAGES[reason]) || DEFAULT_MESSAGE;

  const waUrl = buildWhatsAppUrl(
    env.NEXT_PUBLIC_WHATSAPP_CS_NUMBER,
    "Halo HNS IT Center, saya ingin bertanya tentang produk Anda.",
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex flex-1 items-center justify-center p-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>

          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Gagal masuk</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{message}</p>
          </div>

          <div className="flex flex-col gap-2">
            <Link
              href="/login"
              className="flex items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Coba lagi
            </Link>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl bg-whatsapp px-4 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              <MessageCircle className="h-4 w-4" />
              Chat WhatsApp
            </a>
            <Link
              href="/shop"
              className="flex items-center justify-center rounded-xl border border-input px-4 py-3 text-sm font-semibold transition-colors hover:bg-muted"
            >
              Lihat Produk
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
