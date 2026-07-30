"use server"

import { getProducts } from "@/lib/api/woocommerce/products"
import { mapWooProductToUI } from "@/lib/api/woocommerce/mapper"
import type { GetProductsParams } from "@/types/woocommerce"

export async function fetchProductsAction(params: GetProductsParams) {
  try {
    const products = await getProducts(params)
    return products.map(mapWooProductToUI)
  } catch (error) {
    console.error("Error in fetchProductsAction:", error)
    return []
  }
}
