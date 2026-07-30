/**
 * Tolak email dan username KOSONG pada tabel `users`, lewat CHECK constraint.
 *
 * KENAPA `NOT NULL` TIDAK CUKUP DI DATABASE INI.
 *
 * `sql_mode` server ini adalah `IGNORE_SPACE,NO_AUTO_CREATE_USER,
 * NO_ENGINE_SUBSTITUTION` — tanpa `STRICT_TRANS_TABLES`. Dalam mode itu, INSERT
 * yang melewatkan kolom NOT NULL tanpa DEFAULT tidak ditolak; MariaDB "menolong"
 * dengan mengisinya string kosong dan meneruskan dengan peringatan. Jadi
 * `username VARCHAR(191) NOT NULL` bisa berakhir sebagai `''`.
 *
 * Akibatnya bukan teoretis: akun dengan username `''` melanggar syarat "setiap
 * akun punya dua identitas masuk", dan hanya SATU baris yang bisa memegangnya
 * karena kolomnya unik — sehingga kesalahan pertama lolos senyap dan yang kedua
 * gagal dengan pesan bentrok yang menyesatkan.
 *
 * CHECK constraint berlaku terlepas dari `sql_mode`, jadi ia menutup lubang itu
 * tanpa menyentuh konfigurasi server — yang pada hosting bersama sering memang
 * tidak bisa diubah.
 *
 * CATATAN LEBIH LUAS: `sql_mode` yang sama berlaku untuk SELURUH tabel di skema
 * ini, bukan hanya `users`. Skrip ini sengaja hanya menutup dua kolom identitas
 * masuk — memasang STRICT untuk semuanya adalah keputusan tersendiri yang bisa
 * memunculkan galat baru di seluruh aplikasi, dan itu bukan sesuatu yang pantas
 * diselipkan diam-diam.
 *
 * Idempoten: memeriksa keberadaan constraint lebih dulu.
 *
 * Default DRY RUN. Tambahkan --apply untuk menulis.
 */
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

const APPLY = process.argv.includes("--apply")
const { getPrisma } = await import("../src/lib/prisma/client")
const p = getPrisma()
const tag = APPLY ? "[APPLY]" : "[DRY RUN]"

console.log(`${tag} CHECK constraint email & username tidak kosong\n`)

async function constraintAda(nama: string): Promise<boolean> {
  const rows = await p.$queryRawUnsafe<Array<{ n: bigint }>>(
    "SELECT COUNT(*) AS n FROM information_schema.CHECK_CONSTRAINTS " +
      `WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND CONSTRAINT_NAME = '${nama}'`
  )
  return Number(rows[0].n) > 0
}

const rencana: Array<[string, string]> = [
  ["users_username_not_empty", "ALTER TABLE users ADD CONSTRAINT users_username_not_empty CHECK (username <> '')"],
  ["users_email_not_empty", "ALTER TABLE users ADD CONSTRAINT users_email_not_empty CHECK (email <> '')"],
]

// Baris yang sudah melanggar harus diketahui LEBIH DULU: menambahkan constraint
// di atas data yang melanggar akan gagal, dan pesannya tidak menyebut baris mana.
const pelanggar = await p.$queryRawUnsafe<Array<{ id: string; email: string; username: string }>>(
  "SELECT id, email, username FROM users WHERE email = '' OR username = '' OR username IS NULL"
)
if (pelanggar.length > 0) {
  console.error(`   DIBATALKAN — ${pelanggar.length} baris sudah melanggar:`)
  for (const u of pelanggar) console.error(`     id=${u.id} email="${u.email}" username="${u.username}"`)
  console.error("\n   Perbaiki barisnya dulu, lalu jalankan lagi.")
  await p.$disconnect()
  process.exit(1)
}
console.log(`   ${pelanggar.length} baris melanggar — aman.\n`)

for (const [nama, ddl] of rencana) {
  if (await constraintAda(nama)) {
    console.log(`   ${nama}: SUDAH ADA, dilewati`)
  } else if (!APPLY) {
    console.log(`   ${nama}: [DRY RUN] ${ddl}`)
  } else {
    await p.$executeRawUnsafe(ddl)
    console.log(`   ${nama}: ditambahkan`)
  }
}

console.log("\n=== KEADAAN SEKARANG ===")
const cek = await p.$queryRawUnsafe<Array<{ CONSTRAINT_NAME: string; CHECK_CLAUSE: string }>>(
  "SELECT CONSTRAINT_NAME, CHECK_CLAUSE FROM information_schema.CHECK_CONSTRAINTS " +
    "WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'users'"
)
if (cek.length === 0) console.log("   (belum ada constraint)")
for (const c of cek) console.log(`   ${c.CONSTRAINT_NAME}: ${c.CHECK_CLAUSE}`)

console.log(`\n${tag} selesai.`)
if (!APPLY) console.log("Jalankan ulang dengan --apply untuk menerapkan.")

await p.$disconnect()
