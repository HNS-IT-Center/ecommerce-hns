import "server-only"

import { resolveSiteUrl } from "./site-url"

/**
 * Base URL untuk tautan yang KELUAR dari aplikasi dan diklik orang di tempat
 * lain — tautan verifikasi akun dan reset password di dalam email.
 *
 * Berbeda dari `resolveSiteUrl()`, yang boleh mengembalikan apa saja yang lolos
 * `isTrustedHost` (termasuk `localhost` untuk pengembangan). Itu tepat untuk QR
 * code yang dipindai di layar yang sama, tapi salah untuk email: tautan
 * `localhost` di inbox pelanggan tidak bisa dibuka siapa pun.
 *
 * **Kenapa daftar izin (validasi positif), bukan larangan kata "localhost".**
 * Penjaga yang mencari kata terlarang hanya menangkap kegagalan yang sudah kita
 * bayangkan. Kalau fallback-nya suatu hari berubah menjadi nilai lain yang
 * bukan `localhost` — host internal Hostinger, alamat IP, `127.0.0.1`, atau
 * string kosong — penjaga semacam itu lolos diam-diam dan pelanggan kembali
 * menerima tautan mati. Daftar izin membalik bebannya: apa pun yang tidak
 * secara eksplisit kita akui sebagai alamat publik, ditolak.
 *
 * **Kenapa daftarnya sendiri, bukan meminjam `isTrustedHost`.** Fungsi itu
 * sengaja longgar — ia mengizinkan `localhost` dan seluruh subdomain
 * `*.hnsitcenter.id` supaya pengembangan lokal dan lingkungan baru tidak perlu
 * konfigurasi. Kelonggaran itu tepat di tempatnya, tapi persis yang tidak boleh
 * ada di jalur email.
 */
const EMAIL_LINK_HOSTS = [
  "hnsitcenter.id",
  "www.hnsitcenter.id",
  // Staging. Ikut diizinkan supaya alur pendaftaran bisa DIUJI di sana — itu
  // memang tempatnya diuji. Tautannya sungguh bisa dibuka, jadi tidak melanggar
  // maksud penjaga ini.
  "store.hnsitcenter.id",
]

/**
 * Dilempar saat alamat publik tidak bisa ditentukan.
 *
 * Sengaja gagal keras, BUKAN mengirim email dengan tautan seadanya. Kegagalan
 * yang paling buruk di sini adalah kegagalan diam: pelanggan menerima email
 * berisi tautan mati, mengira dirinya sudah mendaftar, lalu pergi — dan tidak
 * ada seorang pun yang tahu itu terjadi. Persis yang berlangsung entah berapa
 * lama sampai user mengujinya sendiri pada 13 Agustus 2026.
 */
export class PublicUrlUnavailableError extends Error {
  constructor(resolved: string) {
    super(
      `Alamat publik situs tidak bisa ditentukan (hasil resolusi: "${resolved}"). ` +
        `Email tidak dikirim karena tautannya tidak akan bisa dibuka penerima. ` +
        `Periksa NEXT_PUBLIC_SITE_URL di deployment — nilainya harus salah satu dari: ` +
        `${EMAIL_LINK_HOSTS.join(", ")}.`
    )
    this.name = "PublicUrlUnavailableError"
  }
}

/**
 * Base URL yang dijamin bisa dibuka penerima email, atau melempar.
 *
 * Pemanggil TIDAK boleh menangkap galat ini lalu mengirim email apa adanya —
 * seluruh gunanya justru menghentikan pengiriman itu.
 */
export async function resolvePublicUrl(): Promise<string> {
  const resolved = await resolveSiteUrl()

  let hostname: string
  try {
    hostname = new URL(resolved).hostname.toLowerCase()
  } catch {
    throw new PublicUrlUnavailableError(resolved)
  }

  if (!EMAIL_LINK_HOSTS.includes(hostname)) {
    throw new PublicUrlUnavailableError(resolved)
  }

  return resolved.replace(/\/$/, "")
}
