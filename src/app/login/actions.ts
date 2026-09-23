"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import {
  findAccountForPasswordReset,
  hashPassword,
  MIN_PASSWORD_LENGTH,
} from "@/lib/auth/customer-password"
import { createCustomerSession } from "@/lib/auth/customer"
import { createSession } from "@/lib/auth"
import { findUserByIdentifier } from "@/lib/auth/identity"
import { isMaster, landingPathFor, muatIzinUser } from "@/lib/auth/permissions"
import { verifyPassword as verifyPasswordUser } from "@/lib/auth/password"
import { createVerificationToken, consumeVerificationToken } from "@/lib/auth/verification-token"
import { sendEmail } from "@/lib/email/send"
import { resolvePublicUrl } from "@/lib/utils/public-link"
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

/**
 * Login TERPADU (Satu Login Fase A) — satu pintu untuk semua.
 *
 * Sejak semua akun (admin & pelanggan) hidup di tabel `users`, form ini mencari
 * di sana, lalu SISTEM yang menentukan tujuan berdasarkan PERAN:
 *   - peran "pelanggan" → sesi pelanggan → storefront (nextPath)
 *   - peran admin (owner/staff/role dinamis) → sesi admin → /admin
 *
 * Dua sistem sesi (cookie pelanggan & admin, HMAC terpisah) sengaja
 * DIPERTAHANKAN di belakang layar — konsolidasi jadi satu sesi adalah pekerjaan
 * terpisah (Fase B). Yang disatukan di sini cukup PINTU login-nya.
 */
export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const identifier = String(formData.get("identifier") ?? "")
  const password = String(formData.get("password") ?? "")
  const nextPath = sanitizeNextPath(String(formData.get("next") ?? ""))

  if (!identifier.trim() || !password) {
    return { error: "Email/username dan password wajib diisi." }
  }

  const user = await findUserByIdentifier(identifier)

  // Tetap verifikasi walau akun tak ada / tanpa password (Google-only), dengan
  // hash boneka — supaya selisih waktu tak membocorkan akun mana yang ada.
  const hash = user?.passwordHash ?? "0".repeat(32) + ":" + "0".repeat(128)
  const cocok = await verifyPasswordUser(password, hash)

  if (!user || !user.passwordHash || !cocok) return { error: GAGAL }

  /**
   * Tujuan ditentukan PERAN — kecuali untuk MASTER, yang selalu ke panel.
   *
   * `MASTER_ADMIN_EMAIL` digambarkan sebagai pagar terakhir kalau owner tak
   * sengaja mencabut izinnya sendiri (lihat `isMaster` di lib/auth/permissions).
   * Tapi pagar itu dulu tidak berguna: `isMaster` hanya dibaca `muatIzinUser`,
   * yang baru berjalan SESUDAH seseorang punya sesi admin. Alamat master yang
   * kebetulan berperan "pelanggan" — dan alamat developer biasanya memang
   * begitu, karena ia ikut memakai situs sebagai pembeli — diarahkan ke
   * storefront dan tidak pernah sampai ke pintu yang dijaganya.
   */
  if (user.role === "pelanggan" && !isMaster(user)) {
    // Pelanggan email+password wajib terverifikasi (admin tak punya nilai ini).
    if (!user.emailVerifiedAt) return { error: BELUM_VERIFIKASI }
    await createCustomerSession({ id: user.id, email: user.email })
    redirect(nextPath)
  }

  // Selain "pelanggan" = akun admin (owner/staff/role dinamis).
  await createSession({ id: user.id, email: user.email })

  /**
   * Tujuannya ditentukan izin, bukan dipatok ke `/admin`.
   *
   * Kasir dan Sales/CS bekerja di luar panel (`/verify`, `/profile/quotation`),
   * dan sidebar panel tidak punya satu pun menu untuk mereka. Mengantar mereka
   * ke dashboard berarti setiap hari dimulai dari halaman kosong yang harus
   * mereka tinggalkan sendiri.
   */
  redirect(landingPathFor(await muatIzinUser(user)))
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

  /**
   * Alamat publik ditentukan SEBELUM mencari pelanggan, dan galatnya
   * dilaporkan apa adanya.
   *
   * Urutannya penting untuk menjaga sifat anti-enumerasi fungsi ini: hasilnya
   * sama sekali tidak bergantung pada apakah `email` terdaftar, jadi pesan
   * galat ini tidak membocorkan apa pun. Kalau pemeriksaannya ditaruh di dalam
   * blok `if (customer)`, justru pesan itu sendiri yang menjadi pembeda —
   * penyerang bisa menyimpulkan email mana yang terdaftar dari perbedaan
   * balasannya.
   *
   * Host request, bukan `NEXT_PUBLIC_SITE_URL` — alasannya sama seperti di
   * `sendVerificationEmail` (app/register/actions.ts).
   */
  let baseUrl: string
  try {
    baseUrl = await resolvePublicUrl()
  } catch (error) {
    console.error("Gagal mengirim email reset password:", error)
    return {
      error:
        "Email reset password tidak bisa dikirim karena ada masalah konfigurasi di sisi kami. " +
        `Hubungi CS lewat WhatsApp (https://wa.me/${env.NEXT_PUBLIC_WHATSAPP_CS_NUMBER}).`,
      ok: false,
    }
  }

  /**
   * SEMUA peran, termasuk staff — lihat `findAccountForPasswordReset`.
   *
   * Satu pintu memang sudah satu pintu: `/login` melayani pelanggan dan staff,
   * dan `/admin/login` cuma mengalihkan ke sana. Tautan "Lupa password?" di
   * bawah formulirnya pun sudah dilihat semua orang sejak Fase A — yang belum
   * ada hanyalah balasan untuk separuh di antara mereka.
   */
  const account = await findAccountForPasswordReset(email)

  if (account && account.passwordHash) {
    try {
      const token = await createVerificationToken(account.id, "reset_password")
      const link = `${baseUrl}/login/reset-password/${token}`
      await sendEmail({ to: account.email, subject: "Reset password HNS IT Center", text: resetPasswordEmailText(link) })
    } catch (error) {
      // Kegagalan SMTP tetap ditelan diam-diam: membedakan "email terkirim"
      // dari "email tidak terkirim" akan membocorkan email mana yang terdaftar.
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

  // `users`, bukan `customers` — tabel yang dibaca login. Sampai Fase B baris
  // ini menulis ke `customers`, sehingga password baru tidak pernah berlaku:
  // login tetap mencocokkan hash lama di `users`.
  await getPrisma().user.update({
    where: { id: result.customerId },
    /**
     * DUA penanda pencabutan, bukan satu. Password baru berarti sesi lama
     * (termasuk yang mungkin sudah dibajak lewat password lama) harus mati —
     * tapi "sesi lama" itu ada dalam dua bentuk, dan masing-masing punya
     * penandanya sendiri: `sessionsRevokedAt` untuk cookie pelanggan,
     * `passwordChangedAt` untuk cookie panel (lihat `getCurrentCustomer`).
     *
     * Sejak reset terbuka untuk staff (23 September 2026), mengisi yang
     * pertama saja berarti orang yang meminta reset justru tidak mendapat
     * yang paling dia butuhkan: cookie panel milik siapa pun yang sedang
     * memegang akunnya tetap hidup sampai kedaluwarsa sendiri.
     */
    data: { passwordHash, sessionsRevokedAt: changedAt, passwordChangedAt: changedAt },
  })

  return { error: null, ok: true }
}

