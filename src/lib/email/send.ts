import "server-only"

import nodemailer from "nodemailer"
import { env } from "@/config/env"

export class EmailSendError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "EmailSendError"
  }
}

/**
 * Kredensial SMTP dibaca lambat, gagal keras hanya saat pengiriman
 * benar-benar dicoba.
 *
 * Sama alasannya dengan `lib/api/cloudflare/r2.ts`: variabelnya opsional di
 * `config/env.ts` karena skema itu di-parse saat modul dimuat — menandainya
 * wajib akan mematikan SELURUH aplikasi (storefront ikut mati) di mesin
 * mana pun yang belum diberi kredensial SMTP. Kegagalan seharusnya berhenti
 * di "email tidak terkirim", bukan "situs tidak bisa dibuka".
 */
function readConfig() {
  const missing = (["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"] as const).filter(
    (key) => !env[key]
  )
  if (missing.length > 0) {
    throw new EmailSendError(
      `Pengiriman email belum dikonfigurasi. Lengkapi variabel berikut di .env: ${missing.join(", ")}.`
    )
  }
  return {
    host: env.SMTP_HOST!,
    port: env.SMTP_PORT!,
    user: env.SMTP_USER!,
    password: env.SMTP_PASSWORD!,
    // Boleh berbentuk "Nama <email>" (RFC 5322) — nodemailer mem-parsingnya
    // sendiri, tidak perlu dipecah manual di sini. Lihat docs/07 §2.6 untuk
    // format yang diharapkan dan kenapa alamatnya harus alamat SMTP_USER
    // sendiri (Gmail menimpa From ke alamat yang login kalau beda).
    from: env.SMTP_FROM!,
    // Opsional: kalau diisi, balasan pelanggan diarahkan ke CS (yang benar-
    // benar dipantau), bukan ke inbox developer yang cuma dipakai kirim.
    replyTo: env.EMAIL_REPLY_TO,
  }
}

// Dibuat sekali di scope modul (bukan per-panggilan `sendEmail`) supaya
// nodemailer bisa memakai ulang koneksi SMTP-nya, bukan membuka koneksi baru
// untuk setiap email.
let transporter: ReturnType<typeof nodemailer.createTransport> | null = null

function getTransporter() {
  if (transporter) return transporter
  const config = readConfig()
  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    // 465 = SSL implisit sejak koneksi dibuka; port lain (587/25) mulai
    // polos lalu upgrade ke TLS lewat STARTTLS. Gmail App Password bekerja
    // dengan keduanya, tapi `secure` harus cocok dengan port yang dipakai —
    // salah pasang menghasilkan galat handshake yang membingungkan.
    secure: config.port === 465,
    auth: { user: config.user, pass: config.password },
  })
  return transporter
}

export type SendEmailInput = {
  to: string
  subject: string
  text: string
}

/**
 * Kirim email teks polos (tanpa HTML) — cukup untuk verifikasi/reset yang
 * isinya cuma satu tautan dan penjelasan singkat. Melempar `EmailSendError`
 * kalau kredensial belum lengkap atau SMTP menolak; pemanggil (server
 * action) yang memutuskan bagaimana itu ditampilkan ke pengguna.
 */
export async function sendEmail({ to, subject, text }: SendEmailInput): Promise<void> {
  const config = readConfig()
  try {
    await getTransporter().sendMail({
      from: config.from,
      to,
      subject,
      text,
      ...(config.replyTo ? { replyTo: config.replyTo } : {}),
    })
  } catch (error) {
    throw new EmailSendError(
      `Gagal mengirim email ke ${to}: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}
