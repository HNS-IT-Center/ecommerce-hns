/**
 * S1-E6 — kolom `password_changed_at` pada tabel `users`.
 *
 * Dijalankan manual, BUKAN lewat `prisma migrate`: database ini tidak punya
 * tabel `_prisma_migrations`, sehingga `migrate dev` akan memperlakukan seluruh
 * skema sebagai migrasi pertama dan berpotensi mereset data produksi. Alasan
 * yang sama seperti `add-user-and-soft-delete.mts`.
 *
 * Untuk apa kolom ini: token sesi bersifat stateless, tidak ada baris sesi yang
 * bisa dihapus. Pencabutan dilakukan dengan membandingkan waktu — token yang
 * `iat`-nya lebih tua dari nilai kolom ini dianggap mati walau tanda tangannya
 * sah. Tanpa itu, mengganti password sama sekali tidak memutus sesi yang sedang
 * berjalan di perangkat lain.
 *
 * Aditif dan nullable: NULL berarti "password belum pernah diganti sejak kolom
 * ini ada", yang persis keadaan seluruh baris yang sudah ada. Tidak ada baris
 * yang berubah artinya, dan sengaja TIDAK diisi nilai apa pun untuk baris lama
 * — mengisinya dengan `NOW()` akan mencabut sesi semua orang tanpa alasan.
 *
 * Idempoten: memeriksa keberadaan kolom lebih dulu, aman dijalankan ulang.
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

console.log(`${tag} kolom password_changed_at pada users\n`)

// DATETIME(3) mengikuti kolom waktu lain di skema ini (`created_at`,
// `deleted_at`) supaya presisinya seragam di seluruh tabel. Nilai yang ditulis
// aplikasi tetap dibulatkan ke detik utuh — lihat komentar di schema.prisma.
const DDL = "ALTER TABLE users ADD COLUMN password_changed_at DATETIME(3) NULL"

if (await kolomAda("users", "password_changed_at")) {
  console.log("   users.password_changed_at: SUDAH ADA, dilewati")
} else if (!APPLY) {
  console.log(`   users.password_changed_at: [DRY RUN] ${DDL}`)
} else {
  await p.$executeRawUnsafe(DDL)
  console.log("   users.password_changed_at: ditambahkan")
}

console.log("\n=== KEADAAN SEKARANG ===")
// `Default` ikut dicetak, bukan hanya tipe dan nullability: justru kolom Default
// inilah yang membuktikan kolom ini tidak akan pernah terisi sendiri. Kalau ada
// `DEFAULT CURRENT_TIMESTAMP` di sana, setiap baris lama akan langsung
// terhitung "password baru diganti" dan seluruh sesi tercabut tanpa sebab.
const cols = await p.$queryRawUnsafe<
  Array<{ Field: string; Type: string; Null: string; Default: string | null }>
>("SHOW COLUMNS FROM users")
for (const c of cols) {
  console.log(
    `   ${c.Field} — ${c.Type} (null: ${c.Null}, default: ${c.Default === null ? "NULL" : c.Default})`
  )
}

const n = await p.$queryRawUnsafe<Array<{ n: bigint }>>("SELECT COUNT(*) AS n FROM users")
console.log(`   total akun admin: ${Number(n[0].n)}`)

// Kalau ada baris yang password_changed_at-nya sudah terisi padahal migrasi baru
// saja jalan, berarti ada yang mengisinya — dan itu harus terlihat, bukan lolos.
const terisi = await p.$queryRawUnsafe<Array<{ n: bigint }>>(
  "SELECT COUNT(*) AS n FROM users WHERE password_changed_at IS NOT NULL"
)
console.log(`   baris dengan password_changed_at terisi: ${Number(terisi[0].n)}`)

console.log(`\n${tag} selesai.`)
if (!APPLY) console.log("Jalankan ulang dengan --apply untuk menerapkan.")
else {
  console.log(
    "CATATAN: seluruh sesi yang sedang berjalan menjadi tidak sah setelah ini,\n" +
      "karena token lama tidak memuat `iat`. Semua PIC perlu masuk sekali lagi."
  )
}

await p.$disconnect()
