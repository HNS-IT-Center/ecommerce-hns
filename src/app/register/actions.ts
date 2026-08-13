"use server"

import { headers } from "next/headers"
import {
  registerCustomer,
  findCustomerByEmail,
  MIN_PASSWORD_LENGTH,
  validateUsername,
  validatePhoneNumber,
} from "@/lib/auth/customer-password"
import { createVerificationToken, consumeVerificationToken } from "@/lib/auth/verification-token"
import { sendEmail, EmailSendError } from "@/lib/email/send"
import { checkRateLimit, clientIpFrom } from "@/lib/auth/registration-rate-limit"
import { resolveSiteUrl } from "@/lib/utils/site-url"
import { getPrisma } from "@/lib/prisma/client"
import { env } from "@/config/env"
import type { RegisterState, ResendVerificationState, VerifyEmailResult } from "./state"

/**
 * Pesan penjelasan yang SAMA dipakai di sini dan di teks email —
 * memberitahu pemilik email bahwa email ini tidak perlu dibalas untuk hal
 * teknis, dan mengarahkan ke WhatsApp CS (jalur yang benar-benar dipantau
 * tim). `EMAIL_REPLY_TO` (kalau diisi) juga sudah membantu ini di sisi
 * transport, tapi pengingat tertulis di badan email tetap perlu ada —
 * kebanyakan orang membalas email tanpa membaca header Reply-To.
 */
function verificationEmailText(link: string): string {
  return [
    "Halo,",
    "",
    "Terima kasih sudah mendaftar di HNS IT Center. Klik tautan berikut untuk mengaktifkan akun Anda:",
    "",
    link,
    "",
    "Tautan ini berlaku 24 jam. Kalau Anda tidak merasa mendaftar, abaikan saja email ini.",
    "",
    "Email ini dikirim otomatis dan TIDAK PERLU DIBALAS untuk hal teknis — balasan ke alamat ini tidak akan terpantau. Kalau ada pertanyaan, hubungi kami lewat WhatsApp:",
    `https://wa.me/${env.NEXT_PUBLIC_WHATSAPP_CS_NUMBER}`,
    "",
    "Salam,",
    "HNS IT Center",
  ].join("\n")
}

async function sendVerificationEmail(customerId: string, email: string): Promise<void> {
  const token = await createVerificationToken(customerId, "verify_email")
  /**
   * Tautan dibangun dari host request (`resolveSiteUrl`), BUKAN dari
   * `NEXT_PUBLIC_SITE_URL`.
   *
   * Env itu terbukti masih `http://localhost:3000` di deployment produksi
   * (13 Agustus 2026), sehingga setiap pelanggan yang mendaftar menerima
   * tautan aktivasi ke `http://localhost:3000/verifikasi-email/...` — alamat
   * yang tidak bisa dibuka siapa pun kecuali orang yang kebetulan menjalankan
   * server di laptopnya sendiri. Akunnya terdaftar tapi tidak pernah bisa
   * diaktifkan.
   *
   * Selain memperbaiki itu, host request memang sumber yang lebih tepat untuk
   * email: tautan harus mengarah ke tempat pelanggan SEDANG mendaftar. Kalau
   * suatu saat dua domain hidup bersamaan (staging dan produksi), satu nilai
   * env tidak mungkin benar untuk keduanya.
   *
   * `resolveSiteUrl` menyaring host lewat daftar izin, jadi header `Host`
   * palsu tidak bisa mengubah tautan aktivasi menjadi alamat penyerang.
   */
  const link = `${await resolveSiteUrl()}/verifikasi-email/${token}`
  await sendEmail({
    to: email,
    subject: "Verifikasi akun HNS IT Center",
    text: verificationEmailText(link),
  })
}

export async function registerAction(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  const ip = clientIpFrom(await headers())
  const rateLimit = checkRateLimit("register", ip)
  if (!rateLimit.ok) {
    return { error: "Terlalu banyak percobaan. Coba beberapa menit lagi.", ok: false }
  }

  const name = String(formData.get("name") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")
  const confirmPassword = String(formData.get("confirmPassword") ?? "")
  const username = String(formData.get("username") ?? "").trim()
  const phoneNumber = String(formData.get("phoneNumber") ?? "").trim()

  if (!name || !email || !password || !confirmPassword || !username || !phoneNumber) {
    return { error: "Semua kolom wajib diisi.", ok: false }
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password minimal ${MIN_PASSWORD_LENGTH} karakter.`, ok: false }
  }
  // Pola sama seperti resetPasswordAction (login/actions.ts) — dicek SETELAH
  // panjang minimum supaya pengguna yang password-nya juga terlalu pendek
  // dapat pesan yang lebih dasar dulu.
  if (password !== confirmPassword) {
    return { error: "Konfirmasi password tidak sama.", ok: false }
  }
  const usernameError = validateUsername(username)
  if (usernameError) {
    return { error: usernameError, ok: false }
  }
  const phoneError = validatePhoneNumber(phoneNumber)
  if (phoneError) {
    return { error: phoneError, ok: false }
  }

  const result = await registerCustomer(email, name, password, username, phoneNumber)
  if (!result.ok) {
    return {
      error:
        result.reason === "email_taken_google"
          ? "Email ini sudah terdaftar lewat Google. Masuk dengan Google."
          : result.reason === "username_taken"
            ? "Username ini sudah dipakai. Coba yang lain."
            : "Email ini sudah terdaftar. Masuk, atau gunakan \"Lupa password\" kalau lupa.",
      ok: false,
    }
  }

  try {
    await sendVerificationEmail(result.customerId, email)
  } catch (error) {
    // Akun sudah dibuat, tapi email verifikasi gagal terkirim — pelanggan
    // tidak boleh terjebak tanpa cara mengaktifkan akunnya. Pesannya
    // eksplisit menyebut ini urusan teknis kami, bukan input yang salah.
    console.error("Gagal mengirim email verifikasi:", error)
    return {
      error:
        error instanceof EmailSendError
          ? "Akun dibuat, tapi email verifikasi gagal terkirim. Coba \"Kirim ulang\" di halaman berikutnya, atau hubungi CS lewat WhatsApp."
          : "Akun dibuat, tapi terjadi kesalahan mengirim email verifikasi. Coba lagi sebentar.",
      ok: false,
    }
  }

  return { error: null, ok: true }
}

/**
 * Kirim ulang email verifikasi. Pesan SELALU generik ("kalau email
 * terdaftar dan belum aktif, kami kirim ulang") — pola sama seperti
 * `forgotPasswordAction` dan `findUserByIdentifier` versi admin: membedakan
 * "email tidak ada" dari "email sudah aktif" membocorkan informasi ke
 * siapa pun yang iseng mencoba alamat orang lain.
 */
export async function resendVerificationAction(
  _prev: ResendVerificationState,
  formData: FormData
): Promise<ResendVerificationState> {
  const ip = clientIpFrom(await headers())
  const rateLimit = checkRateLimit("resend_verification", ip)
  if (!rateLimit.ok) {
    return { error: "Terlalu banyak percobaan. Coba beberapa menit lagi.", ok: false }
  }

  const email = String(formData.get("email") ?? "").trim()
  if (!email) return { error: "Masukkan email Anda.", ok: false }

  const customer = await findCustomerByEmail(email)

  const generic = {
    error: null,
    ok: true,
  }

  // Diam-diam tidak melakukan apa pun untuk kasus yang tidak berlaku — tapi
  // pemanggil tetap melihat pesan sukses yang sama, persis alasan di atas.
  if (customer && customer.passwordHash && !customer.emailVerifiedAt) {
    try {
      await sendVerificationEmail(customer.id, customer.email)
    } catch (error) {
      console.error("Gagal mengirim ulang email verifikasi:", error)
    }
  }

  return generic
}

export async function verifyEmailAction(token: string): Promise<VerifyEmailResult> {
  const result = await consumeVerificationToken(token, "verify_email")
  if (!result.ok) return result

  await getPrisma().customer.update({
    where: { id: result.customerId },
    data: { emailVerifiedAt: new Date() },
  })

  return { ok: true }
}
