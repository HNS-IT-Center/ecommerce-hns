import "server-only"

import { Prisma } from "@prisma/client"

import { getPrisma } from "@/lib/prisma/client"
import { buildVariationLabel } from "@/lib/utils/variation"
import type { AttributeRequirementGroup } from "@/lib/pc-builder/compatibility"

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
  stock: number
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
  stock: number
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

function hargaBerlaku(
  regular: Prisma.Decimal | null,
  sale: Prisma.Decimal | null,
  saleEndDate: Date | null
): number {
  const salePrice = sale ? Number(sale) : 0
  const regularPrice = regular ? Number(regular) : 0
  const obralBerlaku =
    salePrice > 0 && (saleEndDate === null || saleEndDate.getTime() > Date.now())
  return obralBerlaku ? salePrice : regularPrice
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

function petakan(p: BarisProduk): PrebuildPickerProduct {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    type: p.type,
    price: hargaBerlaku(p.regularPrice, p.salePrice, p.saleEndDate),
    stock: stokBerlaku(p.stockStatus, p.stockQty),
    image: p.images[0]?.url ?? null,
    variations: p.variations.map((v) => ({
      id: v.id,
      label: labelVarian(v),
      price: hargaBerlaku(v.regularPrice, v.salePrice, v.saleEndDate),
      stock: stokBerlaku(v.stockStatus, v.stockQty),
    })),
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
export async function searchPrebuildProducts({
  categoryIds,
  requiredAttributeValueGroups = [],
  searchQuery = "",
  limit = 20,
  page = 1,
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
  searchQuery?: string
  limit?: number
  page?: number
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
  for (const group of requiredAttributeValueGroups) {
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

  const rows = await prisma.product.findMany({
    where,
    orderBy: [{ viewCount: "desc" }],
    skip: (page - 1) * limit,
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
