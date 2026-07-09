"use client"

import { useToastManager } from "@/components/ui/toast"

export function useAddToCartToast() {
  const toastManager = useToastManager()

  return (productName: string) => {
    toastManager.add({
      title: "Ditambahkan ke keranjang",
      description: productName,
      priority: "low",
      timeout: 3000,
    })
  }
}
