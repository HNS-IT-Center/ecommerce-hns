import { ProductCard, type Product } from "@/components/ui/product-card";
import { getProducts } from "@/lib/api/woocommerce/products";
import { mapWooProductToUI } from "@/lib/api/woocommerce/mapper";
import { getStockDisplayMode } from "@/lib/api/stock-display";

interface RelatedProductsProps {
  categoryId: number;
  excludeId: number;
}

export async function RelatedProducts({
  categoryId,
  excludeId,
}: RelatedProductsProps) {
  let products: Product[] = [];
  try {
    const wooProducts = await getProducts({
      category: categoryId,
      perPage: 6,
      exclude: [excludeId],
    });
    const stockDisplayMode = await getStockDisplayMode();
    products = wooProducts.map((p) => mapWooProductToUI(p, stockDisplayMode));
  } catch {
    // silently fail
  }

  if (products.length === 0) return null;

  return (
    <section className="mt-16 border-t border-border/50 pt-12">
      <h2 className="mb-6 text-2xl font-extrabold tracking-tight">
        Produk Terkait
      </h2>
      {/* 6 kartu, bukan 4 — angka ini habis dibagi 2 dan 3, jadi tidak ada
          kartu yang menggantung sendirian di baris terakhir pada breakpoint
          mana pun (2 kolom di mobile, 3 di tablet, 6 di layar lebar). */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6 lg:gap-6">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
