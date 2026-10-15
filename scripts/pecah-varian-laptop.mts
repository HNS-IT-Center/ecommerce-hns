/**
 * Pecah produk laptop SIMPLE yang mewakili beberapa barang Accurate sekaligus
 * jadi induk VARIABLE + satu VARIATION per warna, lalu tautkan tiap variasi ke
 * kode Accurate-nya.
 *
 * Latar (pemilik, 9 Okt 2026): nama produk laptop di web lazim memuat dua atau
 * tiga nomor part sekaligus — satu per warna — tanpa varian ("LENOVO IDEAPAD
 * FLEX 5 14ABR8 82XX00HTID 82XX00HUID ..."). Di Accurate tiap nomor part barang
 * tersendiri. Satu produk hanya bisa memegang satu kode (`accurate_code` unik),
 * jadi warna lainnya tidak pernah tertaut dan stoknya tidak sampai ke web.
 * Aturan pemilik: kode Accurate berawalan 2 (kode baru) dicari dulu, bukan
 * yang berawalan 1 (kode lama).
 *
 * Bedanya dengan gabung-varian-warna.mts (29 Sep): skrip itu membaca SKU
 * "kode1 / kode2"; skrip ini membaca NOMOR PART di nama produk, dan sekalian
 * MEMINDAH kode Accurate induk ke variasinya. gabung-varian-warna meninggalkan
 * kode di induk — 16 kode tersangkut begitu, lihat terapkan-usulan-tautan.mts.
 *
 * Hanya kasus bersih yang diproses; sisanya dilaporkan dengan alasannya:
 *  - produk SIMPLE yang tayang, namanya memuat >= 2 nomor part saudara (sama
 *    panjang, beda di ujung: 82XX00HTID / 82XX00HUID);
 *  - SETIAP nomor part di nama punya barang Accurate aktif yang sepadan: CPU,
 *    kapasitas, dan ukuran layar tidak bertentangan dengan nama produk. Ini
 *    perlu karena ASUS memakai ulang kode seperti VIPS7151M di model lain;
 *  - kalau satu nomor part punya kode berawalan 2, kode lain diabaikan;
 *  - warna tiap barang terbaca dari namanya dan berbeda satu sama lain;
 *  - kodenya ada di accurate_products, tidak ditandai tidak dijual di web, tidak
 *    menambat produk lain, dan tidak dipakai sebagai SKU produk lain;
 *  - kalau induk sudah bertaut, kodenya harus salah satu dari barang itu.
 *
 * Struktur variasinya sama dengan gabung-varian-warna: atribut WARNA, woo_id
 * >= 900.000.000, harga (dan tanggal akhir diskon) disalin dari induk — data
 * katalog yang ditetapkan staff, tidak dihitung (CLAUDE.md §2.7). Stok
 * dibiarkan kosong; sinkron stok Accurate yang mengisinya.
 *
 *   npx tsx --tsconfig scripts/tsconfig.uji.json --conditions=react-server scripts/pecah-varian-laptop.mts
 *   ... --tulis              # tulis ke database lokal
 *   ... --produksi           # uji kering terhadap PRODUKSI (baca saja)
 *   ... --produksi --tulis   # TULIS ke produksi
 *   ... --oleh "Nama"        # nama di log produk (bawaan: "Pecah varian laptop")
 *
 * Aman diulang: produk yang sudah VARIABLE tidak lagi memenuhi syarat. Berkas
 * pemulihan backup/pecah-varian-laptop-<waktu>.sql ditulis ulang setelah tiap
 * produk selesai, jadi selalu mencakup semua yang sudah tersimpan.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"

const arg = (nama: string) => {
  const i = process.argv.indexOf(nama)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const TULIS = process.argv.includes("--tulis")
const PRODUKSI = process.argv.includes("--produksi")
const OLEH = arg("--oleh") ?? "Pecah varian laptop"

const envMap: Record<string, string> = {}
for (const baris of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = baris.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (!m) continue
  envMap[m[1]!] = m[2]!.trim().replace(/^["']|["']$/g, "")
  process.env[m[1]!] ??= envMap[m[1]!]
}
if (PRODUKSI) {
  if (!envMap.PROD_DATABASE_URL) {
    console.error("PROD_DATABASE_URL tidak ada di .env.local — berhenti (tidak menyentuh produksi).")
    process.exit(1)
  }
  process.env.DATABASE_URL = envMap.PROD_DATABASE_URL
}

const { getPrisma } = await import("../src/lib/prisma/client.ts")
const { ProductType, ProductSource } = await import("@prisma/client")
const { tautkanKode } = await import("../src/lib/api/accurate/price-table.ts")
const prisma = getPrisma()

const url = new URL((process.env.DATABASE_URL ?? "").replace(/^mysql:/, "http:"))
console.log(`\nDatabase : ${url.pathname.slice(1)} @ ${url.hostname}${PRODUKSI ? "  ← PRODUKSI" : ""}`)
console.log(`Mode     : ${TULIS ? "MENULIS" : "uji kering (tidak menulis apa pun)"}\n`)

// ---------------------------------------------------------------------------
// Membaca nama
// ---------------------------------------------------------------------------

const token = (s: string) => s.toUpperCase().match(/[A-Z0-9]+/g) ?? []
const mirippart = (t: string) => t.length >= 7 && (t.match(/\d/g)?.length ?? 0) >= 2 && (t.match(/[A-Z]/g)?.length ?? 0) >= 2

/** Kode yang hampir sama tapi beda di ujung — 82XX00HTID vs 82XX00HUID. Sama dengan cocokkan-tautan-accurate. */
function nyarisSama(a: string, b: string): boolean {
  if (a === b || a.length < 5 || b.length < 5) return false
  let awal = 0
  while (awal < a.length && awal < b.length && a[awal] === b[awal]) awal++
  let akhir = 0
  while (akhir < a.length - awal && akhir < b.length - awal && a[a.length - 1 - akhir] === b[b.length - 1 - akhir]) akhir++
  return awal + akhir >= Math.min(a.length, b.length) - 2 && awal + akhir >= 4
}

const pola = (t: string) => t.replace(/[A-Z]/g, "A").replace(/\d/g, "9")
/**
 * Nomor part di nama produk yang punya saudara di nama yang sama, ditambah
 * kode lain yang sepola dengan mereka. Nomor part Apple MW0W3ID dan MW0Y3ID
 * bersaudara, MC6T4ID tidak "nyaris sama" dengan keduanya tapi jelas warna
 * ketiga dari keluarga yang sama — kalau ia terlewat, memecah produknya
 * diam-diam menghapus warna itu dari web.
 */
function nomorPartKembar(nama: string): string[] {
  const ts = [...new Set(token(nama).filter(mirippart))]
  const kembar = ts.filter((t) => ts.some((u) => u !== t && u.length === t.length && nyarisSama(t, u)))
  return ts.filter((t) => kembar.includes(t) || kembar.some((k) => k.length === t.length && pola(k) === pola(t)))
}

/** CPU, kapasitas, dan ukuran layar — cukup untuk membedakan model yang memakai kode ASUS yang sama. */
function spesifikasi(nama: string) {
  const s = nama.toUpperCase().replace(/[″“”]/g, '"').replace(/''/g, '"')
  const ts = token(s)
  return {
    cpu: new Set(ts.filter((t) => /^\d{3,5}[HUPGS]{1,2}$/.test(t) || /^N\d{3,4}$/.test(t))),
    kap: new Set([...s.matchAll(/(\d+)\s*(GB|TB)\b/g)].map((m) => String(Number(m[1]) * (m[2] === "TB" ? 1000 : 1)))),
    inci: new Set([...s.matchAll(/(?<![\d.])(\d{2}(?:\.\d)?)\s*(?:"|INCH)/g)].map((m) => Number(m[1]))),
  }
}
function bertentangan(web: ReturnType<typeof spesifikasi>, acc: ReturnType<typeof spesifikasi>): string | null {
  if (web.cpu.size && acc.cpu.size && ![...acc.cpu].some((c) => web.cpu.has(c))) return `CPU ${[...acc.cpu].join("/")} ≠ ${[...web.cpu].join("/")}`
  const kA = [...acc.kap].filter((k) => !web.kap.has(k))
  const kW = [...web.kap].filter((k) => !acc.kap.has(k))
  if (acc.kap.size && web.kap.size && kA.length && kW.length) return `kapasitas ${kA.join("/")} ≠ ${kW.join("/")}`
  const iA = [...acc.inci].filter((x) => ![...web.inci].some((y) => Math.abs(x - y) <= 0.6))
  if (acc.inci.size && web.inci.size && iA.length) return `layar ${iA.join("/")}" ≠ ${[...web.inci].join("/")}"`
  return null
}

const WARNA_DASAR = new Set([
  "GREY", "GRAY", "BLUE", "BLACK", "WHITE", "SILVER", "GOLD", "GREEN", "PINK", "RED", "PURPLE", "STARLIGHT",
  "MIDNIGHT", "COTTA", "TERACOTTA", "TERRACOTTA", "BEIGE", "CREAM", "ORANGE", "YELLOW", "GRAPHITE", "TEAL", "NAVY",
])
/** Kata di depan warna yang BUKAN bagian nama warna ("WUXGA LUNA GREY" -> LUNA GREY; "VIPS GREY" -> GREY). */
const BUKAN_WARNA = new Set(["VIPS", "FHD", "WUXGA", "QHD", "OLED", "TOUCH", "IPS", "TN", "HOME", "SSD", "WIN", "OHS", "OHM", "OFFICE", "NEW", "NB", "LAPTOP", "AND"])
/**
 * Warna dari nama barang Accurate: isi kurung di ujung ("(ABYSS BLUE)",
 * "(ABYSS BLUE))"), atau satu-dua kata warna di ujung nama ("... M365 LUNA
 * GREY", "... SILVER - MW0W3ID").
 */
function warnaDari(nama: string): string | null {
  const s = nama.toUpperCase().trim()
  const kurung = s.match(/\(([^()]+)\)+\s*$/)
  if (kurung) {
    const isi = kurung[1]!.trim().replace(/\s+/g, " ")
    return /\d/.test(isi) || isi.length > 30 ? null : isi
  }
  const kata = s.replace(/\s+-\s+[A-Z0-9]+$/, "").split(/\s+/)
  const akhir = kata[kata.length - 1]
  if (!akhir || !WARNA_DASAR.has(akhir)) return null
  const depan = kata[kata.length - 2]
  return depan && /^[A-Z]{3,}$/.test(depan) && !BUKAN_WARNA.has(depan) ? `${depan} ${akhir}` : akhir
}
const kunciWarna = (w: string) => w.replace(/[^A-Z]/g, "").replace(/GRAY/g, "GREY")
const prioritasKode = (k: string) => (/^2\d{9}$/.test(k) ? 2 : /^1\d{5}$/.test(k) ? 1 : 0)

function slugify(name: string, wooId: number): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "") + `-${wooId}`
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const calon = await prisma.product.findMany({
  where: { type: ProductType.SIMPLE, status: "PUBLISHED" },
  select: {
    id: true, wooId: true, name: true, sku: true, status: true, accurateCode: true,
    regularPrice: true, salePrice: true, saleEndDate: true,
  },
})
// Barang Accurate dari accurate_products (impor Sheet), BUKAN accurate_items:
// accurate_items baru ada di database yang sudah menjalankan migrasi sinkron
// stok (F2), dan uji kering pertama ke produksi 10 Okt gagal karenanya.
// accurate_products juga tabel yang diwajibkan tautkanKode. STATUS "YA" =
// dihentikan — 1.150 dari 1.152 barang itu juga nonaktif menurut API.
const barangAktif = await prisma.$queryRawUnsafe<{ kode: string; nama: string }[]>(
  "SELECT `Kode Accurate` AS kode, `NAMA BARANG` AS nama FROM accurate_products WHERE COALESCE(`STATUS`, '') <> 'YA' AND `NAMA BARANG` IS NOT NULL",
)
const perToken = new Map<string, { kode: string; nama: string }[]>()
for (const b of barangAktif) {
  for (const t of new Set(token(b.nama).filter(mirippart))) perToken.set(t, [...(perToken.get(t) ?? []), b])
}
const diSheet = new Set(
  (await prisma.$queryRawUnsafe<{ k: string }[]>("SELECT `Kode Accurate` AS k FROM accurate_products")).map((r) => r.k),
)
const diabaikan = new Set(
  (await prisma.$queryRawUnsafe<{ k: string }[]>("SELECT kode_accurate AS k FROM accurate_ignored")).map((r) => r.k),
)
const pemegangKode = new Map(
  (await prisma.product.findMany({ where: { accurateCode: { not: null } }, select: { id: true, accurateCode: true } })).map(
    (p) => [p.accurateCode!, p.id],
  ),
)
const pemegangSku = new Map(
  (await prisma.product.findMany({ where: { sku: { not: null } }, select: { id: true, sku: true } })).map((p) => [p.sku!, p.id]),
)

// ---------------------------------------------------------------------------
// Rencana
// ---------------------------------------------------------------------------

type Varian = { kode: string; warna: string; part: string; namaAccurate: string }
type Rencana = (typeof calon)[number] & { varian: Varian[]; catatan: string[] }
const rencana: Rencana[] = []
const dilewati: { p: (typeof calon)[number]; alasan: string; rincian: string[] }[] = []
const cukupTautkan: (typeof calon)[number][] = []

for (const p of calon) {
  const parts = nomorPartKembar(p.name)
  if (parts.length < 2) continue
  const specWeb = spesifikasi(p.name)
  const rincian: string[] = []
  const varian: Varian[] = []
  const tanpaBarang: string[] = []
  let gagal: string | null = null
  for (const part of parts) {
    const semua = perToken.get(part) ?? []
    const cocok = semua.filter((b) => {
      const beda = bertentangan(specWeb, spesifikasi(b.nama))
      if (beda) rincian.push(`${part}: ${b.kode} diabaikan — ${beda}`)
      return !beda
    })
    // Aturan pemilik: kode baru (berawalan 2) dicari dulu.
    const puncak = Math.max(-1, ...cocok.map((b) => prioritasKode(b.kode)))
    const pakai = cocok.filter((b) => prioritasKode(b.kode) === puncak)
    for (const b of cocok) if (!pakai.includes(b)) rincian.push(`${part}: ${b.kode} diabaikan — ada kode yang lebih baru`)
    if (!pakai.length) {
      tanpaBarang.push(part)
      continue
    }
    for (const b of pakai) {
      const warna = warnaDari(b.nama)
      if (!warna) gagal ??= `warna ${b.kode} tidak terbaca dari namanya`
      else varian.push({ kode: b.kode, warna, part, namaAccurate: b.nama })
    }
  }
  const tolak = (alasan: string) => dilewati.push({ p, alasan, rincian })
  // Hanya satu nomor part yang ada di Accurate: produknya cukup ditautkan
  // biasa (cocokkan-tautan-accurate), tidak perlu dipecah.
  if (parts.length - tanpaBarang.length < 2) {
    cukupTautkan.push(p)
    continue
  }
  if (tanpaBarang.length) {
    tolak(`nomor part ${tanpaBarang.join(", ")} tidak punya barang Accurate aktif yang sepadan — kalau dipecah, warna itu hilang dari web`)
    continue
  }
  if (gagal) {
    tolak(gagal)
    continue
  }
  const perWarna = new Map<string, Varian[]>()
  for (const v of varian) perWarna.set(kunciWarna(v.warna), [...(perWarna.get(kunciWarna(v.warna)) ?? []), v])
  const dobel = [...perWarna.values()].find((arr) => arr.length > 1)
  if (dobel) {
    tolak(`warna ${dobel[0]!.warna} dipakai ${dobel.length} barang (${dobel.map((v) => v.kode).join(", ")}) — kemungkinan barang dobel di Accurate`)
    continue
  }
  if (varian.length < 2) {
    tolak("hanya satu barang Accurate — tidak perlu dipecah")
    continue
  }
  const masalah = varian.flatMap((v) => {
    const r: string[] = []
    if (!diSheet.has(v.kode)) r.push(`${v.kode} belum ada di accurate_products (impor Sheet dulu)`)
    if (diabaikan.has(v.kode)) r.push(`${v.kode} ditandai tidak dijual di web`)
    const pk = pemegangKode.get(v.kode)
    if (pk !== undefined && pk !== p.id) r.push(`${v.kode} sudah menambat produk lain`)
    const ps = pemegangSku.get(v.kode)
    if (ps !== undefined && ps !== p.id) r.push(`${v.kode} sudah jadi SKU produk lain`)
    return r
  })
  if (p.accurateCode && !varian.some((v) => v.kode === p.accurateCode)) {
    masalah.push(`induk tertaut ke ${p.accurateCode}, yang bukan salah satu barang di atas`)
  }
  if (masalah.length) {
    tolak(masalah.join("; "))
    continue
  }
  rencana.push({ ...p, varian, catatan: rincian })
}

console.log(`=== RENCANA ===`)
console.log(`Produk yang dipecah : ${rencana.length}`)
console.log(`Variasi baru        : ${rencana.reduce((s, r) => s + r.varian.length, 0)}`)
console.log(`Dilewati            : ${dilewati.length} (tangani manual, daftar di bawah)`)
console.log(`Tidak perlu dipecah : ${cukupTautkan.length} (hanya satu warna yang ada di Accurate — cukup ditautkan biasa)\n`)
for (const r of rencana) {
  console.log(`#${r.wooId} ${r.name}`)
  console.log(`   SKU ${r.sku ?? "-"} | kode induk ${r.accurateCode ?? "-"}${r.accurateCode ? " (dipindah ke variasinya)" : ""}`)
  for (const v of r.varian) console.log(`   - ${v.warna.padEnd(16)} ${v.kode}  (${v.part})`)
  for (const c of r.catatan) console.log(`     ~ ${c}`)
}
if (dilewati.length) {
  console.log(`\n=== DILEWATI (tangani manual) ===`)
  for (const d of dilewati) {
    console.log(`#${d.p.wooId} ${d.p.name.slice(0, 90)}\n   alasan: ${d.alasan}`)
    for (const c of d.rincian) console.log(`     ~ ${c}`)
  }
}

if (!TULIS) {
  console.log("\nUji kering selesai — tidak ada yang ditulis. Tambahkan --tulis untuk menulis.")
  await prisma.$disconnect()
  process.exit(0)
}
if (rencana.length === 0) {
  console.log("\nTidak ada produk yang perlu dipecah.")
  await prisma.$disconnect()
  process.exit(0)
}

// ---------------------------------------------------------------------------
// Tulis
// ---------------------------------------------------------------------------

mkdirSync("backup", { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, "-")
const berkasBackup = `backup/pecah-varian-laptop-${stamp}.sql`
const kutip = (s: string | null) => (s === null ? "NULL" : `'${s.replace(/'/g, "''")}'`)
let backupSql =
  `-- Pemulihan pecah-varian-laptop, ${new Date().toISOString()}, database ${url.pathname.slice(1)} @ ${url.hostname}${PRODUKSI ? " (PRODUKSI)" : ""}\n` +
  `-- Per produk: lepaskan kode variasinya, hapus variasinya (atributnya ikut terhapus),\n` +
  `-- lalu kembalikan induk ke SIMPLE dengan SKU dan kode Accurate semula. Urutannya penting:\n` +
  `-- kode dan SKU unik, jadi variasinya harus melepasnya dulu.\n\n`
writeFileSync(berkasBackup, backupSql)
console.log(`\nBerkas pemulihan: ${berkasBackup}`)

const atribut = await prisma.attribute.upsert({ where: { name: "WARNA" }, create: { name: "WARNA" }, update: {} })

let dipecah = 0
let ditautkan = 0
const gagal: string[] = []
for (const [i, r] of rencana.entries()) {
  console.log(`[${i + 1}/${rencana.length}] #${r.wooId} ${r.name.slice(0, 60)}...`)
  const dibuat: { id: number; wooId: number; kode: string }[] = []
  try {
    await prisma.$transaction(
      async (tx) => {
        // SKU induk dikosongkan DULU: SKU unik, dan variasinya akan memakai kode
        // yang mungkin sama dengan SKU induk sekarang.
        // `select: { id }` di setiap create/update produk: tanpa itu Prisma membaca
        // balik SEMUA kolom, termasuk stock_synced_at milik migrasi F2 yang belum
        // ada di produksi selama F2 belum di-deploy.
        await tx.product.update({ where: { id: r.id }, data: { type: ProductType.VARIABLE, sku: null }, select: { id: true } })
        for (const [posisi, v] of r.varian.entries()) {
          const nilai = await tx.attributeValue.upsert({
            where: { attributeId_value: { attributeId: atribut.id, value: v.warna } },
            create: { attributeId: atribut.id, value: v.warna },
            update: {},
          })
          const maks = await tx.product.aggregate({ _max: { wooId: true }, where: { wooId: { gte: 900_000_000 } } })
          const wooId = Math.max(maks._max.wooId ?? 0, 900_000_000 - 1) + 1
          const nama = `${r.name} - ${v.warna}`
          const baru = await tx.product.create({
            data: {
              wooId,
              source: ProductSource.LOCAL,
              type: ProductType.VARIATION,
              status: r.status,
              parentId: r.id,
              name: nama,
              slug: slugify(nama, wooId),
              sku: v.kode,
              regularPrice: r.regularPrice,
              salePrice: r.salePrice,
              saleEndDate: r.saleEndDate,
            },
            select: { id: true },
          })
          await tx.productAttribute.create({
            data: { productId: baru.id, attributeId: atribut.id, valueId: nilai.id, position: posisi },
          })
          dibuat.push({ id: baru.id, wooId, kode: v.kode })
        }
      },
      { timeout: 30000 },
    )
  } catch (e) {
    gagal.push(`#${r.wooId}: ${e instanceof Error ? e.message : String(e)} (tidak ada yang tersimpan untuk produk ini)`)
    continue
  }
  dipecah++
  const ids = dibuat.map((d) => d.id).join(",")
  backupSql +=
    `-- Induk #${r.wooId} (id ${r.id}) ${r.name.replace(/\n/g, " ")}\n` +
    `UPDATE products SET accurate_code = NULL WHERE id IN (${ids});\n` +
    `DELETE FROM products WHERE id IN (${ids});\n` +
    `UPDATE products SET type = 'SIMPLE', sku = ${kutip(r.sku)}, accurate_code = ${kutip(r.accurateCode)} WHERE id = ${r.id};\n\n`
  writeFileSync(berkasBackup, backupSql)

  // Tautan lewat jalur yang sama dengan tombol Tautkan (tercatat di product_logs).
  if (r.accurateCode) {
    const lepas = await tautkanKode(r.wooId, null, OLEH)
    if (!lepas.ok) {
      gagal.push(`#${r.wooId}: gagal melepas kode induk ${r.accurateCode}: ${lepas.alasan}`)
      continue
    }
  }
  for (const d of dibuat) {
    const h = await tautkanKode(d.wooId, d.kode, OLEH, { isiSku: true })
    if (h.ok) ditautkan++
    else gagal.push(`#${r.wooId} variasi ${d.wooId}: ${d.kode} gagal ditautkan: ${h.alasan}`)
  }
}

// --- Verifikasi -------------------------------------------------------------
const induk = await prisma.product.findMany({
  where: { id: { in: rencana.map((r) => r.id) } },
  select: { type: true, accurateCode: true, variations: { select: { accurateCode: true, sku: true } } },
})
const variasiCocok = induk.flatMap((p) => p.variations).filter((v) => v.accurateCode !== null && v.accurateCode === v.sku).length
console.log(`\n=== HASIL ===`)
console.log(`Produk dipecah        : ${dipecah} dari ${rencana.length}`)
console.log(`Variasi tertaut       : ${ditautkan} (terverifikasi di DB: ${variasiCocok})`)
console.log(`Induk masih berkode   : ${induk.filter((p) => p.accurateCode !== null).length}`)
console.log(`Gagal                 : ${gagal.length}`)
for (const g of gagal) console.log(`  ${g}`)
console.log(`Berkas pemulihan      : ${berkasBackup}`)
await prisma.$disconnect()
