import { redirect } from "next/navigation";

/**
 * Peninggalan formulir daftar akun lama (localStorage, tanpa password
 * sungguhan) yang sudah dibuang — lihat `features/auth/components/
 * registration-unavailable.tsx`. Login pelanggan sekarang lewat Google di
 * /login, jadi "daftar" bukan lagi konsep terpisah: masuk pertama kali
 * SEKALIGUS mendaftarkan akun.
 *
 * Redirect permanen, bukan halaman sendiri: tidak ada isi khusus "daftar"
 * yang perlu ditampilkan, dan tautan lama yang mengarah ke sini sebaiknya
 * mendarat di alur yang benar-benar berfungsi.
 */
export default function Page() {
  redirect("/login");
}
