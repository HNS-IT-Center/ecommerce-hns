import "server-only"

import { Prisma } from "@prisma/client"
import { getPrisma } from "@/lib/prisma/client"
import { hashPassword } from "@/lib/auth/password"
import { normalizeIdentifier, isEmail } from "@/lib/auth/identity"

/** Sama seperti admin (lib/auth/password.ts) — satu ambang, satu tempat. */
export { MIN_PASSWORD_LENGTH, hashPassword, verifyPassword } from "@/lib/auth/password"
/** Sama seperti admin (lib/auth/identity.ts) — satu aturan format, satu tempat. */
export { validateUsername, validatePhoneNumber } from "@/lib/auth/identity"

export type CustomerIdentityLookup = {
  id: string
  email: string
  passwordHash: string | null
  googleSub: string | null
  emailVerifiedAt: Date | null
}

/**
 * Cari akun pelanggan by email — dipakai jalur yang memang butuh email
 * spesifik (lupa password, kirim ulang verifikasi), bukan saat masuk.
 */
export async function findCustomerByEmail(raw: string): Promise<CustomerIdentityLookup | null> {
  const email = normalizeIdentifier(raw)
  if (!email) return null

  return getPrisma().customer.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true, googleSub: true, emailVerifiedAt: true },
  })
}

/**
 * Cari akun pelanggan dari email ATAU username — dipakai saat masuk.
 *
 * Beda dengan `findUserByIdentifier` versi admin (`identity.ts`): username
 * pelanggan NULLABLE (akun Google yang belum lengkapi profil belum
 * punya), jadi memakai `findFirst` dengan kondisi `isEmail` yang sama tetap
 * aman — baris dengan `username: null` tidak akan pernah cocok dengan
 * pencarian `{ username: identifier }` karena `identifier` tidak pernah
 * kosong (dicek di awal).
 */
export async function findCustomerByEmailOrUsername(raw: string): Promise<CustomerIdentityLookup | null> {
  const identifier = normalizeIdentifier(raw)
  if (!identifier) return null

  return getPrisma().customer.findFirst({
    where: isEmail(identifier) ? { email: identifier } : { username: identifier },
    select: { id: true, email: true, passwordHash: true, googleSub: true, emailVerifiedAt: true },
  })
}

export type RegisterCustomerResult =
  | { ok: true; customerId: string }
  | { ok: false; reason: "email_taken_google" | "email_taken_password" | "username_taken" }

/**
 * Daftar akun baru dengan email+password.
 *
 * Satu akun cuma pernah punya SATU jalur identitas (lihat catatan di
 * schema.prisma pada model Customer) — kalau email ini sudah terdaftar
 * lewat Google ATAU lewat password lain, pendaftaran ditolak dan TIDAK ada
 * penggabungan akun. Ini keputusan sengaja, bukan keterbatasan: alur
 * "hubungkan akun" jauh lebih rumit dan rawan salah untuk tim tanpa
 * peninjau keamanan khusus.
 *
 * `username` dan `phoneNumber` WAJIB di jalur daftar-manual (beda dengan
 * akun Google, yang mengisinya belakangan lewat /profile/lengkapi-profil) —
 * pemanggil (`register/actions.ts`) yang menjamin keduanya sudah divalidasi
 * sebelum sampai sini.
 *
 * `emailVerifiedAt` sengaja `null` — akun ini belum boleh dipakai masuk
 * sampai link verifikasi diklik. Lihat lib/auth/verification-token.ts.
 */
export async function registerCustomer(
  email: string,
  name: string,
  password: string,
  username: string,
  phoneNumber: string
): Promise<RegisterCustomerResult> {
  const normalizedEmail = normalizeIdentifier(email)
  const normalizedUsername = normalizeIdentifier(username)
  const prisma = getPrisma()

  const existing = await prisma.customer.findUnique({
    where: { email: normalizedEmail },
    select: { googleSub: true },
  })
  if (existing) {
    return { ok: false, reason: existing.googleSub ? "email_taken_google" : "email_taken_password" }
  }

  const usernameTaken = await prisma.customer.findUnique({
    where: { username: normalizedUsername },
    select: { id: true },
  })
  if (usernameTaken) {
    return { ok: false, reason: "username_taken" }
  }

  const passwordHash = await hashPassword(password)

  try {
    const customer = await prisma.customer.create({
      data: {
        email: normalizedEmail,
        name: name.trim(),
        passwordHash,
        emailVerifiedAt: null,
        username: normalizedUsername,
        phoneNumber: phoneNumber.trim(),
      },
      select: { id: true },
    })
    return { ok: true, customerId: customer.id }
  } catch (error) {
    // Race condition: dua pendaftaran dengan email/username sama nyaris
    // bersamaan lolos cek `findUnique` di atas sebelum salah satunya sempat
    // `create`. Constraint unik di database yang jadi penjaga terakhir.
    // `meta.target` membedakan constraint mana yang kena — email vs username
    // butuh pesan berbeda ke pengguna.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = error.meta?.target
      const hitUsername = Array.isArray(target) && target.some((t) => String(t).includes("username"))
      return { ok: false, reason: hitUsername ? "username_taken" : "email_taken_password" }
    }
    throw error
  }
}
