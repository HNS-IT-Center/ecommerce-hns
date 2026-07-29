"use server"

import { redirect } from "next/navigation"
import { getPrisma } from "@/lib/prisma/client"
import { createSession, destroySession } from "@/lib/auth"
import { verifyPassword } from "@/lib/auth/password"

export type LoginState = { error: string | null }

export const EMPTY_LOGIN_STATE: LoginState = { error: null }

/**
 * Pesan gagal sengaja SAMA untuk email yang tidak terdaftar dan password yang
 * salah. Membedakan keduanya memberi tahu penebak bahwa sebuah email memang
 * terdaftar — separuh pekerjaan selesai sebelum ia menyentuh password.
 */
const GAGAL = "Email atau password salah."

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const password = String(formData.get("password") ?? "")
  const tujuan = String(formData.get("callbackUrl") ?? "/admin")

  if (!email || !password) return { error: "Email dan password wajib diisi." }

  const user = await getPrisma().user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true },
  })

  // Tetap jalankan verifikasi walau user tidak ada, memakai hash boneka.
  // Kalau langsung dikembalikan, permintaan untuk email tak terdaftar selesai
  // jauh lebih cepat daripada yang terdaftar — dan selisih waktu itu sendiri
  // sudah cukup untuk memetakan email mana yang ada.
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
  redirect("/admin/login")
}
