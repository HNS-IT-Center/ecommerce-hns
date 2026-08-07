"use client"

import { useCartStore } from "@/store/cart"
import { formatRupiah } from "@/lib/utils"
import { MessageCircle, ShoppingBag } from "lucide-react"
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
                      // 80px (h-20) di bawah breakpoint sm, 96px (sm:h-24) di atasnya.
                      sizes="(min-width: 640px) 96px, 80px"
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
        
        {/*
          Menyatakan cara memesan, BUKAN fitur yang sedang dibangun.

          Sebelumnya kotak ini bertuliskan "Coming Soon — sistem checkout
          otomatis sedang dalam tahap pengembangan". Itu kabar tentang kami,
          bukan tentang pesanan orang yang sedang membacanya: ia sudah memilih
          barang dan siap membayar, lalu diberi tahu bahwa yang dia butuhkan
          belum ada. Titik paling mahal untuk mengecewakan orang.

          Jangan kembalikan bahasa "coming soon" di sini. Pemesanan lewat CS
          bukan penampung sementara — itu memang cara HNS bekerja, dan
          kalimatnya tetap benar meski checkout otomatis dibangun nanti.
        */}
        <div className="rounded-xl border border-dashed border-whatsapp/50 bg-whatsapp/5 p-12 flex flex-col items-center justify-center text-center">
          <div className="mb-4">
            <MessageCircle className="h-12 w-12 text-whatsapp" />
          </div>
          <h3 className="text-2xl font-bold text-whatsapp mb-2">Pesan lewat WhatsApp</h3>
          <p className="text-muted-foreground max-w-md">
            Pesanan Anda diselesaikan bersama tim CS kami lewat WhatsApp —
            termasuk konfirmasi stok, ongkir, dan cara pembayaran.
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
