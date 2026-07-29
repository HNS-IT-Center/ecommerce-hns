/**
 * Hashing password admin.
 *
 * Memakai `scrypt` bawaan Node, bukan bcrypt atau argon2. Alasannya bukan
 * karena scrypt lebih baik, melainkan karena ia sudah ada: menambah dependensi
 * native untuk sesuatu yang tersedia di runtime hanya menambah permukaan
 * pemeliharaan tanpa menambah keamanan.
 *
 * Modul ini HANYA boleh dipakai dari server action, route handler, atau script
 * — `node:crypto` tidak tersedia di Edge runtime tempat middleware berjalan.
 * Verifikasi sesi memakai Web Crypto dan tinggal di `session.ts`.
 */
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"

const scryptAsync = promisify(scrypt)

/** Panjang kunci turunan. 64 byte -> 128 karakter hex. */
const KEY_LENGTH = 64
const SALT_LENGTH = 16

/**
 * Hasilnya berbentuk `salt:hash`, keduanya heksadesimal — total 161 karakter,
 * muat di kolom `password_hash` VARCHAR(255).
 *
 * Salt disimpan menyatu dengan hash, bukan di kolom terpisah, supaya tidak ada
 * kemungkinan keduanya tertukar atau terpisah saat baris disalin.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH)
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer
  return `${salt.toString("hex")}:${derived.toString("hex")}`
}

/**
 * Perbandingan memakai `timingSafeEqual`, bukan `===`.
 *
 * Perbandingan string biasa berhenti pada karakter pertama yang berbeda,
 * sehingga lamanya proses membocorkan seberapa banyak awalan yang sudah benar.
 * Untuk satu tebakan perbedaannya tak terukur; untuk jutaan tebakan otomatis ia
 * menjadi petunjuk.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":")
  if (!saltHex || !hashHex) return false

  let salt: Buffer
  let expected: Buffer
  try {
    salt = Buffer.from(saltHex, "hex")
    expected = Buffer.from(hashHex, "hex")
  } catch {
    return false
  }
  if (salt.length === 0 || expected.length === 0) return false

  const derived = (await scryptAsync(password, salt, expected.length)) as Buffer
  return derived.length === expected.length && timingSafeEqual(derived, expected)
}
