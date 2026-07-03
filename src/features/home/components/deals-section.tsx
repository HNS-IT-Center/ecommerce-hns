import { ProductCard } from "@/components/ui/product-card";
import { getProducts } from "@/lib/api/woocommerce/products";
import { mapWooProductToUI } from "@/lib/api/woocommerce/mapper";
import { DealsCountdown } from "./deals-countdown";

export async function DealsSection() {
  let products;
  let earliestEndDate: string | null = null;

  try {
    const wooProducts = await getProducts({ onSale: true, perPage: 4 });
    products = wooProducts.map(mapWooProductToUI);
    
    // Extract earliest sale end date
    for (const wProd of wooProducts) {
      if (wProd.date_on_sale_to_gmt) {
        if (!earliestEndDate || new Date(wProd.date_on_sale_to_gmt) < new Date(earliestEndDate)) {
          earliestEndDate = wProd.date_on_sale_to_gmt;
        }
      }
    }
  } catch {
    return null;
  }

  // Tidak ada produk diskon — sembunyikan section, jangan tampilkan produk biasa sebagai pengganti
  if (products.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-7xl px-4 md:px-6 py-12 border-b border-border/50">
      <DealsCountdown endDate={earliestEndDate ? earliestEndDate + "Z" : undefined} />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:gap-6">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
