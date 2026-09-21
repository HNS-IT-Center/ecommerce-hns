/**
 * Menyalin isi database PRODUKSI ke database LOKAL di Docker — tanpa data
 * pribadi siapa pun.
 *
 * Pakai:
 *   npm run db:tarik-produksi                 # dump + impor ke lokal
 *   npm run db:tarik-produksi -- --dump-saja
 *   npm run db:tarik-produksi -- --impor docker/dumps/produksi-xxxx.sql
 *
 * TIGA HAL YANG MENJAGA SKRIP INI TIDAK MERUSAK APA PUN:
 *
 * 1. Ke produksi ia hanya MEMBACA (`mariadb-dump`), tidak pernah menulis.
 * 2. Sasaran impor wajib 127.0.0.1/localhost. Kalau `DATABASE_URL` menunjuk
 *    host lain — mis. lupa belum ditukar ke lokal — skrip berhenti sebelum
 *    mengirim satu baris pun. Impor berarti DROP TABLE lalu isi ulang; salah
 *    sasaran sekali saja berarti katalog produksi terhapus.
 * 3. Tabel berisi data pribadi ikut STRUKTURNYA saja, tanpa satu baris pun.
 *
 * Kenapa tanpa data pribadi: `users` (sejak Satu Login juga menampung
 * pelanggan), `customers`, dan `pc_build_submissions` memuat nama, email, nomor
 * WhatsApp, serta hash password orang sungguhan. Menyalinnya ke laptop berarti
 * menggandakan data pribadi ke tempat yang tidak pernah dijanjikan kepada
 * pemiliknya, dan tanpa jalur penghapusan — kalau pelanggan menghapus akunnya
 * (CLAUDE.md §2.8), salinan di sini tidak ikut hilang. Untuk menguji katalog,
 * harga, dan rakitan PC, data itu memang tidak dibutuhkan; akun admin lokal
 * dibuat sendiri lewat `scripts/create-admin-user.mts`.
 */
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

import { spawn, spawnSync } from "node:child_process"
import { createWriteStream, existsSync, mkdirSync, statSync } from "node:fs"
import { resolve } from "node:path"

const COMPOSE = ["compose", "-f", "docker-compose.dev.yml"]
const LAYANAN = "mariadb"
const FOLDER_DUMP = "docker/dumps"

/**
 * Tabel yang disalin STRUKTURNYA saja.
 *
 * `customer_verification_tokens` dan `saved_pc_builds` ikut dikosongkan bukan
 * karena isinya pribadi, melainkan karena keduanya menunjuk ke `users` lewat
 * foreign key: menyalin anaknya tanpa induknya menghasilkan baris yatim.
 */
const TABEL_TANPA_BARIS = [
  "users",
  "customers",
  "customer_verification_tokens",
  "saved_pc_builds",
  "customer_deletion_logs",
  "pc_build_submissions",
] as const

type Koneksi = {
  host: string
  port: string
  user: string
  password: string
  database: string
}

function uraikanUrl(nilai: string, namaVariabel: string): Koneksi {
  const bersih = nilai.replace(/^['"]|['"]$/g, "").replace(/^mysql:\/\//, "mariadb://")
  let url: URL
  try {
    url = new URL(bersih)
  } catch {
    throw new Error(`${namaVariabel} bukan URL yang sah.`)
  }
  const database = url.pathname.slice(1)
  if (!database) throw new Error(`${namaVariabel} tidak menyebut nama database.`)
  return {
    host: url.hostname,
    port: url.port || "3306",
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
  }
}

function jalankanDocker(argumen: string[], opsi: { diam?: boolean } = {}) {
  const hasil = spawnSync("docker", argumen, {
    stdio: opsi.diam ? ["ignore", "pipe", "pipe"] : "inherit",
    encoding: "utf8",
  })
  if (hasil.error) {
    throw new Error(
      `Perintah \`docker\` tidak bisa dijalankan. Docker Desktop sudah menyala? (${hasil.error.message})`
    )
  }
  return hasil
}

function pastikanContainerSiap() {
  const hasil = jalankanDocker([...COMPOSE, "exec", "-T", LAYANAN, "healthcheck.sh", "--connect"], {
    diam: true,
  })
  if (hasil.status !== 0) {
    throw new Error(
      "Container database lokal belum siap. Jalankan `npm run db:up` dulu, lalu tunggu statusnya healthy (`npm run db:status`)."
    )
  }
}

/** Menjalankan mariadb-dump DI DALAM container, menembak host produksi. */
function dump(
  sumber: Koneksi,
  argumenTambahan: string[],
  /**
   * Daftar tabel, yang WAJIB berada SESUDAH nama database di baris perintah —
   * `mariadb-dump [opsi] <database> [tabel...]`. Menaruhnya sebelum nama
   * database membuat klien membaca tabel pertama sebagai nama database, dan
   * error yang muncul menyesatkan: "Access denied ... to database 'users'",
   * seolah izinnya yang kurang.
   */
  tabel: string[],
  tujuanBerkas: string,
  tambahkan: boolean
): Promise<void> {
  return new Promise((selesai, gagal) => {
    const berkas = createWriteStream(tujuanBerkas, { flags: tambahkan ? "a" : "w" })
    const anak = spawn(
      "docker",
      [
        ...COMPOSE,
        "exec",
        "-T",
        // Password lewat env, bukan `-p<sandi>`: argumen baris perintah di dalam
        // container terbaca lewat `ps` oleh proses lain di container yang sama.
        "-e",
        `MYSQL_PWD=${sumber.password}`,
        LAYANAN,
        "mariadb-dump",
        `--host=${sumber.host}`,
        `--port=${sumber.port}`,
        `--user=${sumber.user}`,
        // Membaca konsisten tanpa mengunci tabel — produksi tetap melayani
        // pengunjung selama dump berjalan.
        "--single-transaction",
        "--quick",
        "--skip-lock-tables",
        // User Hostinger tidak punya PROCESS privilege; tanpa ini dump berhenti
        // dengan "Access denied ... PROCESS privilege(s)".
        "--no-tablespaces",
        "--default-character-set=utf8mb4",
        ...argumenTambahan,
        sumber.database,
        ...tabel,
      ],
      { stdio: ["ignore", "pipe", "inherit"] }
    )
    anak.stdout.pipe(berkas)
    anak.on("error", gagal)
    anak.on("close", (kode) => {
      berkas.end()
      if (kode === 0) selesai()
      else gagal(new Error(`mariadb-dump keluar dengan kode ${kode}.`))
    })
  })
}

function impor(tujuan: Koneksi, berkasDiContainer: string) {
  // `SOURCE` dijalankan dari dalam container supaya berkas dump tidak melewati
  // stdin Windows, yang bisa mengubah akhir baris dan merusak isinya.
  const hasil = jalankanDocker([
    ...COMPOSE,
    "exec",
    "-T",
    "-e",
    `MYSQL_PWD=${tujuan.password}`,
    LAYANAN,
    "mariadb",
    `--user=${tujuan.user}`,
    "--default-character-set=utf8mb4",
    "--execute",
    `SET FOREIGN_KEY_CHECKS=0; SET NAMES utf8mb4; USE \`${tujuan.database}\`; SOURCE ${berkasDiContainer};`,
  ])
  if (hasil.status !== 0) throw new Error("Impor ke database lokal gagal — lihat pesan di atas.")
}

function hitungBaris(tujuan: Koneksi, tabel: string): string {
  const hasil = jalankanDocker(
    [
      ...COMPOSE,
      "exec",
      "-T",
      "-e",
      `MYSQL_PWD=${tujuan.password}`,
      LAYANAN,
      "mariadb",
      `--user=${tujuan.user}`,
      "--batch",
      "--skip-column-names",
      `--database=${tujuan.database}`,
      "--execute",
      `SELECT COUNT(*) FROM \`${tabel}\``,
    ],
    { diam: true }
  )
  return hasil.status === 0 ? (hasil.stdout ?? "").trim() : "?"
}

async function main() {
  const argv = process.argv.slice(2)
  const dumpSaja = argv.includes("--dump-saja")
  const posisiImpor = argv.indexOf("--impor")
  const berkasImporSiapPakai = posisiImpor === -1 ? null : argv[posisiImpor + 1]

  const tujuanMentah = process.env.DATABASE_URL
  if (!tujuanMentah) throw new Error("DATABASE_URL belum diisi di .env.local.")
  const tujuan = uraikanUrl(tujuanMentah, "DATABASE_URL")

  if (!["127.0.0.1", "localhost", "::1"].includes(tujuan.host)) {
    throw new Error(
      `PENJAGA KESELAMATAN: DATABASE_URL menunjuk ke "${tujuan.host}", bukan database lokal.\n` +
        "Skrip ini menimpa seluruh tabel di sasarannya. Tukar DATABASE_URL ke\n" +
        "mysql://hns:hns@127.0.0.1:3307/ecommerce_hns dulu (lihat docs/16-database-lokal-docker.md)."
    )
  }

  pastikanContainerSiap()

  let berkas: string
  let berkasDiContainer: string

  if (berkasImporSiapPakai) {
    berkas = resolve(berkasImporSiapPakai)
    if (!existsSync(berkas)) throw new Error(`Berkas tidak ditemukan: ${berkas}`)
    berkasDiContainer = `/dumps/${berkas.split(/[\\/]/).pop()}`
  } else {
    const sumberMentah = process.env.PROD_DATABASE_URL
    if (!sumberMentah) {
      throw new Error(
        "PROD_DATABASE_URL belum ada di .env.local. Isinya URL database produksi\n" +
          "(nilai yang dulu dipakai DATABASE_URL). Skrip ini hanya MEMBACA darinya."
      )
    }
    const sumber = uraikanUrl(sumberMentah, "PROD_DATABASE_URL")

    mkdirSync(FOLDER_DUMP, { recursive: true })
    const cap = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")
    const namaBerkas = `produksi-${cap}.sql`
    berkas = resolve(FOLDER_DUMP, namaBerkas)
    berkasDiContainer = `/dumps/${namaBerkas}`

    const abaikan = TABEL_TANPA_BARIS.map((t) => `--ignore-table=${sumber.database}.${t}`)

    console.log(`\n[1/3] Menarik data dari produksi (${sumber.host}) — tanpa tabel data pribadi…`)
    console.log(`      Dikosongkan: ${TABEL_TANPA_BARIS.join(", ")}`)
    await dump(sumber, abaikan, [], berkas, false)

    console.log("[2/3] Menarik STRUKTUR tabel data pribadi (tanpa baris)…")
    await dump(sumber, ["--no-data"], [...TABEL_TANPA_BARIS], berkas, true)

    const ukuranMb = (statSync(berkas).size / 1024 / 1024).toFixed(1)
    console.log(`      Dump tersimpan: ${FOLDER_DUMP}/${namaBerkas} (${ukuranMb} MB)`)
  }

  if (dumpSaja) {
    console.log("\nSelesai (--dump-saja). Impor belum dijalankan.")
    return
  }

  console.log(`[3/3] Mengimpor ke lokal (${tujuan.host}:${tujuan.port}/${tujuan.database})…`)
  impor(tujuan, berkasDiContainer)

  console.log("\nSelesai. Isi database lokal:")
  for (const tabel of ["products", "categories", "brands", "product_images", "users"]) {
    console.log(`  ${tabel.padEnd(16)} ${hitungBaris(tujuan, tabel)} baris`)
  }
  console.log(
    "\n`users` memang 0 — itu yang diinginkan. Buat akun admin lokal:\n" +
      "  npx tsx scripts/create-admin-user.mts admin@lokal.test Admin --username admin"
  )
}

main().catch((galat: unknown) => {
  console.error(`\nGAGAL: ${galat instanceof Error ? galat.message : String(galat)}`)
  process.exit(1)
})
