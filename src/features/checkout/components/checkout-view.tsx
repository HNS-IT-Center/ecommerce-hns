"use client"

import { useCartStore } from "@/store/cart"
import { formatRupiah } from "@/lib/utils"
import { Settings, ShoppingBag } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"

export function CheckoutView() {
  const { items, getSelectedTotalPrice } = useCartStore()
  
  // Only show selected items
  const selectedItems = items.filter(item => item.selected !== false)
  const totalUnits = selectedItems.reduce((sum, item) => sum + item.quantity, 0)
  const currentDate = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date())

  if (selectedItems.length === 0) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center space-y-4 px-4 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <ShoppingBag className="h-10 w-10 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Checkout Kosong</h2>
        <p className="text-muted-foreground">
          Anda belum memilih produk untuk dicheckout.
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

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <div className="lg:col-span-8">
        <div className="rounded-xl border bg-card mb-8">
          <div className="border-b p-6">
            <h2 className="text-xl font-bold">Detail Pesanan</h2>
            <p className="text-sm text-muted-foreground mt-1">Tanggal: {currentDate}</p>
          </div>
          <div className="divide-y">
            {selectedItems.map((item) => (
              <div key={item.id} className="flex gap-4 p-6 sm:gap-6">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted sm:h-24 sm:w-24">
                  {item.image ? (
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted">
                      <ShoppingBag className="h-6 w-6 text-muted-foreground/30" />
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col justify-center">
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
                      <p className="mt-2 text-sm">
                        {item.quantity} x {formatRupiah(item.price)}
                      </p>
                    </div>
                    <div className="text-right font-bold text-foreground">
                      {formatRupiah(item.price * item.quantity)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Coming Soon Block */}
        <div className="rounded-xl border border-dashed border-primary/50 bg-primary/5 p-12 flex flex-col items-center justify-center text-center">
          <div className="animate-spin-slow mb-4">
            <Settings className="h-12 w-12 text-primary" />
          </div>
          <h3 className="text-2xl font-bold text-primary mb-2">Coming Soon</h3>
          <p className="text-muted-foreground max-w-md">
            Sistem checkout otomatis sedang dalam tahap pengembangan. Untuk saat ini, silahkan hubungi CS kami.
          </p>
        </div>
      </div>

      <div className="lg:col-span-4">
        <div className="sticky top-24 rounded-xl border bg-muted/30 p-6">
          <h2 className="text-lg font-bold">Ringkasan Pembayaran</h2>
          
          <div className="mt-6 space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Harga ({totalUnits} Barang)</span>
              <span className="font-medium">{formatRupiah(getSelectedTotalPrice())}</span>
            </div>

            <div className="my-4 border-t border-dashed" />
            
            <div className="flex justify-between">
              <span className="font-bold">Total Belanja</span>
              <span className="text-lg font-extrabold text-sale-red">
                {formatRupiah(getSelectedTotalPrice())}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
