import { NextRequest, NextResponse } from "next/server";
import { getProductById } from "@/lib/api/woocommerce/products";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  if (!id || isNaN(Number(id))) {
    return NextResponse.redirect(new URL("/shop", request.url));
  }

  const productId = Number(id);
  const product = await getProductById(productId);

  if (!product) {
    return NextResponse.redirect(new URL("/shop", request.url));
  }

  // Use a 301 Permanent Redirect to transfer SEO value to the canonical slug URL.
  return NextResponse.redirect(new URL(`/product/${product.slug}`, request.url), 301);
}
