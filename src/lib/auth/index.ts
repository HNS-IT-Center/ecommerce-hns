/**
 * Helper autentikasi admin — satu-satunya pintu yang boleh dipakai modul lain.
 *
 * Seluruh server action dan route handler memanggil `requireAuth()` dari sini,
 * bukan menyalin logikanya. Kalau suatu saat Google atau SSO ditambahkan, yang
 * berubah hanya cara sesi dibuat; berkas ini dan seluruh pemanggilnya tidak
 * tersentuh, karena mereka hanya bertanya "siapa yang sedang masuk", bukan
 * "lewat apa dia masuk".
 */
import { cookies } from "next/headers"
import { getPrisma } from "@/lib/prisma/client"
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  sessionCookieOptions,
  signSession,
  verifySession,
  type SessionPayload,
} from "./session"
import { parseAdminRole, type AdminRole } from "./roles"

export { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, verifySession, type SessionPayload }
export { type AdminRole }

export type AdminUser = {
  id: string
  email: string
  name: string
  image: string | null
  role: AdminRole
  /** Peran RBAC dinamis. Null = pakai `role` lama (owner/staff) — lihat
   *  `muatIzinUser` di permissions.ts. */
  roleId: string | null
}

/** Dilempar saat aksi dipanggil tanpa sesi yang sah. */
export class UnauthorizedError extends Error {
  constructor(message = "Anda harus masuk untuk melakukan tindakan ini.") {
    super(message)
    this.name = "UnauthorizedError"
  }
}

/**
 * Dilempar saat pemanggilnya sudah masuk, tapi rolenya tidak cukup.
 *
 * Sengaja dibedakan dari `UnauthorizedError`: yang satu berarti "silakan
 * masuk", yang ini berarti "masuk lagi pun tidak akan menolong". Memakai satu
 * galat untuk keduanya membuat panel mengarahkan orang ke halaman login yang
 * tidak menyelesaikan apa pun.
 */
export class ForbiddenError extends Error {
  constructor(message = "Tindakan ini hanya untuk akun owner.") {
    super(message)
    this.name = "ForbiddenError"
  }
}

/** Payload sesi dari cookie, atau null. Tidak menyentuh database. */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies()
  return verifySession(store.get(SESSION_COOKIE)?.value)
}

/**
 * User yang sedang masuk, dibaca ULANG dari database setiap kali.
 *
 * Sengaja tidak mempercayai isi cookie sebagai sumber data user. Cookie hanya
 * membuktikan "seseorang pernah berhasil login sebagai id ini"; apakah akun itu
 * masih ada dan masih berhak, hanya tabel User yang tahu. Dengan begini,
 * menghapus akun langsung memutus aksesnya tanpa perlu menunggu cookie
 * kedaluwarsa.
 *
 * Biayanya satu query per pemanggilan. Untuk panel dengan segelintir pengguna
 * itu pertukaran yang murah dibanding sesi yang tidak bisa dicabut.
 */
export async function getCurrentUser(): Promise<AdminUser | null> {
  const session = await getSession()
  if (!session) return null

  const user = await getPrisma().user.findUnique({
    where: { id: session.sub },
    select: { id: true, email: true, name: true, image: true, passwordChangedAt: true, role: true, roleId: true },
  })
  if (!user) return null

  /**
   * Pencabutan sesi.
   *
   * Token yang diterbitkan sebelum password terakhir diganti dianggap mati,
   * walau tanda tangannya sah dan belum kedaluwarsa. Ini yang membuat "ganti
   * password" benar-benar menutup pintu di perangkat lain — tanpa ini, cookie
   * yang sudah beredar tetap berlaku sampai tujuh hari, dan orang yang
   * mengganti passwordnya justru mengira dirinya sudah aman.
   *
   * Perbandingan memakai `<` dan keduanya berpresisi detik (kolomnya ditulis
   * dibulatkan). Token yang terbit pada detik yang sama dengan pergantian
   * dianggap masih hidup — itu memang yang diinginkan, karena sesi baru milik
   * si pengganti password diterbitkan tepat pada detik itu dan tidak boleh
   * membunuh dirinya sendiri.
   */
  if (user.passwordChangedAt && session.iat * 1000 < user.passwordChangedAt.getTime()) {
    return null
  }

  // Dibentuk ulang secara eksplisit, bukan disebar dengan spread: `AdminUser`
  // adalah yang dilihat seluruh panel, dan `passwordChangedAt` tidak ada
  // urusannya di sana.
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    // Dibaca dari database, TIDAK dari cookie. Role sengaja tidak pernah masuk
    // payload sesi: kalau ia ikut ditandatangani di token, menurunkan seseorang
    // jadi staff baru berlaku setelah cookienya kedaluwarsa — sampai tujuh hari
    // kemudian. Dengan dibaca ulang tiap kali, pencabutan izin langsung berlaku.
    role: parseAdminRole(user.role),
    roleId: user.roleId,
  }
}

/** Sama seperti `getCurrentUser`, tapi melempar kalau tidak ada sesi. */
export async function requireAuth(): Promise<AdminUser> {
  const user = await getCurrentUser()
  if (!user) throw new UnauthorizedError()
  return user
}

/**
 * Sama seperti `requireAuth`, tapi menuntut role `owner`.
 *
 * WAJIB dipanggil DI DALAM setiap server action yang butuh owner — satu
 * pemanggilan per action, bukan satu pemeriksaan terpusat di layout atau
 * middleware.
 *
 * Alasannya: pemeriksaan di layer atas melindungi HALAMAN, sedangkan server
 * action adalah endpoint HTTP tersendiri yang bisa dipanggil langsung tanpa
 * pernah memuat halaman itu. Menyembunyikan tombolnya di UI juga bukan
 * pengamanan — ia cuma menyembunyikan tombol. Yang menahan permintaan hanyalah
 * pemeriksaan yang berjalan di server, di dalam action itu sendiri.
 *
 * Konsekuensi yang disengaja: action baru yang lupa memanggil ini TIDAK
 * otomatis terlindungi. Itu memang pertukarannya — penjaga terpusat yang bisa
 * terlewat diam-diam justru lebih berbahaya, karena ia memberi rasa aman tanpa
 * ada yang benar-benar memeriksa.
 */
export async function requireOwner(): Promise<AdminUser> {
  const user = await requireAuth()
  if (user.role !== "owner") throw new ForbiddenError()
  return user
}

/**
 * Sama seperti `requireOwner`, tapi menuntut izin RBAC atas satu halaman —
 * `requirePermission("harga-accurate", "edit")`.
 *
 * WAJIB dipanggil DI DALAM server action yang mengubah data halaman itu, dengan
 * alasan yang sama persis seperti `requireOwner`: menyembunyikan menu di sidebar
 * bukan pengamanan; yang menahan permintaan hanyalah pemeriksaan yang berjalan
 * di server. `import` dinamis untuk menghindari lingkar impor dengan
 * `permissions.ts` (yang mengambil tipe dari berkas ini).
 */
export async function requirePermission(
  page: import("./permissions").AdminPage,
  minimal: import("./permissions").AccessLevel = "view",
): Promise<AdminUser> {
  const user = await requireAuth()
  const { muatIzinUser, bisaAkses } = await import("./permissions")
  const izin = await muatIzinUser(user)
  if (!bisaAkses(izin, page, minimal)) throw new ForbiddenError()
  return user
}

/** Pasang cookie sesi. Dipanggil setelah kredensial terbukti benar. */
export async function createSession(user: { id: string; email: string }): Promise<void> {
  const token = await signSession({ sub: user.id, email: user.email })
  const store = await cookies()
  store.set(SESSION_COOKIE, token, sessionCookieOptions())
}

/** Cabut cookie sesi. */
export async function destroySession(): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE, "", { ...sessionCookieOptions(0), maxAge: 0 })
}
