import Link from "next/link";
import { redirect } from "next/navigation";

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { getCurrentCustomer } from "@/lib/auth/customer";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata = {
  title: "Lupa Password — HNS IT Center",
  robots: { index: false, follow: false },
};

/**
 * Pemulihan password hanya untuk orang yang TIDAK bisa masuk. Yang sesinya
 * masih hidup diarahkan ke /profile — pola sama seperti /login dan /register.
 *
 * Ini bukan penghalang bagi pelanggan yang ingin mengganti password: alur itu
 * memang belum ada, dan kalau nanti dibuat, tempatnya di halaman akun dengan
 * verifikasi password lama — bukan lewat tautan reset via email.
 */
export default async function Page() {
  const customer = await getCurrentCustomer();
  if (customer) redirect("/profile");

  return (
    <div className="flex min-h-dvh flex-col bg-background">
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
