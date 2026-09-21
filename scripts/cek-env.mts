/**
 * Memeriksa bahwa setiap variabel environment yang DIPAKAI KODE benar-benar
 * terdaftar di dua tempat: `.env.example` (acuan lokal) dan
 * `.env.production.example` (daftar periksa hPanel).
 *
 * Pakai:
 *   npm run env:cek
 *
 * KENAPA ADA: variabel baru lahir bersama fitur baru, dan yang mengisinya
 * pertama kali adalah `.env.local` di laptop orang yang menulis fitur itu —
 * di sana fiturnya langsung jalan, jadi tidak ada yang mengingatkan bahwa
 * produksi belum punya nilainya. Kegagalannya baru muncul di server, sering
 * diam-diam: `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` dipakai sejak peta toko
 * dibuat, tidak pernah masuk berkas contoh mana pun, dan peta produksi turun
 * ke mode tanpa pin terverifikasi tanpa satu pun error muncul.
 *
 * Berkas contoh tidak memuat nilai rahasia — hanya nama variabel dan nilai
 * yang memang publik. Itu sebabnya pemeriksaan ini aman dijalankan di CI
 * tanpa secret apa pun.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs"
import { join, extname } from "node:path"

const BERKAS_LOKAL = ".env.example"
const BERKAS_PRODUKSI = ".env.production.example"
const BERKAS_NYATA = ".env.local"

/**
 * Variabel yang disediakan platform (Node, Next, hPanel, GitHub Actions), bukan
 * oleh kita. Tidak pernah ditulis di berkas contoh, jadi jangan dituntut ada.
 */
const DISEDIAKAN_PLATFORM = new Set([
  "NODE_ENV",
  "CI",
  "PORT",
  "HOSTNAME",
  "BUILD_TIME",
  "GIT_COMMIT_SHA",
  "VERCEL_GIT_COMMIT_SHA",
  "RENDER_GIT_COMMIT",
  "SOURCE_VERSION",
])

type KunciBerkas = {
  /** Semua kunci yang disebut, baik aktif maupun dikomentari. */
  semua: Set<string>
  /** Kunci yang barisnya TIDAK dikomentari — artinya wajib diisi. */
  aktif: Set<string>
}

function bacaKunciEnv(berkas: string): KunciBerkas {
  const semua = new Set<string>()
  const aktif = new Set<string>()
  if (!existsSync(berkas)) return { semua, aktif }

  for (const baris of readFileSync(berkas, "utf8").split("\n")) {
    // `=` wajib menempel pada namanya. Tanpa syarat itu, kalimat di dalam
    // komentar — "# KOSONG = TIDAK ADA MASTER" — ikut terbaca sebagai variabel.
    const cocok = baris.match(/^\s*(#\s*)?([A-Z][A-Z0-9_]*)=/)
    if (!cocok) continue
    const [, dikomentari, kunci] = cocok
    semua.add(kunci)
    if (!dikomentari) aktif.add(kunci)
  }
  return { semua, aktif }
}

function berkasTs(dir: string, hasil: string[] = []): string[] {
  for (const nama of readdirSync(dir)) {
    const jalur = join(dir, nama)
    if (statSync(jalur).isDirectory()) {
      berkasTs(jalur, hasil)
    } else if ([".ts", ".tsx", ".mts", ".mjs"].includes(extname(nama))) {
      hasil.push(jalur)
    }
  }
  return hasil
}

/**
 * Kunci yang benar-benar dibaca kode, beserta tempat pertama ia muncul.
 *
 * `src/` dan `scripts/` dipisah dan diperlakukan berbeda: yang dibaca aplikasi
 * wajib ada di daftar produksi, sedangkan yang cuma dipakai perkakas
 * pengembangan (mis. `PROD_DATABASE_URL` milik skrip tarik data) justru TIDAK
 * boleh dipasang di hPanel.
 */
function kunciDipakaiKode(akar: string[]): Map<string, string> {
  const ditemukan = new Map<string, string>()
  for (const berkas of akar.flatMap((d) => (existsSync(d) ? berkasTs(d) : []))) {
    const isi = readFileSync(berkas, "utf8")
    for (const cocok of isi.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) {
      const kunci = cocok[1]
      if (DISEDIAKAN_PLATFORM.has(kunci)) continue
      if (!ditemukan.has(kunci)) ditemukan.set(kunci, berkas.replace(/\\/g, "/"))
    }
  }
  return ditemukan
}

function cetakDaftar(judul: string, baris: string[]) {
  if (baris.length === 0) return
  console.log(`\n${judul}`)
  for (const b of baris) console.log(`  ${b}`)
}

const dipakai = kunciDipakaiKode(["src"])
const dipakaiPerkakas = kunciDipakaiKode(["scripts", "prisma"])
const lokal = bacaKunciEnv(BERKAS_LOKAL)
const produksi = bacaKunciEnv(BERKAS_PRODUKSI)
const nyata = bacaKunciEnv(BERKAS_NYATA)

const galat: string[] = []
const peringatan: string[] = []

// 1 & 2 — kunci yang dipakai kode wajib terdaftar di kedua berkas contoh.
for (const [kunci, berkas] of [...dipakai].sort()) {
  if (!lokal.semua.has(kunci)) {
    galat.push(`${kunci} — dipakai ${berkas}, tidak ada di ${BERKAS_LOKAL}`)
  }
  if (!produksi.semua.has(kunci)) {
    galat.push(`${kunci} — dipakai ${berkas}, tidak ada di ${BERKAS_PRODUKSI}`)
  }
}

// 2b — kunci milik perkakas pengembangan cukup (dan hanya boleh) ada di acuan
// lokal. Mewajibkannya di produksi berarti menyuruh orang mengisi nilai yang
// tidak pernah dibaca server.
for (const [kunci, berkas] of [...dipakaiPerkakas].sort()) {
  if (dipakai.has(kunci)) continue
  if (!lokal.semua.has(kunci)) {
    galat.push(`${kunci} — dipakai ${berkas}, tidak ada di ${BERKAS_LOKAL}`)
  }
  if (produksi.aktif.has(kunci)) {
    galat.push(`${kunci} — cuma dipakai perkakas lokal, tapi diwajibkan di ${BERKAS_PRODUKSI}`)
  }
}

// 3 — daftar produksi tidak boleh mewajibkan variabel yang sudah tidak dipakai.
// Daftar yang memuat barang mati membuat orang mengisi nilai yang tidak
// berguna, dan lama-lama daftarnya berhenti dipercaya.
for (const kunci of [...produksi.aktif].sort()) {
  if (!dipakai.has(kunci)) {
    galat.push(`${kunci} — diwajibkan di ${BERKAS_PRODUKSI}, tapi tidak dipakai kode aplikasi`)
  }
}

// 4 — peringatan: tercatat di acuan lokal tapi belum ada kodenya (mis. rencana
// fase berikutnya). Bukan kesalahan, tapi perlu terlihat supaya daftarnya tidak
// pelan-pelan jadi museum.
for (const kunci of [...lokal.semua].sort()) {
  if (!dipakai.has(kunci) && !dipakaiPerkakas.has(kunci) && !DISEDIAKAN_PLATFORM.has(kunci)) {
    peringatan.push(`${kunci} — ada di ${BERKAS_LOKAL}, belum dipakai kode`)
  }
}

// 5 — peringatan: variabel yang wajib di produksi tapi kosong di laptop ini.
// Artinya fitur itu tidak bisa diuji lokal sebelum tayang.
if (existsSync(BERKAS_NYATA)) {
  for (const kunci of [...produksi.aktif].sort()) {
    if (!nyata.aktif.has(kunci)) {
      peringatan.push(`${kunci} — wajib di produksi, belum terisi di ${BERKAS_NYATA}`)
    }
  }
}

console.log(`Dipakai kode aplikasi (src/)      : ${dipakai.size}`)
console.log(`Dipakai perkakas (scripts/, prisma/): ${dipakaiPerkakas.size}`)
console.log(`Terdaftar di ${BERKAS_LOKAL}          : ${lokal.semua.size}`)
console.log(`Terdaftar di ${BERKAS_PRODUKSI}: ${produksi.semua.size} (wajib: ${produksi.aktif.size})`)

cetakDaftar("PERINGATAN (tidak menggagalkan):", peringatan)
cetakDaftar("GAGAL:", galat)

if (galat.length > 0) {
  console.error(
    `\n${galat.length} masalah. Tambahkan variabelnya di ${BERKAS_LOKAL} DAN ${BERKAS_PRODUKSI},\n` +
      "lalu isi nilainya di hPanel (Node.js app → Environment variables) sebelum fiturnya tayang."
  )
  process.exit(1)
}

console.log("\nBeres — setiap variabel yang dipakai kode sudah terdaftar di kedua berkas.")
