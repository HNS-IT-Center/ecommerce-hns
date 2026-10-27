/**
 * Verifikasi pengaturan mode footer (`lib/api/footer-mode.ts`, docs/05 §36).
 *
 *   npx tsx --tsconfig scripts/tsconfig.uji-next.json --conditions=react-server \
 *     scripts/uji-mode-footer.mts
 *
 * MENULIS hanya ke database lokal — berhenti kalau DATABASE_URL bukan
 * 127.0.0.1/localhost. Baris `settings.FOOTER_MODE` dikembalikan persis seperti
 * semula di `finally` (termasuk "tidak ada").
 */
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

if (!/127\.0\.0\.1|localhost/.test(process.env.DATABASE_URL ?? "")) {
  console.error("DATABASE_URL bukan database lokal — skrip tulis ini dibatalkan.")
  process.exit(1)
}

const { getPrisma } = await import("../src/lib/prisma/client")
const F = await import("../src/lib/api/footer-mode")
const prisma = getPrisma()

let gagal = 0
function cek(nama: string, dapat: unknown, harap: unknown) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harap)
  if (!ok) gagal++
  console.log(`${ok ? "LOLOS" : "GAGAL"}  ${nama}${ok ? "" : `  — dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)}`}`)
}

const semula = await prisma.setting.findUnique({ where: { key: F.FOOTER_MODE_SETTING_KEY } })
try {
  await prisma.setting.deleteMany({ where: { key: F.FOOTER_MODE_SETTING_KEY } })
  cek("baris belum ada → bawaan 'cabang'", await F.getFooterMode(), "cabang")

  await F.saveFooterMode("cabang")
  cek("simpan 'cabang' → terbaca 'cabang'", await F.getFooterMode(), "cabang")

  await F.saveFooterMode("identitas")
  cek("simpan 'identitas' → terbaca 'identitas'", await F.getFooterMode(), "identitas")
  cek("tetap satu baris (upsert, bukan tambah)", await prisma.setting.count({ where: { key: F.FOOTER_MODE_SETTING_KEY } }), 1)

  await prisma.setting.update({ where: { key: F.FOOTER_MODE_SETTING_KEY }, data: { value: { mode: "aneh" } } })
  cek("nilai asing → jatuh ke 'cabang'", await F.getFooterMode(), "cabang")

  cek("isFooterMode menolak nilai asing", [F.isFooterMode("cabang"), F.isFooterMode("identitas"), F.isFooterMode("x"), F.isFooterMode(null)], [true, true, false, false])
} finally {
  await prisma.setting.deleteMany({ where: { key: F.FOOTER_MODE_SETTING_KEY } })
  if (semula) {
    await prisma.setting.create({ data: { key: semula.key, value: semula.value ?? {} } })
  }
  await prisma.$disconnect()
}

console.log(gagal === 0 ? "\nSEMUA LOLOS" : `\n${gagal} GAGAL`)
process.exit(gagal > 0 ? 1 : 0)
