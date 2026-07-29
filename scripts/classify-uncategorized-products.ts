/**
 * Task #5 — beri kategori pada produk terbit yang belum punya satu pun.
 *
 * 205 produk berstatus PUBLISHED tidak menempel di kategori mana pun, jadi
 * customer tidak bisa menemukannya lewat penelusuran sama sekali — hanya lewat
 * pencarian, kalau kebetulan menebak katanya. Ini kerugian yang paling nyata
 * dari seluruh data kategori yang berantakan.
 *
 * Untungnya penamaan di katalog ini teratur: hampir semua produk diawali jenis
 * barangnya ("MOTHERBOARD MSI PRO B760M-E", "POWER SUPPLY DIGITAL ALLIANCE
 * PBZ550", "RAM PC DDR4 ..."). Aturan di bawah membaca pola itu. Pendekatannya
 * sama dengan yang dipakai staff untuk SSD di task #13, dan di sana terbukti
 * tepat 59 dari 59.
 *
 * Sikapnya sengaja pengecut: kalau nama tidak menyebut jenisnya dengan jelas,
 * produk TIDAK ditebak — ia masuk daftar tinjauan manual. Salah menaruh produk
 * lebih merugikan daripada membiarkannya menunggu orang melihatnya, karena
 * kategori yang salah menyesatkan customer sekaligus menyembunyikan barangnya.
 *
 * Jalur leluhur ikut disimpan mengikuti konvensi yang dipakai CategoryPicker,
 * supaya halaman kategori tingkat atas tetap memuat seluruh isinya.
 *
 * Default DRY RUN. Tambahkan --apply untuk menulis.
 */
import { config } from "dotenv"
config({ path: ".env.local" })

import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { PrismaClient } from "@prisma/client"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"

const APPLY = process.argv.includes("--apply")

const base = (process.env.DATABASE_URL as string)
  .replace(/^['"]|['"]$/g, "")
  .replace(/^mysql:\/\//, "mariadb://")
const sep = base.includes("?") ? "&" : "?"
const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(`${base}${sep}connectionLimit=2&acquireTimeout=30000`, {
    useTextProtocol: true,
  }),
})

type Rule = { when: RegExp; path: string }

/**
 * Urut: yang pertama cocok dipakai, jadi aturan spesifik harus di atas yang
 * umum. Target ditulis sebagai path lengkap supaya rename kategori menggagalkan
 * script dengan berisik, bukan diam-diam menaruh produk di tempat lain.
 */
const K = "KOMPONEN PC / NB"
const A = "AKSESSORIES KOMPUTER"

const RULES: Rule[] = [
  // --- penyimpanan: protokol disebut eksplisit
  { when: /^SSD\s+NVME\b|^SSD\s+M\.?2\b/, path: `${K} > SSD / NVME > M.2 / NVME` },
  { when: /^SSD\s+SATA\b/, path: `${K} > SSD / NVME > SSD SATA 2.5"` },
  { when: /^SSD\s+(PORTABLE|EXTERNAL)\b/, path: `${K} > SSD / NVME > SSD EXTERNAL` },
  { when: /^(UGREEN\s+)?ENCLOSURE\b.*\bSSD\b|^UGREEN ENCLOSURE HDD\/SSD/, path: `${K} > SSD / NVME > CASING SSD` },

  // --- motherboard: soket menentukan platform. Akhiran huruf ikut diterima
  // karena varian seperti X870E ditulis menyatu dengan angkanya.
  { when: /^MOTHERBOARD\b.*\b(AM4|AM5|A520|B450|B550|B650|B850|X570|X670|X870)[A-Z]?\b/, path: `${K} > MOTHERBOARD > MOTHERBOARD AMD` },
  { when: /^MOTHERBOARD\b.*\b(LGA\s?\d{3,4}|H61|H81|H110|H310|H410|H510|H610|H710|H810|B360|B460|B560|B660|B760|B860|Z390|Z490|Z590|Z690|Z790|Z890)[A-Z]?\b/, path: `${K} > MOTHERBOARD > MOTHERBOARD INTEL` },

  // --- VGA: chipset disebut di nama. Nomor seri sering menyatu dengan
  // prefiksnya ("GTX1650"), jadi batas kata tidak boleh diwajibkan.
  { when: /^VGA\b.*\b(RTX|GTX|GEFORCE|GT)\s?\d{3,4}/, path: `${K} > VGA CARD / GRAPHICS CARD > VGA NVIDIA` },
  { when: /^VGA\b.*(RADEON|\bRX\s?\d{3,4})/, path: `${K} > VGA CARD / GRAPHICS CARD > VGA AMD RADEON` },
  { when: /^VGA\b.*\bARC\b/, path: `${K} > VGA CARD / GRAPHICS CARD > VGA INTEL ARC` },

  // --- RAM: generasi & bentuk disebut
  { when: /^RAM\s+NB\b.*DDR\s?5/, path: `${K} > RAM / MEMORY > RAM NB DDR 5` },
  { when: /^RAM\s+NB\b.*DDR\s?4/, path: `${K} > RAM / MEMORY > RAM NB DDR 4` },
  { when: /^RAM\s+NB\b.*DDR\s?3/, path: `${K} > RAM / MEMORY > RAM NB DDR 3` },
  { when: /^RAM\b.*DDR\s?5/, path: `${K} > RAM / MEMORY > RAM PC DDR 5` },
  { when: /^RAM\b.*DDR\s?4/, path: `${K} > RAM / MEMORY > RAM PC DDR 4` },
  { when: /^RAM\b.*DDR\s?3/, path: `${K} > RAM / MEMORY > RAM PC DDR 3` },

  // --- pendingin. Ukuran radiator ditulis polos ("LE360 V2 360"), jarang
  // disertai satuan, jadi angkanya yang dicari.
  { when: /^(LIQUID|AIO)\b.*\b360\b|^(LIQUID|AIO)\b.*\d360\b/, path: `${K} > LIQUID COOLING > 360mm` },
  { when: /^(LIQUID|AIO)\b.*\b240\b|^(LIQUID|AIO)\b.*\d240\b/, path: `${K} > LIQUID COOLING > 240mm` },
  { when: /^(LIQUID|AIO)\b.*\b120\b|^(LIQUID|AIO)\b.*\d120\b/, path: `${K} > LIQUID COOLING > 120mm` },
  { when: /^FAN\s+PROCESSOR\b|^(CPU\s+)?COOLER\b/, path: `${K} > FAN PROCESSOR` },
  { when: /^FAN\s+CASING\b/, path: `${K} > FAN CASING` },

  // --- casing: ukuran tower disebut eksplisit
  { when: /^CASING\b.*\bFULL\s+TOWER\b/, path: `${K} > CASING PC > FULL TOWER` },
  { when: /^CASING\b.*\b(MID|MIDDLE)\s+TOWER\b/, path: `${K} > CASING PC > MID TOWER` },
  { when: /^CASING\b.*\bMINI\s+TOWER\b/, path: `${K} > CASING PC > MINI TOWER` },
  { when: /^CASING\b.*\bMICRO\s+TOWER\b/, path: `${K} > CASING PC > MICRO TOWER` },
  { when: /^CASING\b.*\b(SFF|SMALL\s+FORM)\b/, path: `${K} > CASING PC > SMALL FORM FACTOR` },

  // --- monitor: bentuk panel disebut
  { when: /^MONITOR\b.*\bCURVED\b/, path: `${K} > MONITOR PC > MONITOR CURVED` },
  { when: /^MONITOR\b.*\bPORTABLE\b/, path: `${K} > MONITOR PC > MONITOR PORTABLE` },
  { when: /^MONITOR\b.*\bFLAT\b/, path: `${K} > MONITOR PC > MONITOR FLAT` },
  { when: /^BRACKET\s+MONITOR\b|^STAND\s+MONITOR\b/, path: `${K} > MONITOR PC > BRACKET MONITOR` },

  // --- komponen lain yang namanya sudah jelas
  { when: /^POWER\s+SUPPLY\b|^PSU\b/, path: `${K} > POWER SUPPLY` },
  { when: /^UPS\b/, path: `${K} > UPS` },

  // --- aksesori
  { when: /^KEYBOARD\b/, path: `${A} > KEYBOARD` },
  { when: /^MOUSE\b/, path: `${A} > MOUSE` },
  { when: /^MOUSEPAD\b/, path: `${A} > MOUSEPAD` },
  { when: /^HEADSET\b|^HEADPHONE\b/, path: `${A} > HEADSET` },
  { when: /^(EARBUDS|TWS)\b/, path: `${A} > TWS` },
  { when: /^MICROPHONE\b/, path: `${A} > MICROPHONE` },
  { when: /^SPEAKER\b/, path: `${A} > SPEAKER` },
  { when: /^FLASHDISK\b/, path: `${A} > FLASHDISK` },
  { when: /^MICROSD\b/, path: `${A} > MICROSD` },
  { when: /^CARD\s+READER\b/, path: `${A} > CARD READER` },
  { when: /^PASTA\s+THERMAL\b|^THERMAL\s+PASTE\b/, path: `${A} > PASTA THERMAL` },
  { when: /^KURSI\s+GAMING\b/, path: `${A} > KURSI GAMING` },
  { when: /^MEJA\s+GAMING\b/, path: `${A} > MEJA GAMING` },
  { when: /^COOLING\s+PAD\b/, path: `${A} > COOLING PAD / STAND LAPTOP` },
  { when: /^POWERBANK\b|^CHARGING\s+DOCK\b/, path: `${A} > POWERBANK & CHARGER` },
  { when: /^(USB\s+)?HUB\b/, path: `${A} > KABEL / CONVERTER > USB HUB` },
  { when: /\bKABEL\s+HDMI\b|^HDMI\b/, path: `${A} > KABEL / CONVERTER > KABEL HDMI` },
  { when: /\bKABEL\s+LAN\b/, path: `${A} > KABEL / CONVERTER > KABEL LAN` },
  { when: /\b(KABEL|CABLE)\b.*\bUSB[- ]?C\b/, path: `${A} > KABEL / CONVERTER > KABEL USB A-C` },

  // --- printer & software
  { when: /^SCANNER\b/, path: "PRINTER & PROYEKTOR > SCANNER" },
  { when: /^PROYEKTOR\b|^PROJECTOR\b/, path: "PRINTER & PROYEKTOR > PROYEKTOR" },
  { when: /^TINTA\b/, path: "PRINTER & PROYEKTOR > TINTA" },
  { when: /^MICROSOFT\s+OFFICE\b|^WINDOWS\s+\d|^ANTIVIRUS\b/, path: "SOFTWARE" },
  { when: /^PRINTER\b.*\bCANON\b/, path: "PRINTER & PROYEKTOR > PRINTER CANON" },
  { when: /^PRINTER\b.*\bEPSON\b/, path: "PRINTER & PROYEKTOR > PRINTER EPSON" },
  { when: /^PRINTER\b.*\bBROTHER\b/, path: "PRINTER & PROYEKTOR > PRINTER BROTHER" },
  { when: /^PRINTER\b.*\bHP\b/, path: "PRINTER & PROYEKTOR > PRINTER HP" },
  { when: /\bPOINTER\s+LASER\b|\bREMOTE\s+PRESENT/, path: "PRINTER & PROYEKTOR > REMOTE PRESENTASI" },

  // --- PC rakitan pabrikan
  { when: /\bMINI\s+PC\b|\bBAREBONE\b/, path: "PC MINI & DESKTOP" },

  /**
   * Laptop. Windows pra-instal adalah penanda paling andal di katalog ini —
   * komponen dan barebone tidak menyebutnya. Kehadiran GPU diskrit memisahkan
   * lini gaming dari lini kerja; keduanya kini daun setelah task #3.
   */
  { when: /\bWIN\s?1[01]\b.*\b(RTX|GTX)\s?\d{3,4}|\b(RTX|GTX)\s?\d{3,4}.*\bWIN\s?1[01]\b/, path: "LAPTOP > LAPTOP GAMING" },
  { when: /\bWIN\s?1[01]\b/, path: "LAPTOP > LAPTOP OFFICE" },

  /**
   * Jaring terakhir: jenis barang disebut, tapi tidak di awal nama
   * ("Logitech M196 Mouse Wireless", "RAZER KRAKEN ... GAMING HEADSET").
   * Sengaja ditaruh paling bawah supaya aturan yang lebih spesifik menang —
   * MOUSEPAD tidak boleh tertangkap oleh MOUSE, misalnya.
   */
  { when: /\bMOUSEPAD\b/, path: `${A} > MOUSEPAD` },
  { when: /\bMOUSE\b/, path: `${A} > MOUSE` },
  { when: /\bKEYBOARD\b/, path: `${A} > KEYBOARD` },
  { when: /\bHEADSET\b|\bHEADPHONE\b/, path: `${A} > HEADSET` },
  { when: /\bCARD\s+READER\b/, path: `${A} > CARD READER` },
  { when: /\bUSB[- ]?C?\s*HUB\b|\bHUB\s+TYPE-C\b/, path: `${A} > KABEL / CONVERTER > USB HUB` },
  { when: /\bTHERMAL\s+PAS(TA|TE)\b/, path: `${A} > PASTA THERMAL` },
  { when: /^MEJA\b/, path: `${A} > MEJA GAMING` },
  { when: /^KURSI\b/, path: `${A} > KURSI GAMING` },
  { when: /\bTO\s+LIGHTNING\b|\bKABEL\s+LIGHTNING\b/, path: `${A} > KABEL / CONVERTER > KABEL LIGHTNING` },
  { when: /\bJACK\s+AUDIO\b|\bAUX\b|\bKABEL\s+AUDIO\b/, path: `${A} > KABEL / CONVERTER > KABEL AUDIO` },
]

async function main() {
  console.log(APPLY ? "*** MODE: APPLY ***" : "--- MODE: DRY RUN ---")

  const cats = await prisma.category.findMany({ select: { id: true, path: true, parentId: true } })
  const byPath = new Map(cats.map((c) => [c.path, c]))
  const byId = new Map(cats.map((c) => [c.id, c]))

  // Aturan yang menunjuk kategori tidak ada = salah ketik atau kategori berubah.
  const broken = RULES.filter((r) => !byPath.has(r.path))
  if (broken.length > 0) {
    console.error("DIBATALKAN: aturan menunjuk kategori yang tidak ada:")
    for (const b of broken) console.error(`   ${b.path}`)
    await prisma.$disconnect()
    process.exit(1)
  }

  const ancestorsOf = (id: number): number[] => {
    const chain: number[] = []
    let cur = byId.get(id)?.parentId ?? null
    for (let g = 0; cur !== null && g < 20; g += 1) {
      chain.unshift(cur)
      cur = byId.get(cur)?.parentId ?? null
    }
    return chain
  }

  const prods = await prisma.product.findMany({
    where: { parentId: null, type: { not: "VARIATION" }, status: "PUBLISHED", categories: { none: {} } },
    select: { id: true, wooId: true, name: true },
    orderBy: { name: "asc" },
  })

  const matched: { id: number; wooId: number; name: string; leaf: number; path: string }[] = []
  const unmatched: { wooId: number; name: string }[] = []

  for (const p of prods) {
    const n = p.name.toUpperCase()
    const rule = RULES.find((r) => r.when.test(n))
    if (!rule) {
      unmatched.push({ wooId: p.wooId, name: p.name })
      continue
    }
    matched.push({ id: p.id, wooId: p.wooId, name: p.name, leaf: byPath.get(rule.path)!.id, path: rule.path })
  }

  console.log(`\nPUBLISHED tanpa kategori : ${prods.length}`)
  console.log(`  cocok aturan           : ${matched.length}`)
  console.log(`  perlu tinjauan manual  : ${unmatched.length}`)

  const perPath = new Map<string, number>()
  for (const m of matched) perPath.set(m.path, (perPath.get(m.path) ?? 0) + 1)
  console.log("\n=== USULAN PENEMPATAN ===")
  for (const [path, n] of [...perPath.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)}  ${path}`)
  }

  console.log("\n=== PERLU DIPUTUSKAN MANUSIA ===")
  for (const u of unmatched) console.log(`  woo#${String(u.wooId).padEnd(6)} ${u.name.slice(0, 66)}`)

  if (!APPLY) {
    console.log("\n--- DRY RUN selesai. Jalankan ulang dengan --apply untuk menulis. ---")
    await prisma.$disconnect()
    return
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const backupPath = join("scripts", `backup-classify-${stamp}.json`)
  writeFileSync(
    backupPath,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        assigned: matched.map((m) => ({ productId: m.id, wooId: m.wooId, leaf: m.leaf, path: m.path })),
        unmatched,
      },
      null,
      2
    )
  )
  console.log(`\nbackup ditulis: ${backupPath}`)

  let links = 0
  await prisma.$transaction(
    async (tx) => {
      for (const m of matched) {
        for (const catId of [...ancestorsOf(m.leaf), m.leaf]) {
          await tx.productCategory.upsert({
            where: { productId_categoryId: { productId: m.id, categoryId: catId } },
            create: { productId: m.id, categoryId: catId },
            update: {},
          })
          links += 1
        }
      }
    },
    { timeout: 180000 }
  )

  console.log(`\nSELESAI. produk diberi kategori: ${matched.length} | kaitan dibuat: ${links}`)
  console.log(`Rollback: ${backupPath}`)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
