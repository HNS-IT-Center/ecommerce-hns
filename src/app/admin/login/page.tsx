import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"

export const metadata: Metadata = {
  title: "Masuk Admin — HNS IT Center",
  robots: { index: false, follow: false },
}

/**
 * Satu Login (Fase A): pintu login admin terpisah SUDAH DIHAPUS. Halaman ini
 * kini hanya mengalihkan ke `/login` — satu pintu untuk semua, sistem yang
 * menentukan tujuan berdasarkan peran. Route dipertahankan (bukan dihapus dari
 * disk) supaya tautan/bookmark lama ke `/admin/login` tetap mendarat dengan
 * benar, dan `proxy.ts` yang mengarahkan ke sini tidak perlu diubah bersamaan.
 */
export default async function AdminLoginPage() {
  // Sudah masuk sebagai admin → langsung ke panel.
  if (await getCurrentUser()) redirect("/admin")
  // Belum masuk → satu pintu login.
  redirect("/login")
}
