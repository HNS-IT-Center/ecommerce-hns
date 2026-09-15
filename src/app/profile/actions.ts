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
export async function customerLogoutAction(): Promise<void> {
  await Promise.all([destroyCustomerSession(), destroySession()])
  redirect("/")
}
