/**
 * Helper autentikasi pelanggan — satu-satunya pintu yang boleh dipakai modul
 * lain untuk sesi akun pelanggan. Paralel dengan `lib/auth/index.ts` (sesi
 * admin), sengaja berkas terpisah karena keduanya tidak boleh saling
 * menyentuh — lihat docs/09-google-oauth-setup.md §1.
 */
import { cookies } from "next/headers"
import { getPrisma } from "@/lib/prisma/client"
import {
  CUSTOMER_SESSION_COOKIE,
  CUSTOMER_SESSION_MAX_AGE_SECONDS,
  customerSessionCookieOptions,
  signCustomerSession,
  verifyCustomerSession,
  type CustomerSessionPayload,
} from "./customer-session"

export {
  CUSTOMER_SESSION_COOKIE,
  CUSTOMER_SESSION_MAX_AGE_SECONDS,
  verifyCustomerSession,
  type CustomerSessionPayload,
}

export type CurrentCustomer = {
  id: string
  email: string
  name: string
  username: string | null
  phoneNumber: string | null
}

/** Payload sesi dari cookie, atau null. Tidak menyentuh database. */
export async function getCustomerSession(): Promise<CustomerSessionPayload | null> {
  const store = await cookies()
  return verifyCustomerSession(store.get(CUSTOMER_SESSION_COOKIE)?.value)
}

/**
 * Pelanggan yang sedang masuk, dibaca ULANG dari database setiap kali.
 *
 * Sama seperti `getCurrentUser()` versi admin: cookie hanya membuktikan
 * "seseorang pernah berhasil login sebagai id ini", bukan sumber data.
 */
export async function getCurrentCustomer(): Promise<CurrentCustomer | null> {
  const session = await getCustomerSession()
  if (!session) return null

  const customer = await getPrisma().customer.findUnique({
    where: { id: session.sub },
    select: { id: true, email: true, name: true, username: true, phoneNumber: true, sessionsRevokedAt: true },
  })
  if (!customer) return null

  // Pencabutan sesi — pola sama seperti `passwordChangedAt` di sesi admin,
  // dipakai juga saat akun dihapus (CLAUDE.md §2.8: sessionsRevokedAt diisi
  // sesaat sebelum baris `customers` dihapus).
  if (customer.sessionsRevokedAt && session.iat * 1000 < customer.sessionsRevokedAt.getTime()) {
    return null
  }

  return {
    id: customer.id,
    email: customer.email,
    name: customer.name,
    username: customer.username,
    phoneNumber: customer.phoneNumber,
  }
}

/** Pasang cookie sesi. Dipanggil setelah id_token Google terverifikasi. */
export async function createCustomerSession(customer: { id: string; email: string }): Promise<void> {
  const token = await signCustomerSession({ sub: customer.id, email: customer.email })
  const store = await cookies()
  store.set(CUSTOMER_SESSION_COOKIE, token, customerSessionCookieOptions())
}

/** Cabut cookie sesi. */
export async function destroyCustomerSession(): Promise<void> {
  const store = await cookies()
  store.set(CUSTOMER_SESSION_COOKIE, "", { ...customerSessionCookieOptions(0), maxAge: 0 })
}
