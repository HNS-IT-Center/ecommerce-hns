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

export { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, verifySession, type SessionPayload }

export type AdminUser = {
  id: string
  email: string
  name: string
  image: string | null
}

/** Dilempar saat aksi dipanggil tanpa sesi yang sah. */
export class UnauthorizedError extends Error {
  constructor(message = "Anda harus masuk untuk melakukan tindakan ini.") {
    super(message)
    this.name = "UnauthorizedError"
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
    select: { id: true, email: true, name: true, image: true },
  })
  return user
}

/** Sama seperti `getCurrentUser`, tapi melempar kalau tidak ada sesi. */
export async function requireAuth(): Promise<AdminUser> {
  const user = await getCurrentUser()
  if (!user) throw new UnauthorizedError()
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
