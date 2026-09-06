/**
 * Pencarian akun dari apa pun yang diketik orang di kolom "masuk".
 *
 * Ini titik tunggal tempat "identitas yang diketik" berubah menjadi "baris di
 * tabel User". Ia sengaja dipisah dari `login/actions.ts` karena inilah bagian
 * yang akan bertambah kalau provider lain masuk: Google mengembalikan email
 * terverifikasi, SSO mengembalikan email atau id internal, dan keduanya berakhir
 * di fungsi yang sama untuk menjawab satu pertanyaan — akun mana ini?
 *
 * Yang TIDAK boleh pindah ke sini: keputusan boleh-tidaknya masuk. Itu tetap
 * milik tabel User dan lapisan sesi. Berkas ini hanya mencari, tidak memutuskan.
 * Kalau aturan izin ikut masuk ke sini, menambah provider berarti menuliskan
 * aturan yang sama dua kali, dan cepat atau lambat keduanya berbeda.
 */
import { getPrisma } from "@/lib/prisma/client"

/** Panjang username. Batas atas mengikuti VARCHAR(191) kolomnya, dengan jarak. */
export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 32

/**
 * Huruf kecil, angka, titik, garis bawah, dan tanda hubung. Tidak lebih.
 *
 * Yang paling penting dari daftar ini adalah apa yang TIDAK ada di dalamnya:
 * `@`. Kalau username boleh berbentuk email, seseorang bisa mendaftarkan
 * username `admin@hns.com` sementara akun lain memegang email itu — dan sejak
 * saat itu tidak ada yang bisa memastikan siapa yang sebenarnya masuk. Larangan
 * ini juga yang membuat pemilahan di `isEmail` tidak pernah ambigu.
 */
const USERNAME_PATTERN = /^[a-z0-9._-]+$/

/**
 * Apakah yang diketik ini email atau username?
 *
 * Cukup dengan keberadaan `@`, bukan pencocokan pola email yang lengkap.
 * Alasannya: keputusan yang diambil di sini hanya "kolom mana yang dicari",
 * bukan "apakah alamat ini sah". Pola email yang ketat justru berbahaya di
 * tempat ini — ia akan menolak alamat sah yang tidak biasa dan mengirim
 * pemiliknya mencari akun di kolom username, yang pasti tidak ketemu.
 */
export function isEmail(identifier: string): boolean {
  return identifier.includes("@")
}

/** Huruf kecil dan tanpa spasi tepi, supaya "Riyan" dan "riyan" satu akun. */
export function normalizeIdentifier(raw: string): string {
  return raw.trim().toLowerCase()
}

/**
 * Kembalikan pesan kesalahan, atau null kalau usernamenya sah.
 *
 * Dipakai script pembuat akun. TIDAK dipakai saat masuk — di sana username yang
 * cacat cukup diperlakukan sebagai "tidak ditemukan", karena memberi tahu
 * penebak bahwa formatnya salah sama saja memberitahunya format yang benar.
 */
export function validateUsername(username: string): string | null {
  if (username.length < USERNAME_MIN_LENGTH) {
    return `Username minimal ${USERNAME_MIN_LENGTH} karakter.`
  }
  if (username.length > USERNAME_MAX_LENGTH) {
    return `Username maksimal ${USERNAME_MAX_LENGTH} karakter.`
  }
  if (username.includes("@")) {
    return "Username tidak boleh mengandung '@' — itu menandai sebuah email."
  }
  if (!USERNAME_PATTERN.test(username)) {
    return "Username hanya boleh berisi huruf kecil, angka, titik, garis bawah, dan tanda hubung."
  }
  return null
}

/** Angka saja, boleh diawali `+`. 9–15 digit — cakupan longgar nomor HP Indonesia
 * (dengan atau tanpa kode negara) tanpa memaksa format tertentu. */
const PHONE_PATTERN = /^\+?\d{9,15}$/

/**
 * Kembalikan pesan kesalahan, atau null kalau nomornya sah.
 *
 * Cuma cek bentuk (angka, panjang wajar) — TIDAK ada verifikasi OTP.
 * Project ini belum punya integrasi SMS/WhatsApp API untuk itu; kalau nanti
 * dibutuhkan, itu pekerjaan terpisah yang lebih besar, bukan tambahan kecil
 * di sini. Lihat CLAUDE.md §2.1.
 */
export function validatePhoneNumber(phoneNumber: string): string | null {
  const trimmed = phoneNumber.trim()
  if (!PHONE_PATTERN.test(trimmed)) {
    return "Nomor HP tidak valid — isi angka saja (boleh diawali +), 9–15 digit."
  }
  return null
}

export type IdentityLookup = {
  id: string
  email: string
  /// Nullable sejak Satu Login: tabel `users` kini juga memuat pelanggan Google
  /// yang tak punya password. Pemanggil (admin/login) sudah menangani null
  /// dengan hash boneka lalu menolak — akun tanpa password tak bisa masuk.
  passwordHash: string | null
  /// Peran akun — dipakai login terpadu (/login) untuk menentukan tujuan:
  /// "pelanggan" → storefront, selainnya → panel admin. Lihat lib/auth/roles.ts.
  role: string
  /// Verifikasi email (pelanggan email+password). Login terpadu menolak
  /// pelanggan yang belum verifikasi; admin tak punya nilai ini (null = lolos).
  emailVerifiedAt: Date | null
}

/**
 * Cari akun dari email ATAU username. `null` kalau tidak ada.
 *
 * Keduanya kolom unik DAN wajib, jadi setiap akun selalu bisa ditemukan lewat
 * dua jalur, dan tidak ada dua baris yang bisa cocok sekaligus — karena username
 * tidak boleh mengandung `@`, sebuah masukan tidak pernah bisa menjadi email
 * milik satu orang sekaligus username milik orang lain.
 */
export async function findUserByIdentifier(raw: string): Promise<IdentityLookup | null> {
  const identifier = normalizeIdentifier(raw)
  if (!identifier) return null

  return getPrisma().user.findFirst({
    where: isEmail(identifier) ? { email: identifier } : { username: identifier },
    select: { id: true, email: true, passwordHash: true, role: true, emailVerifiedAt: true },
  })
}
