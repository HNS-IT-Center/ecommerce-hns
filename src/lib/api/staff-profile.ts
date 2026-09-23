import "server-only"

import { Prisma } from "@prisma/client"

import { getPrisma } from "@/lib/prisma/client"
import { normalizeIdentifier } from "@/lib/auth/identity"

/**
 * Profil staff seperti yang disunting pemiliknya sendiri di `/profile`.
 *
 * Berdiri sendiri, terpisah dari `admin-users.ts`, dan bedanya bukan kerapian:
 * berkas itu berisi fungsi yang dipakai OWNER untuk mengelola akun ORANG LAIN
 * (mengubah peran, menyetel nama tampilan sales bawahannya). Yang di sini selalu
 * bekerja atas `userId` dari sesi yang sedang berjalan. Mencampurnya berarti
 * suatu hari ada pemanggil yang mengoper id dari klien ke fungsi yang dikira
 * "punya sendiri".
 *
 * Tidak ada kolom baru untuk semua ini: `image`, `phone_number`, `username`, dan
 * `sales_display_name` sudah lama ada di `users`. `phone_number` dulu berkomentar
 * "pelanggan saja, NULL untuk admin" — sejak 23 September 2026 ia juga nomor
 * WhatsApp sales yang dihubungi pelanggan dari tautan penawaran.
 */

export type StaffProfile = {
  id: string
  name: string
  email: string
  username: string | null
  phoneNumber: string | null
  image: string | null
  salesDisplayName: string | null
  /**
   * Akun ini punya password sendiri, atau masuk lewat Google saja.
   *
   * BOOLEAN, bukan hash-nya. Nilai ini menyeberang ke komponen klien
   * (`StaffProfileCard`) dan ikut terbaca di payload RSC — yang dikirim ke
   * sana cukup jawaban "ada/tidak", tidak pernah bahannya.
   *
   * Dipakai untuk memutuskan apakah formulir ganti password pantas tampil.
   * Tanpa ini, akun Google melihat formulir yang setiap kali ditekan hanya
   * membalas galat, dan catatan "tautan reset dikirim ke email Anda" yang
   * tidak pernah benar untuk mereka — `forgotPasswordAction` memang melewati
   * akun tanpa password.
   */
  hasPassword: boolean
}

export async function getStaffProfile(userId: string): Promise<StaffProfile | null> {
  const row = await getPrisma().user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      phoneNumber: true,
      image: true,
      salesDisplayName: true,
      passwordHash: true,
    },
  })
  if (!row) return null

  const { passwordHash, ...profile } = row
  return { ...profile, hasPassword: passwordHash !== null }
}

/**
 * Simpan bagian profil yang tidak menyentuh cara masuk.
 *
 * `email` sengaja TIDAK ada di sini dan jangan ditambahkan. Email adalah kunci
 * sambungan antar cara login (lihat catatan di model `User`): ia mencocokkan
 * akun panel dengan identitas Google, dan mengubahnya lewat formulir profil
 * berarti seseorang bisa memindahkan akunnya ke alamat yang bukan miliknya lalu
 * memakai "Masuk dengan Google" atas alamat itu. Perubahan email pantas jadi
 * pekerjaan owner lewat jalur tersendiri, bukan kolom di halaman ini.
 *
 * `null` pada sebuah medan berarti KOSONGKAN; `undefined` berarti jangan sentuh.
 */
export async function updateStaffProfile(
  userId: string,
  data: {
    name?: string
    salesDisplayName?: string | null
    phoneNumber?: string | null
    image?: string | null
  }
): Promise<boolean> {
  const { count } = await getPrisma().user.updateMany({
    // `role: { not: "pelanggan" }` ikut di WHERE, pola yang sama dengan
    // `setSalesDisplayName`: formulir ini milik staff, dan syarat yang hidup di
    // dalam kueri tidak bisa dilewati jalur kedua yang ditambahkan nanti.
    where: { id: userId, role: { not: "pelanggan" } },
    data,
  })
  return count > 0
}

export type UsernameChangeResult =
  | { ok: true }
  | { ok: false; error: string }

/**
 * Ganti username sendiri — nama yang dipakai MASUK ke panel.
 *
 * Dipisah dari `updateStaffProfile` karena akibatnya berbeda jenis: yang lain
 * mengubah apa yang dibaca orang, yang ini mengubah kunci pintu. Ia juga satu-
 * satunya yang bisa gagal karena sudah dipakai orang lain, dan kegagalan itu
 * harus sampai ke layar dengan kalimatnya sendiri.
 *
 * Bentrok diperiksa dua kali: sekali di sini untuk pesan yang enak dibaca, dan
 * sekali lagi oleh unique constraint di database untuk dua permintaan yang tiba
 * nyaris bersamaan. Pola yang sama dipakai `registerCustomer` dan
 * `/profile/lengkapi-profil`.
 */
export async function updateStaffUsername(
  userId: string,
  username: string
): Promise<UsernameChangeResult> {
  const prisma = getPrisma()
  const normalized = normalizeIdentifier(username)

  const dipakai = await prisma.user.findUnique({
    where: { username: normalized },
    select: { id: true },
  })
  if (dipakai && dipakai.id !== userId) {
    return { ok: false, error: "Username ini sudah dipakai. Coba yang lain." }
  }

  try {
    const { count } = await prisma.user.updateMany({
      where: { id: userId, role: { not: "pelanggan" } },
      data: { username: normalized },
    })
    if (count === 0) return { ok: false, error: "Akun tidak ditemukan." }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "Username ini sudah dipakai. Coba yang lain." }
    }
    throw error
  }

  return { ok: true }
}
