import "server-only"

import { Prisma } from "@prisma/client"
import { getPrisma } from "@/lib/prisma/client"
import { hashPassword } from "@/lib/auth/password"
import { normalizeIdentifier } from "@/lib/auth/identity"

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
 *
 * Membaca `users` dengan syarat `role = "pelanggan"`. Syarat itu bukan hiasan:
 * sejak Satu Login akun admin juga hidup di tabel ini, dan tanpa syarat itu
 * "Lupa password" di storefront bisa dipakai mengganti password akun panel
 * lewat email. Admin mengganti passwordnya di /admin/akun.
 *
 * (`findCustomerByEmailOrUsername` pernah ada di sini — tidak dipakai lagi
 * sejak login terpadu memakai `findUserByIdentifier`, dihapus di Fase B.)
 */
export async function findCustomerByEmail(raw: string): Promise<CustomerIdentityLookup | null> {
  const email = normalizeIdentifier(raw)
  if (!email) return null

  return getPrisma().user.findFirst({
    where: { email, role: "pelanggan" },
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

  // Dicek terhadap SEMUA akun di `users`, termasuk admin: satu email satu
  // akun, apa pun perannya — login terpadu mencari lewat email tanpa
  // membedakan peran.
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { googleSub: true },
  })
  if (existing) {
    return { ok: false, reason: existing.googleSub ? "email_taken_google" : "email_taken_password" }
  }

  const usernameTaken = await prisma.user.findUnique({
    where: { username: normalizedUsername },
    select: { id: true },
  })
  if (usernameTaken) {
    return { ok: false, reason: "username_taken" }
  }

  const passwordHash = await hashPassword(password)

  try {
    const customer = await prisma.user.create({
      data: {
        // WAJIB eksplisit. Default kolom `users.role` adalah "owner" —
        // warisan masa tabel ini khusus admin. Lupa baris ini berarti setiap
        // pendaftar dari storefront menjadi pemilik panel.
        role: "pelanggan",
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
