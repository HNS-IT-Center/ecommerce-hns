import "server-only"

import { Prisma } from "@prisma/client"

import { getPrisma } from "@/lib/prisma/client"
import { buildVariationLabel, cheapestAvailableVariation } from "@/lib/utils/variation"
import type { AttributeRequirementGroup } from "@/lib/pc-builder/compatibility"
import { pageIdsByCardPrice, reorderByIds } from "@/lib/pc-builder/price-sort"

/**
 * Pencarian produk untuk panel PC Prebuild.
 *
 * ## Kenapa TIDAK memakai `fetchBuilderProducts`
 *
 * Dulu alasannya tipe: wizard mengunci `type: "SIMPLE"` karena belum punya UI
 * untuk memilih varian. Alasan itu sudah gugur — sejak
 * `VariationPickerDialog` ada, `fetchBuilderProducts` juga mengembalikan
 * SIMPLE + VARIABLE dengan aturan yang sama persis seperti di sini
 * ([features/builder/actions.ts](../../features/builder/actions.ts)).
 *
 * Yang tersisa sebagai pembeda adalah PEMAKAINYA. Berkas ini melayani panel
 * admin: tidak menerapkan sakelar tampilan stok pelanggan, tidak memakai bentuk
 * `BuilderProduct` milik store wizard, dan bebas berubah mengikuti kebutuhan
 * penyusunan paket tanpa menyentuh jalur yang dipakai pelanggan. Menyatukan
 * keduanya berarti setiap perubahan di panel admin ikut mengubah grid yang
 * dilihat pelanggan.
 *
 * Yang HARUS tetap dijaga: produk VARIABLE tidak boleh masuk rakitan tanpa
 * varian, di sisi mana pun. Harga induknya sering nol dan bukan harga barang
 * mana pun (CLAUDE.md §2.7).
 *
 * ## Aturan harga & stok SAMA PERSIS
 *
 *     obral = salePrice > 0 && (saleEndDate === null || saleEndDate > sekarang)
 *     price = obral ? salePrice : regularPrice
 *     stock = stockStatus === "OUTOFSTOCK" ? 0 : (stockQty ?? 10)
 *
 * `saleEndDate` ikut dibaca karena kolomnya tidak dibersihkan otomatis saat
 * tanggalnya lewat — lihat penjelasan lengkapnya di `hargaBerlaku`
 * (`features/builder/actions.ts`). Tanpa itu, panel admin menampilkan obral
 * kedaluwarsa yang tidak akan pernah diberikan keranjang maupun CS.
 *
 * Kalau salah satunya diubah, ubah juga di `fetchBuilderProducts`,
 * `fetchBuilderProductsByIds`, dan `resolve.ts`. Angka di panel admin harus
 * sama persis dengan angka yang muncul begitu rakitannya masuk wizard.
 * `salePrice` adalah satu-satunya potongan yang sah menurut CLAUDE.md §2.7, dan
 * ia dibaca apa adanya — tidak ada perkalian, tidak ada persentase.
 */

export type PrebuildVariation = {
  id: number
  /** Label tombol varian — nilai atributnya, mis. "1TB · Hitam". */
  label: string
  price: number
  /**
   * Harga normal dan harga obral, terpisah dari `price`, supaya kartu bisa
   * menggambar harga coret. `salePrice` sudah nol kalau obralnya kedaluwarsa —
   * lihat `hargaBerlaku`. Tidak ada perkalian di mana pun: keduanya angka
   * katalog apa adanya (CLAUDE.md §2.7).
   */
  regularPrice: number
  salePrice: number
  stock: number
  image: string | null
}

export type PrebuildAttribute = {
  attributeId: number
  attributeName: string
  valueId: number
  valueName: string
}

export type PrebuildPickerProduct = {
  id: number
  name: string
  slug: string
  /** "SIMPLE" atau "VARIABLE". Yang VARIABLE punya `variations` berisi. */
  type: string
  /** Harga induk. Untuk VARIABLE ini sering 0 — yang berlaku ada di variannya. */
  price: number
  /**
   * Harga yang TAMPIL di kartu grid: `price` kalau induknya sendiri berharga,
   * kalau tidak harga varian termurah yang masih ada stoknya.
   *
   * Dipisah dari `price` dengan sengaja. `price` dipakai menghitung subtotal
   * barang yang belum punya `variationId`, dan di sana nol adalah jawaban yang
   * BENAR — ia penanda bahwa variannya belum dipilih. Kalau `price` sendiri
   * diam-diam diisi harga varian termurah, barang setengah jadi akan ikut total
   * paket dengan angka yang bukan angka siapa pun.
   */
  cardPrice: number
  /** Harga normal & obral untuk harga coret di kartu — lihat `PrebuildVariation`. */
  regularPrice: number
  salePrice: number
  stock: number
  /**
   * Stok yang dipakai kartu grid: untuk induk VARIABLE, stok varian yang paling
   * banyak. Kartunya masih bisa ditekan selama ada satu varian yang tersedia;
   * varian yang habis tetap ditandai satu per satu di chip variannya.
   */
  cardStock: number
  image: string | null
  /** Kosong untuk produk SIMPLE. */
  variations: PrebuildVariation[]
  /**
   * Atribut produk — dipakai menegakkan `dependSteps`/`dependAttributes` milik
   * PC Builder. Prosesor yang dipilih di langkah "Prosesor" menyumbang nilai
   * atribut Socket-nya, dan langkah "Motherboard" yang bergantung padanya hanya
   * menampilkan mainboard dengan socket yang sama.
   */
  attributes: PrebuildAttribute[]
}

/**
 * `salePrice` ikut dinolkan saat obralnya lewat, bukan cuma `price`, supaya
 * kartu tidak menampilkan harga coret untuk potongan yang sudah tidak berlaku —
 * sama persis dengan `hargaBerlaku` di `features/builder/actions.ts`.
 */
function hargaBerlaku(
  regular: Prisma.Decimal | null,
  sale: Prisma.Decimal | null,
  saleEndDate: Date | null
): { price: number; regularPrice: number; salePrice: number } {
  const salePriceMentah = sale ? Number(sale) : 0
  const regularPrice = regular ? Number(regular) : 0
  const obralBerlaku =
    salePriceMentah > 0 && (saleEndDate === null || saleEndDate.getTime() > Date.now())
  const salePrice = obralBerlaku ? salePriceMentah : 0

  return { price: obralBerlaku ? salePrice : regularPrice, regularPrice, salePrice }
}

function stokBerlaku(status: string | null, qty: number | null): number {
  return status === "OUTOFSTOCK" ? 0 : (qty ?? 10)
}

/** Bentuk `select` yang dipakai dua jalur di bawah — satu definisi, bukan dua yang harus disamakan. */
const PILIH_PRODUK = {
  id: true,
  name: true,
  slug: true,
  type: true,
  regularPrice: true,
  salePrice: true,
  saleEndDate: true,
  stockQty: true,
  stockStatus: true,
  images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
  attributes: {
    select: {
      attribute: { select: { id: true, name: true } },
      value: { select: { id: true, value: true } },
    },
  },
  variations: {
    where: { status: "PUBLISHED" },
    orderBy: { id: "asc" },
    select: {
      id: true,
      name: true,
      regularPrice: true,
      salePrice: true,
      saleEndDate: true,
      stockQty: true,
      stockStatus: true,
      images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
      attributes: {
        select: { value: { select: { value: true } } },
      },
    },
  },
} satisfies Prisma.ProductSelect

type BarisProduk = Prisma.ProductGetPayload<{ select: typeof PILIH_PRODUK }>

/**
 * Label varian dirangkai dari NILAI ATRIBUTnya, bukan dari `name` — alasan
 * lengkapnya ada di `lib/utils/variation.ts`. Kalau atributnya kosong, barulah
 * namanya dipakai apa adanya.
 */
function labelVarian(varian: BarisProduk["variations"][number]): string {
  return buildVariationLabel(varian.attributes.map((a) => a.value.value)) ?? varian.name
}

/**
 * Harga yang tampil di kartu grid — dan karena itu satu-satunya angka yang sah
 * dipakai mengurutkan "Harga: rendah ke tinggi".
 *
 * Aturannya sama persis dengan `hargaKartu` di `features/builder/actions.ts`:
 * harga induk kalau ia berharga, kalau tidak varian termurah yang masih ada
 * stoknya. Yang dilakukan cuma MEMILIH satu angka katalog dari beberapa angka
 * katalog — tidak ada perhitungan (CLAUDE.md §2.7).
 */
function hargaKartu(
  baris: {
    regularPrice: Prisma.Decimal | null
    salePrice: Prisma.Decimal | null
    saleEndDate: Date | null
  },
  variasi: Array<{
    regularPrice: Prisma.Decimal | null
    salePrice: Prisma.Decimal | null
    saleEndDate: Date | null
    stockQty: number | null
    stockStatus: string | null
  }>
): number {
  const sendiri = hargaBerlaku(baris.regularPrice, baris.salePrice, baris.saleEndDate)
  if (sendiri.price > 0 || variasi.length === 0) return sendiri.price

  const varian = variasi.map((v) => ({
    price: hargaBerlaku(v.regularPrice, v.salePrice, v.saleEndDate).price,
    stock: stokBerlaku(v.stockStatus, v.stockQty),
  }))

  return cheapestAvailableVariation(varian)?.price ?? sendiri.price
}

function petakan(p: BarisProduk): PrebuildPickerProduct {
  const harga = hargaBerlaku(p.regularPrice, p.salePrice, p.saleEndDate)

  const variations = p.variations.map((v) => {
    const hargaVarian = hargaBerlaku(v.regularPrice, v.salePrice, v.saleEndDate)
    return {
      id: v.id,
      label: labelVarian(v),
      price: hargaVarian.price,
      regularPrice: hargaVarian.regularPrice,
      salePrice: hargaVarian.salePrice,
      stock: stokBerlaku(v.stockStatus, v.stockQty),
      image: v.images[0]?.url ?? null,
    }
  })

  // Induk VARIABLE menumpang variannya untuk harga coret juga: harga normalnya
  // sendiri hampir selalu nol, dan kartu yang memakainya akan menampilkan
  // potongan 100%.
  const termurah =
    variations.length > 0 && harga.price <= 0 ? cheapestAvailableVariation(variations) : null

  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    type: p.type,
    price: harga.price,
    cardPrice: hargaKartu(p, p.variations),
    regularPrice: termurah?.regularPrice ?? harga.regularPrice,
    salePrice: termurah?.salePrice ?? harga.salePrice,
    stock: stokBerlaku(p.stockStatus, p.stockQty),
    cardStock:
      variations.length > 0
        ? variations.reduce((max, v) => Math.max(max, v.stock), 0)
        : stokBerlaku(p.stockStatus, p.stockQty),
    image: p.images[0]?.url ?? null,
    variations,
    attributes: p.attributes.map((a) => ({
      attributeId: a.attribute.id,
      attributeName: a.attribute.name,
      valueId: a.value.id,
      valueName: a.value.value,
    })),
  }
}

/**
 * Produk yang boleh dipilih untuk satu langkah.
 *
 * Kategori diperlakukan sama seperti di wizard: kategori yang dipilih staff
 * BESERTA seluruh turunannya, dicocokkan lewat `path`. Langkah yang menunjuk
 * "Storage" karena itu ikut menampilkan isi "Storage › NVMe".
 */
export type PrebuildSortMode =
  | "default"
  | "name_asc"
  | "name_desc"
  | "price_asc"
  | "price_desc"

export async function searchPrebuildProducts({
  categoryIds,
  requiredAttributeValueGroups = [],
  attributeValueGroups = [],
  searchQuery = "",
  limit = 20,
  page = 1,
  sort = "default",
}: {
  categoryIds: number[]
  /**
   * Syarat atribut dari `dependSteps`/`dependAttributes` milik PC Builder,
   * ditegakkan sama persis seperti di wizard — lewat fungsi yang sama,
   * `buildAttributeRequirementGroups` di `lib/pc-builder/compatibility.ts`.
   *
   * Ini yang membuat langkah "Motherboard" hanya menampilkan mainboard dengan
   * socket yang sama dengan prosesor yang sudah dipilih. Tanpa ini, panel admin
   * membiarkan staff menyusun paket yang komponennya tidak bisa dipasang
   * bersama — dan paket itu baru ketahuan salah di meja teknisi.
   *
   * Berkelompok, bukan daftar valueId datar: kandidat harus memenuhi SEMUA
   * kelompok tapi cukup salah satu nilai di dalam tiap kelompok. Aturan lama
   * menuntut kandidat memiliki SELURUH nilai milik induk, dan itu mengosongkan
   * daftar setiap kali induknya bernilai jamak — casing ATX yang menampung tiga
   * ukuran motherboard adalah kasus yang paling sering muncul.
   */
  requiredAttributeValueGroups?: AttributeRequirementGroup[]
  /**
   * Penyaringan atribut yang dipilih staff sendiri lewat modal "Filter
   * Atribut" — satu kelompok per ATRIBUT, berisi nilai-nilai yang dicentang.
   *
   * Bentuk dan aturannya sengaja sama dengan `requiredAttributeValueGroups`:
   * DAN antar kelompok, ATAU di dalam kelompok. Jadi "Socket: AM4 atau AM5"
   * ditambah "Chipset: B650" berarti mainboard AM4/AM5 yang ber-chipset B650.
   * Dua logika berbeda di satu grid akan membuat staff menebak-nebak kenapa
   * hasilnya menyusut.
   *
   * Ia MENAMBAH syarat, tidak pernah membatalkan
   * `requiredAttributeValueGroups`: aturan kompatibilitas PC Builder bukan
   * preferensi yang boleh dimatikan dari panel.
   */
  attributeValueGroups?: AttributeRequirementGroup[]
  searchQuery?: string
  limit?: number
  page?: number
  sort?: PrebuildSortMode
}): Promise<{ products: PrebuildPickerProduct[]; hasMore: boolean }> {
  const prisma = getPrisma()

  const where: Prisma.ProductWhereInput = {
    status: "PUBLISHED",
    // Inilah satu-satunya perbedaan berarti dari `fetchBuilderProducts`.
    // VARIATION TIDAK ikut: ia dipilih lewat induknya, bukan berdiri sendiri di
    // daftar — kalau ikut, staff akan melihat "1TB" dan "2TB" sebagai dua
    // produk terpisah tanpa tahu keduanya barang yang sama.
    type: { in: ["SIMPLE", "VARIABLE"] },
    OR: [
      { regularPrice: { gt: 0 } },
      { salePrice: { gt: 0 } },
      // Induk VARIABLE sering berharga nol karena harganya ada di varian.
      // Tanpa cabang ini, seluruh produk bervarian hilang dari daftar justru
      // di panel yang dibuat untuk menanganinya.
      { type: "VARIABLE", variations: { some: { OR: [{ regularPrice: { gt: 0 } }, { salePrice: { gt: 0 } }] } } },
    ],
  }

  if (categoryIds.length > 0) {
    const dipilih = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { path: true },
    })

    const turunan = await prisma.category.findMany({
      where: { OR: dipilih.map((c) => ({ path: { startsWith: c.path } })) },
      select: { id: true },
    })

    where.categories = { some: { categoryId: { in: turunan.map((c) => c.id) } } }
  }

  const syarat: Prisma.ProductWhereInput[] = []

  // SEMUA kelompok wajib terpenuhi, SALAH SATU nilai di dalam tiap kelompok
  // sudah cukup — persis seperti `fetchBuilderProducts`. Menggabung seluruh
  // kelompok jadi satu `some: { valueId: { in: [...] } }` akan meloloskan
  // produk yang cuma cocok pada satu atribut.
  // Filter atribut pilihan staff memakai aturan yang sama, dan DIGABUNG —
  // bukan menggantikan syarat kompatibilitas di atas.
  for (const group of [...requiredAttributeValueGroups, ...attributeValueGroups]) {
    if (group.length === 0) continue
    syarat.push({ attributes: { some: { valueId: { in: [...new Set(group)] } } } })
  }

  const kata = searchQuery.trim().split(/\s+/).filter(Boolean)
  if (kata.length > 0) {
    syarat.push({
      OR: [
        { AND: kata.map((k) => ({ name: { contains: k } })) },
        {
          AND: kata.map((k) => ({
            attributes: { some: { value: { value: { contains: k } } } },
          })),
        },
      ],
    })
  }

  if (syarat.length > 0) where.AND = syarat

  const skip = (page - 1) * limit

  if (sort === "price_asc" || sort === "price_desc") {
    // Lewat helper bersama, bukan `orderBy` — alasannya di
    // `lib/pc-builder/price-sort.ts`. Rumus harganya `hargaKartu` milik berkas
    // ini, yang TIDAK menerapkan sakelar tampilan stok pelanggan.
    const halaman = await pageIdsByCardPrice({
      where,
      skip,
      limit,
      direction: sort === "price_asc" ? "asc" : "desc",
      priceOf: (p) => hargaKartu(p, p.variations),
    })

    const baris =
      halaman.ids.length > 0
        ? await prisma.product.findMany({
            where: { id: { in: halaman.ids } },
            select: PILIH_PRODUK,
          })
        : []

    return {
      products: reorderByIds(baris, halaman.ids).map(petakan),
      hasMore: halaman.hasMore,
    }
  }

  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    sort === "name_asc"
      ? [{ name: "asc" }]
      : sort === "name_desc"
        ? [{ name: "desc" }]
        : [{ viewCount: "desc" }]

  const rows = await prisma.product.findMany({
    where,
    orderBy,
    skip,
    // Satu lebih banyak dari yang diminta, cuma untuk tahu masih ada halaman
    // berikutnya — tidak ikut dikembalikan.
    take: limit + 1,
    select: PILIH_PRODUK,
  })

  return {
    products: rows.slice(0, limit).map(petakan),
    hasMore: rows.length > limit,
  }
}

/**
 * Atribut beserta nilai yang BENAR-BENAR dimiliki produk di satu langkah —
 * isi modal "Filter Atribut".
 *
 * Dihitung dari kandidat yang sama dengan yang tampil di grid (kategori langkah
 * + syarat kompatibilitas PC Builder), bukan dari seluruh tabel atribut.
 * Menampilkan atribut yang tidak dipakai produk mana pun di kategori itu
 * berarti menawarkan penyaringan yang pasti mengosongkan grid.
 *
 * Kata kunci pencarian dan filter atribut yang sedang aktif SENGAJA tidak ikut
 * mempersempit: kalau ikut, nilai yang baru saja dicentang staff akan membuat
 * nilai lain dari atribut yang sama menghilang dari modal — dan menambah
 * pilihan kedua ("AM4 atau AM5") jadi mustahil.
 */
export type PrebuildAttributeFacet = {
  attributeId: number
  attributeName: string
  values: { valueId: number; valueName: string; count: number }[]
}

export async function getPrebuildAttributeFacets({
  categoryIds,
  requiredAttributeValueGroups = [],
}: {
  categoryIds: number[]
  requiredAttributeValueGroups?: AttributeRequirementGroup[]
}): Promise<PrebuildAttributeFacet[]> {
  const prisma = getPrisma()

  const where: Prisma.ProductWhereInput = {
    status: "PUBLISHED",
    type: { in: ["SIMPLE", "VARIABLE"] },
  }

  if (categoryIds.length > 0) {
    const dipilih = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { path: true },
    })

    const turunan = await prisma.category.findMany({
      where: { OR: dipilih.map((c) => ({ path: { startsWith: c.path } })) },
      select: { id: true },
    })

    where.categories = { some: { categoryId: { in: turunan.map((c) => c.id) } } }
  }

  const syarat: Prisma.ProductWhereInput[] = []
  for (const group of requiredAttributeValueGroups) {
    if (group.length === 0) continue
    syarat.push({ attributes: { some: { valueId: { in: [...new Set(group)] } } } })
  }
  if (syarat.length > 0) where.AND = syarat

  // Satu kueri atas tabel penghubung, bukan satu per atribut: jumlah atribut di
  // satu kategori bisa belasan, dan satu kueri per atribut akan menjadikan
  // membuka modal ini belasan perjalanan ke database.
  const baris = await prisma.productAttribute.findMany({
    where: { product: where },
    select: {
      attribute: { select: { id: true, name: true } },
      value: { select: { id: true, value: true } },
    },
  })

  const peta = new Map<number, PrebuildAttributeFacet & { nilai: Map<number, { valueId: number; valueName: string; count: number }> }>()

  for (const b of baris) {
    let atribut = peta.get(b.attribute.id)
    if (!atribut) {
      atribut = {
        attributeId: b.attribute.id,
        attributeName: b.attribute.name,
        values: [],
        nilai: new Map(),
      }
      peta.set(b.attribute.id, atribut)
    }

    const ada = atribut.nilai.get(b.value.id)
    if (ada) ada.count += 1
    else atribut.nilai.set(b.value.id, { valueId: b.value.id, valueName: b.value.value, count: 1 })
  }

  return [...peta.values()]
    .map((a) => ({
      attributeId: a.attributeId,
      attributeName: a.attributeName,
      // Nilai diurut menurut jumlah produknya: yang paling sering dipakai
      // adalah yang paling sering dicari, dan daftar alfabetis menenggelamkannya
      // di tengah.
      values: [...a.nilai.values()].sort(
        (x, y) => y.count - x.count || x.valueName.localeCompare(y.valueName)
      ),
    }))
    .sort((x, y) => x.attributeName.localeCompare(y.attributeName))
}

/**
 * Produk berdasarkan daftar id — dipakai memuat kembali pilihan yang sudah
 * tersimpan di preset, supaya pemilihnya tidak tampil kosong padahal datanya
 * ada (preset cuma menyimpan id).
 *
 * Menerima id INDUK. Id varian tidak perlu diminta terpisah: variannya sudah
 * ikut terbawa di dalam produk induknya.
 */
export async function getPrebuildPickerProducts(
  ids: number[]
): Promise<Map<number, PrebuildPickerProduct>> {
  const unik = [...new Set(ids)].filter((id) => Number.isFinite(id) && id > 0)
  if (unik.length === 0) return new Map()

  const rows = await getPrisma().product.findMany({
    where: { id: { in: unik } },
    select: PILIH_PRODUK,
  })

  return new Map(rows.map((p) => [p.id, petakan(p)]))
}
