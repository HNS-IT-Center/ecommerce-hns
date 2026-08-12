import Link from "next/link";
import { redirect } from "next/navigation";

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { getCurrentCustomer } from "@/lib/auth/customer";
import { RegisterForm } from "./register-form";

export const metadata = {
  title: "Daftar — HNS IT Center",
  robots: { index: false, follow: false },
};

/**
 * Menggantikan redirect sementara ke /login (2026-08-11) — sekarang login
 * email+password sungguhan ada di samping Google, jadi "daftar" jadi
 * konsep sendiri lagi (Google tidak butuh pendaftaran terpisah: masuk
 * pertama kali SEKALIGUS mendaftarkan akun).
 *
 * BUKAN kelanjutan formulir lama yang dibuang commit 29e36ae — itu
 * simulasi (password tidak pernah sampai ke database). Ini menyimpan
 * `passwordHash` sungguhan (scrypt, sama seperti admin) dan mewajibkan
 * verifikasi email sebelum akun bisa dipakai masuk.
 */
export default async function Page() {
  const customer = await getCurrentCustomer();
  if (customer) redirect("/akun");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex flex-1 items-center justify-center p-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-sm">
          <h1 className="text-xl font-bold">Daftar Akun</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Untuk menyimpan rakitan PC dan melihatnya kembali kapan saja.
          </p>

          <div className="mt-6">
            <RegisterForm />
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Sudah punya akun?{" "}
            <Link href="/login" className="font-semibold text-foreground underline">
              Masuk
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
