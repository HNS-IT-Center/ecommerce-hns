/**
 * Helper autentikasi pelanggan — satu-satunya pintu yang boleh dipakai modul
 * lain untuk menanyakan "siapa yang sedang masuk di storefront".
 *
 * Satu Login Fase B (15 Sep 2026): identitasnya dibaca dari tabel `users`,
 * BUKAN lagi `customers`. Sejak Fase A (5 Sep) login sudah mencari di `users`,
 * tapi berkas ini dan beberapa jalur tulis masih memakai `customers` — kedua
 * tabel lalu berjalan sendiri-sendiri (reset password tertulis ke tabel yang
 * tidak dibaca login, dst). Sekarang `customers` tidak dibaca maupun ditulis
 * siapa pun; tabelnya tinggal menunggu dihapus lewat migrasi.
 *
 * Cookie-nya TETAP dua (`hns_customer_session` & `hns_admin_session`) — yang
 * disatukan hanya identitasnya. Menyatukan cookie berarti menyamakan masa
 * berlaku dan penjagaan `proxy.ts`, pekerjaan terpisah yang tidak menambah apa
 * pun yang terlihat pengguna.
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
import { SESSION_COOKIE, isIssuedBeforeRevocation, verifySession } from "./session"
import { bisaAkses, muatIzinUser } from "./permissions"
import { parseAdminRole } from "./roles"

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
  /**
   * Browser ini juga memegang sesi admin yang sah. HANYA untuk navigasi
   * (tautan "Panel Admin") — bukan izin. Akses panel tetap diputuskan
   * `requirePageView`/`requirePermission`, dan status ini TIDAK BOLEH masuk
   * ke jalur harga (CLAUDE.md §2.7).
   */
  isAdmin: boolean
  /**
   * Sesi admin itu punya izin `verify` (view). Sama seperti `isAdmin`: HANYA
   * untuk menampilkan tautan "Verifikasi Rakitan" di dropdown akun. Halaman
   * `/verify` tetap menjaga dirinya sendiri lewat `requirePageView`.
   */
  canVerify: boolean
}

/** Payload sesi dari cookie, atau null. Tidak menyentuh database. */
export async function getCustomerSession(): Promise<CustomerSessionPayload | null> {
  const store = await cookies()
  return verifyCustomerSession(store.get(CUSTOMER_SESSION_COOKIE)?.value)
}

const ACCOUNT_SELECT = {
  id: true,
  email: true,
  name: true,
  username: true,
  phoneNumber: true,
  role: true,
  roleId: true,
  sessionsRevokedAt: true,
  passwordChangedAt: true,
} as const

/**
 * Akun storefront yang sedang masuk, dibaca ULANG dari `users` setiap kali.
 *
 * Diterima dari DUA cookie:
 *   - sesi pelanggan → dicabut oleh `sessionsRevokedAt` (reset password,
 *     hapus akun);
 *   - sesi admin → dicabut oleh `passwordChangedAt`, aturan yang sama persis
 *     dengan `getCurrentUser()`. Admin adalah pemakai storefront juga: tanpa
 *     ini ia terlihat "belum masuk" di toko, dan menekan "Masuk" hanya
 *     memantulkannya kembali ke panel.
 *
 * Kalau dua-duanya ada untuk akun BERBEDA (admin sedang menguji akun pelanggan
 * di browser yang sama), sesi pelanggan yang menang — ini halaman toko — dan
 * `isAdmin` tetap menyala supaya jalan ke panel tidak hilang.
 *
 * Pengunjung tanpa cookie sama sekali tidak memicu query apa pun.
 */
export async function getCurrentCustomer(): Promise<CurrentCustomer | null> {
  const store = await cookies()
  const [customerSession, adminSession] = await Promise.all([
    verifyCustomerSession(store.get(CUSTOMER_SESSION_COOKIE)?.value),
    verifySession(store.get(SESSION_COOKIE)?.value),
  ])
  if (!customerSession && !adminSession) return null

  const ids = [...new Set([customerSession?.sub, adminSession?.sub])].filter(
    (id): id is string => typeof id === "string"
  )
  const rows = await getPrisma().user.findMany({ where: { id: { in: ids } }, select: ACCOUNT_SELECT })
  const byId = new Map(rows.map((row) => [row.id, row]))

  // Cookie admin milik akun yang sudah diturunkan jadi "pelanggan" tidak lagi
  // dihitung sebagai admin — panel memang tidak akan menerimanya.
  const admin = adminSession ? byId.get(adminSession.sub) : undefined
  const adminAccount =
    adminSession &&
    admin &&
    admin.role !== "pelanggan" &&
    !isIssuedBeforeRevocation(adminSession.iat, admin.passwordChangedAt)
      ? admin
      : null

  const customer = customerSession ? byId.get(customerSession.sub) : undefined
  const customerAccount =
    customerSession && customer && !isIssuedBeforeRevocation(customerSession.iat, customer.sessionsRevokedAt)
      ? customer
      : null

  const account = customerAccount ?? adminAccount
  if (!account) return null

  // Izin dihitung dari akun ADMIN (pemilik cookie admin), bukan akun yang
  // tampil — sama dengan yang diperiksa `requirePageView` di `/verify`.
  // Pelanggan biasa tidak memicu query izin apa pun.
  const canVerify = adminAccount
    ? bisaAkses(
        await muatIzinUser({ ...adminAccount, role: parseAdminRole(adminAccount.role) }),
        "verify",
        "view"
      )
    : false

  // Dibentuk ulang secara eksplisit — `role` dan penanda pencabutan tidak ada
  // urusannya di luar berkas ini, dan objek ini ikut dikirim `/api/auth/me`.
  return {
    id: account.id,
    email: account.email,
    name: account.name,
    username: account.username,
    phoneNumber: account.phoneNumber,
    isAdmin: adminAccount !== null,
    canVerify,
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
