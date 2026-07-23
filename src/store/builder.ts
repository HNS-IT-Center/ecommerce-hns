import { create } from "zustand"

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

export interface BuilderSlot {
  id: BuilderSlotId
  title: string
  categorySlug: string // untuk fetch dari woocommerce
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
    categorySlug: "hardisk",
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

export const useBuilderStore = create<BuilderState>()((set, get) => ({
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
}))
