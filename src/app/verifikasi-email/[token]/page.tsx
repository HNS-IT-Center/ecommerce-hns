import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { verifyEmailAction } from "@/app/register/actions";

export const metadata = {
  title: "Verifikasi Email — HNS IT Center",
  robots: { index: false, follow: false },
};

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await verifyEmailAction(token);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex flex-1 items-center justify-center p-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-sm space-y-6 rounded-2xl border bg-card p-8 text-center shadow-sm">
          {result.ok ? (
            <>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-green/10">
                <CheckCircle2 className="h-6 w-6 text-brand-green" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Akun Terverifikasi</h1>
                <p className="mt-3 text-sm text-muted-foreground">
                  Email Anda sudah terverifikasi. Sekarang Anda bisa masuk.
                </p>
              </div>
              <Link
                href="/login"
                className="block rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Masuk Sekarang
              </Link>
            </>
          ) : (
            <>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <XCircle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Tautan Tidak Valid</h1>
                <p className="mt-3 text-sm text-muted-foreground">
                  {result.reason === "expired"
                    ? "Tautan verifikasi ini sudah kedaluwarsa. Minta tautan baru dari halaman berikut."
                    : "Tautan verifikasi ini tidak valid — mungkin sudah pernah dipakai. Minta tautan baru kalau perlu."}
                </p>
              </div>
              <Link
                href="/register/cek-email"
                className="block rounded-xl border border-input px-4 py-3 text-sm font-semibold hover:bg-muted"
              >
                Kirim Ulang Tautan
              </Link>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
