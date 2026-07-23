import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

export interface CartItem {
  id: string // Format: productId_variationId (jika ada variasi), atau sekadar productId
  productId: number
  name: string
  price: number
  image?: string
  quantity: number
  sku?: string
  variationLabel?: string // mis. "Warna: Black" — ditampilkan di bawah nama produk di cart
}

interface CartState {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  clearCart: () => void
  getTotalPrice: () => number
  getTotalItems: () => number
}

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
            return { items: newItems }
          }
          
          // Add new item if it doesn't exist
          return { items: [...state.items, newItem] }
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
    }),
    {
      name: "hns-cart-storage", // key in localStorage
      storage: createJSONStorage(() => localStorage),
    }
  )
)
