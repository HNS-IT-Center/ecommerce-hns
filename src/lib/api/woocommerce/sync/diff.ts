import { decodeHtmlEntities } from "@/lib/utils/html"
import type { LocalCatalogSnapshot } from "./local"
import type {
  NewProduct,
  NewProductGroup,
  PriceChange,
  RemoteProduct,
  SyncConflict,
  SyncPlan,
} from "./types"

/**
 * Perbandingan katalog WooCommerce dengan katalog kita.
 *
 * Fungsi murni: tidak menyentuh database, tidak memanggil jaringan, tidak
 * menulis apa pun. Semua yang dibutuhkannya dioper sebagai argumen, supaya
 * bisa diuji dengan data karangan tanpa koneksi ke mana pun — dan supaya
 * jelas bahwa membuat pratinjau tidak mungkin mengubah data.
 */

/**
 * Harga dari WooCommerce datang sebagai string: "2700000", "2700000.00", atau
 * "" untuk kosong.
 */
export function parseRemotePrice(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === "") return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Dua harga dianggap sama kalau sama sampai sen.
 *
 * Dibandingkan sebagai bilangan bulat sen, bukan `===` antar pecahan: sisi
 * kita datang dari `Decimal(14,2)` dan sisi WooCommerce dari string, dan dua
 * jalan itu bisa menghasilkan pecahan biner yang berbeda tipis untuk angka
 * yang sebenarnya sama. Tanpa ini, produk yang harganya tidak berubah bisa
 * muncul di daftar "berubah" dan membuat staff meninjau pekerjaan hantu.
 */
function samePrice(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return a === b
  return Math.round(a * 100) === Math.round(b * 100)
}

function parseDate(value: string): Date | null {
  // WooCommerce mengirim waktu GMT tanpa akhiran "Z". Tanpa ditambahkan,
  // `Date` menafsirkannya sebagai waktu lokal — tujuh jam meleset di WIB, dan
  // produk yang dibuat pagi hari bisa salah dikelompokkan.
  const withZone = /[Zz]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`
  const parsed = new Date(withZone)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function classifyNew(remote: RemoteProduct, boundary: Date | null): NewProductGroup {
  if (!boundary) return "baru"
  const created = parseDate(remote.date_created_gmt)
  // Tanggal yang tidak terbaca dianggap "tertinggal", bukan "baru": kelompok
  // tertinggal adalah yang ditinjau lebih hati-hati, dan tebakan yang salah
  // sebaiknya jatuh ke sana.
  if (!created) return "tertinggal"
  return created > boundary ? "baru" : "tertinggal"
}

function matchCategory(
  remote: RemoteProduct,
  // Hanya `has` yang dipakai di sini; pemilik data boleh Set maupun Map.
  known: { has(name: string): boolean },
): { names: string[]; matched: string | null } {
  // Nama kategori WooCommerce membawa entitas HTML ("PC MINI &amp; DESKTOP").
  // Tanpa didekode, tidak akan pernah cocok dengan taksonomi kita.
  const names = remote.categories.map((category) => decodeHtmlEntities(category.name).trim())
  const matched = names.find((name) => known.has(name.toUpperCase())) ?? null
  return { names, matched }
}

export function buildSyncPlan(
  remoteProducts: RemoteProduct[],
  snapshot: LocalCatalogSnapshot,
  meta: { scannedAt: Date; remoteCount: number },
): SyncPlan {
  const newProducts: NewProduct[] = []
  const priceChanges: PriceChange[] = []
  const conflicts: SyncConflict[] = []
  let skippedVariableParents = 0
  let skippedEmptyRemotePrice = 0

  for (const remote of remoteProducts) {
    const local = snapshot.byWooId.get(remote.id)
    const name = decodeHtmlEntities(remote.name)

    if (!local) {
      const { names, matched } = matchCategory(remote, snapshot.categoryIdByName)
      newProducts.push({
        wooId: remote.id,
        name,
        type: remote.type,
        status: remote.status,
        regularPrice: parseRemotePrice(remote.regular_price),
        salePrice: parseRemotePrice(remote.sale_price),
        createdAt: remote.date_created_gmt,
        group: classifyNew(remote, snapshot.lastImportedAt),
        categoryNames: names,
        matchedCategory: matched,
        variationCount: remote.variations.length,
      })
      continue
    }

    // Nomor yang dipegang produk buatan panel admin. Mengimpor akan menabrak
    // `@unique`, menimpa akan menghancurkan pekerjaan staff — jadi dilaporkan.
    if (local.source === "LOCAL") {
      conflicts.push({ wooId: remote.id, remoteName: name, localName: local.name })
      continue
    }

    // Induk variable dilewati SEBELUM apa pun dibandingkan.
    //
    // WooCommerce menyimpan harga varian di tiap varian, dan membiarkan
    // `regular_price` induknya kosong. Tanpa penjagaan ini, ke-823 produk
    // variable kita muncul sebagai "harga berubah menjadi kosong" — dan
    // menerapkannya akan menghapus harga yang tampil ke pelanggan untuk
    // seperempat katalog. Harga varian ditangani terpisah.
    if (remote.type === "variable") {
      skippedVariableParents++
      continue
    }

    const remoteRegular = parseRemotePrice(remote.regular_price)
    const remoteSale = parseRemotePrice(remote.sale_price)
    if (samePrice(local.regularPrice, remoteRegular) && samePrice(local.salePrice, remoteSale)) {
      continue
    }

    // Sabuk pengaman kedua, untuk tipe produk yang belum kita temui: harga
    // kosong di sumber tidak pernah menjadi alasan mengosongkan harga di sini.
    if (remoteRegular === null && local.regularPrice !== null) {
      skippedEmptyRemotePrice++
      continue
    }

    priceChanges.push({
      wooId: remote.id,
      name: local.name,
      local: { regularPrice: local.regularPrice, salePrice: local.salePrice },
      remote: { regularPrice: remoteRegular, salePrice: remoteSale },
      editedInPanel: snapshot.priceEditedWooIds.has(remote.id),
    })
  }

  // Urutan yang membantu mata: yang paling mungkin butuh perhatian di atas.
  newProducts.sort((a, b) => (a.group === b.group ? b.wooId - a.wooId : a.group === "baru" ? -1 : 1))
  priceChanges.sort((a, b) => Number(b.editedInPanel) - Number(a.editedInPanel) || a.name.localeCompare(b.name))

  return {
    scannedAt: meta.scannedAt.toISOString(),
    importBoundary: snapshot.lastImportedAt?.toISOString() ?? null,
    remoteCount: meta.remoteCount,
    localCount: snapshot.byWooId.size,
    newProducts,
    priceChanges,
    conflicts,
    skippedVariableParents,
    skippedEmptyRemotePrice,
  }
}
