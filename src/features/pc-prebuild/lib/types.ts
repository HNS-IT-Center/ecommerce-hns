import type { PrebuildComponentRole } from "@/lib/pc-prebuild/component-roles"
import type { PrebuildPerformance } from "@/lib/pc-prebuild/performance"

/**
 * Bentuk paket yang dikirim server ke komponen halaman pelanggan.
 *
 * Ini BUKAN `ResolvedPrebuildPreset`. Bedanya disengaja:
 *
 * - `resolve.ts` bertanda `server-only` dan bentuknya mengandung hal yang tidak
 *   boleh menyeberang ke pelanggan (`performance` apa adanya — termasuk draf,
 *   hasil basi, dan `bottleneck` yang khusus admin). Yang menyeberang hanya
 *   `performancePublic`, dan itu ditegakkan di `toPrebuildView()`.
 * - Berkas ini tidak mengimpor apa pun yang menyentuh Prisma, jadi Client
 *   Component boleh memakainya. `component-roles.ts` dan `performance.ts`
 *   dua-duanya sengaja tidak mengimpor apa pun (docs/11-pc-prebuild.md §7).
 *
 * Harga di sini SELALU harga katalog yang dibaca server. Klien boleh
 * menjumlahkannya saat pelanggan menukar pilihan; yang dilarang CLAUDE.md §2.7
 * adalah menurunkan harga baru dari rumus.
 */
export type PrebuildOption = {
  /** Id INDUK. Inilah yang dibawa `?pick=` ke wizard — bukan indeks pilihan. */
  productId: number
  /** Terisi kalau barangnya varian; ia yang memegang harga dan stok. */
  variationId?: number
  quantity: number
  /** Label tombol pilihan: tulisan staff, atau nama produknya. */
  label: string
  /** Nama produk untuk keranjang — tanpa embel-embel varian. */
  name: string
  /** Nilai atribut varian, mis. "1TB · Hitam". Kosong untuk produk biasa. */
  variationLabel: string | null
  image: string | null
  /** Harga katalog satuan. Nol kalau produknya sudah tidak ada. */
  price: number
  inStock: boolean
  /** `false` = produknya sudah tidak ada di katalog. */
  available: boolean
}

export type PrebuildComponent = {
  /** Kunci stabil satu barang di dalam paket: `<stepId>#<urutan barang>`. */
  key: string
  stepId: string
  stepName: string
  role: PrebuildComponentRole
  roleLabel: string
  /**
   * Bawaan = pilihan PERTAMA (docs/11-pc-prebuild.md §5). Stok kosong tidak
   * memindahkannya; pelanggan yang memilih sendiri kalau mau menukar.
   */
  options: PrebuildOption[]
  /** Lebih dari satu pilihan — barang ini bisa ditukar pelanggan. */
  branching: boolean
  /** Seluruh pilihannya hilang dari katalog. */
  missing: boolean
}

export type PrebuildView = {
  id: string
  name: string
  summary: string
  images: string[]
  cover: string | null
  /**
   * Sudah diurutkan: Processor, RAM, Penyimpanan, Graphics Card di depan, lalu
   * sisanya mengikuti urutan langkah di `/admin/pc-builder`.
   */
  components: PrebuildComponent[]
  /** Total pilihan bawaan, dari katalog. */
  total: number
  /** Kombinasi termurah — dipakai label "mulai dari" pada paket bercabang. */
  minTotal: number
  branchingCount: number
  missingCount: number
  outOfStockCount: number
  /**
   * HANYA `performancePublic`: sudah ditayangkan staff DAN belum basi.
   * `null` = panel performa tidak dirender sama sekali.
   */
  performance: PrebuildPerformance | null
}
