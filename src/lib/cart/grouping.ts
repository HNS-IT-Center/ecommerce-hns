import type { CartItem } from "@/store/cart"

/**
 * Mengelompokkan isi keranjang jadi blok yang bisa dirender.
 *
 * Komponen paket PC Prebuild disimpan sebagai baris keranjang biasa (lihat
 * `CartBundleRef` di store/cart.ts) supaya jalur harganya tidak bercabang.
 * Berkas inilah yang mengembalikan bentuk "satu kesatuan" itu ke layar —
 * dan ia SATU tempat, dipakai `/cart`, panel keranjang, dan `/checkout`.
 *
 * Kalau tiap halaman mengelompokkan sendiri, cepat atau lambat ada satu yang
 * menampilkan tujuh komponen berserakan sementara dua halaman lain
 * menampilkannya sebagai paket — dan pelanggan tidak punya cara tahu mana yang
 * benar.
 *
 * Tidak mengimpor apa pun selain tipe, jadi aman dipakai Server maupun Client
 * Component.
 */

export type CartGroup =
  | { kind: "item"; key: string; item: CartItem }
  | {
      kind: "bundle"
      key: string
      presetId: string
      name: string
      /** Jumlah paket. Kuantitas tiap baris sudah dikali angka ini. */
      quantity: number
      lines: CartItem[]
    }

/**
 * Urutannya mengikuti KEMUNCULAN PERTAMA tiap kelompok, bukan mengumpulkan
 * semua paket di atas. Barang yang baru dimasukkan pelanggan harus muncul di
 * tempat yang ia harapkan; daftar yang menyusun ulang dirinya sendiri membuat
 * orang mengira barangnya tidak jadi masuk.
 */
export function groupCartItems(items: CartItem[]): CartGroup[] {
  const groups: CartGroup[] = []
  const indeksBundle = new Map<string, number>()

  for (const item of items) {
    const bundle = item.bundle
    if (!bundle) {
      groups.push({ kind: "item", key: item.id, item })
      continue
    }

    const sudahAda = indeksBundle.get(bundle.key)
    if (sudahAda === undefined) {
      indeksBundle.set(bundle.key, groups.length)
      groups.push({
        kind: "bundle",
        key: bundle.key,
        presetId: bundle.presetId,
        name: bundle.name,
        quantity: bundle.quantity,
        lines: [item],
      })
      continue
    }

    const group = groups[sudahAda]
    if (group.kind === "bundle") group.lines.push(item)
  }

  return groups
}

/**
 * Total satu kelompok menurut harga satuan yang diberikan pemanggil.
 *
 * `unitPriceOf` sengaja dioper dari luar: di `/cart` dan `/checkout` harga
 * satuannya berasal dari katalog (hasil `useCatalogPricing`), bukan dari angka
 * yang mengendap di localStorage. Menjumlahkan harga satuan katalog boleh —
 * yang dilarang CLAUDE.md §2.7 adalah menurunkan harga baru dari rumus.
 */
export function groupTotal(
  group: CartGroup,
  unitPriceOf: (item: CartItem) => number
): number {
  if (group.kind === "item") return unitPriceOf(group.item) * group.item.quantity
  return group.lines.reduce((total, line) => total + unitPriceOf(line) * line.quantity, 0)
}

/** Seluruh baris keranjang di dalam sebuah kelompok. */
export function groupLines(group: CartGroup): CartItem[] {
  return group.kind === "item" ? [group.item] : group.lines
}

/**
 * Paket yang salah satu komponennya sudah ditarik dari katalog.
 *
 * Dilaporkan di level PAKET, bukan per komponen: PC yang kehilangan
 * motherboard-nya bukan pesanan yang lebih murah, ia pesanan yang tidak bisa
 * dipenuhi. Pelanggan yang memutuskan mau mengeluarkan paketnya atau tidak —
 * dan sampai itu diputuskan, paketnya tidak ikut ke pesan CS
 * (`prepareCheckoutWhatsApp` yang menegakkannya di server).
 */
export function isGroupBlocked(group: CartGroup, unavailableCartItemIds: string[]): boolean {
  if (unavailableCartItemIds.length === 0) return false
  return groupLines(group).some((line) => unavailableCartItemIds.includes(line.id))
}
