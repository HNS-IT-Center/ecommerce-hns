import { getCategories } from "@/lib/api/woocommerce/categories"
import { getProducts } from "@/lib/api/woocommerce/products"
import { mapWooProductToUI } from "@/lib/api/woocommerce/mapper"
import { NewItemsTabsClient } from "./new-items-tabs-client"

// Slug kategori WooCommerce asli. "Gaming Gear" tidak punya kategori sendiri
// di toko — mouse/keyboard/headset/kursi gaming semuanya masuk di bawah
// "Aksessories Komputer", jadi itu yang dipakai sebagai sumber produknya.
const TABS = [
  { id: "laptop", label: "Laptop", categorySlug: "laptop" },
  { id: "komponen-pc", label: "Komponen PC", categorySlug: "komponen-pc-nb" },
  { id: "gaming-gear", label: "Gaming Gear", categorySlug: "aksessories-komputer" },
] as const

export async function NewItemsTabs() {
  const productsByTab: Record<string, ReturnType<typeof mapWooProductToUI>[]> = {}

  await Promise.all(
    TABS.map(async (tab) => {
      try {
        const matches = await getCategories({ slug: tab.categorySlug })
        const category = matches[0]
        if (!category) {
          productsByTab[tab.id] = []
          return
        }
        const wooProducts = await getProducts({
          category: category.id,
          perPage: 4,
          orderby: "date",
          order: "desc",
        })
        productsByTab[tab.id] = wooProducts.map(mapWooProductToUI)
      } catch {
        productsByTab[tab.id] = []
      }
    })
  )

  return (
    <NewItemsTabsClient
      tabs={TABS.map(({ id, label }) => ({ id, label }))}
      productsByTab={productsByTab}
    />
  )
}
