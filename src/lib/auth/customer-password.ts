import "server-only"

import { Prisma } from "@prisma/client"
import { getPrisma } from "@/lib/prisma/client"
import { hashPassword } from "@/lib/auth/password"
import { normalizeIdentifier } from "@/lib/auth/identity"

/** Sama seperti admin (lib/auth/password.ts) — satu ambang, satu tempat. */
export { MIN_PASSWORD_LENGTH, hashPassword, verifyPassword } from "@/lib/auth/password"

export type CustomerIdentityLookup = {
  id: string
  email: string
  passwordHash: string | null
  googleSub: string | null
  emailVerifiedAt: Date | null
}

/**
 * Cari akun pelanggan by email — SATU-SATUNYA jalur, tidak ada username
 * seperti admin (`identity.ts`). `normalizeIdentifier` dipakai ulang murni
 * untuk `trim().toLowerCase()`-nya, bukan karena email di sini juga bisa
 * berupa username.
 */
export async function findCustomerByEmail(raw: string): Promise<CustomerIdentityLookup | null> {
  const email = normalizeIdentifier(raw)
  if (!email) return null

  return getPrisma().customer.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true, googleSub: true, emailVerifiedAt: true },
  })
}

export type RegisterCustomerResult =
  | { ok: true; customerId: string }
  | { ok: false; reason: "email_taken_google" | "email_taken_password" }

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
 * `emailVerifiedAt` sengaja `null` — akun ini belum boleh dipakai masuk
 * sampai link verifikasi diklik. Lihat lib/auth/verification-token.ts.
 */
export async function registerCustomer(
  email: string,
  name: string,
  password: string
): Promise<RegisterCustomerResult> {
  const normalizedEmail = normalizeIdentifier(email)
  const prisma = getPrisma()

  const existing = await prisma.customer.findUnique({
    where: { email: normalizedEmail },
    select: { googleSub: true },
  })
  if (existing) {
    return { ok: false, reason: existing.googleSub ? "email_taken_google" : "email_taken_password" }
  }

  const passwordHash = await hashPassword(password)

  try {
    const customer = await prisma.customer.create({
      data: { email: normalizedEmail, name: name.trim(), passwordHash, emailVerifiedAt: null },
      select: { id: true },
    })
    return { ok: true, customerId: customer.id }
  } catch (error) {
    // Race condition: dua pendaftaran dengan email sama nyaris bersamaan
    // lolos cek `findUnique` di atas sebelum salah satunya sempat `create`.
    // Constraint unik di database yang jadi penjaga terakhir — diperlakukan
    // sebagai "email sudah dipakai", bukan error 500 mentah.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, reason: "email_taken_password" }
    }
    throw error
  }
}
