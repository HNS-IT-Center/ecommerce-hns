import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

/**
 * Penanda bahwa sebuah baris keranjang adalah bagian dari paket PC Prebuild.
 *
 * Paket TIDAK disimpan sebagai satu baris tersendiri. Tiap komponennya tetap
 * baris keranjang biasa dengan `productId` katalog yang sungguhan, dan itu
 * disengaja: `priceCartFromCatalog` membaca ulang harga per `productId` saat
 * memesan (CLAUDE.md §2.7), jadi paket yang berdiri sebagai satu baris tanpa
 * produk akan menuntut jalur harga kedua — dan jalur harga adalah satu-satunya
 * tempat di repo ini yang paling tidak boleh punya dua versi.
 *
 * Yang membuatnya terasa sebagai satu kesatuan bagi pelanggan ada di lapisan
 * tampilan: `groupCartItems()` mengelompokkannya, harga per komponen tidak
 * ditampilkan, dan jumlah/hapus/pilih semuanya bekerja di level paket.
 */
export type CartBundleRef = {
  /** Kunci satu paket DI KERANJANG: id preset + kombinasi pilihan tukarnya. */
  key: string
  presetId: string
  /** Nama paket, untuk kepala blok di keranjang dan pesan WhatsApp. */
  name: string
  /**
   * Jumlah komponen ini untuk SATU paket. `quantity` di baris ini selalu
   * `unitQuantity * bundle.quantity` — disimpan supaya mengubah jumlah paket
   * tidak perlu menebak balik berapa aslinya.
   */
  unitQuantity: number
  /** Jumlah paket. Sama di semua baris milik paket yang sama. */
  quantity: number
}

export interface CartItem {
  /**
   * Format: `<productId>` untuk produk biasa, `<productId>_<variationId>` untuk
   * varian, dan `<productId>_<variationId atau kosong>_b<bundleKey>` untuk
   * komponen yang datang dari paket PC Prebuild.
   *
   * Segmen ketiga membuat satu produk bisa hidup di dua paket sekaligus — atau
   * di sebuah paket sekaligus berdiri sendiri — tanpa `addItem` menggabungkan
   * keduanya jadi satu baris. Segmen 0 dan 1 TIDAK boleh berpindah tempat:
   * `priceBearingId()` di features/checkout/actions.ts membacanya untuk
   * menentukan baris mana yang memegang harga.
   */
  id: string
  productId: number
  name: string
  price: number
  image?: string
  quantity: number
  sku?: string
  variationLabel?: string // mis. "Warna: Black" — ditampilkan di bawah nama produk di cart
  selected?: boolean // Untuk memilih item checkout
  /** Terisi hanya untuk komponen paket PC Prebuild. */
  bundle?: CartBundleRef
}

interface CartState {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  clearCart: () => void
  getTotalPrice: () => number
  getTotalItems: () => number
  toggleSelect: (id: string) => void
  toggleSelectAll: (selected: boolean) => void
  getSelectedTotalPrice: () => number
  /**
   * Memasukkan satu paket PC Prebuild sebagai satu kesatuan.
   *
   * Seluruh `lines` wajib berbagi `bundle.key` yang sama. Paket yang sudah ada
   * di keranjang TIDAK digandakan barisnya — jumlah paketnya yang bertambah,
   * dan kuantitas tiap komponen ikut dihitung ulang dari `unitQuantity`.
   */
  addBundle: (lines: CartItem[]) => void
  removeBundle: (key: string) => void
  /** Mengubah jumlah paket. Kuantitas tiap komponen ikut dikali ulang. */
  updateBundleQuantity: (key: string, quantity: number) => void
  /** Centang pilih di level paket — komponen tidak bisa dipilih satu per satu. */
  toggleSelectBundle: (key: string) => void
}

/**
 * Batas jumlah paket per keranjang.
 *
 * Alasannya sama dengan `MAX_QUANTITY_PER_ITEM` di lib/pc-prebuild/limits.ts:
 * angkanya ikut ke pesan WhatsApp yang diterima CS, dan sepuluh rakitan
 * sekaligus sudah jauh di atas pesanan ritel yang wajar — di atas itu urusannya
 * memang lewat CS, bukan lewat keranjang.
 */
const MAX_BUNDLE_QUANTITY = 10

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (newItem) => {
        set((state) => {
          const existingItemIndex = state.items.findIndex((item) => item.id === newItem.id)

          if (existingItemIndex >= 0) {
            // Update quantity if item already exists
            const newItems = [...state.items]
            newItems[existingItemIndex].quantity += newItem.quantity
            newItems[existingItemIndex].selected = true // Select by default when added
            return { items: newItems }
          }

          // Add new item if it doesn't exist
          return { items: [...state.items, { ...newItem, selected: true }] }
        })
      },

      removeItem: (id) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        }))
      },

      updateQuantity: (id, quantity) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, quantity: Math.max(1, quantity) } : item
          ),
        }))
      },

      clearCart: () => {
        set({ items: [] })
      },

      getTotalPrice: () => {
        return get().items.reduce((total, item) => total + item.price * item.quantity, 0)
      },

      getTotalItems: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0)
      },

      toggleSelect: (id) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, selected: !item.selected } : item
          ),
        }))
      },

      toggleSelectAll: (selected) => {
        set((state) => ({
          items: state.items.map((item) => ({ ...item, selected })),
        }))
      },

      getSelectedTotalPrice: () => {
        return get().items.reduce((total, item) => {
          if (item.selected !== false) {
            return total + item.price * item.quantity
          }
          return total
        }, 0)
      },

      addBundle: (lines) => {
        if (lines.length === 0) return
        const kunci = lines[0].bundle?.key
        if (!kunci) return

        set((state) => {
          const sudahAda = state.items.some((item) => item.bundle?.key === kunci)
          if (!sudahAda) {
            return { items: [...state.items, ...lines.map((l) => ({ ...l, selected: true }))] }
          }

          // Paketnya sudah di keranjang: yang bertambah jumlah PAKETNYA, bukan
          // jumlah barisnya. Menambahkan baris kedua untuk paket yang sama akan
          // memecah blok yang justru dibuat supaya rakitannya tetap utuh.
          const tambahan = lines[0].bundle?.quantity ?? 1
          return {
            items: state.items.map((item) => {
              if (item.bundle?.key !== kunci) return item
              const jumlahPaket = Math.min(item.bundle.quantity + tambahan, MAX_BUNDLE_QUANTITY)
              return {
                ...item,
                quantity: item.bundle.unitQuantity * jumlahPaket,
                selected: true,
                bundle: { ...item.bundle, quantity: jumlahPaket },
              }
            }),
          }
        })
      },

      removeBundle: (key) => {
        set((state) => ({ items: state.items.filter((item) => item.bundle?.key !== key) }))
      },

      updateBundleQuantity: (key, quantity) => {
        const jumlahPaket = Math.min(Math.max(1, quantity), MAX_BUNDLE_QUANTITY)
        set((state) => ({
          items: state.items.map((item) => {
            if (item.bundle?.key !== key) return item
            return {
              ...item,
              quantity: item.bundle.unitQuantity * jumlahPaket,
              bundle: { ...item.bundle, quantity: jumlahPaket },
            }
          }),
        }))
      },

      toggleSelectBundle: (key) => {
        const items = get().items
        // Satu paket = satu keputusan. Kalau ada satu saja komponennya yang
        // belum tercentang, seluruh paket dicentang — bukan dibalik satu per
        // satu, yang bisa meninggalkan paket setengah terpilih dan membuat
        // rakitan separuh sampai ke CS.
        const semuaTerpilih = items
          .filter((item) => item.bundle?.key === key)
          .every((item) => item.selected !== false)

        set({
          items: items.map((item) =>
            item.bundle?.key === key ? { ...item, selected: !semuaTerpilih } : item
          ),
        })
      },
    }),
    {
      name: "hns-cart-storage", // key in localStorage
      storage: createJSONStorage(() => localStorage),
    }
  )
)
