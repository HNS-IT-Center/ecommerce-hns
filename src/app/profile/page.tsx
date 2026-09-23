import { redirect } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, LogOut, Wrench } from "lucide-react";

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { getCurrentCustomer } from "@/lib/auth/customer";
import { getCurrentUser } from "@/lib/auth";
import { bisaAkses, muatIzinUser } from "@/lib/auth/permissions";
import { listSavedBuilds } from "@/lib/api/saved-pc-builds";
import { getStaffProfile } from "@/lib/api/staff-profile";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { SavedBuildCard } from "@/features/account/components/saved-build-card";
import { ProfileTabs } from "@/features/account/components/profile-tabs";
import { StaffProfileCard } from "@/features/account/components/staff-profile-card";
import { buildWhatsAppUrl } from "@/lib/api/whatsapp";
import { env } from "@/config/env";
import { InstallAppButton } from "@/features/pwa/components/install-app-button";
import { customerLogoutAction } from "./actions";

export const metadata = {
  title: "Profil Saya",
  robots: { index: false, follow: false },
};

/**
 * `proxy.ts` sudah menyaring permintaan tanpa cookie sesi sebelum sampai ke
 * sini, tapi itu gerbang, bukan otoritas — ia hanya memeriksa tanda tangan
 * token, bukan apakah baris `users`-nya masih ada. Redirect di bawah
 * menutup celah itu untuk kasus akun dihapus di antara request.
 */
export default async function Page() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/login");

  /**
   * Akun Google yang belum melengkapi username/nomor HP tidak boleh memakai
   * halaman ini dulu — lihat catatan di schema.prisma pada Customer.username.
   * Akun daftar-manual tidak pernah transit lewat kondisi ini karena
   * registerAction mewajibkan keduanya sejak awal.
   *
   * **Akun STAFF dikecualikan.** `phoneNumber` memang NULL untuk admin
   * (schema.prisma), jadi tanpa pengecualian ini setiap Sales/CS/kasir yang
   * membuka /profile terlempar ke formulir lengkapi-profil yang tidak ada
   * hubungannya dengan pekerjaannya — dan tidak pernah sampai ke riwayat
   * quotation-nya. Formulir itu memang untuk pelanggan.
   */
  if (!customer.isAdmin && (!customer.username || !customer.phoneNumber)) {
    redirect("/profile/lengkapi-profil");
  }

  const builds = await listSavedBuilds(customer.id);

  /**
   * Staff penerbit quotation mendapat jalan ke riwayatnya dari sini.
   *
   * Dibaca dari sesi ADMIN (`getCurrentUser`), bukan dari `customer.isAdmin`:
   * yang menentukan izin adalah akun pemilik cookie panel. Pelanggan biasa
   * tidak memicu satu kueri izin pun.
   */
  const staff = await getCurrentUser();
  const bolehQuotation = staff
    ? bisaAkses(await muatIzinUser(staff), "quotation-terbit", "edit")
    : false;

  /**
   * Profil yang bisa disunting hanya untuk STAFF.
   *
   * Pelanggan biasa tidak melihat kartunya sama sekali — nama sales, username
   * panel, dan nomor yang dihubungi pelanggan tidak berarti apa-apa bagi mereka,
   * dan mereka juga tidak punya sesi admin untuk menyimpannya. Datanya pun tidak
   * dibaca kalau bukan staff, bukan sekadar tidak dirender: baris yang tidak
   * pernah dikirim tidak bisa terbaca dari payload RSC.
   *
   * `staff.id === customer.id` bukan syarat berlebihan. Satu peramban bisa
   * memegang dua sesi untuk akun BERBEDA — admin yang sedang menguji akun
   * pelanggan — dan di situ `getCurrentCustomer()` memenangkan sesi pelanggan
   * sementara `getCurrentUser()` tetap mengembalikan akun adminnya. Tanpa
   * perbandingan ini, halaman menampilkan nama pelanggan di kepalanya tapi
   * menyunting profil akun admin di bawahnya.
   */
  const staffProfile =
    staff && staff.id === customer.id ? await getStaffProfile(staff.id) : null;

  /**
   * Tombol akun, disusun sekali lalu dipakai dua cabang tampilan.
   *
   * Di mobile tidak ada dropdown akun — dock "Profil" mendarat di halaman ini,
   * jadi jalan ke panel untuk admin harus ada di sini juga, bukan hanya di
   * header desktop.
   */
  const tombolAkun = (
    <>
      {/* `canOpenPanel`, bukan `isAdmin` — alasannya sama dengan di
          `account-nav.tsx`: Sales & Kasir punya sesi admin tapi tidak punya satu
          pun halaman di dalam panel, jadi `/admin` hanya memantulkan mereka
          kembali ke sini. */}
      {customer.canOpenPanel && (
        <Link
          href="/admin"
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-input px-4 text-sm font-semibold transition-colors hover:bg-muted"
        >
          <LayoutDashboard className="h-4 w-4" />
          Panel Admin
        </Link>
      )}
      <form action={customerLogoutAction}>
        <button
          type="submit"
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-input px-4 text-sm font-semibold transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Keluar
        </button>
      </form>
    </>
  );

  const deleteAccountWaUrl = buildWhatsAppUrl(
    env.NEXT_PUBLIC_WHATSAPP_CS_NUMBER,
    "Halo HNS IT Center, saya ingin menghapus akun saya beserta data yang tersimpan."
  );

  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <Header />
      <main className="min-h-content flex-1 p-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-4xl space-y-6">
          {/* Judul halaman DI ATAS bilah tab, bentuk yang sama persis dengan
              `/profile/quotation` dan `/profile/rakitan`. Ketiganya satu
              rangkaian halaman; kalau yang satu berjudul di luar kartu dan yang
              lain di dalam kartu, berpindah tab terasa seperti berpindah
              aplikasi. */}
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Profil Saya</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {bolehQuotation
                ? "Foto, nama, dan nomor yang dilihat pelanggan pada quotation dan pesan follow-up."
                : "Data akun Anda di HNS IT Center."}
            </p>
          </div>

          {/* Bilah tab, dan `/profile` adalah SALAH SATU tabnya — bukan halaman
              induk yang memuat tab di tengah isinya.

              Bentuk sebelumnya membingungkan: kartu profil berdiri di bawah
              bilah tab yang menyorot "Rakitan Tersimpan", jadi pengaturan akun
              terbaca seolah isi tab itu. Pelanggan biasa tidak melihat bilahnya
              sama sekali — bagi mereka memang cuma ada satu daftar. */}
          {bolehQuotation && <ProfileTabs active="profil" />}

          {/* Satu kartu kepala, bukan dua. Untuk staff, tombol Panel Admin &
              Keluar dititipkan ke kartu profil; untuk pelanggan, kartu ringkas
              di bawah ini yang memuatnya. */}
          {staffProfile ? (
            <StaffProfileCard
              profile={staffProfile}
              minPasswordLength={MIN_PASSWORD_LENGTH}
              bolehQuotation={bolehQuotation}
              actions={tombolAkun}
            />
          ) : (
            <div className="flex flex-col gap-6 rounded-2xl border bg-card p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-lg font-bold">{customer.name}</p>
                <p className="text-sm text-muted-foreground">{customer.email}</p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">{tombolAkun}</div>
            </div>
          )}

          {/* Daftar rakitan hanya di sini untuk yang TIDAK punya tabnya sendiri.

              Sales & CS punya tab "Rakitan Tersimpan" dengan isi yang sama
              persis; menampilkannya dua kali berarti halaman profil mereka
              berakhir dengan daftar yang sudah punya alamatnya sendiri, dan tab
              yang aktif berhenti menjelaskan apa yang sedang dilihat. */}
          {!bolehQuotation && (
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

          )}

          {/* Hidden automatically when not installable or already installed. */}
          <InstallAppButton variant="card" />

          {/* Bukan tombol hapus, bukan alur self-service — penghapusan akun
              hanya dieksekusi staff. Baris ini tetap harus ada: aplikasi ini
              mengumpulkan data dari akun Google pelanggan, dan review
              publikasi OAuth Google memeriksa apakah pengguna punya JALAN
              untuk meminta datanya dihapus — jalan lewat CS tetap sah,
              menghapus baris ini sama sekali yang tidak. */}
          <p className="text-center text-xs text-muted-foreground">
            Ingin menghapus akun?{" "}
            <a href={deleteAccountWaUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
              Hubungi kami lewat WhatsApp
            </a>
            .
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
