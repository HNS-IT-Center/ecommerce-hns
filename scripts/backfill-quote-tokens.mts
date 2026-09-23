/**
 * Mengisi `public_token` untuk quotation yang terbit SEBELUM tautan publik ada.
 *
 * Pakai:
 *   npx tsx scripts/backfill-quote-tokens.mts            # dry run
 *   npx tsx scripts/backfill-quote-tokens.mts --apply
 *
 * ## Kenapa tidak di dalam migrasi
 *
 * Nilainya harus ACAK per baris, dan acak yang sungguhan. Yang tersedia di SQL
 * adalah `RAND()`, yang bukan sumber acak kriptografis — dan yang dijaga token
 * ini adalah isi dokumen orang lain: nama pelanggan, rincian rakitan, nilai
 * transaksinya. Token yang bisa diperkirakan sama saja dengan tidak ada token.
 *
 * ## Kenapa boleh menyusul, bukan wajib bersamaan
 *
 * Kolomnya nullable dan setiap pembacanya sudah menangani NULL dengan
 * menyembunyikan tautannya — bukan dengan gagal. Quotation lama yang belum
 * kebagian token tetap bisa dibuka staff lewat `?kode=`, hanya belum bisa
 * dikirim sebagai tautan ke pelanggan.
 *
 * Idempoten: baris yang sudah punya token dilewati, jadi aman dijalankan ulang.
 * Tidak pernah menimpa token yang sudah beredar — menimpanya akan mematikan
 * tautan yang sudah terkirim di WhatsApp seseorang.
 *
 * Jalankan di database lokal Docker dulu (docs/16), baru produksi (docs/10).
 */
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

const APPLY = process.argv.includes("--apply")
const { getPrisma } = await import("../src/lib/prisma/client")
const { generatePublicToken } = await import("../src/lib/utils/public-token")

const p = getPrisma()
const tag = APPLY ? "[APPLY]" : "[DRY RUN]"

console.log(`${tag} isi public_token untuk quotation lama\n`)

const rows = await p.pcBuildQuote.findMany({
  where: { publicToken: null },
  select: { id: true, code: true },
  orderBy: { id: "asc" },
})

if (rows.length === 0) {
  console.log("Semua quotation sudah punya token. Tidak ada yang perlu diisi.")
  process.exit(0)
}

console.log(`${rows.length} quotation belum punya token.\n`)

let terisi = 0
let gagal = 0

for (const row of rows) {
  /**
   * Token dicoba ulang saat bentrok, alih-alih dibiarkan melempar.
   *
   * Ruang tebakannya 850 miliar, jadi tabrakan praktis tidak terjadi — tapi
   * skrip yang berhenti di tengah jalan meninggalkan sebagian baris terisi dan
   * sebagian tidak, dan yang menjalankannya tidak punya cara tahu sampai mana.
   */
  let sukses = false

  for (let percobaan = 0; percobaan < 5 && !sukses; percobaan++) {
    const token = generatePublicToken()

    if (!APPLY) {
      console.log(`  ${row.code} → /q/${token}`)
      sukses = true
      break
    }

    try {
      await p.pcBuildQuote.update({
        where: { id: row.id },
        data: { publicToken: token },
      })
      console.log(`  ${row.code} → /q/${token}`)
      sukses = true
    } catch {
      // Satu-satunya kegagalan yang pantas dicoba lagi adalah bentrok unique.
      // Yang lain akan gagal lagi dengan cara yang sama, dan dihitung di bawah.
    }
  }

  if (sukses) terisi += 1
  else {
    gagal += 1
    console.error(`  GAGAL: ${row.code} — tidak dapat token unik setelah 5 percobaan`)
  }
}

console.log(`\n${tag} selesai. ${terisi} terisi, ${gagal} gagal.`)
if (!APPLY) console.log("Jalankan ulang dengan --apply untuk benar-benar menyimpan.")

process.exit(gagal > 0 ? 1 : 0)
