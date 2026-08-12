import Link from "next/link";

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata = {
  title: "Lupa Password — HNS IT Center",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex flex-1 items-center justify-center p-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-sm space-y-6 rounded-2xl border bg-card p-8 shadow-sm">
          <div className="text-center">
            <h1 className="text-xl font-bold">Lupa Password</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Masukkan email akun Anda — kami kirim tautan untuk membuat password baru.
            </p>
          </div>

          <ForgotPasswordForm />

          <Link href="/login" className="block text-center text-sm font-semibold text-foreground underline">
            Kembali ke halaman masuk
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
