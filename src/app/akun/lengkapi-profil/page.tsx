import { redirect } from "next/navigation";

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { getCurrentCustomer } from "@/lib/auth/customer";
import { sanitizeNextPath } from "@/lib/auth/safe-redirect";
import { CompleteProfileForm } from "./complete-profile-form";

export const metadata = {
  title: "Lengkapi Profil — HNS IT Center",
  robots: { index: false, follow: false },
};

/**
 * Wajib untuk akun Google yang belum punya username/nomor HP — TIDAK BOLEH
 * dilewati (skip). Kalau profilnya sudah lengkap, halaman ini tidak berguna
 * lagi untuk akun itu, jadi diarahkan keluar alih-alih menampilkan form yang
 * tidak perlu. Lihat catatan di schema.prisma pada Customer.username.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/login");
  if (customer.username && customer.phoneNumber) redirect("/akun");

  const { next } = await searchParams;
  const nextPath = sanitizeNextPath(next);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex flex-1 items-center justify-center p-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-sm space-y-6 rounded-2xl border bg-card p-8 shadow-sm">
          <div className="text-center">
            <h1 className="text-xl font-bold">Lengkapi Profil</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Satu langkah lagi — username dan nomor HP dibutuhkan supaya kami bisa menghubungi Anda
              soal pesanan.
            </p>
          </div>

          <CompleteProfileForm nextPath={nextPath} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
