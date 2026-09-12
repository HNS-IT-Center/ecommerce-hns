/**
 * Mengisi `categories.woo_slug` dari WooCommerce yang masih hidup.
 *
 * Jalankan:
 *   npx tsx scripts/isi-category-woo-slug.mts            # dry-run (default)
 *   npx tsx scripts/isi-category-woo-slug.mts --apply    # benar-benar menulis
 *
 * ============================================================================
 * WAJIB: DECODE ENTITAS HTML SEBELUM MEMBANDINGKAN NAMA
 * ============================================================================
 * WooCommerce REST API mengembalikan nama kategori dalam bentuk TER-ENCODE:
 * "FIT &amp; HEALTH", bukan "FIT & HEALTH". Membandingkannya mentah-mentah
 * dengan nama di store membuat setiap kategori bertanda `&` gagal cocok —
 * dan gagalnya DIAM-DIAM, cuma terlihat sebagai "tidak ada padanan".
 *
 * Ini sudah terjadi DUA KALI:
 *   1. Di data layer storefront — kategori tampil sebagai "FIT &AMP; HEALTH".
 *   2. Saat menghitung peta ini, 2 September 2026 — tiga kategori
 *      (GYM & FITNESS, POWERBANK & CHARGER, PRINTER & PROYEKTOR) terlaporkan
 *      hilang, dan angkanya salah jadi 87 sebelum ketahuan seharusnya 90.
 *
 * Karena itu `deEnt()` di bawah dipanggil di SETIAP tempat nama Woo dibaca.
 * Jangan hapus, dan jangan bandingkan `k.name` mentah. Kalau menambah
 * pembacaan nama baru dari API, bungkus dengan deEnt() juga.
 * ============================================================================
 *
 * Yang diisi: 101 kategori (90 NAMA COCOK + 11 IDENTIK).
 * Yang TIDAK diisi: 17 slug Woo yang sebenarnya merek — diarahkan ke
 * /shop?brand= lewat peta di route, bukan lewat kolom ini.
 *
 * Isi kolom = SEGMEN TERAKHIR alamat lama, bukan path penuh. Lihat komentar
 * di prisma/schema.prisma untuk alasannya.
 */
import { PrismaClient } from "@prisma/client"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"
import fs from "node:fs"

const APPLY = process.argv.includes("--apply")

/** Decode entitas HTML dari WooCommerce API. JANGAN HAPUS — baca blok di atas. */
function deEnt(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&#0?38;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&#8217;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8211;|&#8212;/g, "-")
}
const norm = (s: string | null | undefined) =>
  deEnt(s).trim().toUpperCase().replace(/\s+/g, " ")

const envWoo = fs.readFileSync(
  "C:/Users/HNS IT CENTER/Documents/Project/update-price-woo/.env.local", "utf8")
const gw = (k: string) =>
  (envWoo.match(new RegExp("^" + k + '="?([^"\n\r]*)"?', "m")) || [])[1]
const WOO = gw("WOO_URL"), CK = gw("WOO_CONSUMER_KEY"), CS = gw("WOO_CONSUMER_SECRET")

const url = fs.readFileSync(".env.production.local", "utf8")
  .match(/^DATABASE_URL="?([^"\n\r]+)"?/m)![1]
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(url) })

type WooKat = { id: number; slug: string; name: string; parent: number; count: number }

async function main() {
  // 1. tarik kategori Woo
  const kat: WooKat[] = []
  for (let p = 1; ; p++) {
    const r = await fetch(
      `${WOO}/wp-json/wc/v3/products/categories?per_page=100&page=${p}&consumer_key=${CK}&consumer_secret=${CS}`,
      { signal: AbortSignal.timeout(30000) })
    const j = await r.json()
    if (!Array.isArray(j) || j.length === 0) break
    kat.push(...j); if (j.length < 100) break
  }
  console.log(`kategori Woo (API hidup) : ${kat.length}`)

  const byId = new Map(kat.map(k => [k.id, k]))
  const segmenTerakhir = (k: WooKat) => k.slug   // segmen terakhir = slug-nya sendiri
  const pathPenuh = (k: WooKat) => {
    const seg: string[] = []; let cur: WooKat | undefined = k, g = 0
    while (cur && g++ < 10) { seg.unshift(cur.slug); cur = cur.parent ? byId.get(cur.parent) : undefined }
    return seg.join("/")
  }

  // 2. kategori store
  const cats = await prisma.category.findMany({ select: { id: true, name: true, slug: true, path: true } })
  const bySlug = new Map(cats.map(c => [c.slug, c]))
  const byName = new Map(cats.map(c => [norm(c.name), c]))

  // 3. pasangkan
  const akanIsi: { id: number; slug: string; wooSlug: string; cara: string; path: string }[] = []
  const takKetemu: { wooSlug: string; wooName: string; count: number }[] = []
  const dipakai = new Map<string, string>()
  const bentrok: string[] = []

  for (const k of kat) {
    const hit = bySlug.get(k.slug) ?? byName.get(norm(k.name))
    if (!hit) { takKetemu.push({ wooSlug: k.slug, wooName: deEnt(k.name), count: k.count }); continue }
    const seg = segmenTerakhir(k)
    if (dipakai.has(seg)) { bentrok.push(`${seg}: ${dipakai.get(seg)} vs ${hit.slug}`); continue }
    dipakai.set(seg, hit.slug)
    akanIsi.push({ id: hit.id, slug: hit.slug, wooSlug: seg,
      cara: bySlug.has(k.slug) ? "IDENTIK" : "NAMA COCOK", path: pathPenuh(k) })
  }

  console.log(`\n=== ${APPLY ? "APPLY" : "DRY-RUN — tidak ada yang ditulis"} ===`)
  console.log(`AKAN TERISI      : ${akanIsi.length}`)
  console.log(`  IDENTIK        : ${akanIsi.filter(a => a.cara === "IDENTIK").length}`)
  console.log(`  NAMA COCOK     : ${akanIsi.filter(a => a.cara === "NAMA COCOK").length}`)
  console.log(`TIDAK KETEMU     : ${takKetemu.length}  (${takKetemu.reduce((a, r) => a + r.count, 0)} produk)`)
  console.log(`BENTROK unique   : ${bentrok.length}`)
  if (bentrok.length) { for (const b of bentrok) console.log(`   ${b}`) }

  console.log(`\ncontoh yang akan terisi (bertingkat):`)
  for (const a of akanIsi.filter(a => a.path.includes("/")).slice(0, 6))
    console.log(`  ${a.wooSlug.padEnd(26)} <- /${a.path}/\n     -> ${a.slug}`)

  console.log(`\ntidak ketemu (akan diarahkan ke /shop atau /shop?brand=):`)
  for (const t of takKetemu.slice(0, 8)) console.log(`  ${t.wooSlug.padEnd(26)} "${t.wooName}" (${t.count})`)
  if (takKetemu.length > 8) console.log(`  ... dan ${takKetemu.length - 8} lagi`)

  if (!APPLY) {
    console.log(`\n>>> DRY-RUN selesai. Tidak ada baris yang ditulis.`)
    console.log(`>>> Jalankan ulang dengan --apply untuk menulis ${akanIsi.length} baris.`)
    await prisma.$disconnect(); return
  }

  if (bentrok.length) {
    console.log(`\n>>> BERHENTI: ada bentrok unique. Tidak menulis apa pun.`)
    await prisma.$disconnect(); process.exit(1)
  }

  let n = 0
  for (const a of akanIsi) {
    await prisma.category.update({ where: { id: a.id }, data: { wooSlug: a.wooSlug } })
    n++
  }
  const terisi = await prisma.category.count({ where: { wooSlug: { not: null } } })
  const total = await prisma.category.count()
  console.log(`\nditulis  : ${n}`)
  console.log(`terisi   : ${terisi}`)
  console.log(`kategori : ${total}  (harus tetap 108)`)
  await prisma.$disconnect()
}

main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1) })
