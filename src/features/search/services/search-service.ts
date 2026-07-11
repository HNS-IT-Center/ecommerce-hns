import type { Product } from "@/components/ui/product-card"

export async function searchProducts(query: string): Promise<Product[]> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error("Search failed")
  return res.json()
}
