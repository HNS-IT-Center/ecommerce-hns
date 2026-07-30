/**
 * Kolom `username` pada tabel `users`, supaya masuk bisa memakai email ATAU
 * username.
 *
 * Dijalankan manual, BUKAN lewat `prisma migrate`: database ini tidak punya
 * tabel `_prisma_migrations`, sehingga `migrate dev` akan memperlakukan seluruh
 * skema sebagai migrasi pertama. Alasan yang sama seperti
 * `add-user-and-soft-delete.mts` dan `add-password-changed-at.mts`.
 *
 * Aditif dan nullable: NULL berarti "akun ini hanya bisa masuk lewat email",
 * yang persis keadaan seluruh baris yang sudah ada. Tidak ada baris yang berubah
 * artinya, dan tidak ada yang kehilangan cara masuknya.
 *
 * Indeksnya UNIQUE. Tanpa itu dua akun bisa memegang username yang sama dan
 * `findFirst` akan memilih salah satunya secara sewenang-wenang — cara paling
 * senyap untuk membuat orang masuk ke akun yang bukan miliknya. MySQL
 * memperlakukan NULL sebagai nilai yang selalu berbeda, jadi banyak baris tanpa
 * username tetap boleh berdampingan.
 *
 * Idempoten: memeriksa keberadaan kolom dan indeks lebih dulu.
 *
 * Default DRY RUN. Tambahkan --apply untuk menulis.
 */
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

const APPLY = process.argv.includes("--apply")
const { getPrisma } = await import("../src/lib/prisma/client")
const p = getPrisma()
const tag = APPLY ? "[APPLY]" : "[DRY RUN]"

async function kolomAda(tabel: string, kolom: string): Promise<boolean> {
  const rows = await p.$queryRawUnsafe<Array<{ Field: string }>>(`SHOW COLUMNS FROM ${tabel}`)
  return rows.some((r) => r.Field === kolom)
}

async function indeksAda(tabel: string, nama: string): Promise<boolean> {
  const rows = await p.$queryRawUnsafe<Array<{ Key_name: string }>>(`SHOW INDEX FROM ${tabel}`)
  return rows.some((r) => r.Key_name === nama)
}

console.log(`${tag} kolom username pada users\n`)

const DDL_KOLOM = "ALTER TABLE users ADD COLUMN username VARCHAR(191) NULL"
const DDL_INDEKS = "CREATE UNIQUE INDEX users_username_key ON users (username)"

if (await kolomAda("users", "username")) {
  console.log("   users.username: SUDAH ADA, dilewati")
} else if (!APPLY) {
  console.log(`   users.username: [DRY RUN] ${DDL_KOLOM}`)
} else {
  await p.$executeRawUnsafe(DDL_KOLOM)
  console.log("   users.username: ditambahkan")
}

// Indeks diperiksa terpisah dari kolomnya: kalau skrip ini pernah berhenti di
// tengah, kolomnya bisa sudah ada sementara indeksnya belum.
if (await indeksAda("users", "users_username_key")) {
  console.log("   indeks unik users_username_key: SUDAH ADA, dilewati")
} else if (!APPLY) {
  console.log(`   indeks unik: [DRY RUN] ${DDL_INDEKS}`)
} else {
  await p.$executeRawUnsafe(DDL_INDEKS)
  console.log("   indeks unik users_username_key: ditambahkan")
}

console.log("\n=== KEADAAN SEKARANG ===")
const cols = await p.$queryRawUnsafe<
  Array<{ Field: string; Type: string; Null: string; Key: string }>
>("SHOW COLUMNS FROM users")
for (const c of cols) {
  console.log(`   ${c.Field} — ${c.Type} (null: ${c.Null}, key: ${c.Key || "-"})`)
}

const n = await p.$queryRawUnsafe<Array<{ n: bigint }>>("SELECT COUNT(*) AS n FROM users")
console.log(`   total akun admin: ${Number(n[0].n)}`)

console.log(`\n${tag} selesai.`)
if (!APPLY) console.log("Jalankan ulang dengan --apply untuk menerapkan.")

await p.$disconnect()
