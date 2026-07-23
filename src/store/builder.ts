import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

export interface BuilderItem {
  id: string
  name: string
  price: number
  image?: string
}

export type BuilderSlotId =
  | "cpu"
  | "motherboard"
  | "ram"
  | "vga"
  | "storage"
  | "psu"
  | "casing"
  | "cooler"

// Filter "jenis" opsional dalam satu slot, mis. slot Storage yang datanya
// tersebar di beberapa sub-kategori WooCommerce berbeda (SSD NVMe vs SSD SATA
// vs HDD internal) — tiap opsi mengarah ke satu sub-kategori spesifik.
export interface BuilderTypeFilterOption {
  label: string
  categorySlug: string
}

export interface BuilderSlot {
  id: BuilderSlotId
  title: string
  categorySlug: string // untuk fetch dari woocommerce; boleh gabungan beberapa slug dipisah koma
  typeFilters?: BuilderTypeFilterOption[] // filter jenis, ditampilkan sebagai chip di modal pemilihan
  attributeSlug?: string // slug taxonomy atribut WooCommerce utk filter kapasitas, mis. "pa_kapasitas-storage"
  selectedItem: BuilderItem | null
}

interface BuilderState {
  slots: Record<BuilderSlotId, BuilderSlot>
  selectItem: (slotId: BuilderSlotId, item: BuilderItem) => void
  removeItem: (slotId: BuilderSlotId) => void
  clearBuild: () => void
  getTotalPrice: () => number
}

// categorySlug di bawah ini diverifikasi langsung ke taxonomy WooCommerce asli
// via REST API /products/categories (bukan tebakan). Processor, RAM, dan VGA
// TERNYATA punya kategori sendiri (id 29/24/98) — temuan sesi sebelumnya bahwa
// kategori ini tidak ada itu salah; yang salah adalah slug tebakannya
// ("ram pc", "vga card") tidak cocok dengan slug asli WooCommerce.
const initialSlots: Record<BuilderSlotId, BuilderSlot> = {
  cpu: {
    id: "cpu",
    title: "Prosesor (CPU)",
    categorySlug: "processor",
    selectedItem: null,
  },
  motherboard: {
    id: "motherboard",
    title: "Motherboard",
    categorySlug: "motherboard-pc",
    selectedItem: null,
  },
  ram: {
    id: "ram",
    title: "RAM (Memory)",
    categorySlug: "memory-pc",
    selectedItem: null,
  },
  vga: {
    id: "vga",
    title: "Kartu Grafis (VGA)",
    categorySlug: "vga-card-graphics-card",
    selectedItem: null,
  },
  storage: {
    id: "storage",
    title: "Penyimpanan (SSD/HDD)",
    // "hardisk" (id 187) TERNYATA cuma berisi hardisk eksternal/caddy/enclosure —
    // bukan storage internal untuk rakitan. Storage internal asli ada di 3
    // sub-kategori terpisah, digabung di sini (dipisah koma, di-OR-kan oleh
    // /api/products): SSD NVMe (m-2-nvme), SSD SATA (ssd-sata-25), HDD
    // internal (hardisk-internal, anak dari "hardisk" itu sendiri).
    categorySlug: "m-2-nvme,ssd-sata-25,hardisk-internal",
    typeFilters: [
      { label: "SSD NVMe", categorySlug: "m-2-nvme" },
      { label: "SSD SATA", categorySlug: "ssd-sata-25" },
      { label: "HDD", categorySlug: "hardisk-internal" },
    ],
    attributeSlug: "pa_kapasitas-storage",
    selectedItem: null,
  },
  psu: {
    id: "psu",
    title: "Power Supply (PSU)",
    categorySlug: "power-supply",
    selectedItem: null,
  },
  casing: {
    id: "casing",
    title: "Casing",
    categorySlug: "casing-pc",
    selectedItem: null,
  },
  cooler: {
    id: "cooler",
    title: "Pendingin (Cooler) - Opsional",
    categorySlug: "liquid-cooling",
    selectedItem: null,
  },
}

// Hanya pilihan produk per slot yang disimpan ke localStorage — BUKAN seluruh
// config slot (title/categorySlug/typeFilters/attributeSlug). Kalau nanti slug
// kategori diperbaiki lagi di kode (persis seperti fix RAM/VGA/Storage di atas),
// user yang builder-nya sudah tersimpan tidak boleh "terjebak" bawa config basi
// dari localStorage — config selalu ikut kode terbaru, cuma pilihan produknya
// yang persist.
type PersistedBuilderState = {
  selections: Partial<Record<BuilderSlotId, BuilderItem | null>>
}

export const useBuilderStore = create<BuilderState>()(
  persist<BuilderState, [], [], PersistedBuilderState>(
    (set, get) => ({
      slots: initialSlots,

      selectItem: (slotId, item) => {
        set((state) => ({
          slots: {
            ...state.slots,
            [slotId]: {
              ...state.slots[slotId],
              selectedItem: item,
            },
          },
        }))
      },

      removeItem: (slotId) => {
        set((state) => ({
          slots: {
            ...state.slots,
            [slotId]: {
              ...state.slots[slotId],
              selectedItem: null,
            },
          },
        }))
      },

      clearBuild: () => {
        set({ slots: initialSlots })
      },

      getTotalPrice: () => {
        const slots = get().slots
        return Object.values(slots).reduce((total, slot) => {
          return total + (slot.selectedItem?.price || 0)
        }, 0)
      },
    }),
    {
      name: "hns-builder-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        selections: Object.fromEntries(
          Object.entries(state.slots).map(([id, slot]) => [id, slot.selectedItem])
        ) as Partial<Record<BuilderSlotId, BuilderItem | null>>,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as PersistedBuilderState | undefined
        if (!persisted?.selections) return currentState

        const slots = { ...currentState.slots }
        for (const [slotId, item] of Object.entries(persisted.selections)) {
          const id = slotId as BuilderSlotId
          if (slots[id]) {
            slots[id] = { ...slots[id], selectedItem: item ?? null }
          }
        }
        return { ...currentState, slots }
      },
    }
  )
)
