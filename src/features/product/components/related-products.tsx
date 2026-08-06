import { ProductCard, type Product } from "@/components/ui/product-card";
import { getProducts } from "@/lib/api/woocommerce/products";
import { mapWooProductToUI } from "@/lib/api/woocommerce/mapper";

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
      perPage: 4,
      exclude: [excludeId],
    });
    products = wooProducts.map(mapWooProductToUI);
  } catch {
    // silently fail
  }

  if (products.length === 0) return null;

  return (
    <section className="mt-16 border-t border-border/50 pt-12">
      <h2 className="mb-6 text-2xl font-extrabold tracking-tight">
        Produk Terkait
      </h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:gap-6">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
