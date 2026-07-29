import { ProductCard } from "@/components/ui/product-card";
import { getProducts } from "@/lib/api/woocommerce/products";
import { mapWooProductToUI } from "@/lib/api/woocommerce/mapper";
import { DealsCountdown } from "./deals-countdown";
import { DealsCarousel } from "./deals-carousel";

export async function DealsSection() {
  let products;
  let earliestEndDate: string | null = null;

  try {
    const wooProducts = await getProducts({ onSale: true, perPage: 30 });
    products = wooProducts.map(mapWooProductToUI);
    
    // Extract earliest sale end date
    for (const wProd of wooProducts) {
      if (wProd.date_on_sale_to_gmt) {
        if (!earliestEndDate || new Date(wProd.date_on_sale_to_gmt) < new Date(earliestEndDate)) {
          earliestEndDate = wProd.date_on_sale_to_gmt;
        }
      }
    }
    
    // Daily seeded shuffle
    const daySeed = new Date().toISOString().split('T')[0];
    let seed = 0;
    for (let i = 0; i < daySeed.length; i++) {
        seed += daySeed.charCodeAt(i);
    }
    const random = () => {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    }
    products.sort(() => random() - 0.5);
    products = products.slice(0, 15);

  } catch {
    return null;
  }

  // Tidak ada produk diskon — sembunyikan section, jangan tampilkan produk biasa sebagai pengganti
  if (products.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-7xl px-4 md:px-6 py-[10px] border-b border-border/50">
      <DealsCountdown endDate={earliestEndDate ? earliestEndDate + "Z" : undefined} />
      <DealsCarousel products={products} />
    </section>
  );
}
