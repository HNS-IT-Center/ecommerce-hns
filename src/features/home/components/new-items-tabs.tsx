import { getProducts } from "@/lib/api/woocommerce/products"
import { getCategories } from "@/lib/api/woocommerce/categories"
import { mapWooProductToUI } from "@/lib/api/woocommerce/mapper"
import { getStockDisplayMode } from "@/lib/api/stock-display"
import { expandCategorySlugs } from "@/lib/utils/category-tree"
import { NewItemsTabsClient, type Tab } from "./new-items-tabs-client"
import type { Product } from "@/components/ui/product-card"

/**
 * Slug di sini ditulis untuk kategori INDUK saja.
 *
 * Keturunannya dipekarkan saat render oleh `resolveTabCategories()` di bawah,
 * jadi "KABEL / CONVERTER" otomatis ikut membawa KABEL HDMI, KABEL LAN, dan
 * seluruh anak lainnya — baik saat dipilih (`categorySlug`) maupun saat
 * disingkirkan (`excludeCategorySlugs`).
 *
 * Slugnya memakai jalur lengkap (`aksessories-komputer-kabel-converter`,
 * bukan `kabel-converter`) karena begitulah bentuknya di katalog.
 */
export const TABS: Tab[] = [
  { id: "untukmu", label: "Untukmu", isRandom: true },
  { id: "best-deals", label: "Best Deals", onSale: true },
  { id: "promo", label: "Promo", isRandom: true },
  { id: "laptop", label: "Laptop", categorySlug: "laptop" },
  { id: "komponen-pc", label: "Komponen PC", categorySlug: "komponen-pc-nb" },
  {
    id: "gaming-gear",
    label: "Gaming Gear",
    categorySlug: "aksessories-komputer",
    excludeCategorySlugs: [
      "furniture",
      "printer-proyektor",
      "aksessories-komputer-kabel-converter",
      "aksessories-komputer-powerbank-charger",
    ],
  },
  { id: "printer", label: "Printer", categorySlug: "printer-proyektor" },
  {
    id: "charger-cable",
    label: "Charger & Cables",
    categorySlug: [
      "aksessories-komputer-kabel-converter",
      "aksessories-komputer-powerbank-charger",
    ],
  },
]

/**
 * Menukar slug induk di `TABS` dengan slug induk + seluruh keturunannya.
 *
 * Kalau daftar kategorinya gagal dimuat, `TABS` dikembalikan apa adanya:
 * hasilnya kurang lengkap, tapi tabnya tetap jalan.
 */
async function resolveTabCategories(): Promise<Tab[]> {
  let categories
  try {
    categories = await getCategories({ perPage: 500 })
  } catch (error) {
    console.error("Gagal memuat kategori untuk tab Home:", error)
    return TABS
  }

  const unmatchedAll = new Set<string>()

  const resolved = TABS.map((tab) => {
    const next: Tab = { ...tab }

    if (tab.categorySlug) {
      const input = Array.isArray(tab.categorySlug) ? tab.categorySlug : [tab.categorySlug]
      const { slugs, unmatched } = expandCategorySlugs(input, categories)
      unmatched.forEach((s) => unmatchedAll.add(s))
      // Slug yang tidak cocok dibiarkan lewat apa adanya supaya perilakunya
      // tidak berubah diam-diam; yang menandainya adalah peringatan di bawah.
      next.categorySlug = slugs.length > 0 ? slugs : tab.categorySlug
    }

    if (tab.excludeCategorySlugs) {
      const { slugs, unmatched } = expandCategorySlugs(tab.excludeCategorySlugs, categories)
      unmatched.forEach((s) => unmatchedAll.add(s))
      next.excludeCategorySlugs = slugs.length > 0 ? slugs : tab.excludeCategorySlugs
    }

    return next
  })

  if (unmatchedAll.size > 0) {
    // Sengaja berisik. Slug salah ketik di TABS gagal TANPA galat — tabnya
    // cuma kosong, dan produknya diam-diam bocor ke tab yang seharusnya
    // menyingkirkannya.
    console.warn(
      `[NewItemsTabs] Slug kategori tidak ditemukan di katalog: ${Array.from(unmatchedAll).join(", ")}`,
    )
  }

  return resolved
}

export async function NewItemsTabs() {
  const tabs = await resolveTabCategories()
  let initialProducts: Product[] = []

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
    const stockDisplayMode = await getStockDisplayMode()
    initialProducts = wooProducts.slice(0, 30).map((p) => mapWooProductToUI(p, stockDisplayMode))
  } catch (error) {
    console.error("Failed to fetch initial products:", error)
  }

  return (
    <NewItemsTabsClient
      tabs={tabs}
      initialProducts={initialProducts}
    />
  )
}
