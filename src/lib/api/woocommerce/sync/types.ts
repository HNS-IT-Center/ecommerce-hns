/**
 * Bentuk data untuk sinkronisasi katalog WooCommerce -> Prisma.
 *
 * PERHATIAN soal folder ini: berkas lain di `lib/api/woocommerce/` sudah tidak
 * memanggil WooCommerce sama sekali — namanya historis, isinya query Prisma
 * (CLAUDE.md §2.2). Folder `sync/` ini pengecualiannya: ia BENAR-BENAR bicara
 * ke WooCommerce lewat HTTP, karena situs lama masih dipakai staff setiap hari
 * dan produk baru masih lahir di sana.
 *
 * Sinkronisasi ini sengaja sempit: hanya **produk baru** dan **perubahan
 * harga**. Nama, deskripsi, stok, dan kategori produk yang sudah ada tidak
 * pernah ditimpa.
 */

/**
 * Produk apa adanya dari WooCommerce REST — hanya medan yang dipakai.
 *
 * `type` dan `status` dibiarkan `string`, bukan union: WooCommerce bisa
 * mengembalikan nilai yang tidak kita modelkan (plugin menambah tipe produk
 * sendiri), dan mempersempitnya di sini berarti berbohong soal apa yang
 * sebenarnya datang. Penyempitannya dilakukan saat memetakan, dengan
 * pemeriksaan eksplisit.
 */
export type RemoteProduct = {
  id: number
  name: string
  slug: string
  type: string
  status: string
  sku: string
  date_created: string
  date_created_gmt: string
  date_modified: string
  date_modified_gmt: string
  regular_price: string
  sale_price: string
  date_on_sale_to_gmt: string | null
  description: string
  short_description: string
  stock_status: string
  stock_quantity: number | null
  categories: Array<{ id: number; name: string; slug: string }>
  images: Array<{ src: string }>
  /**
   * `variation: true` menandai atribut yang membedakan varian. Yang lain
   * atribut biasa (spesifikasi).
   */
  attributes: Array<{ name: string; options: string[]; visible: boolean; variation: boolean }>
  /**
   * Taksonomi brand WooCommerce. Opsional karena berasal dari plugin dan bisa
   * tidak ada sama sekali — di katalog ini isinya kosong untuk hampir semua
   * produk, jadi jangan andalkan ia terisi.
   */
  brands?: Array<{ name: string }>
  variations: number[]
}

/** Varian dari `/products/{id}/variations`. */
export type RemoteVariation = {
  id: number
  sku: string
  regular_price: string
  sale_price: string
  stock_status: string
  stock_quantity: number | null
  attributes: Array<{ name: string; option: string }>
  image: { src: string } | null
}

/** Cuplikan satu produk di katalog kita, secukupnya untuk dibandingkan. */
export type LocalProduct = {
  wooId: number
  name: string
  source: "WOO" | "LOCAL"
  regularPrice: number | null
  salePrice: number | null
}

export type PriceSide = {
  regularPrice: number | null
  salePrice: number | null
}

export type PriceChange = {
  wooId: number
  name: string
  local: PriceSide
  remote: PriceSide
  /**
   * Produk ini punya jejak penyuntingan harga di `product_logs`, artinya ada
   * staff yang pernah menetapkannya lewat panel admin. Bukan penghalang —
   * WordPress tetap yang menang sesuai keputusan — tapi baris seperti ini
   * ditandai supaya keputusannya terlihat, bukan terjadi diam-diam.
   */
  editedInPanel: boolean
}

/**
 * Dua kelompok produk yang belum ada di kita, dan bedanya penting:
 *
 * - `baru`       — lahir di WooCommerce SETELAH import katalog terakhir.
 * - `tertinggal` — sudah ada di WooCommerce sebelum import, tapi tidak pernah
 *                  masuk (kebanyakan korban CSV lama yang kolomnya bergeser,
 *                  lihat `scripts/archive/backfill-missing-products.mjs`).
 *
 * Keduanya sama-sama "belum ada di kita", tapi yang kedua adalah utang lama
 * dan layak diputuskan terpisah.
 */
export type NewProductGroup = "baru" | "tertinggal"

export type NewProduct = {
  wooId: number
  name: string
  type: string
  status: string
  regularPrice: number | null
  salePrice: number | null
  createdAt: string
  group: NewProductGroup
  categoryNames: string[]
  /**
   * Nama kategori WooCommerce yang ketemu padanannya di taksonomi kita, atau
   * `null` kalau tidak ada yang cocok. Yang `null` tidak ditebak — ia masuk
   * sebagai draft bertanda dan menunggu tangan manusia.
   */
  matchedCategory: string | null
  variationCount: number
}

/**
 * Produk yang nomornya bertabrakan: ada di WooCommerce, tapi `wooId` yang sama
 * di katalog kita dipegang produk buatan panel admin (`source = LOCAL`).
 *
 * Tidak boleh diimpor dan tidak boleh ditimpa — keduanya menghancurkan salah
 * satu sisi. Karena itu dilaporkan, bukan diabaikan.
 */
export type SyncConflict = {
  wooId: number
  remoteName: string
  localName: string
}

export type SyncPlan = {
  scannedAt: string
  /** Batas yang memisahkan "baru" dari "tertinggal" (import terakhir). */
  importBoundary: string | null
  remoteCount: number
  localCount: number
  newProducts: NewProduct[]
  priceChanges: PriceChange[]
  conflicts: SyncConflict[]
  /**
   * Induk produk variable yang harganya TIDAK dibandingkan.
   *
   * Di WooCommerce, induk variable tidak menyimpan harga sendiri — harganya
   * ada di masing-masing varian, dan medan `regular_price` induknya kosong.
   * Membandingkannya dengan harga kita berarti mengusulkan "ubah jadi kosong"
   * untuk setiap produk variable yang ada (823 saat ini). Angka ini dilaporkan,
   * bukan disembunyikan, supaya jelas ada bagian katalog yang belum tercakup.
   */
  skippedVariableParents: number
  /**
   * Produk non-variable yang harganya kosong di WooCommerce padahal kita
   * punya angkanya. Nol saat fitur ini dibuat, tapi dijaga: harga kosong
   * berarti "tidak dinyatakan di sana", bukan "harganya nol".
   */
  skippedEmptyRemotePrice: number
}

/**
 * Hasil pratinjau: rencana ditambah keterangan tentang pemindaiannya sendiri.
 *
 * Tinggal di sini, bukan di `preview.ts`, supaya komponen klien bisa
 * mengimpor tipenya tanpa ikut menyeret modul yang menyentuh Prisma.
 */
export type SyncPreviewResult = SyncPlan & {
  /** Benar kalau pemindaian dibatasi, sehingga hasilnya bukan gambaran utuh. */
  partial: boolean
  pagesFetched: number
  /** WooCommerce melaporkan lebih banyak halaman daripada yang berani diambil. */
  truncated: boolean
}

// --------------------------------------------------------------------- penerapan

export type ApplySkip = { wooId: number; reason: string }
export type ApplyFailure = { wooId: number; message: string }

export type ApplyPriceResult = {
  applied: number
  skipped: ApplySkip[]
  failed: ApplyFailure[]
  /**
   * Cache Next berhasil dibuang. `false` berarti harga SUDAH tersimpan tapi
   * halaman publik bisa menyajikan angka lama sampai entri cache-nya
   * kedaluwarsa sendiri — keadaan yang perlu diketahui, bukan disembunyikan.
   */
  cacheInvalidated: boolean
}

export type ImportResult = {
  imported: number
  /** Berapa di antaranya turun jadi draft karena kategorinya tidak cocok. */
  draftedWithoutCategory: number
  skipped: ApplySkip[]
  failed: ApplyFailure[]
}
