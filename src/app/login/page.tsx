import Link from "next/link";
import { redirect } from "next/navigation";

import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { env } from "@/config/env";
import { getCurrentCustomer } from "@/lib/auth/customer";
import { sanitizeNextPath } from "@/lib/auth/safe-redirect";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Masuk — HNS IT Center",
  robots: { index: false, follow: false },
};

/**
 * Dua jalur masuk: Google (docs/09-google-oauth-setup.md) dan email+password
 * (2026-08-12, di samping Google — bukan pengganti). Keduanya menghasilkan
 * baris `Customer` yang sama, tapi tidak pernah tergabung: satu akun cuma
 * pernah punya SATU jalur identitas, lihat catatan di schema.prisma pada
 * model Customer.
 *
 * Akun hanya menambah kemampuan menyimpan rakitan — browsing, PC builder,
 * keranjang, dan checkout WhatsApp tetap terbuka tanpa akun, jadi halaman
 * ini tidak menutup jalan pemesanan langsung.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const nextPath = sanitizeNextPath(next);

  /**
   * Pelanggan yang sudah masuk tidak punya keperluan dengan formulir ini —
   * pola sama seperti /register.
   *
   * Tujuannya `nextPath`, BUKAN selalu `/profile`: halaman ini kerap dicapai
   * lewat `?next=...` dari proxy, dan melempar ke /profile akan membuang
   * tujuan yang tadi diminta. `sanitizeNextPath` sudah menjamin isinya path
   * internal, jadi nilai ini aman dioper ke `redirect()`.
   *
   * Tidak berputar dengan proxy: proxy hanya melempar KE sini saat cookie
   * sesi tidak ada, sementara cabang ini hanya jalan saat sesinya ada.
   */
  const customer = await getCurrentCustomer();
  if (customer) redirect(nextPath);

  const googleUrl = `/api/auth/google?next=${encodeURIComponent(nextPath)}`;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <Header />
      <main className="flex flex-1 items-center justify-center p-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-8 shadow-sm">
          <div className="text-center">
            <h1 className="text-2xl font-extrabold tracking-tight">Masuk</h1>
          </div>

          <a
            href={googleUrl}
            className="flex items-center justify-center gap-3 rounded-xl border border-input bg-white px-4 py-3 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-muted"
          >
            <GoogleIcon className="h-5 w-5" />
            Masuk dengan Google
          </a>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-semibold text-muted-foreground">
              atau
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <LoginForm nextPath={nextPath} />

          {/* Tautan "Daftar" hanya muncul kalau pendaftaran manual memang
              dibuka. Saat tertutup, TIDAK ada teks pengganti seperti
              "pendaftaran sedang ditutup": Google di atas tetap mendaftarkan
              akun pada masuk pertama, jadi orang tidak sedang kehilangan
              apa pun — mengumumkan penutupan justru membuat mereka mengira
              tidak bisa punya akun sama sekali. Lihat REGISTER_MANUAL_ENABLED
              di config/env.ts. */}
          {env.REGISTER_MANUAL_ENABLED ? (
            <p className="text-center text-sm text-muted-foreground">
              Belum punya akun?{" "}
              <Link
                href="/register"
                className="font-semibold text-foreground underline"
              >
                Daftar
              </Link>
            </p>
          ) : null}

          <Link
            href="/shop"
            className="flex items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted"
          >
            Lanjut tanpa akun
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.26v3.09A11.99 11.99 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.63H1.26A11.99 11.99 0 0 0 0 12c0 1.94.46 3.77 1.26 5.37l4.01-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.26 6.63l4.01 3.09C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}
