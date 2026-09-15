"use server"

import { getPrisma } from "@/lib/prisma/client"
import { BuilderProduct, BuilderVariation } from "@/store/new-builder"
import { Prisma } from "@prisma/client"
import { displayStockCount, getStockDisplayMode, type StockDisplayMode } from "@/lib/api/stock-display"
import { buildVariationLabel, cheapestAvailableVariation } from "@/lib/utils/variation"
import type { AttributeRequirementGroup } from "@/lib/pc-builder/compatibility"

/**
 * ATURAN HARGA & STOK — satu-satunya yang berlaku di seluruh PC Builder:
 *
 *     obral  = salePrice > 0 && (saleEndDate === null || saleEndDate > sekarang)
 *     price  = obral ? salePrice : regularPrice
 *     stock  = stockStatus === "OUTOFSTOCK" ? 0 : (stockQty ?? 10)
 *
 * Salinan aturan yang sama ada di `lib/pc-prebuild/products.ts` dan
 * `lib/pc-prebuild/resolve.ts`; kalau salah satu berubah, ubah semuanya. Angka
 * di panel admin harus sama persis dengan angka yang muncul di wizard.
 * `salePrice` adalah satu-satunya potongan yang sah menurut CLAUDE.md §2.7 dan
 * dibaca apa adanya — tidak ada perkalian, tidak ada persentase.
 *
 * ## `saleEndDate` WAJIB ikut dibaca
 *
 * Kolom `saleEndDate` TIDAK dibersihkan otomatis saat tanggalnya lewat, jadi
 * lapisan bacalah yang harus mengabaikan obral kedaluwarsa — aturan yang sama
 * dipakai `applySaleExpiry()` di `lib/api/woocommerce/products.ts` (etalase &
 * halaman produk) dan `harga()` di `lib/api/woocommerce/cart-pricing.ts`
 * (keranjang, checkout, pesan WhatsApp).
 *
 * Dulu fungsi ini tidak membacanya sama sekali, dan PC Builder menjadi
 * satu-satunya jalur yang menyimpang: kartu komponen di /build-pc menampilkan
 * harga obral yang sudah kedaluwarsa, sementara total panel "My Build" dan
 * pesan WhatsApp — yang lewat `priceCartFromCatalog` — memakai harga normal
 * yang lebih mahal. Dua angka berbeda untuk barang yang sama, di satu layar
 * yang sama, dan selisihnya muncul ke pelanggan sebagai "harga berubah"
 * padahal katalognya tidak berubah. Itu pelanggaran CLAUDE.md §2.7: harga yang
 * masuk keranjang wajib sama persis dengan harga yang tampil.
 *
 * `salePrice` ikut dinolkan saat obralnya lewat, bukan cuma `price`, supaya
 * kartu tidak menampilkan harga coret untuk potongan yang sudah tidak berlaku.
 */
function hargaBerlaku(
  regular: Prisma.Decimal | null,
  sale: Prisma.Decimal | null,
  saleEndDate: Date | null
) {
  const regularPrice = regular ? Number(regular) : 0
  const salePriceMentah = sale ? Number(sale) : 0
  const obralBerlaku =
    salePriceMentah > 0 && (saleEndDate === null || saleEndDate.getTime() > Date.now())
  const salePrice = obralBerlaku ? salePriceMentah : 0

  return { price: obralBerlaku ? salePrice : regularPrice, regularPrice, salePrice }
}

function stokBerlaku(status: string | null, qty: number | null, mode: StockDisplayMode): number {
  return displayStockCount(status === "OUTOFSTOCK" ? 0 : (qty ?? 10), mode)
}

/** Baris VARIATION: yang dibutuhkan untuk menampilkan & memilih satu varian. */
const PILIH_VARIAN = {
  id: true,
  name: true,
  regularPrice: true,
  salePrice: true,
  saleEndDate: true,
  stockQty: true,
  stockStatus: true,
  images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
  attributes: { select: { value: { select: { value: true } } } },
} satisfies Prisma.ProductSelect

const PILIH_ATRIBUT = {
  attribute: { select: { id: true, name: true } },
  value: { select: { id: true, value: true } },
} satisfies Prisma.ProductAttributeSelect

type BarisVarian = Prisma.ProductGetPayload<{ select: typeof PILIH_VARIAN }>

function petakanVarian(v: BarisVarian, mode: StockDisplayMode): BuilderVariation {
  const harga = hargaBerlaku(v.regularPrice, v.salePrice, v.saleEndDate)
  return {
    id: v.id,
    // Label dari NILAI ATRIBUT, bukan dari `name` — lihat `lib/utils/variation.ts`.
    label: buildVariationLabel(v.attributes.map((a) => a.value.value)) ?? v.name,
    price: harga.price,
    regularPrice: harga.regularPrice,
    salePrice: harga.salePrice,
    stock: stokBerlaku(v.stockStatus, v.stockQty, mode),
    image: v.images[0]?.url,
  }
}

/**
 * Harga yang TAMPIL di kartu grid — dan karena itu satu-satunya angka yang sah
 * dipakai untuk mengurutkan "Harga: rendah ke tinggi".
 *
 * Dulu pengurutan harga memakai `orderBy: { regularPrice }` langsung di
 * database, dan hasilnya terlihat acak bagi pelanggan. Dua sebabnya:
 *
 * 1. Yang tampil di kartu adalah `salePrice` kalau ada, bukan `regularPrice`.
 *    Barang yang sedang obral karena itu diurutkan menurut angka yang justru
 *    dicoret di layar.
 * 2. Induk VARIABLE hampir selalu ber-`regularPrice` nol — harganya ada di
 *    variannya. Seluruh produk bervarian karena itu berkumpul di ujung daftar,
 *    lepas dari berapa pun harga variannya.
 *
 * Fungsi ini memakai aturan yang sama persis dengan pemetaan kartu di bawah
 * (`hargaBerlaku`, lalu `cheapestAvailableVariation` untuk induk VARIABLE),
 * sehingga kunci pengurutan dan angka di layar mustahil berbeda. Keduanya
 * memang memanggil fungsi ini.
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
  }>,
  mode: StockDisplayMode
): number {
  const sendiri = hargaBerlaku(baris.regularPrice, baris.salePrice, baris.saleEndDate)
  if (sendiri.price > 0 || variasi.length === 0) return sendiri.price

  const varian = variasi.map((v) => ({
    price: hargaBerlaku(v.regularPrice, v.salePrice, v.saleEndDate).price,
    stock: stokBerlaku(v.stockStatus, v.stockQty, mode),
  }))

  return cheapestAvailableVariation(varian)?.price ?? sendiri.price
}

export async function fetchBuilderProducts({
  categoryIds,
  requiredAttributeValueGroups,
  configuredAttributeIds = [],
  searchQuery = "",
  limit = 20,
  page = 1,
  sort = "default"
}: {
  categoryIds: number[]
  /**
   * Syarat kompatibilitas dari langkah yang diandalkan, sudah dikelompokkan
   * per atribut per komponen induk oleh `buildAttributeRequirementGroups`.
   *
   * Kandidat harus memenuhi SEMUA kelompok, tapi di dalam satu kelompok cukup
   * SALAH SATU nilainya. Dulu parameter ini berupa daftar valueId datar yang
   * semuanya wajib dimiliki, dan itu membuang casing ATX — yang menampung tiga
   * ukuran motherboard sekaligus — dari langkah mana pun yang mengandalkannya.
   * Lihat `lib/pc-builder/compatibility.ts`.
   */
  requiredAttributeValueGroups: AttributeRequirementGroup[]
  configuredAttributeIds?: number[]
  searchQuery?: string
  limit?: number
  page?: number
  sort?: "default" | "name_asc" | "name_desc" | "price_asc" | "price_desc"
}): Promise<{ products: BuilderProduct[], hasMore: boolean }> {
  const prisma = getPrisma()

  // Base where clause
  const where: Prisma.ProductWhereInput = {
    status: "PUBLISHED",
    /**
     * Dulu terkunci `type: "SIMPLE"`, dan penguncian itu punya alasan: wizard
     * belum punya cara memilih varian, sehingga produk VARIABLE yang bocor ke
     * sini akan masuk rakitan tanpa varian — dengan harga induk yang sering nol
     * dan bukan harga barang mana pun.
     *
     * Alasan itu sekarang sudah gugur: `VariationPickerDialog` menutup jalur
     * masuknya. Yang WAJIB tetap dijaga adalah dua-duanya bergerak bersama —
     * kalau pemilih variannya suatu hari dibongkar, kunci ini harus kembali.
     *
     * VARIATION tetap tidak ikut: ia dipilih lewat induknya, bukan berdiri
     * sendiri di grid. Kalau ikut, pelanggan melihat "1TB" dan "2TB" sebagai
     * dua produk terpisah tanpa tahu keduanya barang yang sama.
     */
    type: { in: ["SIMPLE", "VARIABLE"] },
    OR: [
      { regularPrice: { gt: 0 } },
      { salePrice: { gt: 0 } },
      // Induk VARIABLE sering berharga nol karena harganya ada di varian. Tanpa
      // cabang ini, seluruh produk bervarian tetap hilang dari grid walau
      // filter tipenya sudah dilonggarkan.
      {
        type: "VARIABLE",
        variations: {
          some: {
            status: "PUBLISHED",
            OR: [{ regularPrice: { gt: 0 } }, { salePrice: { gt: 0 } }],
          },
        },
      },
    ]
  }

  // Filter by categories if specified
  if (categoryIds.length > 0) {
    // 1. Fetch the paths of the selected categories
    const selectedCategories = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { path: true }
    })

    // 2. Find all categories that start with those paths (this includes the original categories and all children)
    const descendantCategories = await prisma.category.findMany({
      where: {
        OR: selectedCategories.map(cat => ({
          path: { startsWith: cat.path }
        }))
      },
      select: { id: true }
    })

    const allCategoryIds = descendantCategories.map(c => c.id)

    where.categories = {
      some: {
        categoryId: { in: allCategoryIds }
      }
    }
  }

  // SEMUA kelompok wajib terpenuhi (AND antar kelompok), SALAH SATU nilai di
  // dalam tiap kelompok sudah cukup (OR di dalam kelompok) — aturan yang sama
  // persis dengan `isAttributeCompatible` di klien.
  const kelompokTerpakai = requiredAttributeValueGroups.filter(g => g.length > 0)
  if (kelompokTerpakai.length > 0) {
    where.AND = kelompokTerpakai.map(group => ({
      attributes: {
        some: { valueId: { in: group } }
      }
    }))
  }

  // Text search
  if (searchQuery) {
    const searchTerms = searchQuery.trim().split(/\s+/).filter(Boolean)
    if (searchTerms.length > 0) {
      const nameConditions = searchTerms.map(term => ({ name: { contains: term } }))
      const attrConditions = searchTerms.map(term => ({
        attributes: {
          some: {
            value: {
              value: { contains: term }
            }
          }
        }
      }))

      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : (where.AND ? [where.AND] : [])),
        {
          OR: [
            { AND: nameConditions },
            { AND: attrConditions }
          ]
        }
      ]
    }
  }

  const skip = (page - 1) * limit

  // Sakelar tampilan stok di /admin/produk ikut berlaku di PC Builder: kartu
  // komponennya menurunkan ketersediaan dari `stock > 0`. Dibaca lebih dulu
  // karena pengurutan harga pun membutuhkannya — stok ikut menentukan varian
  // mana yang sah dipasang sebagai harga kartu induk VARIABLE.
  const stockDisplayMode = await getStockDisplayMode()

  const PILIH_KARTU = {
    id: true,
    name: true,
    slug: true,
    type: true,
    regularPrice: true,
    salePrice: true,
    saleEndDate: true,
    stockQty: true,
    stockStatus: true,
    viewCount: true,
    images: {
      orderBy: { position: "asc" },
      take: 1,
      select: { url: true }
    },
    attributes: {
      where: configuredAttributeIds.length > 0
        ? { attributeId: { in: configuredAttributeIds } }
        : undefined,
      select: PILIH_ATRIBUT
    },
    // Kosong untuk produk SIMPLE — kartu memakai panjang array ini untuk
    // memutuskan apakah tombol Select membuka pemilih varian.
    variations: {
      where: { status: "PUBLISHED" },
      orderBy: { id: "asc" },
      select: PILIH_VARIAN,
    }
  } satisfies Prisma.ProductSelect

  type BarisKartu = Prisma.ProductGetPayload<{ select: typeof PILIH_KARTU }>

  let paginatedProducts: BarisKartu[]
  let hasMore: boolean

  if (sort === "price_asc" || sort === "price_desc") {
    /**
     * Pengurutan harga TIDAK bisa diserahkan ke `ORDER BY` database.
     *
     * Harga yang tampil di kartu adalah `salePrice` kalau ada, dan untuk induk
     * VARIABLE ia berasal dari varian termurah yang masih ada stoknya — dua
     * aturan yang tidak bisa dinyatakan sebagai satu kolom untuk diurutkan
     * Prisma. Lihat `hargaKartu` di atas untuk gejala yang ditimbulkan
     * `orderBy: { regularPrice }`.
     *
     * Karena itu peringkatnya disusun di sini: satu kueri ringan (hanya id,
     * dua kolom harga, dan harga/stok variannya) atas SELURUH kandidat yang
     * lolos filter, lalu halamannya diambil dari urutan itu. Mengurutkan hanya
     * 20 baris per halaman akan salah — yang termurah bisa berada di halaman
     * mana pun.
     *
     * Bebannya sepadan: kueri ini tidak menarik gambar, deskripsi, maupun
     * atribut, dan kandidatnya sudah dipersempit kategori langkah beserta
     * syarat kompatibilitasnya.
     */
    const kandidat = await prisma.product.findMany({
      where,
      select: {
        id: true,
        regularPrice: true,
        salePrice: true,
        saleEndDate: true,
        variations: {
          where: { status: "PUBLISHED" },
          select: {
            regularPrice: true,
            salePrice: true,
            saleEndDate: true,
            stockQty: true,
            stockStatus: true,
          },
        },
      },
    })

    const arah = sort === "price_asc" ? 1 : -1
    const berurut = kandidat
      .map((p) => ({ id: p.id, price: hargaKartu(p, p.variations, stockDisplayMode) }))
      // `id` sebagai pemecah seri: tanpa itu urutan dua barang berharga sama
      // bisa bertukar antar halaman, dan barang yang sama muncul dua kali (atau
      // tidak sama sekali) saat "Load More" ditekan.
      .sort((a, b) => (a.price === b.price ? a.id - b.id : (a.price - b.price) * arah))

    const idHalaman = berurut.slice(skip, skip + limit).map((x) => x.id)
    hasMore = berurut.length > skip + limit

    const baris = idHalaman.length > 0
      ? await prisma.product.findMany({ where: { id: { in: idHalaman } }, select: PILIH_KARTU })
      : []

    // `IN (...)` tidak menjamin urutan, jadi hasilnya dirangkai ulang mengikuti
    // peringkat di atas.
    const barisById = new Map(baris.map((b) => [b.id, b]))
    paginatedProducts = idHalaman
      .map((id) => barisById.get(id))
      .filter((b): b is BarisKartu => b !== undefined)
  } else {
    const orderBy: Prisma.ProductOrderByWithRelationInput[] = []
    if (sort === "name_asc") orderBy.push({ name: "asc" })
    if (sort === "name_desc") orderBy.push({ name: "desc" })
    if (sort === "default") orderBy.push({ viewCount: "desc" }) // default sorting

    const products = await prisma.product.findMany({
      where,
      orderBy,
      skip,
      take: limit + 1, // Fetch one extra to check if there are more
      select: PILIH_KARTU,
    })

    hasMore = products.length > limit
    paginatedProducts = products.slice(0, limit)
  }

  // Format mapping
  const mappedProducts = paginatedProducts.map(p => {
    const variations = p.variations.map((v) => petakanVarian(v, stockDisplayMode))
    const harga = hargaBerlaku(p.regularPrice, p.salePrice, p.saleEndDate)

    // Induk VARIABLE menumpang variannya untuk harga & ketersediaan: harganya
    // sendiri sering nol, dan stoknya tidak pernah dicatat di baris induk.
    const termurah = variations.length > 0 && harga.price <= 0 ? cheapestAvailableVariation(variations) : null

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      type: p.type,
      // Lewat `hargaKartu`, fungsi yang SAMA dengan kunci pengurutan harga di
      // atas — dua tempat ini tidak boleh punya jawaban berbeda.
      price: hargaKartu(p, p.variations, stockDisplayMode),
      regularPrice: termurah?.regularPrice ?? harga.regularPrice,
      salePrice: termurah?.salePrice ?? harga.salePrice,
      sold: p.viewCount || 0, // Mocking sold with viewCount just for UI display if needed, though product table has no "sold" field natively here.
      stock: variations.length > 0
        // Kartu induk bisa ditekan selama MASIH ADA satu varian yang tersedia;
        // varian yang habis tetap ditandai satu per satu di dalam pemilihnya.
        ? variations.reduce((max, v) => Math.max(max, v.stock), 0)
        : stokBerlaku(p.stockStatus, p.stockQty, stockDisplayMode),
      image: p.images[0]?.url,
      attributes: p.attributes.map(a => ({
        attributeId: a.attribute.id,
        attributeName: a.attribute.name,
        valueId: a.value.id,
        valueName: a.value.value
      })),
      ...(variations.length > 0 ? { variations } : {}),
    }
  })

  return {
    products: mappedProducts,
    hasMore
  }
}

/**
 * Produk berdasarkan daftar id — dipakai memuat paket PC Prebuild ke wizard.
 *
 * Aturan harga & stoknya SAMA PERSIS dengan `fetchBuilderProducts` di atas
 * (keduanya lewat `hargaBerlaku`/`stokBerlaku`), supaya angka di kartu paket
 * sama dengan angka yang muncul begitu rakitannya masuk wizard.
 *
 * Menerima id INDUK maupun id VARIAN. Baris VARIATION yang diminta langsung
 * dipetakan menjadi pilihan varian yang utuh — nama & atribut kompatibilitas
 * dari induknya, harga & stok dari barisnya sendiri — sehingga paket prebuild
 * yang memuat barang bervarian mendarat di wizard dalam bentuk yang sama persis
 * dengan hasil memilihnya sendiri lewat `VariationPickerDialog`.
 *
 * Urutan hasilnya TIDAK dijamin sama dengan urutan `ids` — pemanggil
 * memetakannya sendiri lewat id.
 */
export async function fetchBuilderProductsByIds(ids: number[]): Promise<BuilderProduct[]> {
  const unik = [...new Set(ids)].filter((id) => Number.isFinite(id))
  if (unik.length === 0) return []

  const prisma = getPrisma()

  const products = await prisma.product.findMany({
    where: { id: { in: unik } },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      regularPrice: true,
      salePrice: true,
      saleEndDate: true,
      stockQty: true,
      stockStatus: true,
      viewCount: true,
      images: {
        orderBy: { position: "asc" },
        take: 1,
        select: { url: true }
      },
      attributes: { select: PILIH_ATRIBUT },
      variations: {
        where: { status: "PUBLISHED" },
        orderBy: { id: "asc" },
        select: PILIH_VARIAN,
      },
      // Terisi hanya kalau barisnya sendiri sebuah VARIATION. Nama, atribut
      // kompatibilitas, dan daftar saudara variannya semua datang dari sini.
      parent: {
        select: {
          id: true,
          name: true,
          slug: true,
          images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
          attributes: { select: PILIH_ATRIBUT },
          variations: {
            where: { status: "PUBLISHED" },
            orderBy: { id: "asc" },
            select: PILIH_VARIAN,
          },
        },
      },
    }
  })

  const stockDisplayMode = await getStockDisplayMode()

  return products.map(p => {
    const harga = hargaBerlaku(p.regularPrice, p.salePrice, p.saleEndDate)

    const atributInduk = (p.parent?.attributes ?? p.attributes).map(a => ({
      attributeId: a.attribute.id,
      attributeName: a.attribute.name,
      valueId: a.value.id,
      valueName: a.value.value
    }))

    if (p.parent) {
      const saudara = p.parent.variations.map((v) => petakanVarian(v, stockDisplayMode))

      return {
        id: p.id,
        // Nama induk, bukan nama barisnya sendiri: varian warisan impor
        // WooCommerce sering bernama sama persis dengan induknya, jadi
        // pembedanya HARUS `variationLabel`, bukan `name`.
        name: p.parent.name,
        slug: p.parent.slug,
        type: p.type,
        price: harga.price,
        regularPrice: harga.regularPrice,
        salePrice: harga.salePrice,
        sold: p.viewCount || 0,
        stock: stokBerlaku(p.stockStatus, p.stockQty, stockDisplayMode),
        image: p.images[0]?.url ?? p.parent.images[0]?.url,
        attributes: atributInduk,
        parentId: p.parent.id,
        parentName: p.parent.name,
        variationLabel:
          buildVariationLabel(p.attributes.map((a) => a.value.value)) ?? undefined,
        variations: saudara,
      }
    }

    const variations = p.variations.map((v) => petakanVarian(v, stockDisplayMode))
    const termurah = variations.length > 0 && harga.price <= 0 ? cheapestAvailableVariation(variations) : null

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      type: p.type,
      price: termurah?.price ?? harga.price,
      regularPrice: termurah?.regularPrice ?? harga.regularPrice,
      salePrice: termurah?.salePrice ?? harga.salePrice,
      sold: p.viewCount || 0,
      stock: variations.length > 0
        ? variations.reduce((max, v) => Math.max(max, v.stock), 0)
        : stokBerlaku(p.stockStatus, p.stockQty, stockDisplayMode),
      image: p.images[0]?.url,
      attributes: atributInduk,
      ...(variations.length > 0 ? { variations } : {}),
    }
  })
}

/**
 * Deskripsi satu produk untuk Quick Preview di wizard.
 *
 * Sengaja TIDAK ikut di `fetchBuilderProducts`: `description` bertipe
 * MediumText, dan grid memuat 20 kartu sekali jalan lalu menambah 20 lagi
 * setiap "Load More" — menariknya di depan berarti ratusan KB HTML untuk
 * modal yang mungkin tidak pernah dibuka satu pun. Pola yang sama dipakai
 * Quick View katalog, yang baru memuat variannya saat modalnya terbuka.
 *
 * Baris VARIATION nyaris tidak pernah punya deskripsi sendiri — yang dibaca
 * pembeli selalu deskripsi induknya. Kartu di grid memang selalu SIMPLE atau
 * induk VARIABLE, tapi cadangan ke induk dipasang supaya fungsi ini tetap
 * benar kalau suatu hari dipanggil dengan id varian.
 */
export async function fetchBuilderProductDescription(
  id: number
): Promise<{ description: string; shortDescription: string }> {
  if (!Number.isFinite(id)) return { description: "", shortDescription: "" }

  const product = await getPrisma().product.findUnique({
    where: { id },
    select: {
      description: true,
      shortDescription: true,
      parent: { select: { description: true, shortDescription: true } },
    },
  })

  if (!product) return { description: "", shortDescription: "" }

  return {
    description: product.description || product.parent?.description || "",
    shortDescription: product.shortDescription || product.parent?.shortDescription || "",
  }
}
