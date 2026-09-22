import Link from "next/link"
import { redirect } from "next/navigation"
import { Wrench } from "lucide-react"

import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { getCurrentUser } from "@/lib/auth"
import { bisaAkses, muatIzinUser } from "@/lib/auth/permissions"
import { listSavedBuilds } from "@/lib/api/saved-pc-builds"
import { SavedBuildCard } from "@/features/account/components/saved-build-card"
import { ProfileTabs } from "@/features/account/components/profile-tabs"

export const metadata = {
  title: "Rakitan Tersimpan",
  robots: { index: false, follow: false },
}

/**
 * Tab kedua milik staff: rakitan yang MEREKA simpan sendiri lewat tombol Simpan
 * di /build-pc, untuk dilanjutkan nanti.
 *
 * Bukan rakitan milik pelanggan. Membuka simpanan akun pelanggan kepada staff
 * adalah fitur lain dengan aturan privasinya sendiri, dan bukan yang diminta.
 *
 * Halaman ini sengaja TIDAK menggantikan bagian "Rakitan Tersimpan" di
 * `/profile` — pelanggan biasa tetap melihatnya di sana, tanpa tab, karena bagi
 * mereka memang cuma ada satu daftar.
 */
export default async function RakitanTersimpanPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login?next=/profile/rakitan")

  const izin = await muatIzinUser(user)
  if (!bisaAkses(izin, "quotation-terbit", "edit")) redirect("/profile")

  const builds = await listSavedBuilds(user.id)

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <Header />
      <main className="flex-1 p-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-4xl space-y-6">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Rakitan Tersimpan</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Rakitan yang Anda simpan untuk dilanjutkan nanti.
            </p>
          </div>

          <ProfileTabs active="rakitan" />

          <div className="flex justify-end">
            <Link
              href="/build-pc"
              className="flex items-center gap-1.5 text-sm font-semibold text-brand-green hover:underline"
            >
              <Wrench className="h-3.5 w-3.5" />
              Rakit PC Baru
            </Link>
          </div>

          {builds.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
              Belum ada rakitan tersimpan. Susun rakitan di PC Builder lalu tekan Simpan.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {builds.map((build) => (
                <SavedBuildCard key={build.id} build={build} />
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}

export const dynamic = "force-dynamic"
