import { wooFetchWithMeta } from "../client"
import type { RemoteProduct, RemoteVariation, ScannedProduct } from "./types"

/**
 * Pengambilan katalog dari WooCommerce REST.
 *
 * Satu-satunya berkas di project yang benar-benar menembak WooCommerce untuk
 * data produk. Alasannya ada di `types.ts`.
 */

/** Batas WooCommerce; meminta lebih dari ini diam-diam dipotong jadi 100. */
const PER_PAGE = 100

/**
 * Berapa halaman diambil bersamaan.
 *
 * Situs lama ini masih melayani pelanggan sungguhan. Empat permintaan paralel
 * memangkas sapuan penuh (33 halaman) dari sekitar setengah menit menjadi
 * belasan detik tanpa membebani WordPress seperti sepuluh koneksi sekaligus.
 */
const CONCURRENCY = 4

/**
 * Pagar pengaman. Katalognya ±3.300 produk (33 halaman); 80 memberi ruang
 * tumbuh berkali lipat sambil tetap menghentikan perulangan yang lepas kendali
 * kalau suatu saat WooCommerce salah melaporkan jumlah halaman.
 */
const MAX_PAGES = 80

export type FetchRemoteOptions = {
  /**
   * Hanya produk yang berubah sejak waktu ini (ISO 8601, waktu situs).
   * Kosong berarti sapuan penuh.
   */
  modifiedAfter?: string | null
  /**
   * Medan tambahan di luar `SCAN_FIELDS`, untuk pemanggil yang butuh lebih.
   *
   * Ada karena `scripts/isi-woo-slug.mts` memakai fungsi ini untuk menyusun
   * peta 301 redirect dan membutuhkan `slug` — medan yang sengaja tidak diminta
   * saat memindai. Tanpa jalan ini, satu-satunya pilihan adalah mengembalikan
   * `slug` ke daftar pindai dan menyeretnya di ±33 halaman untuk keperluan
   * satu skrip yang jalan sesekali.
   *
   * Hasilnya tetap bertipe `ScannedProduct`; pemanggil yang meminta tambahan
   * mempersempitnya sendiri, karena hanya ia yang tahu apa yang ia minta.
   */
  extraFields?: readonly (keyof RemoteProduct)[]
}

export type FetchRemoteResult = {
  products: ScannedProduct[]
  /** Jumlah yang dilaporkan WooCommerce lewat header `X-WP-Total`. */
  reportedTotal: number
  pagesFetched: number
  truncated: boolean
}

/**
 * Kolom yang diminta saat MEMINDAI, lewat `_fields` WooCommerce.
 *
 * Daftar ini persis apa yang dibaca `buildSyncPlan` di `diff.ts` — tidak lebih.
 * Tanpa `_fields`, setiap produk datang lengkap dengan `description` dan
 * `short_description`: ribuan kata HTML per halaman yang dikirim melintasi
 * jaringan lalu dibuang tanpa pernah dibaca, dikalikan ±33 halaman.
 *
 * Yang sengaja TIDAK diminta di sini, dan alasannya:
 *
 * - `description`, `short_description`, `images`, `attributes`, `brands`,
 *   `stock_status`, `stock_quantity`, `sku` — hanya dipakai saat MENGIMPOR
 *   produk, dan importer mengambil datanya sendiri lewat
 *   `fetchRemoteProductsByIds` (yang sengaja tidak dibatasi `_fields`).
 * - `date_modified_gmt` — tidak dibaca `diff.ts`; penyaringan "sejak" dikerjakan
 *   WooCommerce lewat `modified_after`, bukan oleh kita.
 *
 * Kalau suatu saat `diff.ts` membaca medan baru, medan itu WAJIB ditambahkan di
 * sini — kalau tidak, nilainya datang sebagai `undefined` dan pembandingannya
 * gagal diam-diam, bukan dengan galat.
 */
const SCAN_FIELDS = [
  "id",
  "name",
  "type",
  "status",
  "regular_price",
  "sale_price",
  "date_created_gmt",
  "categories",
  "variations",
] as const satisfies readonly (keyof ScannedProduct)[]

/**
 * Penjaga: `SCAN_FIELDS` wajib memuat SETIAP medan `ScannedProduct`.
 *
 * `satisfies` di atas hanya menolak nama yang tidak ada di tipe. Yang berbahaya
 * justru kebalikannya — menambah medan ke `ScannedProduct` lalu lupa memintanya
 * lewat `_fields`. Medannya akan datang `undefined` dan pembandingan harga
 * gagal tanpa galat. Baris ini membuat kelalaian itu jadi error kompilasi.
 */
type MedanTakDiminta = Exclude<keyof ScannedProduct, (typeof SCAN_FIELDS)[number]>
const _semuaMedanDiminta: MedanTakDiminta extends never ? true : never = true
void _semuaMedanDiminta

function buildPath(page: number, options: FetchRemoteOptions): string {
  const params = new URLSearchParams({
    per_page: String(PER_PAGE),
    page: String(page),
    // `status=any` supaya draft dan private ikut terlihat. Produk yang belum
    // terbit di WooCommerce tetap perlu diketahui — staff sering menyiapkannya
    // lebih dulu di sana.
    status: "any",
    // Urut id menaik: urutan yang stabil antar halaman. `orderby=date` bisa
    // menggeser isi halaman kalau ada produk baru dibuat di tengah sapuan,
    // sehingga ada baris yang terlewat dan ada yang terhitung dua kali.
    orderby: "id",
    order: "asc",
    // Memangkas muatan jaringan; lihat SCAN_FIELDS di atas. Header
    // `X-WP-Total`/`X-WP-TotalPages` tidak terpengaruh — keduanya datang dari
    // header respons, bukan dari body yang dibatasi di sini.
    _fields: [...SCAN_FIELDS, ...(options.extraFields ?? [])].join(","),
  })
  if (options.modifiedAfter) params.set("modified_after", options.modifiedAfter)
  return `/products?${params.toString()}`
}

async function fetchPage(
  page: number,
  options: FetchRemoteOptions,
): Promise<{ data: ScannedProduct[]; totalPages: number; total: number }> {
  const { data, meta } = await wooFetchWithMeta<ScannedProduct[]>(buildPath(page, options), {
    // Sinkronisasi harus melihat keadaan sekarang. Entri cache Next di sini
    // berarti membandingkan katalog kita dengan WooCommerce versi kemarin.
    cache: "no-store",
  })
  return { data, totalPages: meta.totalPages, total: meta.total }
}

/**
 * Ambil seluruh produk (induk saja — variasi punya endpoint sendiri).
 *
 * Halaman pertama diambil lebih dulu karena hanya dari headernya kita tahu ada
 * berapa halaman; sisanya diambil berkelompok.
 */
export async function fetchRemoteProducts(
  options: FetchRemoteOptions = {},
): Promise<FetchRemoteResult> {
  const first = await fetchPage(1, options)
  const products: ScannedProduct[] = [...first.data]

  const totalPages = Math.max(1, first.totalPages)
  const lastPage = Math.min(totalPages, MAX_PAGES)

  for (let page = 2; page <= lastPage; page += CONCURRENCY) {
    const batch: Promise<{ data: ScannedProduct[] }>[] = []
    for (let offset = 0; offset < CONCURRENCY && page + offset <= lastPage; offset++) {
      batch.push(fetchPage(page + offset, options))
    }
    for (const result of await Promise.all(batch)) products.push(...result.data)
  }

  return {
    products,
    reportedTotal: first.total,
    pagesFetched: lastPage,
    truncated: totalPages > MAX_PAGES,
  }
}

/**
 * Ambil sejumlah produk tertentu berdasarkan id.
 *
 * Dipakai saat MENERAPKAN perubahan, bukan saat memindai. Alasannya penting:
 * harga yang diterapkan tidak boleh datang dari body permintaan klien maupun
 * dari pratinjau yang mungkin sudah berumur beberapa menit. Klien hanya
 * mengirim "produk mana", lalu harganya diambil ulang langsung dari
 * WooCommerce di sini — satu-satunya sumber yang sah (CLAUDE.md §2.7).
 */
export async function fetchRemoteProductsByIds(ids: number[]): Promise<RemoteProduct[]> {
  const out: RemoteProduct[] = []
  for (let i = 0; i < ids.length; i += PER_PAGE) {
    const chunk = ids.slice(i, i + PER_PAGE)
    const params = new URLSearchParams({
      per_page: String(PER_PAGE),
      status: "any",
      include: chunk.join(","),
    })
    const { data } = await wooFetchWithMeta<RemoteProduct[]>(`/products?${params.toString()}`, {
      cache: "no-store",
    })
    out.push(...data)
  }
  return out
}

/**
 * Varian satu produk variable.
 *
 * Endpoint terpisah karena `/products` tidak pernah mengembalikan varian —
 * hanya daftar id-nya. Satu permintaan per induk, jadi hanya dipanggil untuk
 * produk yang benar-benar akan diimpor, bukan saat memindai.
 */
export async function fetchRemoteVariations(productId: number): Promise<RemoteVariation[]> {
  const { data } = await wooFetchWithMeta<RemoteVariation[]>(
    `/products/${productId}/variations?per_page=${PER_PAGE}&status=any`,
    { cache: "no-store" },
  )
  return data
}
