import { redirect } from "next/navigation";

/**
 * Peninggalan halaman akun lama (pra-Sprint-1, sebelum login Google ada) yang
 * cuma bisa mengatakan "belum tersedia" — lihat `features/auth/components/
 * registration-unavailable.tsx`. Halaman akun pelanggan yang sungguhan ada di
 * /profile (proteksi sesi, rakitan tersimpan).
 *
 * Redirect ke /profile, BUKAN ke /login: /profile sendiri yang memutuskan apakah
 * pengunjung perlu login (redirect ke /login kalau belum ada sesi) — jangan
 * duplikasi keputusan itu di sini.
 */
export default function Page() {
  redirect("/profile");
}
