"use client"

import { useCartStore } from "@/store/cart"
import { formatRupiah } from "@/lib/utils"
import { buildWhatsAppUrl } from "@/lib/api/whatsapp"
import { generateOrderMessage } from "@/features/checkout/lib/generate-order-message"
import { Trash2, Plus, Minus, MessageCircle, ShoppingBag } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { Button, buttonVariants } from "@/components/ui/button"

type CartViewProps = {
  whatsappNumber: string
}

export function CartView({ whatsappNumber }: CartViewProps) {
  const { items, removeItem, updateQuantity, getTotalPrice } = useCartStore()
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0)

  if (items.length === 0) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center space-y-4 px-4 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <ShoppingBag className="h-10 w-10 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Keranjang Kosong</h2>
        <p className="text-muted-foreground">
          Belum ada produk di keranjang Anda.
        </p>
        <Link
          href="/shop"
          className={buttonVariants({ variant: "default", size: "lg", className: "mt-4 px-8" })}
        >
          Mulai Belanja
        </Link>
      </div>
    )
  }

  const handleCheckoutWA = () => {
    const message = generateOrderMessage(items, getTotalPrice())
    window.open(buildWhatsAppUrl(whatsappNumber, message), "_blank")
  }

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      {/* Cart Items */}
      <div className="lg:col-span-8">
        <div className="rounded-xl border bg-card">
          <div className="border-b p-6">
            <h2 className="text-xl font-bold">Keranjang Belanja</h2>
          </div>
          <div className="divide-y">
            {items.map((item) => (
              <div key={item.id} className="flex gap-4 p-6 sm:gap-6">
                {/* Product Image */}
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-muted sm:h-32 sm:w-32">
                  {item.image ? (
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted">
                      <ShoppingBag className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                  )}
                </div>

                {/* Product Details */}
                <div className="flex flex-1 flex-col justify-between">
                  <div className="flex justify-between gap-4">
                    <div>
                      <h3 className="font-semibold leading-tight line-clamp-2">
                        {item.name}
                      </h3>
                      {item.variationLabel && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item.variationLabel}
                        </p>
                      )}
                      {item.sku && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          SKU: {item.sku}
                        </p>
                      )}
                    </div>
                    <div className="text-right font-bold text-foreground sm:text-lg">
                      {formatRupiah(item.price)}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center rounded-lg border bg-background">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="flex h-8 w-12 items-center justify-center text-sm font-medium">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    
                    <button
                      onClick={() => removeItem(item.id)}
                      className="flex items-center gap-2 text-sm font-medium text-sale-red hover:underline"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="hidden sm:inline">Hapus</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Order Summary */}
      <div className="lg:col-span-4">
        <div className="sticky top-24 rounded-xl border bg-muted/30 p-6">
          <h2 className="text-lg font-bold">Ringkasan Belanja</h2>
          
          <div className="mt-6 space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Harga ({totalUnits} Barang)</span>
              <span className="font-medium">{formatRupiah(getTotalPrice())}</span>
            </div>

            <div className="my-4 border-t border-dashed" />
            
            <div className="flex justify-between">
              <span className="font-bold">Total Belanja</span>
              <span className="text-lg font-extrabold text-sale-red">
                {formatRupiah(getTotalPrice())}
              </span>
            </div>
          </div>

          <Button
            variant="default"
            size="lg"
            onClick={handleCheckoutWA}
            className="mt-6 h-14 w-full bg-[#25D366] hover:bg-[#128C7E] text-white shadow-lg shadow-whatsapp/20"
          >
            <MessageCircle className="h-5 w-5" />
            Checkout via WhatsApp
          </Button>
          
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Anda akan diarahkan ke WhatsApp untuk menyelesaikan pesanan.
          </p>
        </div>
      </div>
    </div>
  )
}
