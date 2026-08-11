import { redirect } from "next/navigation";
import Link from "next/link";
import { LogOut, Wrench } from "lucide-react";

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { getCurrentCustomer } from "@/lib/auth/customer";
import { listSavedBuilds } from "@/lib/api/saved-pc-builds";
import { SavedBuildCard } from "@/features/account/components/saved-build-card";
import { customerLogoutAction } from "./actions";

export const metadata = {
  title: "Akun Saya — HNS IT Center",
  robots: { index: false, follow: false },
};

/**
 * `proxy.ts` sudah menyaring permintaan tanpa cookie sesi sebelum sampai ke
 * sini, tapi itu gerbang, bukan otoritas — ia hanya memeriksa tanda tangan
 * token, bukan apakah baris `customers`-nya masih ada. Redirect di bawah
 * menutup celah itu untuk kasus akun dihapus di antara request.
 */
export default async function Page() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/login");

  const builds = await listSavedBuilds(customer.id);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 p-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-4xl space-y-8">
          <div className="flex flex-col gap-6 rounded-2xl border bg-card p-8 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">Akun Saya</h1>
              <p className="mt-1 text-sm text-muted-foreground">{customer.name}</p>
              <p className="text-sm text-muted-foreground">{customer.email}</p>
            </div>

            <form action={customerLogoutAction}>
              <button
                type="submit"
                className="flex items-center justify-center gap-2 rounded-xl border border-input px-4 py-3 text-sm font-semibold transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                Keluar
              </button>
            </form>
          </div>

          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Rakitan Tersimpan</h2>
              <Link
                href="/build-pc"
                className="flex items-center gap-1.5 text-sm font-semibold text-brand-green hover:underline"
              >
                <Wrench className="h-3.5 w-3.5" />
                Rakit PC Baru
              </Link>
            </div>

            {builds.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-card p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Belum ada rakitan tersimpan. Susun rakitan di PC Builder lalu simpan untuk melihatnya
                  di sini.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {builds.map((build) => (
                  <SavedBuildCard key={build.id} build={build} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
