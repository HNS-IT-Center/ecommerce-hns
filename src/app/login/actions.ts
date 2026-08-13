"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import {
  findCustomerByEmail,
  findCustomerByEmailOrUsername,
  verifyPassword,
  hashPassword,
  MIN_PASSWORD_LENGTH,
} from "@/lib/auth/customer-password"
import { createCustomerSession } from "@/lib/auth/customer"
import { createVerificationToken, consumeVerificationToken } from "@/lib/auth/verification-token"
import { sendEmail } from "@/lib/email/send"
import { resolveSiteUrl } from "@/lib/utils/site-url"
import { checkRateLimit, clientIpFrom } from "@/lib/auth/registration-rate-limit"
import { sanitizeNextPath } from "@/lib/auth/safe-redirect"
import { getPrisma } from "@/lib/prisma/client"
import { env } from "@/config/env"
import type { LoginState, ForgotPasswordState, ResetPasswordState } from "./state"

/**
 * Pesan gagal SAMA untuk identitas tak terdaftar, akun Google-only (tanpa
 * password), dan password salah — pola sama seperti admin
 * (`admin/login/actions.ts`): membedakan ketiganya memberi tahu penebak
 * separuh jalan lebih cepat.
 */
const GAGAL = "Email/username atau password salah."
const BELUM_VERIFIKASI = "Akun belum diverifikasi. Cek email Anda, atau kirim ulang tautan verifikasi."

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const identifier = String(formData.get("identifier") ?? "")
  const password = String(formData.get("password") ?? "")
  const nextPath = sanitizeNextPath(String(formData.get("next") ?? ""))

  if (!identifier.trim() || !password) {
    return { error: "Email/username dan password wajib diisi." }
  }

  const customer = await findCustomerByEmailOrUsername(identifier)

  // Tetap jalankan verifikasi walau akun tidak ada ATAU tidak punya
  // password (Google-only) — pola sama seperti admin: kalau langsung
  // dikembalikan, permintaan untuk kasus itu selesai jauh lebih cepat
  // daripada yang benar-benar diverifikasi, dan selisih waktunya sendiri
  // sudah membocorkan mana yang mana.
  const hash = customer?.passwordHash ?? "0".repeat(32) + ":" + "0".repeat(128)
  const cocok = await verifyPassword(password, hash)

  if (!customer || !customer.passwordHash || !cocok) return { error: GAGAL }
  if (!customer.emailVerifiedAt) return { error: BELUM_VERIFIKASI }

  await createCustomerSession({ id: customer.id, email: customer.email })
  redirect(nextPath)
}

function resetPasswordEmailText(link: string): string {
  return [
    "Halo,",
    "",
    "Ada permintaan reset password untuk akun Anda di HNS IT Center. Klik tautan berikut untuk membuat password baru:",
    "",
    link,
    "",
    "Tautan ini berlaku 1 jam. Kalau Anda tidak meminta ini, abaikan saja email ini — password Anda tidak berubah.",
    "",
    "Email ini dikirim otomatis dan TIDAK PERLU DIBALAS untuk hal teknis — balasan ke alamat ini tidak akan terpantau. Kalau ada pertanyaan, hubungi kami lewat WhatsApp:",
    `https://wa.me/${env.NEXT_PUBLIC_WHATSAPP_CS_NUMBER}`,
    "",
    "Salam,",
    "HNS IT Center",
  ].join("\n")
}

/**
 * Pesan SELALU generik ("kalau email terdaftar, kami kirim link") —
 * membedakan "email tidak ada" dari "email ada tapi Google-only" membocorkan
 * info ke siapa pun yang mencoba alamat orang lain. Lihat pola yang sama di
 * `register/actions.ts` (`resendVerificationAction`).
 */
export async function forgotPasswordAction(
  _prev: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const ip = clientIpFrom(await headers())
  const rateLimit = checkRateLimit("forgot_password", ip)
  if (!rateLimit.ok) {
    return { error: "Terlalu banyak percobaan. Coba beberapa menit lagi.", ok: false }
  }

  const email = String(formData.get("email") ?? "").trim()
  if (!email) return { error: "Masukkan email Anda.", ok: false }

  const customer = await findCustomerByEmail(email)

  if (customer && customer.passwordHash) {
    try {
      const token = await createVerificationToken(customer.id, "reset_password")
      // Host request, bukan `NEXT_PUBLIC_SITE_URL` — alasan lengkapnya ada di
      // `sendVerificationEmail` (app/register/actions.ts). Singkatnya: env itu
      // masih `localhost` di produksi, jadi tautan ini pun tidak bisa dibuka
      // pelanggan. Rusaknya dengan cara yang sama, cuma belum ketahuan karena
      // alur lupa-password lebih jarang dipakai daripada pendaftaran.
      const link = `${await resolveSiteUrl()}/login/reset-password/${token}`
      await sendEmail({ to: customer.email, subject: "Reset password HNS IT Center", text: resetPasswordEmailText(link) })
    } catch (error) {
      console.error("Gagal mengirim email reset password:", error)
    }
  }

  return { error: null, ok: true }
}

export async function resetPasswordAction(
  token: string,
  _prev: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const password = String(formData.get("password") ?? "")
  const confirm = String(formData.get("confirmPassword") ?? "")

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password minimal ${MIN_PASSWORD_LENGTH} karakter.`, ok: false }
  }
  if (password !== confirm) {
    return { error: "Konfirmasi password tidak sama.", ok: false }
  }

  const result = await consumeVerificationToken(token, "reset_password")
  if (!result.ok) {
    return {
      error:
        result.reason === "expired"
          ? "Tautan reset password sudah kedaluwarsa. Minta tautan baru."
          : "Tautan reset password tidak valid. Minta tautan baru.",
      ok: false,
    }
  }

  const passwordHash = await hashPassword(password)

  // Dibulatkan ke detik utuh — pola sama seperti admin (`akun/actions.ts`):
  // `iat` token sesi juga berpresisi detik, dan menyimpan milidetik di sini
  // membuat token yang terbit pada detik yang sama terbaca "lebih tua".
  const changedAt = new Date(Math.floor(Date.now() / 1000) * 1000)

  await getPrisma().customer.update({
    where: { id: result.customerId },
    // Password baru berarti sesi lama (termasuk yang mungkin sudah dibajak
    // lewat password lama) harus mati — sama alasannya dengan
    // `passwordChangedAt` di sesi admin.
    data: { passwordHash, sessionsRevokedAt: changedAt },
  })

  return { error: null, ok: true }
}

