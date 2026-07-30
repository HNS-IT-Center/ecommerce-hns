/**
 * Buat atau perbarui akun admin panel.
 *
 * Password DIMINTA LEWAT PROMPT, tidak pernah lewat argumen baris perintah.
 * Argumen tersimpan di riwayat shell dan terlihat di daftar proses milik
 * pengguna lain pada mesin yang sama — dua tempat yang tidak pantas menyimpan
 * password. Ketikan juga tidak ditampilkan di layar.
 *
 * Tidak ada pendaftaran mandiri di panel ini: akun hanya lahir dari sini.
 * Itu disengaja — halaman login yang bisa membuat akun sendiri berarti siapa
 * pun yang menemukannya bisa memberi dirinya akses.
 *
 * Pakai:
 *   npx tsx scripts/create-admin-user.mts <email> [nama] [--username <username>]
 *
 * Username bersifat opsional. Tanpa itu akun tetap bisa masuk lewat email —
 * kolomnya nullable justru supaya menambahkan cara masuk kedua tidak pernah
 * menjadi syarat.
 */
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

import { createInterface } from "node:readline"

const { hashPassword, MIN_PASSWORD_LENGTH } = await import("../src/lib/auth/password")
const { normalizeIdentifier, validateUsername } = await import("../src/lib/auth/identity")
const { getPrisma } = await import("../src/lib/prisma/client")

function tanya(pertanyaan: string, sembunyikan = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    process.stdout.write(pertanyaan)
    if (sembunyikan) {
      // Menonaktifkan gema karakter supaya password tidak muncul di layar.
      ;(rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = () => {}
    }
    rl.question("", (jawaban) => {
      rl.close()
      if (sembunyikan) process.stdout.write("\n")
      resolve(jawaban)
    })
  })
}

const argv = process.argv.slice(2)

// `--username x` dikeluarkan lebih dulu supaya sisa argumennya bisa
// diperlakukan sebagai nama tanpa ikut menyeret bendera ini ke dalamnya.
const posisiUsername = argv.indexOf("--username")
const username =
  posisiUsername === -1 ? null : normalizeIdentifier(argv[posisiUsername + 1] ?? "")
if (posisiUsername !== -1) argv.splice(posisiUsername, 2)

const email = argv[0]?.trim().toLowerCase()
const nama = argv.slice(1).join(" ").trim()

const PEMAKAIAN = "Pakai: npx tsx scripts/create-admin-user.mts <email> [nama] [--username <username>]"

if (!email || !email.includes("@")) {
  console.error(PEMAKAIAN)
  process.exit(1)
}

// Username divalidasi SEBELUM password diminta. Menanyakan password dua kali
// lalu berhenti karena usernamenya cacat memboroskan pekerjaan orang tanpa
// alasan — dan yang cacat sudah bisa diketahui sejak sekarang.
if (username !== null) {
  if (!username) {
    console.error(`--username butuh nilai.\n${PEMAKAIAN}`)
    process.exit(1)
  }
  const keluhan = validateUsername(username)
  if (keluhan) {
    console.error(keluhan)
    process.exit(1)
  }
}

// Penjagaan eksplisit: kalau ada yang mencoba menitipkan password lewat argumen,
// hentikan dan jelaskan alasannya, jangan diam-diam mengabaikannya.
if (process.argv.some((a) => a.startsWith("--password"))) {
  console.error(
    "Password tidak boleh lewat argumen — ia tersimpan di riwayat shell.\n" +
      "Jalankan tanpa argumen password; nanti diminta lewat prompt."
  )
  process.exit(1)
}

const prisma = getPrisma()

try {
  const sudahAda = await prisma.user.findUnique({ where: { email } })
  console.log(
    sudahAda
      ? `Akun "${email}" sudah ada — passwordnya akan DIGANTI.`
      : `Membuat akun baru untuk "${email}".`
  )

  // Bentrokan username diperiksa lebih dulu, bukan diserahkan ke indeks unik di
  // database. Kalau dibiarkan, kegagalannya baru muncul SETELAH password
  // diketik dua kali, dan bentuknya galat Prisma mentah yang tidak menjelaskan
  // apa pun kepada orang yang menjalankannya.
  if (username) {
    const pemilik = await prisma.user.findUnique({ where: { username } })
    if (pemilik && pemilik.email !== email) {
      console.error(`\nUsername "${username}" sudah dipakai akun lain. Dibatalkan.`)
      process.exit(1)
    }
    console.log(`Username akan disetel: "${username}".`)
  }

  const password = await tanya("Password baru      : ", true)
  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`\nPassword minimal ${MIN_PASSWORD_LENGTH} karakter. Dibatalkan.`)
    process.exit(1)
  }

  const ulangi = await tanya("Ulangi password    : ", true)
  if (password !== ulangi) {
    console.error("\nPassword tidak sama. Dibatalkan.")
    process.exit(1)
  }

  const passwordHash = await hashPassword(password)
  const namaFinal = nama || sudahAda?.name || email.split("@")[0]

  const user = await prisma.user.upsert({
    where: { email },
    // Username hanya ditulis kalau memang diberikan. Tanpa penjagaan ini,
    // menjalankan ulang script untuk mengganti password akan menghapus username
    // yang sudah terpasang — dan pemiliknya baru sadar saat cara masuk yang
    // biasa ia pakai tiba-tiba tidak dikenali.
    update: { passwordHash, name: namaFinal, ...(username ? { username } : {}) },
    create: { email, name: namaFinal, passwordHash, username },
    select: { id: true, email: true, name: true, username: true, createdAt: true },
  })

  console.log(
    `\n${sudahAda ? "Password diperbarui" : "Akun dibuat"}: ${user.name} <${user.email}>` +
      (user.username ? ` (username: ${user.username})` : "")
  )
  console.log(`Total akun admin sekarang: ${await prisma.user.count()}`)
} finally {
  await prisma.$disconnect()
}
