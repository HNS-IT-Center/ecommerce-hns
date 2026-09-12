import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProductCard, type Product } from "@/components/ui/product-card";
import { getProducts } from "@/lib/api/woocommerce/products";
import { mapWooProductToUI } from "@/lib/api/woocommerce/mapper";
import { getStockDisplayMode } from "@/lib/api/stock-display";

interface ToolsCrossSellProps {
  title: string;
  searchQuery: string;
  categorySlug: string;
}

export async function ToolsCrossSell({ title, searchQuery, categorySlug }: ToolsCrossSellProps) {
  // Dianotasi eksplisit: `let products = []` membuat TypeScript menyimpulkan
  // `any[]` (tidak ada konteks tipe di titik deklarasi), dan `noImplicitAny`
  // menolaknya saat build.
  let products: Product[] = [];
  try {
    const wooProducts = await getProducts({ search: searchQuery, category: categorySlug, perPage: 6 });
    const stockDisplayMode = await getStockDisplayMode();
    products = wooProducts.map((p) => mapWooProductToUI(p, stockDisplayMode));
  } catch (error) {
    console.error("Failed to fetch cross-sell products", error);
  }

  if (products.length === 0) {
    return null;
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{title}</h2>
        <Link 
          href={`/shop?q=${searchQuery}&category=${categorySlug}`}
          target="_blank"
          className="text-sm font-medium text-brand-green hover:text-brand-green/80 transition-colors flex items-center gap-1"
        >
          Explore More <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
