import { randomInt } from "node:crypto"

/**
 * Token alamat tautan publik quotation — `hnsitcenter.id/q/k3f9m2qa`.
 *
 * **Bukan turunan dari `code`, dan tidak boleh dibuat jadi turunannya.** Kode
 * quotation berurutan (`HNSPC-20260923-0007`), jadi apa pun yang bisa dihitung
 * darinya ikut bisa ditebak tetangganya — satu tautan yang beredar akan jadi
 * pintu ke seluruh penawaran bulan itu beserta nama pelanggannya.
 */

/**
 * 31 karakter: seluruh huruf kecil dan angka, dikurangi yang mudah tertukar
 * saat dibaca atau didiktekan lewat telepon — `0`/`o`, `1`/`l`/`i`.
 *
 * Huruf kecil semua supaya tautannya pendek dan tidak perlu dieja dengan
 * "huruf besar". Alamatnya dibaca `toLowerCase()` sebelum dicari, jadi yang
 * terlanjur mengetik huruf besar tetap mendarat.
 */
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz"

/**
 * 8 karakter ≈ 39,6 bit ≈ 850 miliar kemungkinan.
 *
 * Dipilih sebagai titik temu dua tuntutan yang berlawanan: alamatnya harus
 * pendek supaya tidak terlihat mencurigakan di WhatsApp (`bit.ly` dan kawannya
 * sudah telanjur jadi penanda penipuan), tapi cukup lebar supaya menebaknya
 * tidak masuk akal. Turun ke 6 karakter memotong dua karakter tapi memangkas
 * ruang tebakan hampir seribu kali — tidak sepadan.
 */
export const PUBLIC_TOKEN_LENGTH = 8

/** Pola alamat yang sah. Dipakai halaman `/q/[token]` sebelum menyentuh DB. */
export const PUBLIC_TOKEN_PATTERN = new RegExp(`^[${ALPHABET}]{${PUBLIC_TOKEN_LENGTH}}$`)

/**
 * `randomInt` dari `node:crypto`, BUKAN `Math.random()`.
 *
 * Yang dijaga token ini adalah isi dokumen orang lain; `Math.random()` tidak
 * pernah menjanjikan apa pun tentang bisa-tidaknya keluaran berikutnya ditebak
 * dari yang sudah terlihat. `randomInt` juga menghindari bias modulo yang
 * muncul saat rentang acak dipetakan ke alfabet yang bukan pangkat dua.
 */
export function generatePublicToken(): string {
  let token = ""
  for (let i = 0; i < PUBLIC_TOKEN_LENGTH; i++) {
    token += ALPHABET[randomInt(ALPHABET.length)]
  }
  return token
}

/** Alamat lengkap yang dikirim ke pelanggan. `siteUrl` tanpa garis miring akhir. */
export function publicQuoteUrl(siteUrl: string, token: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/q/${token}`
}
