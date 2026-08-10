import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { getCurrentCustomer } from "@/lib/auth/customer";
import { customerLogoutAction } from "./actions";

export const metadata = {
  title: "Akun Saya — HNS IT Center",
  robots: { index: false, follow: false },
};

/**
 * Placeholder Sprint 1: cuma membuktikan login-sampai-selesai bekerja.
 * Fitur simpan rakitan (alasan akun ini dibuat, lihat docs/09) menyusul di
 * sprint terpisah.
 *
 * `proxy.ts` sudah menyaring permintaan tanpa cookie sesi sebelum sampai ke
 * sini, tapi itu gerbang, bukan otoritas — ia hanya memeriksa tanda tangan
 * token, bukan apakah baris `customers`-nya masih ada. Redirect di bawah
 * menutup celah itu untuk kasus akun dihapus di antara request.
 */
export default async function Page() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 p-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-md space-y-6 rounded-2xl border bg-card p-8 shadow-sm">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Akun Saya</h1>
            <p className="mt-1 text-sm text-muted-foreground">{customer.name}</p>
            <p className="text-sm text-muted-foreground">{customer.email}</p>
          </div>

          <form action={customerLogoutAction}>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-input px-4 py-3 text-sm font-semibold transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              Keluar
            </button>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}
