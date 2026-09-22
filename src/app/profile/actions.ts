"use server"

import { redirect } from "next/navigation"
import { destroySession } from "@/lib/auth"
import { destroyCustomerSession } from "@/lib/auth/customer"

/**
 * Keluar dari storefront mengakhiri KEDUA sesi.
 *
 * Sejak sesi admin juga dikenali di toko (Satu Login Fase B), header tidak
 * membedakan dari cookie mana ia tahu siapa Anda. Kalau "Keluar" hanya
 * mencabut satu, orang yang menekannya tetap terlihat masuk — atau lebih
 * buruk, tampak keluar padahal panel admin masih terbuka di browser itu.
 */
async function cabutSesi(): Promise<void> {
  await Promise.all([destroyCustomerSession(), destroySession()])
}

/**
 * Untuk `<form action={...}>` — form HTML biasa, tanpa JavaScript di
 * pemanggilnya (lihat halaman `/profile`). Karena tidak ada kode klien yang
 * berjalan sesudahnya, kepindahan halaman harus dikerjakan di sini.
 */
export async function customerLogoutAction(): Promise<void> {
  await cabutSesi()
  redirect("/")
}

/**
 * Untuk pemanggil KLIEN yang mengurus lanjutannya sendiri (menu akun di
 * header).
 *
 * **Sengaja tidak memanggil `redirect()`**, dan itu bukan kelalaian. Menu akun
 * harus menjalankan tiga hal setelah cookie tercabut: menanyakan ulang status
 * login untuk tab ini, memberi aba-aba ke tab lain, lalu berpindah halaman.
 * `redirect()` di dalam server action bekerja dengan melempar — apa yang
 * terjadi pada kode klien SESUDAH `await` karena itu bergantung pada cara Next
 * menangani lemparan tersebut, dan ketiga langkah di atas terlalu penting
 * untuk digantungkan pada perilaku yang tidak dijanjikan siapa pun.
 *
 * Tanpa `redirect()`, aksi ini cuma "cabut cookie, selesai" — dan urutan
 * sesudahnya sepenuhnya milik klien yang memanggilnya.
 */
export async function customerLogoutActionForClient(): Promise<void> {
  await cabutSesi()
}
