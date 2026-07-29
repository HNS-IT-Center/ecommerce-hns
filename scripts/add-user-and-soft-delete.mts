/**
 * S1-E4 — tabel `users` + kolom soft delete pada `stores` dan `faq_items`.
 *
 * Dijalankan manual, BUKAN lewat `prisma migrate`: database ini tidak punya
 * tabel `_prisma_migrations` sama sekali, sehingga `migrate dev` akan
 * memperlakukan seluruh skema sebagai migrasi pertama dan berpotensi mereset
 * data produksi. `db push` juga berisiko karena ikut merekonsiliasi selisih
 * lain yang mungkin ada antara schema.prisma dan database.
 *
 * Seluruh perubahan aditif: satu tabel baru, dan kolom baru yang nullable.
 * Tidak ada baris yang berubah artinya — `deleted_at NULL` berarti "belum
 * dihapus", yang persis keadaan seluruh baris yang sudah ada.
 *
 * Idempoten: memeriksa keberadaan tabel/kolom lebih dulu, aman dijalankan ulang.
 *
 * Default DRY RUN. Tambahkan --apply untuk menulis.
 */
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

const APPLY = process.argv.includes("--apply")
const { getPrisma } = await import("../src/lib/prisma/client")
const p = getPrisma()
const tag = APPLY ? "[APPLY]" : "[DRY RUN]"

async function tabelAda(nama: string): Promise<boolean> {
  const rows = await p.$queryRawUnsafe<Array<Record<string, unknown>>>("SHOW TABLES")
  return rows.map((r) => String(Object.values(r)[0])).includes(nama)
}

async function kolomAda(tabel: string, kolom: string): Promise<boolean> {
  const rows = await p.$queryRawUnsafe<Array<{ Field: string }>>(`SHOW COLUMNS FROM ${tabel}`)
  return rows.some((r) => r.Field === kolom)
}

console.log(`${tag} Tabel users + kolom soft delete\n`)

// ------------------------------------------------------------------ 1. users
const adaUsers = await tabelAda("users")
console.log(`1. Tabel \`users\`: ${adaUsers ? "SUDAH ADA" : "belum ada"}`)

const DDL_USERS = `
CREATE TABLE users (
  id            VARCHAR(191) NOT NULL,
  email         VARCHAR(191) NOT NULL,
  name          VARCHAR(191) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  image         VARCHAR(1000) NULL,
  created_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY users_email_key (email)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`.trim()

if (adaUsers) {
  console.log("   dilewati.")
} else if (!APPLY) {
  console.log("   [DRY RUN] akan dijalankan:")
  console.log(DDL_USERS.split("\n").map((l) => `      ${l}`).join("\n"))
} else {
  await p.$executeRawUnsafe(DDL_USERS)
  console.log("   tabel dibuat.")
}

// -------------------------------------------------- 2. kolom soft delete
const KOLOM: Array<[string, string, string]> = [
  ["stores", "deleted_at", "ALTER TABLE stores ADD COLUMN deleted_at DATETIME(3) NULL"],
  ["stores", "deleted_by", "ALTER TABLE stores ADD COLUMN deleted_by VARCHAR(191) NULL"],
  ["faq_items", "deleted_at", "ALTER TABLE faq_items ADD COLUMN deleted_at DATETIME(3) NULL"],
  ["faq_items", "deleted_by", "ALTER TABLE faq_items ADD COLUMN deleted_by VARCHAR(191) NULL"],
]

console.log("\n2. Kolom soft delete")
for (const [tabel, kolom, ddl] of KOLOM) {
  const ada = await kolomAda(tabel, kolom)
  if (ada) {
    console.log(`   ${tabel}.${kolom}: SUDAH ADA, dilewati`)
  } else if (!APPLY) {
    console.log(`   ${tabel}.${kolom}: [DRY RUN] ${ddl}`)
  } else {
    await p.$executeRawUnsafe(ddl)
    console.log(`   ${tabel}.${kolom}: ditambahkan`)
  }
}

// ------------------------------------------------------------ 3. indeks
const INDEKS: Array<[string, string]> = [
  ["stores", "CREATE INDEX stores_deleted_at_idx ON stores (deleted_at)"],
  ["faq_items", "CREATE INDEX faq_items_deleted_at_idx ON faq_items (deleted_at)"],
]

console.log("\n3. Indeks deleted_at (query default akan selalu menyaringnya)")
for (const [tabel, ddl] of INDEKS) {
  const idx = await p.$queryRawUnsafe<Array<{ Key_name: string }>>(`SHOW INDEX FROM ${tabel}`)
  const nama = `${tabel}_deleted_at_idx`
  if (idx.some((i) => i.Key_name === nama)) {
    console.log(`   ${nama}: SUDAH ADA, dilewati`)
  } else if (!APPLY) {
    console.log(`   ${nama}: [DRY RUN] ${ddl}`)
  } else {
    await p.$executeRawUnsafe(ddl)
    console.log(`   ${nama}: dibuat`)
  }
}

// ------------------------------------------------------------ 4. verifikasi
if (APPLY) {
  console.log("\n=== VERIFIKASI ===")
  const cols = await p.$queryRawUnsafe<Array<{ Field: string; Type: string }>>("SHOW COLUMNS FROM users")
  console.log("   users:", cols.map((c) => c.Field).join(", "))
  for (const t of ["stores", "faq_items"]) {
    const c = await p.$queryRawUnsafe<Array<{ Field: string }>>(`SHOW COLUMNS FROM ${t}`)
    const n = await p.$queryRawUnsafe<Array<{ n: bigint }>>(`SELECT COUNT(*) AS n FROM ${t}`)
    console.log(`   ${t}: ${c.map((x) => x.Field).join(", ")}  (${Number(n[0].n)} baris)`)
  }
}

console.log(`\n${tag} selesai.`)
if (!APPLY) console.log("Jalankan ulang dengan --apply untuk menerapkan.")

await p.$disconnect()
