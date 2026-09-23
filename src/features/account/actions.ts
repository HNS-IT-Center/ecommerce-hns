"use server"

import { revalidatePath } from "next/cache"

import { getPrisma } from "@/lib/prisma/client"
import { updateStaffProfile, updateStaffUsername } from "@/lib/api/staff-profile"
import { UnauthorizedError, createSession, requireAuth } from "@/lib/auth"
import { validatePhoneNumber, validateUsername } from "@/lib/auth/identity"
import { MIN_PASSWORD_LENGTH, hashPassword } from "@/lib/auth/password"
import { MAX_SALES_DISPLAY_NAME } from "@/features/quotation/lib/sales-name"
import type { AccountActionState } from "./lib/state"

/**
 * PASANG atau ganti password akun yang sedang masuk.
 *
 * **Password lama TIDAK diminta (23 September 2026).** Sebelumnya ia wajib,
 * dengan alasan yang masih benar sebagai deskripsi risiko: sesi cuma
 * membuktikan "pintu ini pernah dibuka", bukan "yang di depan layar adalah
 * pemiliknya", jadi komputer yang tertinggal tanpa terkunci cukup untuk
 * mengunci pemilik aslinya keluar dari akunnya sendiri.
 *
 * Tapi kolom itu MUSTAHIL diisi oleh sebagian besar yang melihatnya. Mayoritas
 * akun staff masuk lewat Google dan `passwordHash`-nya NULL — tidak ada
 * password lama untuk diketik, sehingga formulirnya menolak mereka setiap kali
 * ditekan. Yang mereka butuhkan justru kebalikannya: memasang password
 * PERTAMA, supaya punya cara masuk yang tidak bergantung pada Google.
 *
 * Akun berpassword pun tidak dirugikan. Yang lupa passwordnya tidak pernah
 * tertolong oleh kolom yang menanyakannya; pemulihannya lewat "Lupa password"
 * (`findAccountForPasswordReset`), yang menuntut akses ke kotak masuk — jauh
 * lebih kuat daripada kursi kosong di depan layar.
 *
 * Yang menutup celah kursi kosong adalah pencabutan di bawah: siapa pun yang
 * menyalahgunakan sesi yang tertinggal memang bisa mengganti password, tapi
 * pemiliknya tahu seketika (semua sesinya mati) dan merebut akunnya kembali
 * lewat email, tanpa perlu menunggu siapa pun.
 *
 * **Memberi password kepada akun Google DIIZINKAN**, dan itu bukan kelalaian.
 * Sejak 7 September 2026 satu akun boleh punya dua jalur identitas (catatan
 * `googleSub` di schema.prisma) — arah password→Google sudah ditautkan
 * otomatis oleh `api/auth/google/callback`. Yang masih ditolak adalah arah
 * sebaliknya di `register/actions.ts`, dan itu kasus yang berbeda: di sana
 * orangnya BELUM terbukti pemilik akun, ia cuma mengetikkan sebuah email.
 * Di sini ia sudah masuk. `googleSub` tidak disentuh, jadi login Google-nya
 * tetap berjalan seperti sebelumnya.
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

  const baru = String(formData.get("newPassword") ?? "")
  const ulangi = String(formData.get("confirmPassword") ?? "")

  if (!baru || !ulangi) {
    return { error: "Semua kolom wajib diisi.", ok: null }
  }
  if (baru.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password baru minimal ${MIN_PASSWORD_LENGTH} karakter.`, ok: null }
  }
  if (baru !== ulangi) {
    return { error: "Konfirmasi password baru tidak sama.", ok: null }
  }

  const prisma = getPrisma()
  const user = await prisma.user.findUnique({
    where: { id: me.id },
    select: { passwordHash: true },
  })
  // Baris bisa hilang di antara `requireAuth` dan baris ini kalau akunnya baru
  // saja dihapus. Diperlakukan sama seperti tidak punya sesi.
  if (!user) return { error: "Akun tidak ditemukan.", ok: null }

  // Memasang yang pertama, atau mengganti yang sudah ada. Bedanya cuma pada
  // kalimat yang dibaca orangnya — jalurnya satu, dan penulisannya identik.
  const pertamaKali = user.passwordHash === null

  // Dibulatkan ke detik utuh: `iat` di dalam token juga berpresisi detik, dan
  // menyimpan milidetik di sini membuat token yang diterbitkan pada detik yang
  // sama terbaca "lebih tua" lalu mati sendiri seketika.
  const changedAt = new Date(Math.floor(Date.now() / 1000) * 1000)

  await prisma.user.update({
    where: { id: me.id },
    /**
     * DUA penanda, alasannya sama seperti di `resetPasswordAction`
     * (app/login/actions.ts): cookie panel dicabut `passwordChangedAt`, cookie
     * pelanggan dicabut `sessionsRevokedAt`, dan staff memegang KEDUANYA —
     * formulir ini sendiri tampil di `/profile`, halaman toko. Mengisi yang
     * pertama saja membuat kalimat "sesi di perangkat lain sudah diputus" di
     * bawah cuma benar separuh.
     */
    data: {
      passwordHash: await hashPassword(baru),
      passwordChangedAt: changedAt,
      sessionsRevokedAt: changedAt,
    },
  })

  // Sesi sendiri diterbitkan ulang. Baris di atas baru saja mematikan SEMUA
  // token yang terbit sebelum detik ini — termasuk milik peramban yang sedang
  // dipakai sekarang. Tanpa penerbitan ulang, mengganti password berarti
  // menendang diri sendiri keluar tepat setelah berhasil.
  //
  // Cukup sesi PANEL, walau cookie pelanggan di peramban ini ikut mati:
  // `getCurrentCustomer` menerima cookie panel juga, jadi `/profile` — tempat
  // formulir ini berdiri untuk staff — tetap terbuka setelahnya.
  await createSession(me)

  return {
    error: null,
    ok: pertamaKali
      ? "Password berhasil dipasang. Sekarang Anda bisa masuk dengan email/username + password, selain lewat Google. Sesi di perangkat lain diputus."
      : "Password berhasil diganti. Sesi di perangkat lain sudah diputus.",
  }
}

/**
 * Simpan profil staff: foto, nama sales, dan nomor WhatsApp.
 *
 * Satu aksi untuk tiga medan yang disimpan bersama dari satu formulir. Email
 * TIDAK ada di sini dan jangan ditambahkan — alasannya di `updateStaffProfile`.
 */
export async function updateStaffProfileAction(
  _prev: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  let me: { id: string }
  try {
    me = await requireAuth()
  } catch (error) {
    if (error instanceof UnauthorizedError) return { error: error.message, ok: null }
    throw error
  }

  const namaSales = String(formData.get("salesDisplayName") ?? "").trim()
  const nomor = String(formData.get("phoneNumber") ?? "").trim()
  const foto = String(formData.get("image") ?? "").trim()

  if (namaSales.length > MAX_SALES_DISPLAY_NAME) {
    return { error: `Nama sales maksimal ${MAX_SALES_DISPLAY_NAME} karakter.`, ok: null }
  }

  // Kosong SAH: nomor yang belum diisi adalah keadaan normal untuk kasir dan
  // admin yang tidak pernah dihubungi pelanggan. Yang divalidasi hanya nomor
  // yang benar-benar diketik.
  if (nomor && validatePhoneNumber(nomor)) {
    return { error: validatePhoneNumber(nomor), ok: null }
  }

  /**
   * Foto hanya boleh menunjuk ke bucket kita sendiri.
   *
   * Medan ini dikirim klien sebagai URL — hasil unggahan ke `/api/admin/media`.
   * Tanpa penjaga ini, siapa pun yang memanggil aksi ini langsung bisa
   * menitipkan alamat mana pun, dan foto profil berubah jadi pemuat konten
   * pihak ketiga di setiap halaman yang menampilkannya: satu alamat yang
   * dikendalikan orang lain, dimuat oleh peramban staff, lengkap dengan alamat
   * IP dan waktu bukanya.
   */
  const r2 = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.replace(/\/+$/, "")
  if (foto && (!r2 || !foto.startsWith(`${r2}/`))) {
    return { error: "Foto profil harus diunggah lewat tombol unggah.", ok: null }
  }

  const tersimpan = await updateStaffProfile(me.id, {
    salesDisplayName: namaSales.length > 0 ? namaSales : null,
    phoneNumber: nomor.length > 0 ? nomor : null,
    image: foto.length > 0 ? foto : null,
  })
  if (!tersimpan) return { error: "Akun staff tidak ditemukan.", ok: null }

  // Tiga halaman menampilkan nilai-nilai ini.
  revalidatePath("/profile")
  revalidatePath("/profile/quotation")
  revalidatePath("/admin/akun")

  return { error: null, ok: "Profil tersimpan." }
}

/**
 * Ganti username sendiri — nama yang dipakai MASUK ke panel.
 *
 * Terpisah dari formulir profil di atas, dan itu disengaja: yang di atas
 * mengubah apa yang DIBACA orang, yang ini mengubah kunci pintu. Menyatukan
 * keduanya berarti satu tombol Simpan mengerjakan dua hal yang akibatnya jauh
 * berbeda, dan yang gagal di salah satunya menyeret yang lain.
 *
 * Sesi tidak perlu diterbitkan ulang: token menunjuk `id` akun, bukan
 * username-nya — yang berubah hanyalah apa yang diketik di layar masuk
 * berikutnya.
 */
export async function updateUsernameAction(
  _prev: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  let me: { id: string }
  try {
    me = await requireAuth()
  } catch (error) {
    if (error instanceof UnauthorizedError) return { error: error.message, ok: null }
    throw error
  }

  const username = String(formData.get("username") ?? "").trim().toLowerCase()
  if (!username) return { error: "Username wajib diisi.", ok: null }

  const salah = validateUsername(username)
  if (salah) return { error: salah, ok: null }

  const hasil = await updateStaffUsername(me.id, username)
  if (!hasil.ok) return { error: hasil.error, ok: null }

  revalidatePath("/profile")
  revalidatePath("/admin/akun")

  return { error: null, ok: `Username diganti jadi "${username}". Pakai ini saat masuk.` }
}
