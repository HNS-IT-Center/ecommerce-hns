"use server"

import { getProducts } from "@/lib/api/woocommerce/products"
import { mapWooProductToUI } from "@/lib/api/woocommerce/mapper"
import { getStockDisplayMode } from "@/lib/api/stock-display"
import type { GetProductsParams } from "@/types/woocommerce"

export async function fetchProductsAction(params: GetProductsParams) {
  try {
    const products = await getProducts(params)
    const stockDisplayMode = await getStockDisplayMode()
    return products.map((p) => mapWooProductToUI(p, stockDisplayMode))
  } catch (error) {
    console.error("Error in fetchProductsAction:", error)
    return []
  }
}
