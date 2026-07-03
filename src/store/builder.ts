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

const initialSlots: Record<BuilderSlotId, BuilderSlot> = {
  cpu: {
    id: "cpu",
    title: "Prosesor (CPU)",
    categorySlug: "prosesor", 
    selectedItem: null,
  },
  motherboard: {
    id: "motherboard",
    title: "Motherboard",
    categorySlug: "motherboard",
    selectedItem: null,
  },
  ram: {
    id: "ram",
    title: "RAM (Memory)",
    categorySlug: "ram",
    selectedItem: null,
  },
  vga: {
    id: "vga",
    title: "Kartu Grafis (VGA)",
    categorySlug: "vga",
    selectedItem: null,
  },
  storage: {
    id: "storage",
    title: "Penyimpanan (SSD/HDD)",
    categorySlug: "ssd",
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
    categorySlug: "casing",
    selectedItem: null,
  },
  cooler: {
    id: "cooler",
    title: "Pendingin (Cooler) - Opsional",
    categorySlug: "cooler",
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
