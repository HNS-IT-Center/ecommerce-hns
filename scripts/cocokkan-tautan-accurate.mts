/**
 * Cocokkan SELURUH barang Accurate aktif yang belum tertaut dengan produk web.
 * BACA SAJA, dan hanya terhadap database LOKAL.
 *
 * Hasilnya USULAN untuk ditinjau manusia — docs/13 §5: mesin mengurutkan,
 * tidak pernah memilih. Skrip ini tidak menulis satu baris pun ke database.
 * Yang menulis tautan adalah `terapkan-usulan-tautan.mts`, dan hanya untuk
 * baris yang sudah disetujui.
 *
 * Bedanya dengan `auto-tautkan-ketat.mts` (5 Okt 2026), semuanya hasil
 * memeriksa kenapa 1.930 barang di sana jatuh ke "perlu ditinjau":
 *
 *  1. Katalog pembanding hanya produk yang BISA ditautkan — SIMPLE dan
 *     VARIATION. Produk induk VARIABLE ikut dihitung di skrip lama, padahal
 *     namanya mengulang nama variasinya; akibatnya hampir setiap kode model
 *     "dipakai produk lain" (induknya sendiri) dan gagal syarat keunikan.
 *  2. Atribut variasi (`product_attributes`: WARNA, SWITCH TYPE, …) ikut
 *     dibaca. Nama variasi sering mengulang daftar pilihan induknya
 *     ("NAVY BLUE / SKY BLUE - NAVY X SW RED"), jadi warna & switch sebuah
 *     variasi diambil dari nilai atributnya, bukan dari seluruh nama.
 *  3. Penulisan diseragamkan dulu: `MAG 32C6X` = `MAG32C6X`, `D4` = `DDR4`,
 *     `16 GB` = `16GB`, `RTX 4060TI` = `RTX 4060 TI`, `5 IN 1` = `5IN1`.
 *  4. Spesifikasi yang BERTENTANGAN menggugurkan pasangan: kapasitas, watt,
 *     Hz, MHz, GHz, inci, panjang kabel, mAh, DDR, warna, switch keyboard,
 *     tingkat CPU, versi, angka model, dan akhiran GPU/CPU (Ti, SUPER, XT,
 *     X3D, GRE). "Tidak disebut" di satu sisi bukan pertentangan — kecuali
 *     akhiran GPU/CPU, karena "RTX 4070" dan "RTX 4070 SUPER" barang berbeda.
 *  5. Diperiksa DUA ARAH: produk web itu juga tidak boleh menjadi pilihan
 *     barang Accurate lain (aktif, tertaut atau tidak).
 *  6. Kategori dipelajari dari tautan yang sudah ada — bukan dicocokkan
 *     sebagai teks (itu sudah diukur memperburuk, lihat pencocokan-nama.ts).
 *     Usulan yang mendarat di kategori web yang belum pernah terlihat untuk
 *     kategori Accurate itu diturunkan tingkatnya.
 *  7. (9 Okt) Warna Logitech disamakan dulu (GRAPHITE = BLACK, OFF WHITE /
 *     PALE GREY = WHITE, ROSE = PINK) — lihat samakanWarnaLogitech(). Pilihan
 *     tingkat C yang JENIS barangnya beda (keyboard lawan headset, jam tangan)
 *     dibuang; kalau tak bersisa, barangnya jatuh ke D — lihat jenisBeda().
 *
 * Akurasinya DIUKUR, bukan diklaim: tautan yang sudah ada (dibuat manusia)
 * dipakai sebagai kunci jawaban — dicocokkan ulang seolah belum tertaut, dan
 * sekali lagi dengan jawaban benarnya disembunyikan (apakah mesin memaksakan
 * pasangan lain ketika barangnya memang tidak ada di web?).
 *
 *   npx tsx --tsconfig scripts/tsconfig.uji.json scripts/cocokkan-tautan-accurate.mts
 *
 * Keluaran: backup/cocokkan-tautan/usulan.json (+ ringkasan.txt). `backup/`
 * di-gitignore — berkasnya hanya ada di laptop yang menjalankan. Env KELUAR=<folder>
 * mengalihkan keluaran, untuk mencoba aturan baru tanpa menimpa usulan.json.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"

for (const baris of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = baris.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (m) process.env[m[1]!] ??= m[2]!.trim().replace(/^["']|["']$/g, "")
}
const host = new URL((process.env.DATABASE_URL ?? "").replace(/^mysql:/, "http:")).hostname
if (host !== "127.0.0.1" && host !== "localhost") {
  console.error(`DATABASE_URL menunjuk ${host}, bukan database lokal — berhenti. Skrip ini hanya untuk lokal.`)
  process.exit(1)
}

const { getPrisma } = await import("../src/lib/prisma/client.ts")
const { bangunIndeks, peringkatKandidat, tokenNama, berkodeModel } = await import(
  "../src/lib/api/accurate/pencocokan-nama.ts"
)
const prisma = getPrisma()
const q = <T,>(sql: string) => prisma.$queryRawUnsafe<T[]>(sql)

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

type Barang = {
  id: number
  kode: string
  nama: string
  kategori: string | null
  brand: string | null
  status: string
  tipe: string
  stok: number
  diSheet: boolean
  tertautWoo: number | null
  /**
   * Kode yang menempel di produk induk VARIABLE — sisa sebelum produknya
   * dipecah jadi varian (gabung-varian-warna 29 Sep tidak memindahkan kodenya).
   * Induk tidak bisa ditautkan, jadi barang ini ikut antrean dan diusulkan
   * PINDAH ke variasinya. Isinya id internal induk.
   */
  diIndukId: number | null
  diIndukWoo: number | null
  diabaikan: boolean
}
type Produk = {
  id: number
  wooId: number
  tipe: string
  status: string
  statusInduk: string | null
  nama: string
  namaInduk: string | null
  varian: string
  sku: string | null
  kode: string | null
  brand: string | null
  parentId: number | null
  kategori: string | null
}

const barisBarang = await q<Record<string, unknown>>(`
  SELECT i.id, i.code AS kode, i.name AS nama, i.category_name AS kategori, i.brand_name AS brand,
         i.status, i.type AS tipe, CAST(i.stock_web AS DOUBLE) AS stok,
         (SELECT COUNT(*) FROM accurate_products ap WHERE ap.\`Kode Accurate\` = i.code) AS diSheet,
         p.woo_id AS tertautWoo, p.id AS tertautId, p.type AS tipeTertaut,
         (ig.kode_accurate IS NOT NULL) AS diabaikan
    FROM accurate_items i
    LEFT JOIN products p ON p.accurate_code = i.code
    LEFT JOIN accurate_ignored ig ON ig.kode_accurate = i.code`)
const semuaBarang: Barang[] = barisBarang.map((r) => {
  const diInduk = r.tertautWoo != null && String(r.tipeTertaut) === "VARIABLE"
  return {
  id: Number(r.id),
  kode: String(r.kode),
  nama: String(r.nama ?? ""),
  kategori: r.kategori == null ? null : String(r.kategori),
  brand: r.brand == null ? null : String(r.brand),
  status: String(r.status),
  tipe: String(r.tipe),
  stok: Number(r.stok ?? 0),
  diSheet: Number(r.diSheet) > 0,
  tertautWoo: r.tertautWoo == null || diInduk ? null : Number(r.tertautWoo),
  diIndukId: diInduk ? Number(r.tertautId) : null,
  diIndukWoo: diInduk ? Number(r.tertautWoo) : null,
  diabaikan: Number(r.diabaikan) > 0,
  }
})

const barisProduk = await q<Record<string, unknown>>(`
  SELECT p.id, p.woo_id AS wooId, p.type AS tipe, p.status, par.status AS statusInduk, p.name AS nama,
         par.name AS namaInduk, p.sku, p.accurate_code AS kode, COALESCE(b.name, bp.name) AS brand,
         p.parent_id AS parentId,
         (SELECT GROUP_CONCAT(CONCAT(a.name, '=', v.value) ORDER BY pa.position SEPARATOR ';;')
            FROM product_attributes pa
            JOIN attributes a ON a.id = pa.attribute_id
            JOIN attribute_values v ON v.id = pa.value_id
           WHERE pa.product_id = p.id) AS atributVarian
    FROM products p
    LEFT JOIN products par ON par.id = p.parent_id
    LEFT JOIN brands b ON b.id = p.brand_id
    LEFT JOIN brands bp ON bp.id = par.brand_id
   WHERE p.type IN ('SIMPLE', 'VARIATION') AND p.name IS NOT NULL AND p.name <> ''`)
const barisBrand = await q<{ name: string }>("SELECT name FROM brands")
const barisKategori = await q<Record<string, unknown>>(`
  SELECT pc.product_id AS pid, c.name, c.depth, pc.is_primary AS utama
    FROM product_categories pc JOIN categories c ON c.id = pc.category_id`)

// Kategori web satu produk: yang utama, kalau tidak ada yang paling dalam.
// Variasi tidak punya kategori sendiri — pakai milik induknya.
const kategoriPer = new Map<number, { nama: string; skor: number }>()
for (const r of barisKategori) {
  const pid = Number(r.pid)
  const skor = (Number(r.utama) ? 100 : 0) + Number(r.depth ?? 0)
  const lama = kategoriPer.get(pid)
  if (!lama || skor > lama.skor) kategoriPer.set(pid, { nama: String(r.name), skor })
}
const semuaProduk: Produk[] = barisProduk.map((r) => {
  const id = Number(r.id)
  const parentId = r.parentId == null ? null : Number(r.parentId)
  const tipe = String(r.tipe)
  // Atribut hanya bermakna sebagai pembeda pada VARIATION; pada SIMPLE ia
  // biasanya daftar spesifikasi yang sudah ada di nama.
  const varian =
    tipe === "VARIATION"
      ? String(r.atributVarian ?? "")
          .split(";;")
          .filter(Boolean)
          .map((s) => {
            const nama = s.slice(0, s.indexOf("="))
            const nilai = s.slice(s.indexOf("=") + 1)
            return /SWITCH/i.test(nama) && !/SWITCH/i.test(nilai) ? `SWITCH ${nilai}` : nilai
          })
          // Pemisah ";" supaya warna atribut satu tidak menempel ke "SWITCH"
          // atribut berikutnya ("BLUE WHITE SWITCH ..." terbaca switch WHITE).
          .join(" ; ")
      : ""
  return {
    id,
    wooId: Number(r.wooId),
    tipe,
    status: String(r.status),
    statusInduk: r.statusInduk == null ? null : String(r.statusInduk),
    nama: String(r.nama),
    namaInduk: r.namaInduk == null ? null : String(r.namaInduk),
    varian,
    sku: r.sku == null ? null : String(r.sku),
    kode: r.kode == null ? null : String(r.kode),
    brand: r.brand == null ? null : String(r.brand),
    parentId,
    kategori: kategoriPer.get(parentId ?? id)?.nama ?? kategoriPer.get(id)?.nama ?? null,
  }
})
const produkPerWoo = new Map(semuaProduk.map((p) => [p.wooId, p]))
const tayang = (p: Produk) => p.status === "PUBLISHED" && (p.tipe === "SIMPLE" || p.statusInduk === "PUBLISHED")

// ---------------------------------------------------------------------------
// Penyeragaman nama & atribut
// ---------------------------------------------------------------------------

function seragamkan(nama: string): string {
  return (
    nama
      .toUpperCase()
      .replace(/&AMP;/g, "&")
      .replace(/[″“”]/g, '"')
      .replace(/(\d),(\d)/g, "$1.$2")
      .replace(/(\d)\s*(?:"|INCHI?|INCH(?:ES)?)(?![A-Z0-9])/g, "$1INCH ")
      .replace(/(\d)\.(\d{3})(?=\s*(?:DPI|MAH))/g, "$1$2")
      .replace(/(\d)\s+(GB|TB|MB|W|WATT|HZ|MHZ|GHZ|MAH|MM|CM|M|MTR|METER|DPI|K)(?![A-Z0-9])/g, "$1$2")
      .replace(/(\d)WATT(?![A-Z0-9])/g, "$1W")
      .replace(/(\d)(?:MTR|METER)(?![A-Z0-9])/g, "$1M")
      .replace(/(\d)\s*IN\s*(\d)(?![A-Z0-9])/g, "$1IN$2")
      .replace(/\bLGA\s+(\d{3,4})\b/g, "LGA$1")
      .replace(/\bD([345])\b/g, "DDR$1")
      .replace(/\bDDR\s+([345])\b/g, "DDR$1")
      .replace(/\b([A-Z]+\d+)\.0\b/g, "$1")
      .replace(/\bV\.(\d)\b/g, "V$1")
      .replace(/\bCORE\s*I([3579])\b/g, "I$1")
      .replace(/\bCORE\s+ULTRA\s+([3579])\b/g, "ULTRA$1")
      .replace(/\bCORE\s+([3579])\b/g, "CORE$1")
      .replace(/\bULTRA\s+([3579])\b/g, "ULTRA$1")
      .replace(/\bRYZEN\s+AI\s+([3579])\b/g, "RAI$1")
      .replace(/\bRYZEN\s+([3579])\b/g, "R$1")
      .replace(/\bI([3579])-(\d{4,5}[A-Z]*)\b/g, "I$1 $2")
      .replace(/\bR([3579])-(\d{4}[A-Z]*)\b/g, "R$1 $2")
      // Akhiran GPU/CPU dipisah dari angkanya: 4060TI -> 4060 TI, 9900X3D -> 9900X X3D.
      .replace(/\b(\d{3,4})(TI|XTX|XT|GRE|SUPER)\b/g, "$1 $2")
      .replace(/\b(\d{3,4}X)3D\b/g, "$1 X3D")
      .replace(/\b(\d{3,4})X3D\b/g, "$1 X3D")
      .replace(/\bOFF[\s-]WHITE\b/g, "OFFWHITE")
      .replace(/\bABU[\s-]ABU\b/g, "ABU")
      .replace(/\bWI-FI\b/g, "WIFI")
      .replace(/\bTEN\s*KEYLESS\b/g, "TKL")
      .replace(/\bTRI[\s-]?COLOU?R\b/g, "TRICOLOR")
      .replace(/\b(?:MICRO[\s-]?ATX|M-ATX)\b/g, "MATX")
      .replace(/\b(?:MINI[\s-]?ITX|M-?ITX)\b/g, "ITX")
      .replace(/\bE-ATX\b/g, "EATX")
      .replace(/\bMIDDLE\s+TOWER\b/g, "MID TOWER")
      .replace(/\bT-FORCE\b/g, "TFORCE")
      .replace(/\bGEN\s+(III|II|IV)\b/g, "GEN$1")
      // Sinonim yang ditulis berbeda di dua sistem.
      .replace(/\bADAPTOR\b/g, "ADAPTER")
      .replace(/\bFLASH[\s-]?(?:DRIVE|DISK)\b/g, "FLASHDISK")
      .replace(/\bANTI[\s-]VIRUS\b/g, "ANTIVIRUS")
      .replace(/\bHEAD[\s-]SET\b/g, "HEADSET")
      .replace(/\bEAR[\s-]PHONES?\b/g, "EARPHONE")
      .replace(/\bONE[\s-]PIECE\b/g, "ONEPIECE")
      // Paket Office & Microsoft 365 bawaan laptop, ditulis belasan cara:
      // "OHM 2024" = "OHS 2024" = "OH24" = "OFFICE HOME 2024", "M365B" = "M365".
      // Satu token per versi, supaya tidak terbaca kode model ("OH24" lawan
      // "OHM2024" dulu jadi "kode nyaris sama") dan tahunnya tidak terbaca
      // tahun model. Versinya tetap dibandingkan lewat atribut `office`.
      .replace(/\bM365B\b/g, "M365")
      .replace(/\bOFFICE\s+HOME(?:\s*&\s*STUDENT)?\s+(?:20)?(2[0-9])\b/g, "OFFICE$1")
      .replace(/\bOH[SM]?\s*(?:20)?(2[0-9])\b/g, "OFFICE$1")
      .replace(/\bOFFICE\s+(?:20)?(2[14])\b/g, "OFFICE$1")
      .replace(/\bHOME\s+(?:20)?(2[14])\b/g, "HOME OFFICE$1")
      .replace(/\b(OFFICE2[0-9])\s+365\b/g, "$1 M365")
      // Resolusi layar satu token ("3440 × 1440" -> "3440X1440"), supaya angkanya
      // tidak terbaca sebagai kode model ("QHD 3440" -> QHD3440).
      .replace(/(\d{3,4})\s*[X×]\s*(\d{3,4})/g, "$1X$2")
      .replace(/\bCAT\s+(\d[A-Z]?)\b/g, "CAT$1")
  )
}

const WARNA: Record<string, string> = {
  BLACK: "BLACK", HITAM: "BLACK", WHITE: "WHITE", PUTIH: "WHITE", GREY: "GREY", GRAY: "GREY", ABU: "GREY",
  SILVER: "SILVER", GOLD: "GOLD", RED: "RED", MERAH: "RED", BLUE: "BLUE", BIRU: "BLUE", NAVY: "NAVY",
  GREEN: "GREEN", HIJAU: "GREEN", YELLOW: "YELLOW", KUNING: "YELLOW", PURPLE: "PURPLE", UNGU: "PURPLE",
  PINK: "PINK", ORANGE: "ORANGE", BROWN: "BROWN", COKLAT: "BROWN", BEIGE: "BEIGE", CREAM: "CREAM",
  MINT: "MINT", LAVENDER: "LAVENDER", OFFWHITE: "OFFWHITE", ROSE: "ROSE", TEAL: "TEAL", CYAN: "CYAN",
  LILAC: "LILAC", MAGENTA: "MAGENTA", TOSCA: "TOSCA", MAROON: "MAROON", GRAPHITE: "GRAPHITE",
  CHARCOAL: "CHARCOAL", SKY: "SKY",
  MATCHA: "MATCHA", PEACH: "PEACH", MOCHA: "MOCHA", IVORY: "IVORY", CORAL: "CORAL", OLIVE: "OLIVE",
  TRANSPARENT: "TRANSPARENT", MERCURY: "WHITE", QUARTZ: "PINK", TRICOLOR: "TRICOLOR",
  VIOLET: "VIOLET", MIDNIGHT: "MIDNIGHT", STARLIGHT: "STARLIGHT", SAND: "SAND", CHAMPAGNE: "CHAMPAGNE",
  BURGUNDY: "BURGUNDY", TURQUOISE: "TURQUOISE", LIME: "LIME",
}
// BRONZE/PLATINUM/TITANIUM dulu ikut di atas — padahal di nama PSU itu
// sertifikat 80+, bukan warna, sehingga "PSU ... BLACK" bertentangan dengan
// "PSU ... 80+ BRONZE". Sertifikat sekarang atribut tersendiri (`rating`).
/**
 * Warna satu token. Warna gabungan ("BLUEGREY", "BLACKBLUE") dipecah jadi
 * komponennya dan ditandai gabungan: ia sama dengan "BLUE GREY" yang ditulis
 * terpisah, tapi TIDAK sama dengan "BLUE" saja (lihat pertentangan()).
 */
function warnaDari(t: string): string[] | null {
  if (WARNA[t]) return [WARNA[t]!]
  for (let i = 3; i <= t.length - 3; i++) {
    const kiri = WARNA[t.slice(0, i)]
    const kanan = WARNA[t.slice(i)]
    if (kiri && kanan) return [kiri, kanan]
  }
  return null
}
/**
 * Logitech (aturan 9 Okt 2026): Accurate memakai nama warna pabrik, web
 * memakai nama umum — GRAPHITE = BLACK, OFF WHITE = WHITE, PALE GREY = WHITE,
 * ROSE = PINK ("TONAL" hanya keterangan). Tanpa ini PEBBLE 2 M350S
 * (Accurate TONAL GRAPHITE/ROSE/WHITE, web Black/Pink/White) gugur sebagai
 * "warna bertentangan" padahal pasangannya tiga lawan tiga.
 *
 * Dua sisi sama-sama disamakan, jadi web yang menulis "GRAPHITE" tetap cocok.
 * Model yang di Accurate punya BLACK dan GRAPHITE sekaligus (MK295, M325S)
 * menjadi kembar dan jatuh ke C lewat pemeriksaan dua arah — tidak dipaksakan.
 * GREY biasa tidak disentuh: M171 punya GREY dan OFF WHITE sebagai dua barang.
 */
function samakanWarnaLogitech(a: Atribut, teks: string): void {
  if (!a.warna.size) return
  const pucat = /\bPALE\s+GR[AE]Y\b/.test(teks)
  const PADANAN: Record<string, string> = { GRAPHITE: "BLACK", OFFWHITE: "WHITE", ROSE: "PINK" }
  a.warna = new Set([...a.warna].map((w) => (w === "GREY" && pucat ? "WHITE" : PADANAN[w] ?? w)))
}
const NAMA_SWITCH =
  "RED|BLUE|BROWN|YELLOW|SILVER|BLACK|WHITE|GREEN|PINK|PURPLE|ORANGE|CLEAR|CREAM|MILKY|JADE|BANANA|CRYSTAL|TARO|ROSIE|ROSE|MINT|LEMON|STRAWBERRY|MAGNETIC|OPTICAL"
const MODIF_LUNAK = new Set(["PRO", "MAX", "PLUS", "ULTRA", "MINI", "LITE", "SE", "AIR", "NANO", "II", "III", "IV"])

type KunciAtribut =
  | "kap" | "watt" | "hz" | "mhz" | "ghz" | "inci" | "panjang" | "mah" | "ddr" | "warna" | "sw" | "cpu" | "versi" | "angka" | "paket" | "modif"
  | "kemasan" | "kipas" | "mode" | "dpi" | "modular" | "nomor" | "faktor" | "tower" | "tahun" | "rating" | "rgb" | "warnaGabung"
  | "volt" | "amp" | "pin" | "dimm" | "office"
type Atribut = Record<KunciAtribut, Set<string>>
const kosong = (): Atribut => ({
  kap: new Set(), watt: new Set(), hz: new Set(), mhz: new Set(), ghz: new Set(), inci: new Set(), panjang: new Set(),
  mah: new Set(), ddr: new Set(), warna: new Set(), sw: new Set(), cpu: new Set(), versi: new Set(), angka: new Set(),
  paket: new Set(), modif: new Set(), kemasan: new Set(), kipas: new Set(), mode: new Set(), dpi: new Set(), modular: new Set(), nomor: new Set(), faktor: new Set(), tower: new Set(), tahun: new Set(), rating: new Set(), rgb: new Set(), warnaGabung: new Set(),
  volt: new Set(), amp: new Set(), pin: new Set(), dimm: new Set(), office: new Set(),
})

function atribut(seragam: string): Atribut {
  const a = kosong()
  let s = seragam
  // Switch keyboard dicabut lebih dulu supaya warnanya tidak terbaca sebagai warna bodi.
  // "BLUE (TARO)" = switch biru bernama Taro: dua-duanya dicatat, jadi Accurate
  // yang menulis "TARO SWITCH" tidak dianggap bertentangan dengan web "BLUE (TARO)".
  s = s.replace(new RegExp(`\\b(${NAMA_SWITCH})\\s*\\((${NAMA_SWITCH})\\)`, "g"), (_, w1: string, w2: string) => {
    a.sw.add(w1)
    a.sw.add(w2)
    return " "
  })
  const re = [
    new RegExp(`\\b(?:SW|SWITCH(?:ES)?)\\s*[-:]?\\s*(${NAMA_SWITCH})\\b`, "g"),
    new RegExp(`\\b(${NAMA_SWITCH})\\s*(?:SW|SWITCH(?:ES)?)\\b`, "g"),
    new RegExp(`\\b(${NAMA_SWITCH})\\s*\\((?:CLICKY|TACTILE|LINEAR)\\)`, "g"),
  ]
  for (const r of re) s = s.replace(r, (_, w: string) => (a.sw.add(w), " "))
  // "NON RGB" lawan "RGB": kata RGB muncul di keduanya, jadi dibaca sebagai atribut.
  if (/\bNON[\s-]?A?RGB\b/.test(s)) a.rgb.add("TIDAK")
  else if (/\bA?RGB\b/.test(s)) a.rgb.add("YA")
  // Sertifikat PSU dicabut sebelum warna dibaca.
  s = s.replace(/\b80\s*(?:\+|PLUS)\s*(BRONZE|SILVER|GOLD|PLATINUM|TITANIUM|WHITE|STANDARD)\b/g, (_, r: string) => {
    a.rating.add(r)
    return " "
  })
  // Akhiran GPU/CPU hanya bermakna tepat di belakang angka model ("4070 TI SUPER",
  // "9070 XT", "9800X X3D") — "SSD VENOMRX SUPER VRX" bukan GPU SUPER.
  for (const m of s.matchAll(/\b\d{3,5}[A-Z]?((?:\s+(?:TI|SUPER|XTX|XT|GRE|X3D))+)\b/g)) {
    for (const t of m[1]!.trim().split(/\s+/)) a.modif.add(t)
  }

  for (const m of s.matchAll(/(?<![A-Z0-9.X])(\d+(?:\.\d+)?)(GB|TB)(?![A-Z0-9])/g)) {
    const gb = Number(m[1]) * (m[2] === "TB" ? 1000 : 1)
    a.kap.add(String(gb === 1024 ? 1000 : gb))
  }
  for (const m of s.matchAll(/(?<![A-Z0-9.])(\d{2,4})W(?![A-Z0-9])/g)) a.watt.add(m[1]!)
  for (const m of s.matchAll(/(?<![A-Z0-9.])(\d{2,3})HZ(?![A-Z0-9])/g)) a.hz.add(m[1]!)
  for (const m of s.matchAll(/(?<![A-Z0-9.])(\d{3,4})MHZ(?![A-Z0-9])/g)) a.mhz.add(m[1]!)
  for (const m of s.matchAll(/(?<![A-Z0-9.])(\d(?:\.\d+)?)GHZ(?![A-Z0-9])/g)) a.ghz.add(String(Number(m[1])))
  for (const m of s.matchAll(/(?<![A-Z0-9.])(\d{1,2}(?:\.\d)?)INCH/g)) a.inci.add(String(Number(m[1])))
  for (const m of s.matchAll(/(?<![A-Z0-9.X])(\d+(?:\.\d+)?)(M|CM)(?![A-Z0-9])/g)) {
    const meter = Number(m[1]) / (m[2] === "CM" ? 100 : 1)
    if (meter > 0 && meter <= 100) a.panjang.add(String(meter))
  }
  for (const m of s.matchAll(/(?<![A-Z0-9.])(\d{3,5})MAH(?![A-Z0-9])/g)) a.mah.add(m[1]!)
  for (const m of s.matchAll(/\bDDR([345])\b/g)) a.ddr.add(m[1]!)
  for (const m of s.matchAll(/\b(I[3579]|R[3579]|CORE[3579]|ULTRA[579]|RAI[3579])\b/g)) a.cpu.add(m[1]!)
  // "V1-V4" = rentang versi 1 sampai 4 (VGA Colorful NB DUO V1-V4), bukan dua versi.
  s = s.replace(/\bV(\d)\s*-\s*V(\d)\b/g, (_, p: string, q: string) => {
    for (let v = Number(p); v <= Number(q); v++) a.versi.add(String(v))
    return " "
  })
  for (const m of s.matchAll(/\bV(\d{1,2})\b/g)) a.versi.add(m[1]!)
  // Listrik & konektor adaptor laptop: 19V, 3.42A, pin 4.0*1.35MM.
  for (const m of s.matchAll(/(?<![A-Z0-9.])(\d{1,2}(?:\.\d{1,2})?)\s*V(?![A-Z0-9])/g)) a.volt.add(String(Number(m[1])))
  for (const m of s.matchAll(/(?<![A-Z0-9.])(\d{1,2}(?:\.\d{1,2})?)\s*A(?![A-Z0-9])/g)) a.amp.add(String(Number(m[1])))
  for (const m of s.matchAll(/(\d\.\d{1,2})\s*[*X]\s*(\d\.\d{1,2})\s*MM\b/g)) a.pin.add(`${Number(m[1])}x${Number(m[2])}`)
  // RAM laptop lawan RAM PC.
  if (/\bRAM\b|\bDDR\d\b/.test(s)) {
    if (/\bSODIMM\b|\bRAM\s+NB\b|\bNOTEBOOK\b/.test(s)) a.dimm.add("SODIMM")
    else if (/\bLONGDIMM\b|\bRAM\s+PC\b|\bDESKTOP\b/.test(s)) a.dimm.add("LONGDIMM")
  }
  for (const m of s.matchAll(/\b(\d)IN(\d)\b/g)) a.paket.add(`${m[1]}IN${m[2]}`)
  // Prosesor: TRAY lawan BOX, dan ada/tidaknya kipas. TRAY tanpa menyebut
  // kipas berarti tanpa kipas — begitu Accurate menamai ("MPK (TRAY+FAN)").
  if (/\b(?:PROCESSOR|PROSESOR|CPU)\b/.test(s)) {
    if (/\bTRAY\b/.test(s)) a.kemasan.add("TRAY")
    if (/\bBOX\b/.test(s)) a.kemasan.add("BOX")
    if (/\bWITH\s+(?:FAN|COOLER)\b|\+\s*FAN\b|\bWRAITH\b/.test(s)) a.kipas.add("FAN")
    else if (/\bCPU\s+ONLY\b|\bNO\s+FAN\b|\bWITHOUT\s+FAN\b/.test(s) || a.kemasan.has("TRAY")) a.kipas.add("NOFAN")
  }
  for (const m of s.matchAll(/(?<![A-Z0-9.])(\d{3,5})DPI(?![A-Z0-9])/g)) a.dpi.add(m[1]!)
  for (const m of s.matchAll(/\bOFFICE(2\d)\b/g)) a.office.add(m[1]!)
  for (const m of s.matchAll(/\b(MINI|MID|FULL|MICRO)[\s-]?TOWER\b/g)) a.tower.add(m[1]!)
  // Nomor generasi di belakang nama seri: "FLIP 7", "VIVOBOOK 14", "MIRAGE 5".
  for (const m of s.matchAll(/\b([A-Z]{3,})\s+(\d{1,2})(?![\d.A-Z])/g)) {
    if (!WARNA[m[1]!] && !KATA_HENTI.has(m[1]!)) a.nomor.add(`${m[1]}:${m[2]}`)
  }
  for (const m of s.matchAll(/\b(NON|SEMI|FULL)[\s-]?MODULAR\b/g)) a.modular.add(m[1]!)
  for (const m of s.matchAll(/\b(DUAL|TRI|[2-4])[\s-]?MODES?\b/g)) a.mode.add(m[1] === "DUAL" ? "2" : m[1] === "TRI" ? "3" : m[1]!)
  for (const t of s.split(/[^A-Z0-9]+/)) {
    const w = warnaDari(t)
    if (w) {
      for (const c of w) a.warna.add(c)
      if (w.length > 1) a.warnaGabung.add(t)
    }
    if (/^(?:EATX|MATX|ITX|ATX)$/.test(t)) a.faktor.add(t)
    if (/^20(?:1[5-9]|2\d|3[0-5])$/.test(t)) a.tahun.add(t)
    if (/^\d{3,5}$/.test(t)) {
      const n = Number(t)
      if (!(n >= 2010 && n <= 2035)) a.angka.add(t)
    }
  }
  return a
}

/**
 * Pertentangan = tiap sisi menyebut nilai yang tidak disebut sisi lain.
 * Pengecualian: akhiran keras (Ti/SUPER/XT/X3D) — disebut di satu sisi saja
 * sudah berarti barang lain. Angka model hanya dibandingkan sesama panjang.
 */
function pertentangan(x: Atribut, y: Atribut): string[] {
  const hasil: string[] = []
  for (const k of Object.keys(x) as KunciAtribut[]) {
    const a = x[k]
    const b = y[k]
    const hanyaA = [...a].filter((v) => !b.has(v))
    const hanyaB = [...b].filter((v) => !a.has(v))
    if (k === "modif") {
      if (hanyaA.length || hanyaB.length) hasil.push(`akhiran ${[...hanyaA, ...hanyaB].join("/")} hanya di satu sisi`)
      continue
    }
    // Versi Office bawaan laptop tidak menggugurkan — putuskan() mencatatnya.
    if (k === "warnaGabung" || k === "office") continue
    if (a.size === 0 || b.size === 0) continue
    if (k === "warna" && (x.warnaGabung.size || y.warnaGabung.size)) {
      // Ada warna gabungan: komponen kedua sisi harus sama persis.
      if (hanyaA.length || hanyaB.length) hasil.push(`warna ${[...a].join("/")} ≠ ${[...b].join("/")}`)
      continue
    }
    if (k === "nomor") {
      // Hanya bertentangan kalau nama seri yang SAMA diberi nomor berbeda.
      const beda = hanyaA.filter((v) => hanyaB.some((w) => w.split(":")[0] === v.split(":")[0]))
      if (beda.length) hasil.push(`nomor seri ${beda.join("/")} ≠ ${hanyaB.join("/")}`)
      continue
    }
    if (k === "inci") {
      // Ukuran layar dibulatkan berbeda di dua sistem (32 lawan 31.5): selisih
      // sampai 0.6 inci dianggap sama.
      const beda = hanyaA.filter((p) => ![...b].some((r) => Math.abs(Number(p) - Number(r)) <= 0.6))
      if (beda.length && hanyaB.some((r) => ![...a].some((p) => Math.abs(Number(p) - Number(r)) <= 0.6))) {
        hasil.push(`inci ${hanyaA.join("/")} ≠ ${hanyaB.join("/")}`)
      }
      continue
    }
    if (k === "angka") {
      if (hanyaA.some((p) => hanyaB.some((r) => r.length === p.length))) hasil.push(`angka model ${hanyaA.join("/")} ≠ ${hanyaB.join("/")}`)
      continue
    }
    if (hanyaA.length > 0 && hanyaB.length > 0) hasil.push(`${k} ${hanyaA.join("/")} ≠ ${hanyaB.join("/")}`)
  }
  return hasil
}

/** Token berangka yang hanya keterangan spesifikasi umum, bukan identitas model. */
const GENERIK =
  /^(?:DDR\d|LPDDR\d+X?|GDDR\d+X?|USB\d*(?:\.\d)?[A-Z]?|GEN\d+(?:X\d)?|GEN(?:II|III|IV)|LGA\d+|AM\d|FM\d|M\.2|PCIE\d(?:\.\d)?|WIFI\d+E?|BT\d(?:\.\d)?|\d+K|\d+P|HDMI\d(?:\.\d)?|DP\d(?:\.\d)?|RJ\d+|CAT\d+[A-Z]?|WIN\d+|W1[01]|\d+(?:\.\d+)?(?:GB|TB|MB|W|HZ|MHZ|GHZ|INCH|M|CM|MM|MAH|DPI|PORTS?|V|A|MBPS|GBPS|KG|ML|PCS|IN\d|TH|ND|RD|ST|CORE|CORES|THREAD|THREADS|FPS|DB|KHZ|RPM|CFM|LUX|ANSI|LM|NM)|\d+X\d+(?:GB|TB|MM|CM|M)?|I[3579]|R[3579]|CORE[3579]|ULTRA[579]|RAI[3579]|V\d{1,2}|[A-Z]\d|\d+%|TYPE-?C|80\+?|\d+IN\d|OFFICE\d{2}|M365)$/

type Bentuk = {
  brand: Set<string>
  kataBrand: Set<string>
  unit: string[]
  identitas: Identitas[]
  bentuk: Set<string>
  gabungan: string[]
  kata: Set<string>
  atribut: Atribut
  ringkas: string
}

type Identitas = { t: string; i: number; opsional: boolean; bagian?: [string, string] }
const CPU_TINGKAT = /^(?:I[3579]|R[3579]|RAI[3579]|CORE[3579]|ULTRA[579])$/

/**
 * Pecah nama jadi unit pembanding. Tanda hubung: bagian 1 huruf ditempel ke
 * tetangganya (`H510M-B` -> `H510MB`), jadi B dan F tetap membedakan.
 * `bentuk` = semua unit + gabungan dua unit bersebelahan, supaya
 * `MAG 32C6X` dan `MAG32C6X` saling mengenali.
 *
 * Identitas = token huruf+angka yang bukan spesifikasi umum, ditambah angka
 * model yang berdiri di belakang awalan huruf (`RTX 4070` -> `RTX4070`) atau
 * tingkat CPU (`R5 5600` -> `5600`). Token bernomor-part — berawalan atau
 * berakhiran deretan kode panjang seperti `CA-1Y4-00M6WN-00`, `910-007375`,
 * `SDCZ550-064G-G46` — ditandai OPSIONAL: kalau web menuliskannya ia bukti
 * kuat, kalau tidak, ketiadaannya tidak menggugurkan.
 */
function bentuk(nama: string, atributTeks?: string, brand?: string | null): Bentuk {
  const s = seragamkan(nama)
  const kasar = s.replace(/[^A-Z0-9.\-]+/g, " ").split(/\s+/).map((t) => t.replace(/^[.\-]+|[.\-]+$/g, "")).filter(Boolean)
  const unit: string[] = []
  const nomorPart = new Set<number>()
  for (const t of kasar) {
    if (!t.includes("-")) {
      unit.push(t)
      continue
    }
    const bagian = t.split("-").filter(Boolean)
    // Huruf-angka seperti STK-01, LC-462, RX-106: satu kode, bukan dua kata.
    if (bagian.length === 2 && /^[A-Z]{1,5}$/.test(bagian[0]!) && /^\d{2,6}[A-Z]{0,3}$/.test(bagian[1]!)) {
      unit.push(bagian[0]! + bagian[1]!)
      continue
    }
    const panjangPart = bagian.length >= 3 || /^\d{3}-\d{6}$/.test(t) || bagian.some((b) => b.length >= 6 && /\d/.test(b) && /^[0-9A-Z]+$/.test(b) && /^\d/.test(b))
    const gabung: string[] = []
    for (let i = 0; i < bagian.length; i++) {
      const b = bagian[i]!
      if (b.length === 1) {
        if (gabung.length > 0) gabung[gabung.length - 1] += b
        else if (i + 1 < bagian.length && bagian[i + 1]!.length <= 4) bagian[i + 1] = b + bagian[i + 1]!
      } else gabung.push(b)
    }
    for (const g of gabung) {
      if (panjangPart) nomorPart.add(unit.length)
      unit.push(g)
    }
  }
  const himpunan = new Set<string>(unit)
  const gabungan: string[] = []
  for (let i = 0; i + 1 < unit.length; i++) gabungan.push(unit[i]! + unit[i + 1]!)
  for (const t of kasar) if (t.includes("-")) gabungan.push(t.replace(/-/g, ""))
  for (const g of gabungan) himpunan.add(g)

  const identitas: Bentuk["identitas"] = []
  unit.forEach((t, i) => {
    const sebelum = unit[i - 1]
    if (t.length >= 3 && berkodeModel(t) && !GENERIK.test(t)) {
      // Nomor part panjang tanpa tanda hubung (CMH64GX5M2B6000C38,
      // KF436C17BB2AK2) jarang ditulis di nama web: bukti kuat kalau ada,
      // tidak menggugurkan kalau tidak.
      const partPanjang = t.length >= 10 && (t.match(/\d/g)?.length ?? 0) >= 3 && (t.match(/[A-Z]/g)?.length ?? 0) >= 3
      identitas.push({ t, i, opsional: nomorPart.has(i) || partPanjang })
    } else if (/^\d{3,5}$/.test(t) && sebelum) {
      // "ASUS 100-240V": angka itu awal rentang tegangan, bukan nomor model.
      const sesudah = unit[i + 1]
      if (sesudah && /^\d+(?:\.\d+)?(?:V|W|A|HZ|MAH)$/.test(sesudah)) return
      if (/^[A-Z]{2,5}$/.test(sebelum) && !WARNA[sebelum] && sebelum !== "NEW") {
        const gabung = sebelum + t
        himpunan.add(gabung)
        identitas.push({ t: gabung, i, opsional: nomorPart.has(i), bagian: [sebelum, t] })
      } else if (CPU_TINGKAT.test(sebelum)) {
        identitas.push({ t, i, opsional: false })
      } else if (t.length >= 5) {
        identitas.push({ t, i, opsional: nomorPart.has(i) })
      }
    } else if (/^\d{5,6}$/.test(t)) {
      // Nomor produk murni (UGREEN 15728, 35998): identitas tersendiri.
      identitas.push({ t, i, opsional: nomorPart.has(i) })
    }
  })
  const kata = new Set(tokenNama(s + " " + (atributTeks ?? "")))
  const atr = atribut(s)
  if (atributTeks) {
    // Variasi: warna, switch, kapasitas dan pembeda lain dari nilai atribut
    // variasinya, karena namanya sering memuat SEMUA pilihan induk.
    const v = atribut(seragamkan(atributTeks))
    for (const k of ["warna", "sw", "kap", "watt", "inci", "panjang", "paket"] as const) if (v[k].size > 0) atr[k] = v[k]
    if (v.warna.size > 0) atr.warnaGabung = v.warnaGabung
    const tv = tokenNama(seragamkan(atributTeks))
    for (const t of tv) himpunan.add(t)
  }
  const merek = brandDi(s, brand ?? null)
  // Nama Accurate kadang tanpa merek ("NEW KEYBOARD POP KEYS 920-010579 ...") —
  // nomor part Logitech (910-/920-/960-/981-xxxxxx) ikut jadi tanda.
  if (merek.brand.has("LOGITECH") || /\b9[1-8]\d-\d{6}\b/.test(s)) samakanWarnaLogitech(atr, `${s} ${atributTeks ? seragamkan(atributTeks) : ""}`)
  return {
    brand: merek.brand,
    kataBrand: merek.kata,
    unit,
    identitas,
    bentuk: himpunan,
    gabungan,
    kata,
    atribut: atr,
    ringkas: s.replace(/[^A-Z0-9]/g, ""),
  }
}

/**
 * Kata ada di nama lain — persis, atau ditulis sambung/pisah ("ANTI VIRUS" =
 * "ANTIVIRUS", "SUPER LIGHT" = "SUPERLIGHT").
 */
function kataAda(x: Bentuk, t: string, y: Bentuk): boolean {
  if (y.kata.has(t) || y.bentuk.has(t)) return true
  return x.unit.some(
    (u, i) => u === t && ((i > 0 && y.bentuk.has(x.unit[i - 1]! + t)) || (i + 1 < x.unit.length && y.bentuk.has(t + x.unit[i + 1]!))),
  )
}

function adaDi(x: Bentuk, idx: Identitas, y: Bentuk): boolean {
  if (y.bentuk.has(idx.t)) return true
  if (idx.bagian && y.bentuk.has(idx.bagian[1]) && (y.kata.has(idx.bagian[0]) || y.bentuk.has(idx.bagian[0]))) return true
  const kiri = x.unit[idx.i - 1]
  const kanan = x.unit[idx.i + 1]
  if (kiri && y.bentuk.has(kiri + idx.t)) return true
  if (kanan && y.bentuk.has(idx.t + kanan)) return true
  return false
}

/** Kode yang hampir sama tapi beda di ujung — `R745K6G` vs `R745K6M`. */
function nyarisSama(a: string, b: string): boolean {
  if (a === b || a.length < 5 || b.length < 5) return false
  let awal = 0
  while (awal < a.length && awal < b.length && a[awal] === b[awal]) awal++
  let akhir = 0
  while (akhir < a.length - awal && akhir < b.length - awal && a[a.length - 1 - akhir] === b[b.length - 1 - akhir]) akhir++
  return awal + akhir >= Math.min(a.length, b.length) - 2 && awal + akhir >= 4
}

const ringkasBrand = (b: string | null) => (b ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "")

/**
 * Brand yang disebut di sebuah nama, dikanonkan lewat alias (ROG = ASUS,
 * AORUS = GIGABYTE, XPG = ADATA, T-FORCE = TEAMGROUP, …). Merek platform
 * (AMD, INTEL, NVIDIA) hanya dipakai kalau tidak ada merek pembuat — VGA
 * "SPARKLE INTEL ARC" dan "ASROCK INTEL ARC" tetap dua barang berbeda.
 */
const ALIAS_BRAND: Record<string, string> = {
  ROG: "ASUS", AORUS: "GIGABYTE", XPG: "ADATA", TEAMFORCE: "TEAMGROUP", TFORCE: "TEAMGROUP", TEAMGROUP: "TEAMGROUP",
  TEAM: "TEAMGROUP", COOLERMASTER: "COOLERMASTER", GSKILL: "GSKILL", WESTERNDIGITAL: "WD", LEXAGAMING: "LEXA",
  NEXTLEVELRACING: "NEXTLEVELRACING", NEXLLEVELRACING: "NEXTLEVELRACING", HYPERX: "KINGSTON", RYZEN: "AMD",
  RADEON: "AMD", GEFORCE: "NVIDIA", ARMAGGEDDON: "AEROCOOL", ARMAGGEDON: "AEROCOOL", PLAYSTATION: "SONY",
  PREDATOR: "ACER", IGAME: "COLORFUL", LIANLI: "LIANLI", TPLINK: "TPLINK", MOZARACING: "MOZA", MOZA: "MOZA",
}
const MEREK_PLATFORM = new Set(["AMD", "INTEL", "NVIDIA", "MICROSOFT"])
const kanonBrand = new Map<string, string>()
for (const r of barisBrand) {
  const k = ringkasBrand(r.name)
  if (k.length >= 2) kanonBrand.set(k, ALIAS_BRAND[k] ?? k)
}
for (const [k, v] of Object.entries(ALIAS_BRAND)) kanonBrand.set(k, v)
/** Brand di sebuah nama, plus kata-kata yang membentuknya ("TEAM GROUP" -> TEAM, GROUP). */
function brandDi(seragam: string, tambahan: string | null): { brand: Set<string>; kata: Set<string> } {
  const t = seragam.split(/[^A-Z0-9]+/).filter(Boolean)
  const hasil = new Set<string>()
  const kata = new Set<string>()
  for (let i = 0; i < t.length; i++) {
    for (let n = 1; n <= 3 && i + n <= t.length; n++) {
      const k = kanonBrand.get(t.slice(i, i + n).join(""))
      if (k && !(n === 1 && t[i]!.length < 2)) {
        hasil.add(k)
        for (const w of t.slice(i, i + n)) kata.add(w)
      }
    }
  }
  const kt = tambahan ? kanonBrand.get(ringkasBrand(tambahan)) : undefined
  if (kt) hasil.add(kt)
  const pembuat = [...hasil].filter((b) => !MEREK_PLATFORM.has(b))
  return { brand: new Set(pembuat.length ? pembuat : hasil), kata }
}
const KATA_HENTI = new Set(["NEW", "AND", "WITH", "FOR", "THE", "DAN", "ED", "EDITION", "SERIES", "VERSION", "BOX", "ORI", "ORIGINAL", "GARANSI", "RESMI", "OFFICIAL", "TRAY", "BUNDLE", "PAKET",
  // Keterangan warna Logitech ("TONAL GRAPHITE", "PALE GREY") — bukan nama seri. Tanpa PALE
  // di sini, PALE GREY yang di web ditulis WHITE (MX ANYWHERE 3S, MX KEYS S) gugur karena
  // "kata PALE tidak ada di web". Harganya: MX BRIO PALE GREY turun B -> C (masih benar).
  "TONAL", "PALE"])

// ---------------------------------------------------------------------------
// Indeks
// ---------------------------------------------------------------------------

const namaCocok = (p: Produk) => (p.varian ? `${p.nama} ${p.varian}` : p.nama)
const bentukProduk = semuaProduk.map((p) => bentuk(p.nama, p.varian || undefined, p.brand))
const katalog = bangunIndeks(
  semuaProduk.map((p, i) => ({ wooId: i, nama: `${seragamkan(namaCocok(p))} ${bentukProduk[i]!.gabungan.join(" ")}` })),
)
const idf = (t: string) => {
  const df = katalog.df.get(t) ?? 0
  return df === 0 ? 0 : Math.log(katalog.total / (1 + df))
}

const bentukBarang = new Map<number, Bentuk>()
for (const b of semuaBarang) bentukBarang.set(b.id, bentuk(b.nama, undefined, b.brand))

/**
 * Per kode panjang: "sidik" barang Accurate aktif yang memuatnya — kode
 * identitas wajib SELAIN kode itu, plus tingkat CPU dan kapasitas. Nomor part
 * sungguhan hanya punya satu sidik (warna lain dari barang yang sama tidak
 * mengubahnya). Kode konfigurasi ASUS seperti VIPS7151M / FHD3821M dipakai
 * ulang di model berbeda (M1405YA Ryzen 7 dan A1404VA Core i7), jadi punya
 * beberapa sidik dan BUKAN nomor part.
 */
const sidikPart = new Map<string, Set<string>>()
for (const b of semuaBarang) {
  if (b.status !== "active") continue
  const x = bentukBarang.get(b.id)!
  for (const t of x.identitas) {
    if (t.t.length < 7) continue
    const sidik = [
      ...x.identitas.filter((u) => u.t !== t.t && !u.opsional).map((u) => u.t).sort(),
      `cpu:${[...x.atribut.cpu].sort().join("/")}`,
      `kap:${[...x.atribut.kap].sort().join("/")}`,
    ].join("|")
    sidikPart.set(t.t, (sidikPart.get(t.t) ?? new Set()).add(sidik))
  }
}

/**
 * Nomor part: kode panjang huruf+angka yang hanya dipegang SATU produk web
 * (atau variasi-variasi satu induk — nama variasi mengulang nama induknya),
 * dan di Accurate hanya menandai satu barang (lihat sidikPart). Di laptop
 * inilah identitas sebenarnya — "83UG0024ID", "8X3A2PA".
 */
function nomorPartUnik(t: string): boolean {
  if (t.length < 7 || GENERIK.test(t)) return false
  if ((t.match(/\d/g)?.length ?? 0) < 2 || (t.match(/[A-Z]/g)?.length ?? 0) < 2) return false
  if ((sidikPart.get(t)?.size ?? 0) > 1) return false
  const pemegang = katalog.indeks.get(t) ?? []
  if (pemegang.length === 0) return false
  return new Set(pemegang.map((i) => semuaProduk[i]!.parentId ?? -semuaProduk[i]!.id)).size === 1
}

// SKU -> produk. SKU boleh memuat beberapa kode ("kode1 / kode2").
const pecahSku = (sku: string | null) => (sku ?? "").split(/[\/,;|\s]+/).map((x) => x.trim()).filter(Boolean)
const produkPerSku = new Map<string, number[]>()
semuaProduk.forEach((p, i) => {
  for (const k of pecahSku(p.sku)) {
    const arr = produkPerSku.get(k)
    if (arr) arr.push(i)
    else produkPerSku.set(k, [i])
  }
})
const barangPerKode = new Map(semuaBarang.map((b) => [b.kode, b]))

type Pasangan = {
  idx: number
  sama: string[]
  partSama: string[]
  hilangDiWeb: string[]
  opsionalHilang: string[]
  lebihDiWeb: string[]
  nyaris: string[]
  konflik: string[]
  lengkapA: boolean
  lengkapW: boolean
  longgar: boolean
  skorKata: number
  kataHilang: string[]
  kataLebih: string[]
  umum: { seriA: string[]; hanyaW: string[] } | null
}

function nilai(b: Barang, idx: number): Pasangan {
  const x = bentukBarang.get(b.id)!
  const y = bentukProduk[idx]!
  const sama: string[] = []
  const hilangDiWeb: string[] = []
  const opsionalHilang: string[] = []
  for (const t of x.identitas) {
    if (adaDi(x, t, y)) sama.push(t.t)
    else if (t.opsional) opsionalHilang.push(t.t)
    else hilangDiWeb.push(t.t)
  }
  // Nomor part yang sama persis — bukti terkuat, terutama laptop. Nama web
  // laptop lazim memuat DUA nomor part sekaligus, satu per warna, tanpa varian
  // ("IDEAPAD 5 2IN1 83UG0024ID 83UG0025ID ..."); nomor part saudaranya (beda
  // di ujung) bukan "kode tambahan".
  const partSama = sama.filter(nomorPartUnik)
  const lebihDiWeb = y.identitas
    .filter((t) => !adaDi(y, t, x) && !partSama.some((p) => nyarisSama(p, t.t)))
    .map((t) => t.t)
  const nyaris =[...hilangDiWeb, ...opsionalHilang].filter((t) => y.identitas.some((u) => nyarisSama(t, u.t)))
  const konflik = pertentangan(x.atribut, y.atribut)
  if (nyaris.length) konflik.push(`kode nyaris sama tapi beda: ${nyaris.join(", ")}`)
  // Kode UMUM — chipset (B860, Z790), GPU (RTX 5060), atau kode yang dipakai
  // >= 4 produk web — tidak cukup sendirian: "B860 LIVEMIXER" dan "B860 STEEL
  // LEGEND" berbagi kode yang sama. Nama seri Accurate wajib ada di web.
  // Kata tambahan di sisi WEB ("STEREO", "LIMITED", "FROZTINE") hanya dinilai
  // di pilih(), bersama kandidat lain: ia baru membedakan kalau ada beberapa
  // produk sebrand dengan kode yang sama. Versi pertama aturan ini menolaknya
  // langsung, dan diukur 9 Okt 2026 menggugurkan pasangan sah seperti Logitech
  // H151 / H540 dan MSI RTX 5070 Ti Frieren.
  const kodeUmum = (t: string) =>
    /^[ABHQXZ]\d{3}[EIM]?$/.test(t) || /^(?:RTX|GTX|RX|ARC)\d{3,4}$/.test(t) || (katalog.df.get(t) ?? 0) >= 4
  let umum: Pasangan["umum"] = null
  if (sama.length > 0 && sama.every(kodeUmum)) {
    const seri = (z: Bentuk) =>
      [...z.kata].filter((t) => {
        if (!/^[A-Z]{4,}$/.test(t) || KATA_HENTI.has(t) || WARNA[t] || KATA_UMUM.has(t) || MODIF_LUNAK.has(t)) return false
        if (kanonBrand.has(t) || z.kataBrand.has(t)) return false
        const df = katalog.df.get(t) ?? 0
        return df >= 1 && df <= 30
      })
    const seriA = seri(x)
    const hanyaA = seriA.filter((t) => !kataAda(x, t, y))
    if (hanyaA.length) konflik.push(`kode umum (${sama.join(", ")}), nama seri Accurate tidak ada di web: ${hanyaA.join("/")}`)
    umum = { seriA, hanyaW: seri(y).filter((t) => !kataAda(y, t, x)) }
  }
  if (x.brand.size && y.brand.size && ![...x.brand].some((m) => y.brand.has(m))) {
    konflik.push(`brand ${[...x.brand].join("/")} ≠ ${[...y.brand].join("/")}`)
  }

  // Skor kata: IDF kata Accurate yang ada di web, dikurangi separuh IDF kata
  // langka web yang tidak ada di Accurate. Hanya untuk memilih di antara
  // kandidat yang sama kuat — bukan untuk menentukan cocok/tidak.
  let skorKata = 0
  const kataHilang: string[] = []
  const kataLebih: string[] = []
  for (const t of x.kata) {
    if (KATA_HENTI.has(t) || WARNA[t]) continue
    const w = idf(t)
    if (w === 0) continue
    if (y.kata.has(t) || y.bentuk.has(t)) skorKata += w
    else kataHilang.push(t)
  }
  for (const t of y.kata) {
    if (KATA_HENTI.has(t) || WARNA[t] || x.kata.has(t) || x.bentuk.has(t)) continue
    const w = idf(t)
    if (w > Math.log(katalog.total / 31)) kataLebih.push(t) // df <= 30: kata langka
    skorKata -= w / 2
  }
  const identitasWajib = x.identitas.filter((t) => !t.opsional).length
  const lengkapA = sama.length > 0 && hilangDiWeb.length === 0 && (identitasWajib > 0 || sama.length > 0)
  return {
    idx,
    sama,
    partSama,
    hilangDiWeb,
    opsionalHilang,
    lebihDiWeb,
    nyaris,
    konflik,
    lengkapA,
    lengkapW: lebihDiWeb.length === 0,
    longgar: sama.length > 0 && konflik.length === 0,
    skorKata,
    kataHilang,
    kataLebih,
    umum,
  }
}

/** Kata langka (df <= 5) yang ada di satu sisi saja — nama seri yang beda (EPSILON vs ORION). */
function seriBeda(b: Barang, k: Pasangan): string[] {
  const x = bentukBarang.get(b.id)!
  const y = bentukProduk[k.idx]!
  const langka = (t: string) => {
    const df = katalog.df.get(t) ?? 0
    return df >= 1 && df <= 5 && /^[A-Z]{4,}$/.test(t) && !KATA_HENTI.has(t) && !WARNA[t]
  }
  const hanyaA = [...x.kata].filter((t) => langka(t) && !y.kata.has(t) && !y.bentuk.has(t))
  const hanyaW = [...y.kata].filter((t) => langka(t) && !x.kata.has(t) && !x.bentuk.has(t))
  return hanyaA.length > 0 && hanyaW.length > 0 ? [`${hanyaA.join("/")} vs ${hanyaW.join("/")}`] : []
}

// ---------------------------------------------------------------------------
// Pilihan per barang
// ---------------------------------------------------------------------------

const KANDIDAT = 20
const MARGIN = 1.5

type Pilihan =
  | { jenis: "satu"; k: Pasangan; cara: "tunggal" | "pembeda" | "longgar" | "kata" | "terkandung"; dikalahkan: Pasangan[] }
  | { jenis: "ragu"; opsi: Pasangan[]; sebab: string }
  | { jenis: "tidak"; mirip: Pasangan[]; golongan: string; sebab: string }

function pilih(b: Barang, sembunyikan?: number): { pilihan: Pilihan; kandidat: Pasangan[] } {
  const kandidat = peringkatKandidat(`${seragamkan(b.nama)} ${bentukBarang.get(b.id)!.gabungan.join(" ")}`, katalog, KANDIDAT + 1)
    .filter((k) => k.wooId !== sembunyikan)
    .slice(0, KANDIDAT)
    .map((k) => nilai(b, k.wooId))
  // Kode umum tanpa nama seri di Accurate ("GIGABYTE X870 GAMING X"): kalau
  // beberapa produk tanpa pertentangan memegang kode yang sama, mesin tidak
  // punya dasar memilih — semuanya jadi pilihan manual (C). Kalau produk itu
  // satu-satunya pemegang kode (Logitech H151), ia tetap boleh dipilih walau
  // nama webnya punya kata tambahan ("STEREO").
  const ditandai = new Set(
    kandidat.filter(
      (k) =>
        k.umum !== null &&
        k.konflik.length === 0 &&
        k.umum.seriA.length === 0 &&
        kandidat.some((o) => o !== k && o.umum !== null && o.konflik.length === 0 && o.sama.join("|") === k.sama.join("|")),
    ),
  )
  for (const k of ditandai) k.longgar = false
  // Nomor part yang sama persis cukup, walau kode lain ditulis beda di web
  // (Accurate "ULTRA 5 325 ... M365B", web "ULTRA 5 325U ... M365") — dan
  // mengalahkan kandidat yang cocok tanpa nomor part.
  const kuatSemua = kandidat.filter((k) => (k.lengkapA || k.partSama.length > 0) && k.konflik.length === 0 && !ditandai.has(k))
  const kuat = kuatSemua.some((k) => k.partSama.length) ? kuatSemua.filter((k) => k.partSama.length) : kuatSemua
  const urut = (arr: Pasangan[]) => [...arr].sort((p, r) => r.skorKata - p.skorKata)

  if (kuat.length === 1) return { pilihan: { jenis: "satu", k: kuat[0]!, cara: "tunggal", dikalahkan: [] }, kandidat }
  if (kuat.length > 1) {
    const [p, r] = urut(kuat)
    const bersih = p!.kataLebih.length === 0 || p!.kataHilang.length === 0
    if (p!.skorKata - r!.skorKata >= MARGIN && p!.kataHilang.every((t) => idf(t) < 3) && bersih) {
      return { pilihan: { jenis: "satu", k: p!, cara: "pembeda", dikalahkan: urut(kuat).slice(1) }, kandidat }
    }
    return { pilihan: { jenis: "ragu", opsi: urut(kuat), sebab: `${kuat.length} produk web sama-sama cocok (varian/kembar)` }, kandidat }
  }
  if (ditandai.size) {
    const kode = [...ditandai][0]!.sama.join(", ")
    return {
      pilihan: {
        jenis: "ragu",
        opsi: urut([...ditandai]).slice(0, 6),
        sebab: `kode ${kode} dipakai ${ditandai.size} produk web, dan nama Accurate tidak menyebut nama serinya — pilih manual`,
      },
      kandidat,
    }
  }
  const longgar = kandidat.filter((k) => k.longgar)
  if (longgar.length > 0) {
    const [p, r] = urut(longgar)
    const unggul = !r || p!.skorKata - r.skorKata >= MARGIN
    // Longgar = sebagian kode Accurate tidak tertulis di web. Hanya diterima
    // kalau yang tidak tertulis cuma nomor part, atau kode yang cocok jarang.
    const yangHilang = p!.hilangDiWeb
    const bersih = p!.kataLebih.length === 0 || p!.kataHilang.length === 0
    if (unggul && yangHilang.length === 0 && (longgar.length === 1 || bersih)) {
      return { pilihan: { jenis: "satu", k: p!, cara: "longgar", dikalahkan: urut(longgar).slice(1) }, kandidat }
    }
    return {
      pilihan: {
        jenis: "ragu",
        opsi: urut(longgar).slice(0, 6),
        sebab: yangHilang.length ? `mirip, tapi kode Accurate tak ada di web: ${yangHilang.join(", ")}` : `${longgar.length} produk web mirip`,
      },
      kandidat,
    }
  }
  // Jalur KATA, untuk barang tanpa kode model wajib sama sekali: "FSP VITA BD
  // 650W", "PARADOX LEGEND 750W", kode Vention yang hanya huruf ("IABBG").
  // Paling tinggi B — tidak pernah A.
  const x = bentukBarang.get(b.id)!
  if (x.identitas.every((t) => t.opsional)) {
    const kunci = kataKunci(x)
    const cukup = kunci.length >= 2 || (kunci.length === 1 && (katalog.df.get(kunci[0]!) ?? 0) <= 3)
    if (cukup) {
      const bb = ringkasBrand(b.brand)
      const lolos = kandidat.filter((k) => {
        const y = bentukProduk[k.idx]!
        const p = semuaProduk[k.idx]!
        if (k.konflik.length) return false
        if (!kunci.every((t) => kataAda(x, t, y))) return false
        if (y.identitas.some((t) => !t.opsional && !adaDi(y, t, x))) return false
        if (![...x.atribut.nomor].every((v) => y.atribut.nomor.has(v))) return false
        if (bb && !y.ringkas.includes(bb) && ringkasBrand(p.brand) !== bb) return false
        return true
      })
      if (lolos.length > 0) {
        const [p, r] = urut(lolos)
        const bersih = p!.kataLebih.length === 0 || p!.kataHilang.length === 0
        if ((!r || p!.skorKata - r.skorKata >= MARGIN) && (lolos.length === 1 || bersih)) {
          return { pilihan: { jenis: "satu", k: p!, cara: "kata", dikalahkan: urut(lolos).slice(1) }, kandidat }
        }
        return { pilihan: { jenis: "ragu", opsi: urut(lolos).slice(0, 6), sebab: `${lolos.length} produk web cocok lewat kata (tanpa kode model)` }, kandidat }
      }
    }
  }
  // Belum ada pasangan yang meyakinkan, tapi ada produk yang memuat SEMUA kata
  // pembeda Accurate tanpa spesifikasi yang bertentangan: tampilkan sebagai
  // pilihan manual (C), jangan dibuang ke D. Contoh: MacBook yang nomor part-nya
  // tidak ditulis di web, RAM Corsair yang web-nya tanpa nomor part.
  const kunciSemua = kataKunci(x)
  const layakDilihat = kunciSemua.length
    ? kandidat.filter((k) => k.konflik.length === 0 && kunciSemua.every((t) => kataAda(x, t, bentukProduk[k.idx]!)))
    : []
  if (layakDilihat.length) {
    const wajib = x.identitas.filter((t) => !t.opsional)
    return {
      pilihan: {
        jenis: "ragu",
        opsi: urut(layakDilihat).slice(0, 6),
        sebab: wajib.length
          ? `kode model ${wajib.map((t) => t.t).join(", ")} tidak tertulis di web, tapi nama dan spesifikasinya mirip — pilih manual`
          : `nama dan spesifikasinya mirip, tapi kata pembedanya sedikit — pilih manual`,
      },
      kandidat,
    }
  }
  // Nama Accurate yang SELURUH katanya ada di nama produk web, tanpa spesifikasi
  // bertentangan: "MICROSOFT OFFICE HOME & BUSINESS 2024" lawan "... 2024 (POSA
  // CARD)", "RAM LONGDIMM DDR5 ADATA 8GB 4800MHZ" lawan "RAM PC ADATA LONGDIMM
  // DDR5 8GB 4800Mhz". Satu kandidat sebrand tanpa kata seri tambahan -> B;
  // selebihnya C.
  //   (i)  semua kata (>= 3 huruf) nama Accurate ada di nama web, minimal dua kata; atau
  //   (ii) kata yang BUKAN kata umum ada di nama web, dan minimal dua spesifikasi
  //        SAMA PERSIS (bukan sekadar tidak bertentangan) — adaptor "ASUS 19V 3.42A
  //        65W 4.0*1.35MM" lawan web "CHARGER LAPTOP ASUS 19V-3.42 A 65W ...".
  const semuaKata = [...x.kata].filter((t) => /^[A-Z]{3,}$/.test(t) && !KATA_HENTI.has(t) && !WARNA[t])
  const kataInti = semuaKata.filter((t) => !KATA_UMUM.has(t))
  const atributSama = (y: Bentuk) =>
    (Object.keys(x.atribut) as KunciAtribut[]).filter((k) => {
      const p = x.atribut[k]
      const q = y.atribut[k]
      return k !== "warna" && k !== "warnaGabung" && k !== "office" && p.size > 0 && p.size === q.size && [...p].every((v) => q.has(v))
    }).length
  if (semuaKata.length >= 2 || kataInti.length >= 1) {
    const terkandung = kandidat.filter((k) => {
      if (k.konflik.length) return false
      const y = bentukProduk[k.idx]!
      if (semuaKata.length >= 2 && semuaKata.every((t) => kataAda(x, t, y))) return true
      return kataInti.length >= 1 && kataInti.every((t) => kataAda(x, t, y)) && atributSama(y) >= 2
    })
    const t0 = terkandung[0]
    if (terkandung.length === 1 && t0) {
      const y = bentukProduk[t0.idx]!
      const sebrand = x.brand.size > 0 && [...x.brand].some((m) => y.brand.has(m))
      const tanpaKodeLain = y.identitas.every((t) => t.opsional || adaDi(y, t, x))
      if (sebrand && tanpaKodeLain && t0.kataLebih.length === 0) {
        return { pilihan: { jenis: "satu", k: t0, cara: "terkandung", dikalahkan: [] }, kandidat }
      }
    }
    if (terkandung.length) {
      return {
        pilihan: { jenis: "ragu", opsi: urut(terkandung).slice(0, 6), sebab: "seluruh kata nama Accurate ada di nama produk web, tapi tanpa kode model — pilih manual" },
        kandidat,
      }
    }
  }
  const mirip = kandidat.filter((k) => k.sama.length > 0).slice(0, 5)
  return {
    pilihan: { jenis: "tidak", mirip: mirip.length ? mirip : kandidat.slice(0, 3), ...diagnosa(b, x, kandidat) },
    kandidat,
  }
}

/**
 * Kenapa sebuah barang tidak mendapat pasangan (tingkat D). "Tidak cocok" BUKAN
 * berarti "pasti tidak ada di web" — diagnosis ini membedakan bukti kuat
 * (kodenya tidak tertulis di produk web mana pun) dari kasus yang layak dicek
 * manusia (ada produk mirip tapi satu spesifikasi beda, atau penulisannya lain).
 */
const brandWeb = new Set<string>()
for (const y of bentukProduk) for (const m of y.brand) brandWeb.add(m)
function pemegang(t: Identitas): number {
  const langsung = katalog.indeks.get(t.t)?.length ?? 0
  if (langsung || !t.bagian) return langsung
  const angka = katalog.indeks.get(t.bagian[1]) ?? []
  const awalan = new Set(katalog.indeks.get(t.bagian[0]) ?? [])
  return angka.filter((i) => awalan.has(i)).length
}
const pendek = (i: number) => {
  const n = semuaProduk[i]!.nama
  return n.length > 60 ? `${n.slice(0, 57)}…` : n
}
function diagnosa(b: Barang, x: Bentuk, kandidat: Pasangan[]): { golongan: string; sebab: string } {
  const merek = [...x.brand]
  if (merek.length && merek.every((m) => !brandWeb.has(m))) {
    return { golongan: "brand belum ada di web", sebab: `brand ${merek.join("/")} belum punya satu pun produk di web` }
  }
  const wajib = x.identitas.filter((t) => !t.opsional)
  if (wajib.length) {
    const ada = wajib.filter((t) => pemegang(t) > 0)
    if (!ada.length) {
      return { golongan: "kode model tidak ada di web", sebab: `kode model ${wajib.map((t) => t.t).join(", ")} tidak tertulis di nama produk web mana pun` }
    }
    const m = kandidat.find((k) => k.sama.length > 0)
    if (m && m.konflik.length) {
      return { golongan: "ada versi lain di web", sebab: `produk web berkode sama ada (${pendek(m.idx)}), tapi ${m.konflik.join("; ")}` }
    }
    if (m && m.hilangDiWeb.length) {
      return { golongan: "kode hanya cocok sebagian", sebab: `produk paling mirip (${pendek(m.idx)}) tidak memuat kode ${m.hilangDiWeb.join(", ")}` }
    }
    return { golongan: "kode ada di produk lain", sebab: `kode ${ada.map((t) => t.t).join(", ")} hanya muncul di produk web yang jauh berbeda` }
  }
  const alfa = [...x.kata].filter(
    (t) => /^[A-Z]{3,}$/.test(t) && !KATA_HENTI.has(t) && !WARNA[t] && !KATA_UMUM.has(t) && !x.kataBrand.has(t) && !kanonBrand.has(t),
  )
  const asing = alfa.filter((t) => (katalog.df.get(t) ?? 0) === 0)
  const kunci = kataKunci(x)
  const catatAsing = asing.length ? `; kata ${asing.join(", ")} tidak ada di nama produk web mana pun` : ""
  if (kunci.length === 0) {
    return asing.length
      ? { golongan: "kata pembeda tidak ada di web", sebab: `tanpa kode model${catatAsing}` }
      : { golongan: "nama terlalu umum", sebab: "nama tidak punya kode model maupun kata pembeda yang langka" }
  }
  if (kunci.length === 1 && (katalog.df.get(kunci[0]!) ?? 0) > 3) {
    return { golongan: "nama terlalu umum", sebab: `tanpa kode model; satu-satunya kata pembeda (${kunci[0]}) dipakai banyak produk${catatAsing}` }
  }
  const t0 = kandidat[0]
  if (t0) {
    const y = bentukProduk[t0.idx]!
    const hilang = kunci.filter((t) => !kataAda(x, t, y))
    if (t0.konflik.length) {
      return { golongan: "ada versi lain di web", sebab: `produk paling mirip (${pendek(t0.idx)}) bertentangan: ${t0.konflik.join("; ")}${catatAsing}` }
    }
    if (hilang.length) {
      return { golongan: "penulisan nama beda", sebab: `produk paling mirip (${pendek(t0.idx)}) tidak memuat kata ${hilang.join(", ")}${catatAsing}` }
    }
    return { golongan: "beda brand atau kode tambahan", sebab: `produk paling mirip (${pendek(t0.idx)}) beda brand atau punya kode model tambahan${catatAsing}` }
  }
  return { golongan: "tidak ada kandidat", sebab: `tidak ada produk web yang berbagi kata langka${catatAsing}` }
}

/** Kata langka Accurate yang wajib ada di web pada jalur KATA. */
const KATA_BUKAN_KUNCI = new Set(["LONGDIMM", "SODIMM", "NB", "SET", "COMBO", "WIRED", "WIRELESS", "GAMING", "SERIES", "BLACK", "WHITE"])
/**
 * Kata jenis barang dan keterangan pemasaran: ada di banyak nama, ditulis
 * semaunya di kedua sistem, dan tidak membedakan satu produk dari produk lain
 * yang sejenis. Bukan kata pembeda — baik untuk jalur KATA maupun nama seri.
 * Diukur 9 Okt 2026: tanpa daftar ini "STEREO", "CHASSIS", "LIMITED",
 * "ADAPTER" (web: "CHARGER") menggugurkan pasangan yang sebenarnya benar.
 */
const KATA_UMUM = new Set([
  ...KATA_BUKAN_KUNCI,
  "CHASSIS", "TOWER", "MIDDLE", "CASING", "CASE", "EDITION", "LIMITED", "BUNDLING", "STEREO", "HEADSET", "HEADPHONE",
  "HEADPHONES", "EARPHONE", "EARBUDS", "MOUSE", "KEYBOARD", "MECHANICAL", "OPTICAL", "CONNECTION", "CONNECT", "DUAL",
  "TRIPLE", "SINGLE", "MODE", "MODES", "COOLER", "COOLING", "LIQUID", "CARD", "DIGITAL", "DISPLAY", "SCREEN", "PANEL",
  "GLASS", "TEMPERED", "LIGHT", "LIGHTING", "FULL", "SIZE", "PORTABLE", "BLUETOOTH", "SPEAKER", "MICROPHONE", "CABLE",
  "KABEL", "ADAPTER", "CHARGER", "NOISE", "CANCELLING", "CANCELING", "ACTIVE", "PASSIVE", "SURROUND", "SOUND", "AUDIO",
  "VIDEO", "CAMERA", "WEBCAM", "MONITOR", "CURVED", "FLAT", "OFFICE", "HOME", "BUSINESS", "ERGONOMIC", "SILENT",
  "CLICK", "CLICKY", "TACTILE", "LINEAR", "SWITCH", "SWITCHES", "HOTSWAP", "HOTSWAPPABLE", "INCLUDE", "INCLUDED",
  "FREE", "BONUS", "PACK", "PACKAGE", "UPGRADE", "UPGRADED", "LAPTOP", "NOTEBOOK", "PRINTER", "TINTA", "CARTRIDGE",
  "POWER", "SUPPLY", "MODULAR", "PROCESSOR", "MOTHERBOARD", "MEMORY", "INTERNAL", "EXTERNAL", "FLASHDISK", "DRIVE",
  "STORAGE", "PORT", "PORTS", "HUB", "CONVERTER", "KONVERTER", "TYPE", "FAST", "CHARGING", "BATTERY", "BATERAI",
  "STANDARD", "NORMAL", "REGULAR", "STAND", "HOLDER", "MOUNT", "BRACKET", "DESK", "TABLE", "CHAIR", "KURSI", "MEJA",
  "MOUSEPAD", "DESKMAT", "ARGB", "RGB", "LED", "FAN", "FANS", "TRUE", "TWS", "PLUG", "SHAPE", "SQUARE", "ROUND",
  "GROUP", "UNIT", "PCS", "LAN", "ETHERNET", "NETWORK", "PATCH",
  "BRONZE", "PLATINUM", "TITANIUM", "SUPPORT", "NON", "CORD", "PIN", "WITH", "EU", "UK", "US",
])
function kataKunci(x: Bentuk): string[] {
  return [...x.kata].filter((t) => {
    if (!/^[A-Z]{3,}$/.test(t) || KATA_HENTI.has(t) || WARNA[t] || KATA_UMUM.has(t)) return false
    if (x.kataBrand.has(t) || kanonBrand.has(t)) return false
    const df = katalog.df.get(t) ?? 0
    return df >= 1 && df <= 80
  })
}

const aktif = semuaBarang.filter((b) => b.status === "active")
const pilihanPer = new Map<number, ReturnType<typeof pilih>>()
for (const b of aktif) pilihanPer.set(b.id, pilih(b))

// Arah balik: barang Accurate aktif mana saja yang MEMILIH satu produk.
// Barang yang masih ragu di antara beberapa produk tidak dihitung — kalau
// "M171 GREY" jelas memilih variasi GREY, "M171" polos yang ragu di antara
// lima warna tidak punya klaim lebih kuat atas variasi itu.
const diklaim = new Map<number, number[]>()
for (const b of aktif) {
  const p = pilihanPer.get(b.id)!.pilihan
  if (p.jenis === "satu") diklaim.set(p.k.idx, [...(diklaim.get(p.k.idx) ?? []), b.id])
}
const barangPerId = new Map(semuaBarang.map((b) => [b.id, b]))

// ---------------------------------------------------------------------------
// Pelajaran kategori dari tautan yang sudah ada
// ---------------------------------------------------------------------------

const kelompok = (k: string | null) => (k ?? "(KOSONG)").toUpperCase().trim().split(/\s+/)[0]!
const petaKategori = new Map<string, Map<string, number>>()
const petaKelompok = new Map<string, Map<string, number>>()
for (const b of semuaBarang) {
  if (b.tertautWoo == null) continue
  const p = produkPerWoo.get(b.tertautWoo)
  if (!p?.kategori) continue
  for (const [peta, kunci] of [
    [petaKategori, (b.kategori ?? "(KOSONG)").toUpperCase()],
    [petaKelompok, kelompok(b.kategori)],
  ] as const) {
    const m = peta.get(kunci) ?? new Map<string, number>()
    m.set(p.kategori, (m.get(p.kategori) ?? 0) + 1)
    peta.set(kunci, m)
  }
}
function kategoriWajar(b: Barang, p: Produk): boolean | null {
  if (!p.kategori) return null
  const persis = petaKategori.get((b.kategori ?? "(KOSONG)").toUpperCase())
  const kel = petaKelompok.get(kelompok(b.kategori))
  const jumlah = (m?: Map<string, number>) => [...(m?.values() ?? [])].reduce((s, n) => s + n, 0)
  if (persis?.has(p.kategori) || kel?.has(p.kategori)) return true
  if (jumlah(kel) >= 5) return false
  return null
}

// ---------------------------------------------------------------------------
// Keputusan
// ---------------------------------------------------------------------------

type Tingkat = "A" | "B" | "C" | "S" | "T" | "D"
type Keputusan = { tingkat: Tingkat; sumber: "sku" | "nama" | "-"; idx: number | null; alasan: string[]; opsi: number[]; golongan?: string }

/**
 * Kode Accurate berawalan 2 (10 digit, 2608000015) = kode baru; berawalan 1
 * (6 digit, 100001–101572) = kode lama. Aturan pemilik, 9 Okt 2026: kalau
 * kode lama dan kode baru berebut satu produk web, kode baru didahulukan —
 * kode lama hanya dipakai kalau tidak ada kode baru yang menunjuk produk itu.
 */
const prioritasKode = (k: string) => (/^2\d{9}$/.test(k) ? 2 : /^1\d{5}$/.test(k) ? 1 : 0)
const GOL_KODE_LAMA = "kode lama, sudah ada kode baru"

function bedaOffice(b: Barang, i: number): string[] {
  const a = bentukBarang.get(b.id)!.atribut.office
  const w = bentukProduk[i]!.atribut.office
  if (!a.size || !w.size || [...a].some((v) => w.has(v))) return []
  const tulis = (s: Set<string>) => [...s].map((v) => `20${v}`).join("/")
  return [`versi Office beda: Accurate ${tulis(a)}, web ${tulis(w)}`]
}

/**
 * A — yakin: satu-satunya pasangan, dua arah, tanpa pertentangan, tanpa catatan.
 * B — kuat tapi ada catatan (dipilih dari beberapa kandidat lewat kata pembeda,
 *     nomor part tak tertulis di web, kode tambahan di web, kategori tak lazim,
 *     brand beda, nama seri beda).
 * C — ragu: beberapa kandidat sama kuat, atau mirip tapi ada yang tidak cocok.
 * S — pasangannya SUDAH tertaut ke kode Accurate lain (kemungkinan duplikat/varian di Accurate).
 * T — pasangannya ada tapi produk web tidak tayang (draft/private) — kebijakan 21 Sep: tidak ditautkan.
 * D — tidak ada produk web yang sepadan.
 */
function putuskanDasar(b: Barang, uji?: { benar: number; sembunyikan: boolean }): Keputusan {
  const bisaDitautkan = (i: number) => {
    const p = semuaProduk[i]!
    if (uji && i === uji.benar) return true
    return p.kode == null && tayang(p)
  }
  const { pilihan } = uji?.sembunyikan ? pilih(b, uji.benar) : pilihanPer.get(b.id)!

  // 1. SKU produk web = kode Accurate. Tidak dipakai saat menguji jalur nama.
  if (!uji) {
    const lewatSku = produkPerSku.get(b.kode) ?? []
    if (lewatSku.length === 1) {
      const i = lewatSku[0]!
      const p = semuaProduk[i]!
      const n = nilai(b, i)
      const kodeAktifDiSku = pecahSku(p.sku).filter((k) => barangPerKode.get(k)?.status === "active")
      if (n.konflik.length > 0) return { tingkat: "C", sumber: "sku", idx: i, alasan: [`SKU sama, tapi nama bertentangan: ${n.konflik.join("; ")}`], opsi: [i] }
      if (p.kode && p.kode !== b.kode) {
        const golongan = prioritasKode(p.kode) > prioritasKode(b.kode) ? GOL_KODE_LAMA : undefined
        return { tingkat: "S", sumber: "sku", idx: i, alasan: [`SKU sama, tapi produk sudah tertaut ke ${p.kode}`], opsi: [i], golongan }
      }
      if (!tayang(p)) return { tingkat: "T", sumber: "sku", idx: i, alasan: [`SKU sama, produk web ${p.status}${p.statusInduk ? `/induk ${p.statusInduk}` : ""}`], opsi: [i] }
      const catatan: string[] = []
      if (kodeAktifDiSku.length > 1) {
        const lain = kodeAktifDiSku.filter((x) => x !== b.kode)
        const lebihBaru = lain.filter((x) => prioritasKode(x) > prioritasKode(b.kode))
        if (lebihBaru.length) {
          return { tingkat: "S", sumber: "sku", idx: i, alasan: [`SKU produk juga memuat kode baru ${lebihBaru.join(", ")} — kode berawalan 2 didahulukan`], opsi: [i], golongan: GOL_KODE_LAMA }
        }
        if (lain.some((x) => prioritasKode(x) === prioritasKode(b.kode))) {
          return { tingkat: "C", sumber: "sku", idx: i, alasan: [`SKU produk memuat ${kodeAktifDiSku.length} kode Accurate aktif (${kodeAktifDiSku.join(", ")}) — satu produk mewakili beberapa barang`], opsi: [i] }
        }
        catatan.push(`SKU juga memuat kode lama ${lain.join(", ")} — kode berawalan 2 didahulukan`)
      }
      if (pilihan.jenis === "satu" && pilihan.k.idx !== i && n.sama.length === 0) {
        return { tingkat: "C", sumber: "sku", idx: i, alasan: ["SKU menunjuk produk ini, tapi nama lebih cocok ke produk lain"], opsi: [i, pilihan.k.idx] }
      }
      catatan.push(...bedaOffice(b, i))
      return { tingkat: catatan.length ? "B" : "A", sumber: "sku", idx: i, alasan: ["SKU produk web = kode Accurate", ...catatan], opsi: [i] }
    }
    if (lewatSku.length > 1) return { tingkat: "C", sumber: "sku", idx: null, alasan: [`${lewatSku.length} produk web memakai kode ini di SKU-nya`], opsi: lewatSku }
  }

  // 2. Nama.
  if (pilihan.jenis === "tidak") {
    return { tingkat: "D", sumber: "-", idx: null, alasan: [pilihan.sebab], opsi: pilihan.mirip.map((m) => m.idx), golongan: pilihan.golongan }
  }
  if (pilihan.jenis === "ragu") {
    const layak = pilihan.opsi.filter((o) => bisaDitautkan(o.idx))
    const tingkat: Tingkat = layak.length > 0 ? "C" : pilihan.opsi.some((o) => semuaProduk[o.idx]!.kode) ? "S" : "T"
    return { tingkat, sumber: "nama", idx: (layak[0] ?? pilihan.opsi[0]!).idx, alasan: [pilihan.sebab], opsi: pilihan.opsi.slice(0, 6).map((o) => o.idx) }
  }

  const k = pilihan.k
  const p = semuaProduk[k.idx]!
  if (!bisaDitautkan(k.idx)) {
    if (p.kode) {
      const golongan = prioritasKode(p.kode) > prioritasKode(b.kode) ? GOL_KODE_LAMA : undefined
      return { tingkat: "S", sumber: "nama", idx: k.idx, alasan: [`produk web yang cocok sudah tertaut ke ${p.kode}`], opsi: [k.idx], golongan }
    }
    return { tingkat: "T", sumber: "nama", idx: k.idx, alasan: [`produk web cocok tapi ${p.status}${p.statusInduk ? `/induk ${p.statusInduk}` : ""}`], opsi: [k.idx] }
  }
  // Barang Accurate lain yang memilih produk yang sama: kode baru mengalahkan
  // kode lama; sesama kode baru (atau sesama lama) -> pilih manual.
  const pesaingSemua = (diklaim.get(k.idx) ?? []).filter((id) => id !== b.id).map((id) => barangPerId.get(id)!)
  const lebihBaru = pesaingSemua.filter((o) => prioritasKode(o.kode) > prioritasKode(b.kode))
  if (lebihBaru.length) {
    return {
      tingkat: "S",
      sumber: "nama",
      idx: k.idx,
      alasan: [`kode baru ${lebihBaru.map((o) => o.kode).join(", ")} juga menunjuk produk ini — kode berawalan 2 didahulukan`],
      opsi: [k.idx],
      golongan: GOL_KODE_LAMA,
    }
  }
  const pesaing = pesaingSemua.filter((o) => prioritasKode(o.kode) === prioritasKode(b.kode))
  if (pesaing.length > 0) {
    const kodeLain = pesaing.map((o) => o.kode)
    return {
      tingkat: "C",
      sumber: "nama",
      idx: k.idx,
      alasan: [`barang Accurate lain juga menunjuk produk ini: ${kodeLain.slice(0, 4).join(", ")}${kodeLain.length > 4 ? ", …" : ""}`],
      opsi: [k.idx],
    }
  }

  let tingkat: Tingkat = "A"
  const alasan = k.sama.length ? [`cocok pada ${k.sama.join(", ")}`] : []
  const turun = (s: string) => {
    tingkat = "B"
    alasan.push(s)
  }
  const lamaKalah = pesaingSemua.filter((o) => prioritasKode(o.kode) < prioritasKode(b.kode))
  if (lamaKalah.length) turun(`kode lama ${lamaKalah.map((o) => o.kode).join(", ")} juga menunjuk produk ini — kode berawalan 2 didahulukan`)
  if (k.partSama.length && k.hilangDiWeb.length) {
    turun(`nomor part ${k.partSama.join(", ")} sama; kode lain ditulis beda di web: ${k.hilangDiWeb.join(", ")}`)
  }
  for (const s of bedaOffice(b, k.idx)) turun(s)
  if (pilihan.cara === "kata") turun(`tanpa kode model — cocok lewat kata: ${kataKunci(bentukBarang.get(b.id)!).join(", ")}`)
  if (pilihan.cara === "terkandung") turun("tanpa kode model — seluruh kata nama Accurate ada di nama produk web ini")
  if (pilihan.cara === "pembeda") turun(`dipilih dari ${pilihan.dikalahkan.length + 1} kandidat lewat kata pembeda`)
  if (pilihan.cara === "longgar" && k.opsionalHilang.length) turun(`nomor part Accurate tak tertulis di web: ${k.opsionalHilang.join(", ")}`)
  if (!k.lengkapW) turun(`produk web punya kode tambahan: ${k.lebihDiWeb.join(", ")}`)
  const seri = seriBeda(b, k)
  if (seri.length) turun(`nama seri beda: ${seri.join("; ")}`)
  const lunak = (t: string) => MODIF_LUNAK.has(t) || /^V\d$/.test(t)
  const lunakA = [...bentukBarang.get(b.id)!.kata].filter(lunak)
  const lunakW = [...bentukProduk[k.idx]!.kata].filter(lunak)
  const lunakBeda = [...lunakA.filter((t) => !lunakW.includes(t)), ...lunakW.filter((t) => !lunakA.includes(t))]
  const rgbA = [...bentukBarang.get(b.id)!.kata].filter((t) => t === "RGB" || t === "ARGB")
  if (rgbA.length && !rgbA.some((t) => bentukProduk[k.idx]!.kata.has(t))) lunakBeda.push(rgbA.join("/"))
  if (lunakBeda.length) turun(`pengubah model hanya di satu sisi: ${lunakBeda.join(", ")}`)
  const wajar = kategoriWajar(b, p)
  // Kategori tak lazim tapi pasangannya bersih (tanpa catatan lain, tanpa kode
  // tambahan di web) cukup diturunkan ke B — produk UGREEN di web banyak yang
  // ditaruh di "AKSESSORIES KOMPUTER". Yang ada catatan lain (mis. prosesor
  // yang mendarat di PC rakitan) tetap C.
  if (wajar === false && tingkat === "A" && k.lengkapW) {
    turun(`kategori web "${p.kategori}" belum pernah dipakai untuk kategori Accurate "${b.kategori}"`)
  } else if (wajar === false) {
    return {
      tingkat: "C",
      sumber: "nama",
      idx: k.idx,
      alasan: [`kategori web "${p.kategori}" belum pernah dipakai untuk kategori Accurate "${b.kategori}"`, ...alasan],
      opsi: [k.idx],
    }
  }
  const bb = ringkasBrand(b.brand)
  if (bb && !bentukProduk[k.idx]!.ringkas.includes(bb) && p.brand && ringkasBrand(p.brand) !== bb) turun(`brand beda: Accurate ${b.brand}, web ${p.brand}`)
  const kemA = bentukBarang.get(b.id)!.atribut.kemasan
  const kemW = bentukProduk[k.idx]!.atribut.kemasan
  if (kemA.size !== kemW.size) turun(`kemasan ${[...kemA, ...kemW].join("/")} hanya disebut di satu sisi`)
  const thA = bentukBarang.get(b.id)!.atribut.tahun
  const thW = bentukProduk[k.idx]!.atribut.tahun
  if (thA.size !== thW.size) turun(`tahun model ${[...thA, ...thW].join("/")} hanya disebut di satu sisi`)
  return { tingkat, sumber: "nama", idx: k.idx, alasan, opsi: [k.idx, ...(pilihan.cara === "pembeda" ? pilihan.dikalahkan.slice(0, 3).map((d) => d.idx) : [])] }
}

/**
 * Jenis barang (aturan 9 Okt 2026) dari kata di nama DAN nama kategorinya.
 * Digabung supaya longgar: "LOGITECH PRO X TKL" tidak menyebut KEYBOARD di
 * namanya, tapi kategori webnya KEYBOARD. Sisi yang tidak punya kata jenis
 * tidak pernah dianggap bertentangan.
 *
 * Alasannya: usulan C memuat pasangan lintas jenis — keyboard G515 -> headset
 * G633S, keyboard MX KEYS S -> jam tangan ORAIMO, keyboard PRO X TKL -> mouse
 * G PRO 2. Pasangan seperti itu tidak mungkin benar dan hanya menyesatkan
 * peninjau lembar kerja.
 */
const KATA_JENIS: Record<string, string> = {
  KEYBOARD: "KEYBOARD", MOUSE: "MOUSE", MOUSEPAD: "MOUSEPAD", DESKMAT: "MOUSEPAD",
  HEADSET: "AUDIO", HEADPHONE: "AUDIO", EARPHONE: "AUDIO", EARBUDS: "AUDIO", TWS: "AUDIO", IEM: "AUDIO",
  // MONITOR sengaja tidak ikut: aksesori ikut menyebutnya (MONITOR LIGHT BAR, BRACKET MONITOR).
  SPEAKER: "SPEAKER", SOUNDBAR: "SPEAKER", WEBCAM: "WEBCAM", SMARTWATCH: "SMARTWATCH",
  HANDPHONE: "HANDPHONE", HANPHONE: "HANDPHONE", SMARTPHONE: "HANDPHONE",
}
function jenisDari(...teks: (string | null)[]): Set<string> {
  const hasil = new Set<string>()
  for (const t of teks) {
    if (!t) continue
    const s = seragamkan(t)
      .replace(/\bMOUSE\s*PAD\b/g, "MOUSEPAD")
      .replace(/\bSMART\s*WATCH\b/g, "SMARTWATCH")
      .replace(/\bHEAD\s*PHONES?\b/g, "HEADPHONE")
      .replace(/\bEAR\s*BUDS\b/g, "EARBUDS")
    for (const k of s.split(/[^A-Z0-9]+/)) if (KATA_JENIS[k]) hasil.add(KATA_JENIS[k]!)
  }
  return hasil
}
const jenisBarang = new Map(semuaBarang.map((b) => [b.id, jenisDari(b.nama, b.kategori)]))
const jenisProduk = semuaProduk.map((p) => jenisDari(namaCocok(p), p.kategori))
function jenisBeda(b: Barang, i: number): string | null {
  const a = jenisBarang.get(b.id)!
  const w = jenisProduk[i]!
  if (!a.size || !w.size || [...a].some((x) => w.has(x))) return null
  return `jenis barang beda: Accurate ${[...a].join("/")}, web ${[...w].join("/")}`
}

/** putuskanDasar + aturan jenis: pilihan C yang beda jenis dibuang; tak bersisa -> D. */
function putuskan(b: Barang, uji?: { benar: number; sembunyikan: boolean }): Keputusan {
  const k = putuskanDasar(b, uji)
  if (k.tingkat !== "C") return k
  const calon = [...new Set([...(k.idx != null ? [k.idx] : []), ...k.opsi])]
  const sejenis = calon.filter((i) => !jenisBeda(b, i))
  if (!calon.length || sejenis.length === calon.length) return k
  if (!sejenis.length) {
    return { tingkat: "D", sumber: "-", idx: null, alasan: [jenisBeda(b, calon[0]!)!, ...k.alasan.map((a) => `semula C: ${a}`)], opsi: [], golongan: "jenis barang beda" }
  }
  return {
    ...k,
    idx: k.idx == null ? null : sejenis[0]!,
    opsi: k.opsi.filter((i) => sejenis.includes(i)),
    alasan: [...k.alasan, `${calon.length - sejenis.length} pilihan beda jenis dibuang`],
  }
}

// ---------------------------------------------------------------------------
// Ukur akurasi dengan tautan yang sudah ada sebagai kunci jawaban
// ---------------------------------------------------------------------------

const idxPerWoo = new Map(semuaProduk.map((p, i) => [p.wooId, i]))
const uji = { total: 0, A: 0, Abenar: 0, B: 0, Bbenar: 0, C: 0, D: 0, ST: 0, sembunyiA: 0, sembunyiB: 0 }
const contohSalah: string[] = []
const contohPalsu: string[] = []
const jenisBedaDiUji: string[] = []
const hasilUji: { kode: string; kelompok: string; tingkat: Tingkat; benar: boolean; alasan: string[] }[] = []
for (const b of aktif) {
  if (b.tertautWoo == null) continue
  const benar = idxPerWoo.get(b.tertautWoo)
  if (benar == null) continue
  uji.total++
  const jb = jenisBeda(b, benar)
  if (jb) jenisBedaDiUji.push(`${b.kode} ${b.nama} -> ${semuaProduk[benar]!.nama} [${jb}]`)
  const k = putuskan(b, { benar, sembunyikan: false })
  hasilUji.push({ kode: b.kode, kelompok: kelompok(b.kategori), tingkat: k.tingkat, benar: k.idx === benar, alasan: k.alasan })
  if (k.tingkat === "A" || k.tingkat === "B") {
    uji[k.tingkat]++
    if (k.idx === benar) uji[k.tingkat === "A" ? "Abenar" : "Bbenar"]++
    else if (contohSalah.length < 40)
      contohSalah.push(`${k.tingkat}  ${b.kode} ${b.nama}\n     -> ${semuaProduk[k.idx!]!.nama}  [${k.alasan.join(" | ")}]\n     benar: ${semuaProduk[benar]!.nama}`)
  } else if (k.tingkat === "C") uji.C++
  else if (k.tingkat === "D") uji.D++
  else uji.ST++
  const s = putuskan(b, { benar, sembunyikan: true })
  if (s.tingkat === "A" || s.tingkat === "B") {
    if (s.tingkat === "A") uji.sembunyiA++
    else uji.sembunyiB++
    if (contohPalsu.length < 40)
      contohPalsu.push(`${s.tingkat}  ${b.kode} ${b.nama}\n     -> ${semuaProduk[s.idx!]!.nama}  [${s.alasan.join(" | ")}]\n     benar: ${semuaProduk[benar]!.nama}`)
  }
}

// ---------------------------------------------------------------------------
// Antrean sungguhan
// ---------------------------------------------------------------------------

const antrean = aktif.filter((b) => b.tertautWoo == null && !b.diabaikan)
const keputusan = antrean.map((b) => ({ b, k: putuskan(b) }))

// Satu produk hanya boleh menerima satu kode: kalau dua barang di A/B menunjuk
// produk yang sama (mis. lewat SKU dan lewat nama), kode baru tunggal menang
// atas kode lama (yang lama -> S); selebihnya semua turun ke C.
const klaim = new Map<number, Barang[]>()
for (const { b, k } of keputusan) if ((k.tingkat === "A" || k.tingkat === "B") && k.idx != null) klaim.set(k.idx, [...(klaim.get(k.idx) ?? []), b])
for (const { b, k } of keputusan) {
  const arr = k.idx != null ? klaim.get(k.idx) : undefined
  if (!(k.tingkat === "A" || k.tingkat === "B") || !arr || arr.length < 2) continue
  const puncak = Math.max(...arr.map((o) => prioritasKode(o.kode)))
  const pemenang = arr.filter((o) => prioritasKode(o.kode) === puncak)
  if (pemenang.length === 1 && pemenang[0] !== b) {
    k.tingkat = "S"
    k.golongan = GOL_KODE_LAMA
    k.alasan.unshift(`produk web ini diusulkan untuk kode baru ${pemenang[0]!.kode} — kode berawalan 2 didahulukan`)
  } else if (pemenang.length === 1) {
    k.tingkat = "B"
    k.alasan.push(`kode lama ${arr.filter((o) => o !== b).map((o) => o.kode).join(", ")} juga menunjuk produk ini — kode berawalan 2 didahulukan`)
  } else {
    k.tingkat = "C"
    k.alasan.unshift("produk web ini juga diusulkan untuk barang Accurate lain")
  }
}

// Kode yang menempel di induk VARIABLE: usulan ke variasi induk itu sendiri =
// PINDAH (paling tinggi B, supaya dilihat); ke produk lain jadi C, karena
// terapkan-usulan-tautan hanya mau memindah kode dari induk ke anaknya.
for (const { b, k } of keputusan) {
  if (b.diIndukId == null) continue
  const usul = k.tingkat === "A" || k.tingkat === "B"
  const anak = k.idx != null && semuaProduk[k.idx]!.parentId === b.diIndukId
  if (usul && anak) {
    k.tingkat = "B"
    k.alasan.unshift(`PINDAH: kode ini sekarang menempel di produk induk ${b.diIndukWoo} (VARIABLE) — dipindah ke variasinya`)
  } else if (usul) {
    k.tingkat = "C"
    k.alasan.unshift(`kode ini menempel di produk induk ${b.diIndukWoo} (VARIABLE), tapi usulannya produk di luar induk itu`)
  } else {
    k.alasan.unshift(`kode ini menempel di produk induk ${b.diIndukWoo} (VARIABLE) — induk tidak bisa ditautkan`)
  }
}

// Periksa satu-dua barang: LIHAT=2608000015,2609000060 npx tsx ... — cetak
// identitas, atribut, kandidat teratas beserta penilaiannya, dan keputusannya.
for (const kode of (process.env.LIHAT ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
  const b = barangPerKode.get(kode)
  if (!b) {
    console.log(`\n[LIHAT] ${kode}: tidak ada di accurate_items`)
    continue
  }
  const x = bentukBarang.get(b.id)!
  const isiAtribut = (a: Atribut) =>
    (Object.keys(a) as KunciAtribut[])
      .filter((k) => a[k].size)
      .map((k) => `${k}=${[...a[k]].join("/")}`)
      .join(" ")
  console.log(`\n[LIHAT] ${b.kode} (${b.status}, stok ${b.stok}, tertaut ${b.tertautWoo ?? "-"}) ${b.nama}`)
  console.log(`  identitas: ${x.identitas.map((t) => t.t + (t.opsional ? "?" : "")).join(" ")}`)
  console.log(`  atribut  : ${isiAtribut(x.atribut)}`)
  const { pilihan, kandidat } = pilihanPer.get(b.id) ?? pilih(b)
  for (const k of kandidat.slice(0, 6)) {
    const p = semuaProduk[k.idx]!
    console.log(`  - ${p.wooId} ${p.tipe} ${p.status}${p.kode ? ` [kode ${p.kode}]` : ""} ${namaCocok(p).slice(0, 110)}`)
    console.log(
      `      sama=${k.sama.join(",")} hilang=${k.hilangDiWeb.join(",")} opsHilang=${k.opsionalHilang.join(",")} lebihWeb=${k.lebihDiWeb.join(",")}` +
        ` konflik=${k.konflik.join(" | ")} skor=${k.skorKata.toFixed(1)}`,
    )
  }
  console.log(`  pilih    : ${pilihan.jenis}${pilihan.jenis === "satu" ? ` ${semuaProduk[pilihan.k.idx]!.wooId} (${pilihan.cara})` : ` — ${pilihan.sebab}`}`)
  const kp = keputusan.find((d) => d.b.id === b.id)?.k
  if (kp) console.log(`  antrean  : ${kp.tingkat} ${kp.idx != null ? semuaProduk[kp.idx]!.wooId : "-"} — ${kp.alasan.join(" | ")}`)
  const benar = b.tertautWoo != null ? idxPerWoo.get(b.tertautWoo) : undefined
  if (benar != null) {
    const ku = putuskan(b, { benar, sembunyikan: false })
    console.log(`  uji kunci: ${ku.tingkat} ${ku.idx != null ? semuaProduk[ku.idx]!.wooId : "-"} (benar ${b.tertautWoo}) — ${ku.alasan.join(" | ")}`)
  }
}

// ---------------------------------------------------------------------------
// Keluaran
// ---------------------------------------------------------------------------

const keluar = process.env.KELUAR ?? "backup/cocokkan-tautan"
mkdirSync(keluar, { recursive: true })
const ringkasProduk = (i: number | null) => {
  if (i == null) return null
  const p = semuaProduk[i]!
  return {
    wooId: p.wooId,
    nama: p.nama,
    varian: p.varian || null,
    kategori: p.kategori,
    status: p.status,
    statusInduk: p.statusInduk,
    tipe: p.tipe,
    sku: p.sku,
    kode: p.kode,
  }
}
const usulan = keputusan.map(({ b, k }) => ({
  kode: b.kode,
  nama: b.nama,
  kategori: b.kategori,
  kelompok: kelompok(b.kategori),
  brand: b.brand,
  stok: b.stok,
  diSheet: b.diSheet,
  tingkat: k.tingkat,
  sumber: k.sumber,
  produk: ringkasProduk(k.idx),
  alasan: k.alasan,
  opsi: k.opsi.map(ringkasProduk),
  golongan: k.golongan ?? null,
  dariInduk: b.diIndukWoo,
}))
// Produk web tayang yang belum tertaut dan tidak diusulkan untuk barang mana pun.
const diusulkan = new Set(keputusan.filter(({ k }) => k.tingkat === "A" || k.tingkat === "B").map(({ k }) => k.idx))
const webTanpaPasangan = semuaProduk
  .map((p, i) => ({ p, i }))
  .filter(({ p, i }) => p.kode == null && tayang(p) && !diusulkan.has(i))
  .map(({ p }) => ({ wooId: p.wooId, nama: p.nama, varian: p.varian || null, kategori: p.kategori, tipe: p.tipe, sku: p.sku }))
writeFileSync(`${keluar}/usulan.json`, JSON.stringify({ dibuat: new Date().toISOString(), usulan, webTanpaPasangan }, null, 1))
writeFileSync(`${keluar}/uji.json`, JSON.stringify(hasilUji))

const baris: string[] = []
const tulis = (s = "") => (baris.push(s), console.log(s))
const persen = (a: number, b: number) => (b === 0 ? "-" : `${((a / b) * 100).toFixed(1)}%`)
tulis(`Barang Accurate aktif           : ${aktif.length}`)
tulis(`Produk web yang bisa ditautkan  : ${semuaProduk.length} (SIMPLE+VARIATION; ${semuaProduk.filter((p) => p.kode == null && tayang(p)).length} tayang & belum tertaut)`)
tulis(`Antrean (aktif, belum tertaut, belum diabaikan): ${antrean.length}  — berstok ${antrean.filter((b) => b.stok > 0).length}`)
tulis()
tulis(`=== UJI dengan ${uji.total} tautan lama sebagai kunci jawaban (jalur NAMA saja, SKU tidak dipakai) ===`)
tulis(`A: ${uji.A} usulan, benar ${uji.Abenar} (${persen(uji.Abenar, uji.A)})`)
tulis(`B: ${uji.B} usulan, benar ${uji.Bbenar} (${persen(uji.Bbenar, uji.B)})`)
tulis(`C: ${uji.C}  D: ${uji.D}  S/T: ${uji.ST}`)
tulis(`Jawaban benar disembunyikan -> mesin tetap mengusulkan A: ${uji.sembunyiA}, B: ${uji.sembunyiB} (dari ${uji.total}) — perkiraan usulan palsu saat barangnya tidak ada di web`)
tulis(`Aturan jenis: tautan lama yang jenisnya dianggap beda = ${jenisBedaDiUji.length}`)
for (const c of jenisBedaDiUji.slice(0, 20)) tulis(`   ${c}`)
tulis()
tulis("--- Contoh usulan A/B yang SALAH di uji ---")
for (const c of contohSalah) tulis(c)
tulis()
tulis("--- Contoh usulan palsu saat jawaban benar disembunyikan ---")
for (const c of contohPalsu) tulis(c)
tulis()
const hitung = (arr: typeof usulan, t: string) => arr.filter((u) => u.tingkat === t).length
tulis("=== ANTREAN — per tingkat ===")
for (const t of ["A", "B", "C", "S", "T", "D"]) {
  const arr = usulan.filter((u) => u.tingkat === t)
  tulis(`${t}: ${String(arr.length).padStart(5)}   berstok ${String(arr.filter((u) => u.stok > 0).length).padStart(5)}   via SKU ${arr.filter((u) => u.sumber === "sku").length}`)
}
tulis(`Produk web tayang belum tertaut yang tidak mendapat usulan A/B: ${webTanpaPasangan.length}`)
{
  const ab = keputusan.filter(({ b, k }) => (k.tingkat === "A" || k.tingkat === "B") && k.idx != null && jenisBeda(b, k.idx))
  tulis(`Usulan A/B yang jenisnya beda (tidak diubah, hanya dicatat): ${ab.length}`)
  for (const { b, k } of ab.slice(0, 20)) tulis(`   ${k.tingkat} ${b.kode} ${b.nama} -> ${semuaProduk[k.idx!]!.nama} [${jenisBeda(b, k.idx!)}]`)
  // C juga dibentuk SESUDAH putuskan() (dedupe klaim, PINDAH induk) dari bekas A/B.
  const c = keputusan.filter(({ b, k }) => k.tingkat === "C" && k.idx != null && jenisBeda(b, k.idx))
  tulis(`Usulan C akhir yang masih menunjuk produk beda jenis: ${c.length}`)
  for (const { b, k } of c.slice(0, 20)) tulis(`   C ${b.kode} ${b.nama} -> ${semuaProduk[k.idx!]!.nama} [${k.alasan[0]}]`)
}
tulis()
tulis("=== Kenapa tingkat D tidak cocok ===")
const perGolongan = new Map<string, typeof usulan>()
for (const u of usulan) if (u.tingkat === "D") perGolongan.set(u.golongan ?? "-", [...(perGolongan.get(u.golongan ?? "-") ?? []), u])
for (const [g, arr] of [...perGolongan.entries()].sort((p, q) => q[1].length - p[1].length)) {
  tulis(`${String(arr.length).padStart(5)}  berstok ${String(arr.filter((u) => u.stok > 0).length).padStart(4)}  ${g}`)
}
tulis()
tulis("=== Per kelompok kategori Accurate (urut jumlah antrean) ===")
tulis("kelompok          antre  stok |    A    B    C    S    T    D")
const perKel = new Map<string, typeof usulan>()
for (const u of usulan) perKel.set(u.kelompok, [...(perKel.get(u.kelompok) ?? []), u])
for (const [kel, arr] of [...perKel.entries()].sort((a, b) => b[1].length - a[1].length)) {
  tulis(
    `${kel.padEnd(16).slice(0, 16)} ${String(arr.length).padStart(6)} ${String(arr.filter((u) => u.stok > 0).length).padStart(5)} | ` +
      ["A", "B", "C", "S", "T", "D"].map((t) => String(hitung(arr, t)).padStart(4)).join(" "),
  )
}
writeFileSync(`${keluar}/ringkasan.txt`, baris.join("\n"))
console.log(`\nTersimpan: ${keluar}/usulan.json, ${keluar}/ringkasan.txt`)
await prisma.$disconnect()
