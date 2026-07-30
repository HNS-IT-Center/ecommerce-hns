/**
 * Jadikan `users.username` WAJIB (NOT NULL), setelah sebelumnya nullable.
 *
 * Kenapa berubah: keputusan produk — setiap akun admin harus punya DUA identitas
 * masuk, email dan username, dan keduanya bisa dipakai. Selama kolomnya nullable,
 * "bisa masuk pakai username" hanya berlaku untuk akun yang kebetulan punya.
 *
 * Dijalankan manual, BUKAN lewat `prisma migrate` — database ini tidak punya
 * tabel `_prisma_migrations`. Alasan yang sama seperti tiga skrip sebelumnya.
 *
 * BEDA PENTING dari migrasi sebelumnya: ini TIDAK aditif. Mengubah kolom menjadi
 * NOT NULL gagal kalau ada baris yang nilainya NULL, dan MySQL akan "menolong"
 * dengan mengisinya jadi string kosong ketimbang berhenti. String kosong pada
 * kolom unik hanya bisa dimiliki satu baris, dan ia identitas masuk yang tidak
 * pernah diputuskan siapa pun.
 *
 * Karena itu skrip ini MENOLAK berjalan selama masih ada baris tanpa username,
 * dan menyebutkan barisnya. Ia sengaja tidak mengarang username dari email:
 * itu membuat identitas masuk yang pemiliknya sendiri tidak tahu, dan bisa
 * bertabrakan dengan username orang lain. Isi dulu satu per satu:
 *
 *   npx tsx scripts/create-admin-user.mts <email> [nama] --username <username>
 *
 * Idempoten: memeriksa nullability kolom lebih dulu.
 *
 * Default DRY RUN. Tambahkan --apply untuk menulis.
 */
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

const APPLY = process.argv.includes("--apply")
const { getPrisma } = await import("../src/lib/prisma/client")
const p = getPrisma()
const tag = APPLY ? "[APPLY]" : "[DRY RUN]"

type Kolom = { Field: string; Type: string; Null: string; Key: string }

const kolom = await p.$queryRawUnsafe<Kolom[]>("SHOW COLUMNS FROM users")
const username = kolom.find((c) => c.Field === "username")

console.log(`${tag} jadikan users.username WAJIB\n`)

if (!username) {
  console.error("Kolom users.username belum ada. Jalankan scripts/add-username-column.mts dulu.")
  await p.$disconnect()
  process.exit(1)
}

if (username.Null === "NO") {
  console.log("   users.username: SUDAH NOT NULL, dilewati")
} else {
  // Penjagaan yang membuat skrip ini aman dijalankan kapan saja.
  const kosong = await p.$queryRawUnsafe<Array<{ id: string; email: string }>>(
    "SELECT id, email FROM users WHERE username IS NULL OR username = ''"
  )

  if (kosong.length > 0) {
    console.error(`   DIBATALKAN — ${kosong.length} akun belum punya username:`)
    for (const u of kosong) console.error(`     - ${u.email}`)
    console.error(
      "\n   Isi dulu masing-masing, lalu jalankan skrip ini lagi:\n" +
        "     npx tsx scripts/create-admin-user.mts <email> --username <username>"
    )
    await p.$disconnect()
    process.exit(1)
  }

  // Tipenya disebut ulang persis (VARCHAR(191)) karena MODIFY COLUMN menulis
  // ulang seluruh definisi kolom — apa pun yang tidak disebut akan hilang.
  const DDL = "ALTER TABLE users MODIFY COLUMN username VARCHAR(191) NOT NULL"

  if (!APPLY) {
    console.log(`   ${kosong.length} akun tanpa username — aman.`)
    console.log(`   users.username: [DRY RUN] ${DDL}`)
  } else {
    await p.$executeRawUnsafe(DDL)
    console.log("   users.username: sekarang NOT NULL")
  }
}

console.log("\n=== KEADAAN SEKARANG ===")
for (const c of await p.$queryRawUnsafe<Kolom[]>("SHOW COLUMNS FROM users")) {
  console.log(`   ${c.Field} — ${c.Type} (null: ${c.Null}, key: ${c.Key || "-"})`)
}

const akun = await p.user.findMany({ select: { email: true, username: true } })
console.log(`\n   ${akun.length} akun admin:`)
for (const a of akun) console.log(`     ${a.email}  ←→  ${a.username ?? "(belum ada)"}`)

console.log(`\n${tag} selesai.`)
if (!APPLY) console.log("Jalankan ulang dengan --apply untuk menerapkan.")

await p.$disconnect()
