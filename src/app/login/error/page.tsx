import Link from "next/link";
import { AlertTriangle, KeyRound, MessageCircle } from "lucide-react";

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { buildWhatsAppUrl } from "@/lib/api/whatsapp";
import { env } from "@/config/env";
import { isSsoEnabled } from "@/lib/auth/sso";

export const metadata = {
  title: "Gagal masuk",
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

/**
 * Alasan dari `/api/auth/sso/*` — login STAFF lewat HNS SSO (docs/19 §5).
 *
 * Pembacanya staff, bukan pelanggan, jadi setiap pesan menyebut SIAPA yang bisa
 * membereskannya: admin SSO (akses aplikasi) atau owner ecommerce (akun &
 * peran di Manajemen User). Pesan "gagal masuk" tanpa arah membuat staff
 * mencoba ulang hal yang sama berkali-kali.
 */
const SSO_MESSAGES: Record<string, string> = {
  sso_not_configured: "Masuk dengan SSO HNS belum diaktifkan di web ini. Gunakan email dan password.",
  sso_access_denied:
    "Akun SSO Anda belum diberi akses ke web Ecommerce, atau proses masuk dibatalkan. Minta admin SSO HNS memberi akses aplikasi ini.",
  sso_not_provisioned:
    "Login SSO berhasil, tapi email Anda belum terdaftar sebagai staff di web ini. Minta owner menambahkan email Anda di Manajemen User, lalu coba lagi.",
  sso_customer_account:
    "Email SSO Anda terdaftar sebagai akun pelanggan di web ini, jadi tidak bisa dipakai masuk sebagai staff. Hubungi owner.",
  sso_sub_conflict:
    "Email ini sudah tertaut ke akun SSO orang lain. Hubungi owner untuk diperiksa.",
  sso_state_invalid: "Sesi masuk kedaluwarsa atau tidak sah. Coba lagi.",
  sso_network: "Gagal menghubungi SSO HNS. Coba beberapa saat lagi, atau masuk dengan email dan password.",
  sso_token: "SSO HNS menolak proses masuk. Coba lagi; kalau terulang, hubungi admin.",
};

const SSO_DEFAULT_MESSAGE = "Gagal masuk dengan SSO HNS. Coba beberapa saat lagi.";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const isSso = Boolean(reason?.startsWith("sso_"));
  if (isSso) return <SsoErrorView message={(reason && SSO_MESSAGES[reason]) || SSO_DEFAULT_MESSAGE} />;

  const message = (reason && MESSAGES[reason]) || DEFAULT_MESSAGE;

  const waUrl = buildWhatsAppUrl(
    env.NEXT_PUBLIC_WHATSAPP_CS_NUMBER,
    "Halo HNS IT Center, saya ingin bertanya tentang produk Anda.",
  );

  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <Header />
      <main className="min-h-content flex flex-1 items-center justify-center p-4 py-12 sm:px-6 lg:px-8">
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

/**
 * Versi halaman galat untuk STAFF yang gagal masuk lewat SSO.
 *
 * Tanpa tombol WhatsApp CS dan "Lihat Produk" — keduanya jalan keluar untuk
 * pelanggan. Staff butuh dua hal: mencoba SSO lagi, atau masuk dengan password
 * yang masih berlaku selama tahap peralihan.
 */
function SsoErrorView({ message }: { message: string }) {
  const ssoReady = isSsoEnabled();

  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <Header />
      <main className="min-h-content flex flex-1 items-center justify-center p-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-6 text-center shadow-sm sm:p-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>

          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Gagal masuk dengan SSO</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{message}</p>
          </div>

          <div className="flex flex-col gap-2">
            {ssoReady ? (
              // `<a>`, bukan `<Link>`: tujuannya route handler yang me-redirect
              // ke domain lain, bukan halaman yang bisa di-prefetch.
              <a
                href="/api/auth/sso/login"
                className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
              >
                <KeyRound className="h-4 w-4" />
                Coba lagi dengan SSO
              </a>
            ) : null}
            <Link
              href="/login"
              className="flex items-center justify-center rounded-xl border border-input px-4 py-3 text-sm font-semibold transition-colors hover:bg-muted"
            >
              Masuk dengan email &amp; password
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
