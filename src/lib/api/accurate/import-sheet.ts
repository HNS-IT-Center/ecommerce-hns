import "server-only"

import { getPrisma } from "@/lib/prisma/client"
import { env } from "@/config/env"

/**
 * Impor data barang Accurate dari Google Sheet (CSV publish) ke tabel
 * `accurate_products` di ecommerce_hns.
 *
 * PENTING — Sheet ini TIDAK memuat harga. Kolomnya hanya data barang + stok:
 *   NO, KODE ACCURATE, NAMA BARANG, UPC/BARCODE, NAMA KATEGORI, NAMA BRAND,
 *   STATUS, STOK
 * Harga (SP/CP/PRICE) diisi manual oleh role harga di admin, BUKAN dari sini.
 *
 * Karena itu impor ini UPSERT yang sengaja tidak menyentuh kolom harga:
 * - Kode sudah ada  → UPDATE nama/kategori/brand/status/stok/barcode saja.
 *   Kolom `SP`, `CP`, `PRICE` DIBIARKAN — isian role harga tidak boleh hilang
 *   tiap impor (permintaan eksplisit: "tanpa merusak harga lain").
 * - Kode baru       → INSERT baris baru; harga NULL (menunggu diisi role harga).
 *
 * Pemetaan (pairing) kode Accurate ↔ produk web ada di `accurate_woo_mapping`
 * dan TIDAK disentuh impor ini — kode yang sudah ter-pairing tetap ter-pairing.
 */

export class SheetUrlNotSetError extends Error {
  constructor() {
    super("URL Google Sheet belum diatur — isi GOOGLE_SHEET_CSV_URL di .env.local")
    this.name = "SheetUrlNotSetError"
  }
}

export function isSheetConfigured(): boolean {
  return Boolean(env.GOOGLE_SHEET_CSV_URL)
}

export type ImportResult = {
  totalBaris: number
  baru: number
  diperbarui: number
  dilewati: number
  errorContoh: string[]
}

/** Satu baris Sheet setelah dipetakan ke kolom accurate_products. */
type BarangSheet = {
  kode: string
  nama: string | null
  barcode: string | null
  kategori: string | null
  brand: string | null
  status: string | null
  stok: number | null
}

/**
 * Pecah satu baris CSV menghormati tanda kutip. Sheet Google memakai `"` untuk
 * membungkus sel yang memuat koma, dan `""` untuk kutip literal. Parser naif
 * `split(",")` akan merusak nama produk yang memuat koma.
 */
function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ",") {
      out.push(cur)
      cur = ""
    } else {
      cur += c
    }
  }
  out.push(cur)
  return out
}

/** Normalkan header ("NAMA KATEGORI" → "namakategori") untuk pencocokan longgar. */
function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[^a-z0-9]/g, "")
}

/**
 * Ambil CSV dari Sheet dan petakan tiap baris. Melempar `SheetUrlNotSetError`
 * kalau URL belum diatur, dan Error biasa kalau fetch/format gagal.
 */
async function ambilBarangDariSheet(): Promise<BarangSheet[]> {
  if (!env.GOOGLE_SHEET_CSV_URL) throw new SheetUrlNotSetError()

  const res = await fetch(env.GOOGLE_SHEET_CSV_URL, {
    // Selalu tarik yang terbaru; jangan pakai cache Next.
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) {
    throw new Error(`Gagal mengambil Sheet (HTTP ${res.status}). Cek URL & akses publik.`)
  }
  const teks = await res.text()
  const baris = teks.split(/\r?\n/).filter((l) => l.trim() !== "")
  if (baris.length < 2) throw new Error("Sheet kosong atau tanpa data.")

  const header = splitCsvLine(baris[0]).map(normHeader)
  const idx = {
    kode: header.indexOf("kodeaccurate"),
    nama: header.indexOf("namabarang"),
    barcode: header.findIndex((h) => h === "upcbarcode" || h === "barcode"),
    kategori: header.indexOf("namakategori"),
    brand: header.indexOf("namabrand"),
    status: header.indexOf("status"),
    stok: header.indexOf("stok"),
  }
  if (idx.kode === -1) {
    throw new Error("Kolom 'KODE ACCURATE' tidak ditemukan di Sheet.")
  }

  const ambil = (cols: string[], i: number): string | null =>
    i === -1 ? null : (cols[i]?.trim() || null)

  const hasil: BarangSheet[] = []
  for (let r = 1; r < baris.length; r++) {
    const cols = splitCsvLine(baris[r])
    const kode = ambil(cols, idx.kode)
    if (!kode) continue // baris tanpa kode dilewati
    const stokRaw = ambil(cols, idx.stok)
    hasil.push({
      kode,
      nama: ambil(cols, idx.nama),
      barcode: ambil(cols, idx.barcode),
      kategori: ambil(cols, idx.kategori),
      brand: ambil(cols, idx.brand),
      status: ambil(cols, idx.status),
      stok: stokRaw === null ? null : Number(stokRaw.replace(/[^\d.-]/g, "")) || 0,
    })
  }
  return hasil
}

/** Berapa baris di-upsert per satu query batch. */
const BATCH = 200

/**
 * Jalankan impor: baca Sheet, upsert ke accurate_products TANPA menyentuh harga.
 * READ dari Sheet, WRITE hanya kolom data barang.
 *
 * Dilakukan per-BATCH dengan satu `INSERT ... ON DUPLICATE KEY UPDATE` per
 * batch, bukan satu query per baris: 6000+ round-trip berurutan ke Hostinger
 * menembus batas waktu koneksi (terbukti putus di ~2 menit). `ON DUPLICATE KEY`
 * mengandalkan `Kode Accurate` sebagai PRIMARY KEY, dan HANYA menyebut kolom
 * data barang di klausa UPDATE — kolom harga (SP/CP/PRICE) tidak ikut, jadi
 * isian role harga tidak pernah tertimpa.
 */
export async function importDariSheet(): Promise<ImportResult> {
  const barang = await ambilBarangDariSheet()
  const prisma = getPrisma()

  // Hitung baru vs diperbarui dari selisih dengan kode yang sudah ada.
  const adaRows = await prisma.$queryRawUnsafe<Array<{ k: string }>>(
    "SELECT `Kode Accurate` AS k FROM accurate_products",
  )
  const sudahAda = new Set(adaRows.map((r) => r.k))

  const hasil: ImportResult = {
    totalBaris: barang.length,
    baru: 0,
    diperbarui: 0,
    dilewati: 0,
    errorContoh: [],
  }

  // Sheet bisa memuat kode ganda; simpan yang terakhir menang, sekaligus
  // menghindari dua baris dengan PK sama dalam satu batch.
  const unik = new Map<string, BarangSheet>()
  for (const b of barang) unik.set(b.kode, b)
  const daftar = [...unik.values()]

  for (let i = 0; i < daftar.length; i += BATCH) {
    const chunk = daftar.slice(i, i + BATCH)
    const placeholders = chunk.map(() => "(?, ?, ?, ?, ?, ?, ?)").join(", ")
    const params: Array<string | number | null> = []
    for (const b of chunk) {
      params.push(b.kode, b.nama, b.barcode, b.kategori, b.brand, b.status, b.stok)
    }
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO accurate_products
           (\`Kode Accurate\`, \`NAMA BARANG\`, \`barcode_ean\`, \`KATEGORI\`,
            \`NAMA BRAND\`, \`STATUS\`, \`Stok Sistem\`)
         VALUES ${placeholders}
         ON DUPLICATE KEY UPDATE
           \`NAMA BARANG\` = VALUES(\`NAMA BARANG\`),
           \`barcode_ean\` = VALUES(\`barcode_ean\`),
           \`KATEGORI\`    = VALUES(\`KATEGORI\`),
           \`NAMA BRAND\`  = VALUES(\`NAMA BRAND\`),
           \`STATUS\`      = VALUES(\`STATUS\`),
           \`Stok Sistem\` = VALUES(\`Stok Sistem\`)`,
        ...params,
      )
      for (const b of chunk) {
        if (sudahAda.has(b.kode)) hasil.diperbarui++
        else hasil.baru++
      }
    } catch (e) {
      hasil.dilewati += chunk.length
      if (hasil.errorContoh.length < 5) {
        hasil.errorContoh.push(
          `batch ${i / BATCH + 1}: ${e instanceof Error ? e.message.slice(0, 90) : "error"}`,
        )
      }
    }
  }

  return hasil
}
