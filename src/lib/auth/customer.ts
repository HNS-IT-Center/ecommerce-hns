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
import { bisaAkses, capIzin, muatIzinUser } from "./permissions"

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
   * Foto profil, atau `null` kalau belum pernah diunggah.
   *
   * Selalu URL di bucket R2 kita sendiri: `updateStaffProfileAction`
   * (features/account/actions.ts) menolak apa pun yang tidak diawali
   * `NEXT_PUBLIC_R2_PUBLIC_URL`, dan login Google TIDAK pernah menulis kolom
   * ini. Itu yang membuatnya aman dirender `next/image` — hostnya sudah
   * terdaftar di `remotePatterns`, bukan host sembarang.
   *
   * Ikut dikirim ke klien lewat `/api/auth/me`. Tidak apa-apa: isinya alamat
   * berkas publik, sama dengan yang sudah tampil di halaman profilnya sendiri.
   *
   * Sampai hari ini hanya STAFF yang punya pengunggahnya (`/profile`);
   * pelanggan biasa bernilai `null` dan jatuh ke avatar inisial.
   */
  image: string | null
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
  /**
   * Cap izin sesi ADMIN di peramban ini, atau `null` kalau tidak ada.
   *
   * BUKAN izin, dan tidak memutuskan apa pun — satu-satunya gunanya adalah
   * dibandingkan dengan cap sebelumnya oleh `SessionProvider` di klien. Begitu
   * berbeda, tampilan yang sudah terlanjur dirender dianggap basi dan halaman
   * disegarkan; server tetap yang memutuskan akses pada setiap permintaan.
   *
   * Tanpa ini, perubahan peran hanya terdeteksi di DALAM panel admin (lewat
   * `PermissionWatcher`). Di luar sana — menu akun di header, `/verify`,
   * `/profile/quotation` — akses baru tidak terlihat sampai halaman dimuat
   * ulang penuh, dan satu-satunya cara yang diketahui staff untuk memaksanya
   * adalah keluar lalu masuk lagi.
   *
   * Isinya sama persis dengan yang sudah dikirim panel admin ke peramban lewat
   * `/api/admin/permission-version`, jadi tidak ada yang baru yang ikut keluar.
   */
  permissionVersion: string | null
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
  image: true,
  role: true,
  roleId: true,
  // Ikut dibaca demi `permissionVersion`. Join kunci primer di baris yang
  // memang sudah diambil — bukan query tambahan.
  roleRef: { select: { updatedAt: true } },
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
        await muatIzinUser(adminAccount),
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
    // Dari akun yang TAMPIL, bukan dari `adminAccount`. Foto adalah bagian dari
    // identitas yang sedang ditunjukkan header; kalau admin sedang menguji akun
    // pelanggan di peramban yang sama, yang harus terlihat adalah wajah akun
    // pelanggan itu — sama seperti nama dan emailnya di atas.
    image: account.image,
    isAdmin: adminAccount !== null,
    canVerify,
    // Dari akun ADMIN, sumber yang sama dengan `canVerify` — bukan dari akun
    // yang kebetulan tampil. Pelanggan biasa tidak punya izin yang bisa
    // berubah, jadi capnya memang `null`.
    permissionVersion: adminAccount
      ? capIzin({
          role: adminAccount.role,
          roleId: adminAccount.roleId,
          roleUpdatedAt: adminAccount.roleRef?.updatedAt,
        })
      : null,
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
