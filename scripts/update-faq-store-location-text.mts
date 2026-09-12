/**
 * MENULIS, idempoten. Memperbarui satu jawaban FAQ yang menyebut nama cabang.
 *
 * Kenapa perlu skrip sendiri: `src/lib/constants/policy-content.ts` hanya dipakai
 * saat `prisma db seed`. Mengubah konstantanya tidak menyentuh baris yang sudah
 * telanjur ada di database — dan menjalankan ulang seed bukan pilihan, karena
 * blok FAQ di sana melakukan `deleteMany()` lalu `createMany()`, yang berarti
 * seluruh suntingan staff atas FAQ lain ikut terhapus.
 *
 * Aman dijalankan berkali-kali: pencocokannya lewat pertanyaan, dan kalau
 * jawabannya sudah sesuai ia tidak menulis apa pun.
 */
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

import { PrismaClient } from "@prisma/client"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"

const base = (process.env.DATABASE_URL ?? "")
  .replace(/^['"]|['"]$/g, "")
  .replace(/^mysql:\/\//, "mariadb://")
const sep = base.includes("?") ? "&" : "?"
const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(`${base}${sep}connectionLimit=2&acquireTimeout=30000`, {
    useTextProtocol: true,
  }),
})

const PERTANYAAN = "Di mana lokasi toko dan jam operasionalnya?"
const JAWABAN_BARU =
  "Lihat alamat lengkap, jam operasional, dan peta seluruh cabang kami di halaman Toko Fisik."

const baris = await prisma.faqItem.findMany({
  where: { question: PERTANYAAN },
  select: { id: true, answer: true },
})

if (baris.length === 0) {
  console.log(`Tidak ada baris FAQ dengan pertanyaan "${PERTANYAAN}".`)
  console.log("Tidak ada yang diubah — mungkin FAQ belum pernah di-seed.")
} else {
  let diubah = 0
  for (const b of baris) {
    if (b.answer === JAWABAN_BARU) {
      console.log(`  #${b.id} sudah sesuai, dilewati.`)
      continue
    }
    console.log(`  #${b.id} sebelum : ${b.answer}`)
    await prisma.faqItem.update({ where: { id: b.id }, data: { answer: JAWABAN_BARU } })
    console.log(`  #${b.id} sesudah : ${JAWABAN_BARU}`)
    diubah++
  }
  console.log(`\n${diubah} baris diperbarui dari ${baris.length} yang cocok.`)
}

await prisma.$disconnect()
