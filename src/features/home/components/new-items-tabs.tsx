import { getProducts } from "@/lib/api/woocommerce/products"
import { mapWooProductToUI } from "@/lib/api/woocommerce/mapper"
import { NewItemsTabsClient } from "./new-items-tabs-client"

export const TABS = [
  { id: "untukmu", label: "Untukmu", isRandom: true },
  { id: "best-deals", label: "Best Deals", onSale: true },
  { id: "promo", label: "Promo", isRandom: true },
  { id: "laptop", label: "Laptop", categorySlug: "laptop" },
  { id: "komponen-pc", label: "Komponen PC", categorySlug: "komponen-pc-nb" },
  { id: "gaming-gear", label: "Gaming Gear", categorySlug: "aksessories-komputer" },
  { id: "printer", label: "Printer", categorySlug: "printer" },
  { id: "charger-cable", label: "Charger & Cable", categorySlug: "cables-charger" },
]

export async function NewItemsTabs() {
  let initialProducts = []

  try {
    // Fetch initial 30 products for "Untukmu" (default)
    const wooProducts = await getProducts({ perPage: 30 })
    
    // Randomize initial products
    const daySeed = new Date().toISOString().split('T')[0];
    let seed = 0;
    for (let i = 0; i < daySeed.length; i++) seed += daySeed.charCodeAt(i);
    const random = () => {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    }
    
    wooProducts.sort(() => random() - 0.5)
    initialProducts = wooProducts.slice(0, 30).map(mapWooProductToUI)
  } catch (error) {
    console.error("Failed to fetch initial products:", error)
  }

  return (
    <NewItemsTabsClient
      tabs={TABS}
      initialProducts={initialProducts}
    />
  )
}
