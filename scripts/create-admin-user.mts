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
 *   npx tsx scripts/create-admin-user.mts <email> [nama]
 */
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

import { createInterface } from "node:readline"

const { hashPassword } = await import("../src/lib/auth/password")
const { getPrisma } = await import("../src/lib/prisma/client")

const PANJANG_MINIMAL = 10

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

const email = process.argv[2]?.trim().toLowerCase()
const nama = process.argv.slice(3).join(" ").trim()

if (!email || !email.includes("@")) {
  console.error("Pakai: npx tsx scripts/create-admin-user.mts <email> [nama]")
  process.exit(1)
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

  const password = await tanya("Password baru      : ", true)
  if (password.length < PANJANG_MINIMAL) {
    console.error(`\nPassword minimal ${PANJANG_MINIMAL} karakter. Dibatalkan.`)
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
    update: { passwordHash, name: namaFinal },
    create: { email, name: namaFinal, passwordHash },
    select: { id: true, email: true, name: true, createdAt: true },
  })

  console.log(
    `\n${sudahAda ? "Password diperbarui" : "Akun dibuat"}: ${user.name} <${user.email}>`
  )
  console.log(`Total akun admin sekarang: ${await prisma.user.count()}`)
} finally {
  await prisma.$disconnect()
}
