import "server-only"

import { randomBytes, createHash } from "node:crypto"
import { getPrisma } from "@/lib/prisma/client"

/**
 * Token sekali pakai untuk verifikasi email & reset password.
 *
 * Token mentah (yang masuk ke URL email) dan hash-nya (yang disimpan di
 * tabel) adalah dua hal berbeda — pola sama seperti cookie sesi
 * (lib/auth/customer-session.ts): kalau tabel `customer_verification_tokens`
 * pernah bocor, penyerang tidak bisa langsung memakai isinya.
 *
 * SHA-256 di sini, BUKAN scrypt seperti password (lib/auth/password.ts).
 * Keduanya menjawab pertanyaan yang beda: password adalah rahasia PENDEK
 * yang manusia pilih sendiri dan bisa ditebak (butuh hash LAMBAT supaya
 * brute-force mahal), sedangkan token ini adalah 32 byte ACAK yang tidak
 * pernah diketik manusia — ruang tebakannya sudah sedemikian besar sehingga
 * hash cepat pun tidak menolong penyerang. Memakai scrypt di sini cuma
 * menambah beban tanpa menambah keamanan nyata.
 */

const TOKEN_BYTES = 32
const VERIFY_EMAIL_TTL_MS = 24 * 60 * 60 * 1000 // 24 jam
const RESET_PASSWORD_TTL_MS = 60 * 60 * 1000 // 1 jam — lebih pendek, ini jalan masuk ke akun

export type TokenPurpose = "verify_email" | "reset_password"

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

function ttlFor(purpose: TokenPurpose): number {
  return purpose === "verify_email" ? VERIFY_EMAIL_TTL_MS : RESET_PASSWORD_TTL_MS
}

/**
 * Buat token baru untuk `customerId`. Token lama dengan `purpose` yang sama
 * dihapus dulu — hanya satu token aktif per tujuan per akun, supaya link
 * lama yang belum kedaluwarsa tidak diam-diam tetap berlaku setelah orang
 * minta link baru (mis. klik "kirim ulang" berkali-kali).
 *
 * Mengembalikan token MENTAH — inilah satu-satunya kesempatan memilikinya;
 * yang tersimpan di database cuma hash-nya.
 */
export async function createVerificationToken(customerId: string, purpose: TokenPurpose): Promise<string> {
  const prisma = getPrisma()
  const token = randomBytes(TOKEN_BYTES).toString("base64url")

  await prisma.$transaction([
    prisma.customerVerificationToken.deleteMany({ where: { customerId, purpose } }),
    prisma.customerVerificationToken.create({
      data: {
        customerId,
        purpose,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + ttlFor(purpose)),
      },
    }),
  ])

  return token
}

export type ConsumeTokenResult =
  | { ok: true; customerId: string }
  | { ok: false; reason: "not_found" | "expired" }

/**
 * Validasi token MENTAH dari URL, lalu HAPUS-nya (sekali pakai — baik
 * berhasil maupun kedaluwarsa dibersihkan, supaya tabel tidak menumpuk token
 * mati).
 */
export async function consumeVerificationToken(token: string, purpose: TokenPurpose): Promise<ConsumeTokenResult> {
  const prisma = getPrisma()
  const tokenHash = hashToken(token)

  const row = await prisma.customerVerificationToken.findUnique({
    where: { tokenHash },
    select: { id: true, customerId: true, purpose: true, expiresAt: true },
  })

  if (!row || row.purpose !== purpose) {
    return { ok: false, reason: "not_found" }
  }

  await prisma.customerVerificationToken.delete({ where: { id: row.id } })

  if (row.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "expired" }
  }

  return { ok: true, customerId: row.customerId }
}
