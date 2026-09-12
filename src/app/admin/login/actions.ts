"use server"

import { redirect } from "next/navigation"
import { createSession, destroySession } from "@/lib/auth"
import { findUserByIdentifier } from "@/lib/auth/identity"
import { verifyPassword } from "@/lib/auth/password"
import type { LoginState } from "./state"

/**
 * Pesan gagal sengaja SAMA untuk identitas yang tidak terdaftar dan password
 * yang salah. Membedakan keduanya memberi tahu penebak bahwa sebuah email atau
 * username memang terdaftar — separuh pekerjaan selesai sebelum ia menyentuh
 * password.
 *
 * Pesannya juga tidak menyebut apakah yang diketik terbaca sebagai email atau
 * sebagai username. Menyebutkannya berarti membocorkan kolom mana yang barusan
 * dicari, dan itu sudah cukup untuk memetakan bentuk identitas yang dipakai
 * di panel ini.
 */
const GAGAL = "Email/username atau password salah."

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const identifier = String(formData.get("identifier") ?? "")
  const password = String(formData.get("password") ?? "")
  const tujuan = String(formData.get("callbackUrl") ?? "/admin")

  if (!identifier.trim() || !password) {
    return { error: "Email/username dan password wajib diisi." }
  }

  // Yang diketik boleh email boleh username; pemilahannya ada di `identity.ts`,
  // bukan di sini. Aksi ini tidak perlu tahu caranya — hanya perlu tahu akun
  // mana yang ketemu.
  const user = await findUserByIdentifier(identifier)

  // Tetap jalankan verifikasi walau user tidak ada, memakai hash boneka.
  // Kalau langsung dikembalikan, permintaan untuk identitas tak terdaftar
  // selesai jauh lebih cepat daripada yang terdaftar — dan selisih waktu itu
  // sendiri sudah cukup untuk memetakan akun mana yang ada.
  const hash = user?.passwordHash ?? "0".repeat(32) + ":" + "0".repeat(128)
  const cocok = await verifyPassword(password, hash)

  if (!user || !cocok) return { error: GAGAL }

  await createSession({ id: user.id, email: user.email })

  // Hanya menerima jalur internal. Tanpa penjagaan ini, `?callbackUrl=`
  // bisa diisi alamat luar dan halaman login berubah jadi batu loncatan
  // phishing yang tampak berasal dari domain sendiri.
  redirect(tujuan.startsWith("/") && !tujuan.startsWith("//") ? tujuan : "/admin")
}

export async function logoutAction(): Promise<void> {
  await destroySession()
  // Satu Login: keluar mengantar ke pintu tunggal `/login`, bukan lagi halaman
  // login admin terpisah (yang kini cuma meneruskan ke sana).
  redirect("/login")
}
