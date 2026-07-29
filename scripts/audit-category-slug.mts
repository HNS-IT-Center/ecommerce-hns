/**
 * AUDIT #4 — READ-ONLY. Tidak menulis apa pun ke database.
 *
 * Membandingkan slug yang tersimpan dengan slug yang AKAN dihasilkan konvensi
 * `slugFromPath` dari path sekarang, lalu mengelompokkan penyebab selisihnya.
 */
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

const { getPrisma } = await import("../src/lib/prisma/client")
const p = getPrisma()

/** Konvensi yang dipakai createCategory di src/lib/api/woocommerce/categories.ts */
const slugFromPath = (path: string) =>
  path.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "")

const cats = await p.category.findMany({
  select: { id: true, name: true, slug: true, path: true, depth: true, parentId: true },
  orderBy: { path: "asc" },
})

type Row = (typeof cats)[number] & { expected: string; sebab: string }
const rows: Row[] = cats.map((c) => {
  const expected = slugFromPath(c.path)
  let sebab = "cocok"
  if (c.slug !== expected) {
    const namaSaja = slugFromPath(c.name)
    const parent = c.parentId === null ? null : cats.find((x) => x.id === c.parentId)
    if (c.slug === namaSaja) sebab = "slug = nama saja (tanpa jalur induk)"
    else if (parent && !c.slug.startsWith(slugFromPath(parent.path))) sebab = "slug menyebut induk LAMA"
    else if (!c.slug.includes(namaSaja)) sebab = "slug menyebut nama LAMA / terpotong"
    else sebab = "selisih penulisan"
  }
  return { ...c, expected, sebab }
})

const beda = rows.filter((r) => r.slug !== r.expected)

console.log("=== RINGKASAN ===")
console.log(`Total kategori          : ${cats.length}`)
console.log(`Slug sesuai path        : ${cats.length - beda.length}`)
console.log(`Slug TIDAK sesuai path  : ${beda.length}`)
console.log(`Seluruh ${cats.length} URL kategori saat ini AKTIF (slug unik, tidak ada yang mati).`)

console.log("\n=== SEBAB SELISIH ===")
const grup = new Map<string, Row[]>()
for (const r of beda) {
  if (!grup.has(r.sebab)) grup.set(r.sebab, [])
  grup.get(r.sebab)!.push(r)
}
for (const [sebab, list] of [...grup].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n  ${list.length}x — ${sebab}`)
  for (const r of list.slice(0, 40)) {
    console.log(`     path : ${r.path}`)
    console.log(`     slug : ${r.slug}`)
    console.log(`     jadi : ${r.expected}`)
  }
  if (list.length > 40) console.log(`     ... dan ${list.length - 40} lagi`)
}

console.log("\n=== KALAU SLUG DISELARASKAN ===")
console.log(`URL kategori yang berubah  : ${beda.length} dari ${cats.length}`)
console.log(`Redirect 301 yang dibutuhkan: ${beda.length}`)

// Tabrakan kalau slug diregenerasi
const calon = new Map<string, string[]>()
for (const r of rows) {
  if (!calon.has(r.expected)) calon.set(r.expected, [])
  calon.get(r.expected)!.push(r.path)
}
const tabrakan = [...calon].filter(([, v]) => v.length > 1)
console.log(`Slug baru yang bertabrakan : ${tabrakan.length}`)
for (const [slug, paths] of tabrakan) console.log(`   "${slug}" <- ${paths.join(" | ")}`)

const panjang = rows.filter((r) => r.expected.length > 191)
console.log(`Slug baru melewati batas kolom (191): ${panjang.length}`)

console.log("\n=== SLUG TERPANJANG SAAT INI ===")
for (const r of [...cats].sort((a, b) => b.slug.length - a.slug.length).slice(0, 5)) {
  console.log(`  ${String(r.slug.length).padStart(3)} — ${r.slug}`)
}

console.log("\n=== SLUG YANG MENGANDUNG NAMA MEREK (sisa kategori merek lama) ===")
for (const r of cats.filter((c) => /apple|playstation|epson|brother|canon|nvidia|radeon|colorful/i.test(c.slug))) {
  console.log(`  ${r.path}\n     slug: ${r.slug}`)
}

await p.$disconnect()
