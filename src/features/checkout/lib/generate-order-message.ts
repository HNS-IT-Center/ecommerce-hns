import type { CartItem } from "@/store/cart"
import { formatRupiah } from "@/lib/utils"

export function generateOrderMessage(items: CartItem[], total: number): string {
  const intro = "Halo HNS IT Center, saya mau order:"

  const itemLines = items
    .map((item, index) => {
      const variantLine = item.variationLabel ? `\n   Varian: ${item.variationLabel}` : ""
      const skuLine = item.sku ? `\n   SKU: ${item.sku}` : ""
      return (
        `${index + 1}. ${item.name}${variantLine}${skuLine}\n` +
        `   Jumlah: ${item.quantity} x ${formatRupiah(item.price)}\n` +
        `   Subtotal: ${formatRupiah(item.price * item.quantity)}`
      )
    })
    .join("\n\n")

  const totalLine = `*Total Pembayaran: ${formatRupiah(total)}*`
  const outro = "Mohon info ketersediaan stok & cara pembayaran. Terima kasih."

  return `${intro}\n\n${itemLines}\n\n${totalLine}\n\n${outro}`
}
