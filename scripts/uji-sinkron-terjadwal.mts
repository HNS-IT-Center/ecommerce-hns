/**
 * Verifikasi sinkron stok terjadwal — `POST /api/cron/sinkron-stok` (docs/13 §10).
 *
 * Memanggil HANDLER ROUTE yang sungguhan (bukan salinan logikanya), MEMBACA API
 * Data Accurate yang sungguhan, dan MENULIS hanya ke database lokal — skrip
 * menolak jalan kalau DATABASE_URL bukan 127.0.0.1/localhost. Baris riwayat
 * sinkron yang dibuatnya dihapus lagi; stok produk lokal dibiarkan tersinkron
 * (memang itu keadaan yang benar).
 *
 *   npx tsx --tsconfig scripts/tsconfig.uji-next.json --conditions=react-server \
 *     scripts/uji-sinkron-terjadwal.mts
 *
 * Env dibaca SEKALI saat modul dimuat (`config/env.ts`), jadi keadaan "API mati"
 * dan "CRON_SECRET kosong" diuji di proses anak tersendiri — skrip ini
 * memanggil dirinya sendiri dengan argumen `gagal` dan `tanpa-secret`.
 */
import { spawnSync } from "node:child_process"
import { config } from "dotenv"

config({ path: ".env.local", quiet: true })

if (!/127\.0\.0\.1|localhost/.test(process.env.DATABASE_URL ?? "")) {
  console.error("DATABASE_URL bukan database lokal — skrip tulis ini dibatalkan.")
  process.exit(1)
}

const MODE = process.argv[2] ?? "utama"
const TOKEN = "zz-test-cron-secret-0123456789abcdef"
if (MODE === "tanpa-secret") delete process.env.CRON_SECRET
else process.env.CRON_SECRET = TOKEN
// Port tertutup di mesin sendiri: sambungan ditolak seketika, seperti API yang mati.
// (Bukan port rendah seperti 9 — `fetch` menolaknya sebagai "bad port" sebelum
// mencoba tersambung, dan itu bukan keadaan yang ingin diuji.)
if (MODE === "gagal") process.env.HNS_API_URL = "http://127.0.0.1:59999/api/v1"

const { POST } = await import("../src/app/api/cron/sinkron-stok/route")
const { getPrisma } = await import("../src/lib/prisma/client")
const prisma = getPrisma()

let gagal = 0
function cek(nama: string, benar: boolean, detail: unknown = "") {
  if (!benar) gagal++
  console.log(`${benar ? "LOLOS" : "GAGAL"}  [${MODE}] ${nama}${benar ? "" : `  — ${JSON.stringify(detail)}`}`)
}

function panggil(authorization?: string) {
  return POST(
    new Request("http://localhost/api/cron/sinkron-stok", {
      method: "POST",
      headers: authorization ? { authorization } : {},
    }),
  )
}

const idAwal = (await prisma.accurateSyncRun.aggregate({ _max: { id: true } }))._max.id ?? 0
const runBaru = () =>
  prisma.accurateSyncRun.findMany({ where: { id: { gt: idAwal } }, orderBy: { id: "asc" } })
const bersihkan = () => prisma.accurateSyncRun.deleteMany({ where: { id: { gt: idAwal } } })

try {
  if (MODE === "utama") {
    const tanpaHeader = await panggil()
    cek("tanpa header ditolak 401", tanpaHeader.status === 401, tanpaHeader.status)

    const salah = await panggil(`Bearer ${TOKEN.replace(/.$/, "X")}`)
    cek("token salah (panjang sama) ditolak 401", salah.status === 401, salah.status)

    const pendek = await panggil("Bearer zz")
    cek("token salah (panjang beda) ditolak 401", pendek.status === 401, pendek.status)

    const tanpaBearer = await panggil(TOKEN)
    cek("token tanpa awalan Bearer ditolak 401", tanpaBearer.status === 401, tanpaBearer.status)
    cek("penolakan tidak menjalankan sinkron", (await runBaru()).length === 0, (await runBaru()).length)

    const t0 = Date.now()
    const sah = await panggil(`Bearer ${TOKEN}`)
    const isi = (await sah.json()) as { ok?: boolean; itemsReceived?: number; dilewati?: string }
    console.log(`INFO   sinkron terjadwal ${((Date.now() - t0) / 1000).toFixed(1)} dtk:`, JSON.stringify(isi))
    cek("token sah: 200", sah.status === 200, sah.status)
    cek("token sah: sinkron berjalan (bukan dilewati)", isi.ok === true && !isi.dilewati, isi)
    cek("token sah: barang diterima", (isi.itemsReceived ?? 0) > 0, isi.itemsReceived)

    const runs = await runBaru()
    cek("tepat satu baris riwayat", runs.length === 1, runs.length)
    const run = runs[0]
    cek("riwayat bertanda 'jadwal'", run?.trigger === "jadwal", run?.trigger)
    cek("riwayat tanpa nama staff", run?.userName === null, run?.userName)
    cek("riwayat selesai tanpa galat", run?.finishedAt !== null && run?.error === null, run?.error)

    const ulang = await panggil(`Bearer ${TOKEN}`)
    const isiUlang = (await ulang.json()) as { ok?: boolean; dilewati?: string }
    cek("panggilan ulang < 5 menit: 200", ulang.status === 200, ulang.status)
    cek("panggilan ulang < 5 menit: dilewati", typeof isiUlang.dilewati === "string", isiUlang)
    cek("panggilan ulang tidak menambah riwayat", (await runBaru()).length === 1, (await runBaru()).length)

    await bersihkan()

    // Proses anak: env berbeda butuh modul yang dimuat ulang.
    for (const anak of ["gagal", "tanpa-secret"]) {
      const r = spawnSync(
        `npx tsx --tsconfig scripts/tsconfig.uji-next.json --conditions=react-server scripts/uji-sinkron-terjadwal.mts ${anak}`,
        { stdio: "inherit", shell: true },
      )
      cek(`proses anak "${anak}" lolos`, r.status === 0, r.status)
    }
  }

  if (MODE === "gagal") {
    const res = await panggil(`Bearer ${TOKEN}`)
    const isi = (await res.json()) as { ok?: boolean; error?: string }
    cek("API mati: 500", res.status === 500, res.status)
    cek("API mati: ok=false dengan pesan", isi.ok === false && typeof isi.error === "string", isi)
    const runs = await runBaru()
    cek("API mati: TETAP tercatat satu baris riwayat", runs.length === 1, runs.length)
    cek("API mati: baris bertanda 'jadwal'", runs[0]?.trigger === "jadwal", runs[0]?.trigger)
    cek(
      "API mati: galatnya terbaca",
      runs[0]?.error?.startsWith("Gagal menarik data dari API Data Accurate") === true,
      runs[0]?.error,
    )
    cek("API mati: penyebabnya ikut tercatat", runs[0]?.error?.includes("ECONNREFUSED") === true, runs[0]?.error)
    console.log(`INFO   galat tercatat: ${runs[0]?.error}`)
    cek("API mati: 0 barang diterima", runs[0]?.itemsReceived === 0, runs[0]?.itemsReceived)
  }

  if (MODE === "tanpa-secret") {
    const res = await panggil(`Bearer ${TOKEN}`)
    cek("CRON_SECRET kosong: semua ditolak 401", res.status === 401, res.status)
    cek("CRON_SECRET kosong: pesannya jelas", (await res.text()).includes("belum dikonfigurasi"))
    cek("CRON_SECRET kosong: tidak menjalankan sinkron", (await runBaru()).length === 0)
  }
} finally {
  await bersihkan()
  await prisma.$disconnect()
}

if (MODE === "utama") console.log(gagal === 0 ? "\nSEMUA LOLOS" : `\n${gagal} GAGAL`)
process.exit(gagal > 0 ? 1 : 0)
