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
// (bukan tebakan) — sebelumnya beberapa slug (prosesor/motherboard/ram/vga/ssd/
// cooler/casing) tidak match kategori manapun, jadi /api/products diam-diam
// jatuh ke pencarian keyword yang salah sasaran (mis. slot "RAM" nunjukin
// speaker JBL). WooCommerce toko ini TIDAK punya kategori khusus untuk
// Processor, RAM, atau VGA — untuk 3 slot itu, categorySlug sengaja diisi
// kata kunci pencarian ter-presisi (bukan slug kategori beneran), karena
// /api/products sudah punya fallback: kalau slug tidak match kategori, ia
// dipakai sebagai keyword pencarian. Lihat PRE-DEPLOY-CHECKLIST.md.
const initialSlots: Record<BuilderSlotId, BuilderSlot> = {
  cpu: {
    id: "cpu",
    title: "Prosesor (CPU)",
    categorySlug: "processor", // tidak ada kategori Processor — fallback ke search "processor"
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
    categorySlug: "ram pc", // tidak ada kategori RAM — fallback ke search "ram pc" (tidak sempurna, masih ada noise laptop/casing, tapi jauh lebih relevan dari "ram" sendirian)
    selectedItem: null,
  },
  vga: {
    id: "vga",
    title: "Kartu Grafis (VGA)",
    categorySlug: "vga card", // tidak ada kategori VGA — fallback ke search "vga card"
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
