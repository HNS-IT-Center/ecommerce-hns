"use server"

import { getPrisma } from "@/lib/prisma/client"
import { UnauthorizedError, createSession, requireAuth } from "@/lib/auth"
import { MIN_PASSWORD_LENGTH, hashPassword, verifyPassword } from "@/lib/auth/password"
import type { AccountActionState } from "./state"

/**
 * Ganti password akun yang sedang masuk.
 *
 * Password lama tetap diminta walaupun sesinya sudah terbukti sah. Sesi hanya
 * membuktikan "pintu ini pernah dibuka", bukan "yang di depan layar adalah
 * pemiliknya" — komputer yang tertinggal tanpa terkunci sudah cukup untuk
 * membedakan keduanya. Tanpa password lama, siapa pun yang lewat bisa mengunci
 * pemilik aslinya keluar dari akunnya sendiri.
 */
export async function changePasswordAction(
  _prev: AccountActionState,
  formData: FormData
): Promise<AccountActionState> {
  let me: { id: string; email: string }
  try {
    me = await requireAuth()
  } catch (error) {
    if (error instanceof UnauthorizedError) return { error: error.message, ok: null }
    throw error
  }

  const lama = String(formData.get("currentPassword") ?? "")
  const baru = String(formData.get("newPassword") ?? "")
  const ulangi = String(formData.get("confirmPassword") ?? "")

  if (!lama || !baru || !ulangi) {
    return { error: "Semua kolom wajib diisi.", ok: null }
  }
  if (baru.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password baru minimal ${MIN_PASSWORD_LENGTH} karakter.`, ok: null }
  }
  if (baru !== ulangi) {
    return { error: "Konfirmasi password baru tidak sama.", ok: null }
  }
  if (baru === lama) {
    return { error: "Password baru harus berbeda dari password saat ini.", ok: null }
  }

  const prisma = getPrisma()
  const user = await prisma.user.findUnique({
    where: { id: me.id },
    select: { passwordHash: true },
  })
  // Baris bisa hilang di antara `requireAuth` dan baris ini kalau akunnya baru
  // saja dihapus. Diperlakukan sama seperti tidak punya sesi.
  if (!user) return { error: "Akun tidak ditemukan.", ok: null }

  if (!(await verifyPassword(lama, user.passwordHash))) {
    return { error: "Password saat ini salah.", ok: null }
  }

  // Dibulatkan ke detik utuh: `iat` di dalam token juga berpresisi detik, dan
  // menyimpan milidetik di sini membuat token yang diterbitkan pada detik yang
  // sama terbaca "lebih tua" lalu mati sendiri seketika.
  const changedAt = new Date(Math.floor(Date.now() / 1000) * 1000)

  await prisma.user.update({
    where: { id: me.id },
    data: { passwordHash: await hashPassword(baru), passwordChangedAt: changedAt },
  })

  // Sesi sendiri diterbitkan ulang. Baris di atas baru saja mematikan SEMUA
  // token yang terbit sebelum detik ini — termasuk milik peramban yang sedang
  // dipakai sekarang. Tanpa penerbitan ulang, mengganti password berarti
  // menendang diri sendiri keluar tepat setelah berhasil.
  await createSession(me)

  return {
    error: null,
    ok: "Password berhasil diganti. Sesi di perangkat lain sudah diputus.",
  }
}
