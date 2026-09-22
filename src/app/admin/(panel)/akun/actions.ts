"use server"

import { revalidatePath } from "next/cache"

import { getPrisma } from "@/lib/prisma/client"
import { UnauthorizedError, createSession, requireAuth } from "@/lib/auth"
import { MIN_PASSWORD_LENGTH, hashPassword, verifyPassword } from "@/lib/auth/password"
import { bisaAkses, muatIzinUser } from "@/lib/auth/permissions"
import type { AdminRole } from "@/lib/auth/roles"
import { MAX_SALES_DISPLAY_NAME, type AccountActionState } from "./state"

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

  // passwordHash nullable sejak Satu Login (pelanggan Google tak punya), tapi
  // yang sampai ke sini adalah admin yang sedang login lewat password — jadi
  // null di sini berarti keadaan tak wajar; tolak dengan aman.
  if (!user.passwordHash || !(await verifyPassword(lama, user.passwordHash))) {
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

/**
 * Atur nama tampilan sales milik sendiri — yang tercetak di PDF quotation.
 *
 * Terpisah dari `name` akun, dan bedanya bukan kosmetik: `name` dipakai di
 * seluruh panel untuk mengenali siapa melakukan apa, sedangkan yang ini dibaca
 * pelanggan di atas kertas. Sales yang ingin dokumennya bertuliskan "Tyo" tidak
 * seharusnya ikut mengubah namanya di daftar admin, log produk, dan jejak audit.
 *
 * Nilainya TIDAK berlaku surut. Quotation menyimpan salinan nama ini saat
 * terbit (`pc_build_quotes.sales_name`), jadi mengubahnya di sini hanya
 * mempengaruhi dokumen yang terbit SESUDAHNYA — PDF yang sudah di tangan
 * pelanggan tetap apa adanya.
 */
export async function updateSalesDisplayNameAction(
  _prev: AccountActionState,
  formData: FormData
): Promise<AccountActionState> {
  let me: { id: string; email: string; role: AdminRole; roleId: string | null }
  try {
    me = await requireAuth()
  } catch (error) {
    if (error instanceof UnauthorizedError) return { error: error.message, ok: null }
    throw error
  }

  // Ditegakkan di SERVER, bukan cuma dengan menyembunyikan formulirnya: server
  // action adalah endpoint HTTP tersendiri yang bisa dipanggil tanpa pernah
  // memuat halamannya.
  const izin = await muatIzinUser(me)
  if (!bisaAkses(izin, "quotation-sales", "edit")) {
    return { error: "Akun Anda tidak berperan sebagai Sales.", ok: null }
  }

  const raw = String(formData.get("salesDisplayName") ?? "").trim()
  if (raw.length > MAX_SALES_DISPLAY_NAME) {
    return { error: `Nama tampilan maksimal ${MAX_SALES_DISPLAY_NAME} karakter.`, ok: null }
  }

  // Kosong = hapus, lalu `name` akun yang dipakai. Disimpan NULL, bukan string
  // kosong, supaya "belum diatur" dan "sengaja dikosongkan" tidak jadi dua
  // keadaan berbeda yang harus dibedakan setiap pembacanya.
  await getPrisma().user.update({
    where: { id: me.id },
    data: { salesDisplayName: raw.length > 0 ? raw : null },
  })

  revalidatePath("/admin/akun")

  return {
    error: null,
    ok: raw.length > 0
      ? `Quotation berikutnya akan tercetak atas nama "${raw}".`
      : "Nama tampilan dikosongkan — quotation akan memakai nama akun Anda.",
  }
}
