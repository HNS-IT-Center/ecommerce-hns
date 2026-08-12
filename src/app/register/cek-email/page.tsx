import Link from "next/link";
import { Mail } from "lucide-react";

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ResendVerificationForm } from "./resend-verification-form";

export const metadata = {
  title: "Cek Email Anda — HNS IT Center",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex flex-1 items-center justify-center p-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-sm space-y-6 rounded-2xl border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-6 w-6 text-primary" />
          </div>

          <div>
            <h1 className="text-xl font-bold">Cek Email Anda</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Kami sudah mengirim tautan verifikasi ke email yang Anda daftarkan. Klik tautan itu untuk
              mengaktifkan akun, lalu masuk seperti biasa.
            </p>
          </div>

          <ResendVerificationForm />

          <Link href="/login" className="block text-sm font-semibold text-foreground underline">
            Kembali ke halaman masuk
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
