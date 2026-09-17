"use client"

import { useState } from "react"

import { useCartStore, type CartItem } from "@/store/cart"
import {
  groupCartItems,
  groupLines,
  groupDiscount,
  groupTotal,
  groupsTotal,
  isGroupBlocked,
  type BundleDiscountOf,
  type CartGroup,
} from "@/lib/cart/grouping"
import { formatRupiah } from "@/lib/utils"
import { MessageCircle, PackageOpen, ShoppingBag, TriangleAlert } from "lucide-react"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { ProductImage } from "@/components/ui/product-image"
import { WhatsAppOrderButton } from "./whatsapp-order-button"

export function CheckoutView() {
  const { items } = useCartStore()

  /**
   * Harga menurut katalog, terisi setelah tombol WhatsApp membacanya.
   *
   * null = katalog belum dibaca, jadi yang tampil masih angka keranjang.
   * Begitu terisi, ia menggantikan angka keranjang di SELURUH halaman — baris
   * per barang maupun ringkasan. Mengoreksi totalnya saja akan membuat
   * penjumlahan di layar tidak cocok, yang justru memindahkan masalahnya.
   */
  const [catalogPricing, setCatalogPricing] = useState<{
    total: number
    unitPriceByCartItemId: Record<string, number>
    unavailableCartItemIds: string[]
    bundleDiscountByKey: Record<string, number>
  } | null>(null)

  // Only show selected items
  const selectedItems = items.filter(item => item.selected !== false)
  /** Harga satuan yang ditampilkan: katalog kalau sudah dibaca, keranjang kalau belum. */
  const unitPriceOf = (item: CartItem) =>
    catalogPricing?.unitPriceByCartItemId[item.id] ?? item.price

  const isUnavailable = (item: { id: string }) =>
    catalogPricing?.unavailableCartItemIds.includes(item.id) ?? false

  /** Potongan paket: menurut konfigurasi kalau sudah dibaca, yang tersimpan kalau belum. */
  const discountOf: BundleDiscountOf = (group) =>
    catalogPricing?.bundleDiscountByKey[group.key] ?? group.discount

  const groups = groupCartItems(selectedItems)
  const takTersedia = catalogPricing?.unavailableCartItemIds ?? []

  /**
   * Total menurut angka yang tersimpan di keranjang — harga satuan dan potongan
   * paket — sebagai pembanding `priceWasCorrected`. Dulu `getSelectedTotalPrice()`
   * milik store, yang tidak tahu soal potongan paket: setiap keranjang berisi
   * paket berpotongan akan selalu dinyatakan "disesuaikan".
   */
  const cartTotal = groupsTotal(groups, (item) => item.price)

  /**
   * Dijumlahkan dari kelompok yang sedang tampil, BUKAN diambil dari
   * `catalogPricing.total`.
   *
   * `catalogPricing` adalah potret dari detik tombol WhatsApp ditekan, dan ia
   * tidak diperbarui sesudahnya. Keranjang masih bisa berubah selagi halaman
   * ini terbuka — lewat panel keranjang, atau dari tab lain yang berbagi
   * localStorage yang sama. Kalau totalnya diambil dari potret itu, ringkasan
   * akan membeku sementara baris-barisnya (yang memakai `unitPriceOf`) ikut
   * berubah, dan pelanggan melihat dua angka yang tidak cocok satu sama lain.
   *
   * Sama alasannya dengan `/cart` dan panel `/build-pc` — lihat
   * `groupsTotal` di lib/cart/grouping.ts.
   */
  const displayedTotal = groupsTotal(groups, unitPriceOf, takTersedia, discountOf)

  /**
   * Dibandingkan terhadap total menurut harga keranjang. Kalau katalog sudah
   * dibaca dan angkanya bergeser, sebabnya disebutkan — bukan angkanya diganti
   * diam-diam.
   */
  const priceWasCorrected =
    catalogPricing !== null && displayedTotal !== cartTotal

  // Barang yang sudah tidak terbit tidak ikut dihitung — ia juga tidak ikut
  // dikirim ke CS. Untuk paket, satu komponen yang hilang menahan SELURUH
  // paketnya; aturan yang sama ditegakkan server di `prepareCheckoutWhatsApp`.
  const totalUnits = groups
    .filter((g) => !isGroupBlocked(g, takTersedia))
    .flatMap(groupLines)
    .reduce((sum, item) => sum + item.quantity, 0)
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
            {groups.map((group) =>
              group.kind === "bundle" ? (
                <BundleSummary
                  key={group.key}
                  group={group}
                  blocked={isGroupBlocked(group, takTersedia)}
                  isUnavailable={isUnavailable}
                  total={groupTotal(group, unitPriceOf, discountOf)}
                  discount={groupDiscount(group, unitPriceOf, discountOf)}
                />
              ) : (
                <ItemSummary
                  key={group.key}
                  item={group.item}
                  unitPrice={unitPriceOf(group.item)}
                  unavailable={isUnavailable(group.item)}
                />
              )
            )}
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
          {/* Tombolnya ADA DI SINI, bukan hanya di ringkasan samping: kotak ini
              yang menjelaskan caranya, dan penjelasan tanpa tombol membuat
              halaman ini jalan buntu bagi orang yang sudah siap membayar. */}
          <div className="mt-6 w-full max-w-sm">
            <WhatsAppOrderButton onPriced={setCatalogPricing} />
          </div>
        </div>
      </div>

      <div className="lg:col-span-4">
        <div className="sticky top-24 rounded-xl border bg-card p-6">
          <h2 className="text-lg font-bold">Ringkasan Pembayaran</h2>
          
          <div className="mt-6 space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Harga ({totalUnits} Barang)</span>
              <span className="font-medium">{formatRupiah(displayedTotal)}</span>
            </div>

            <div className="my-4 border-t border-dashed" />

            <div className="flex justify-between">
              <span className="font-bold">Total Belanja</span>
              <span className="text-lg font-extrabold text-sale-red">
                {formatRupiah(displayedTotal)}
              </span>
            </div>

            {/* Muncul hanya kalau katalog memang mengubah angkanya. Menyebut
                sebabnya, bukan sekadar mengganti angka diam-diam. */}
            {priceWasCorrected && (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Total disesuaikan dengan harga terbaru di katalog.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------------- *
 * Baris ringkasan
 * ------------------------------------------------------------------------- */

function ItemSummary({
  item,
  unitPrice,
  unavailable,
}: {
  item: CartItem
  unitPrice: number
  unavailable: boolean
}) {
  return (
    <div className="flex gap-4 p-6 sm:gap-6">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-white sm:h-24 sm:w-24">
        <ProductImage
          src={item.image}
          alt={item.name}
          fill
          // 80px (h-20) di bawah breakpoint sm, 96px (sm:h-24) di atasnya.
          sizes="(min-width: 640px) 96px, 80px"
          className="object-cover"
          fallback={<ShoppingBag className="h-6 w-6 opacity-30" aria-hidden="true" />}
        />
      </div>

      <div className="flex flex-1 flex-col justify-center">
        <div className="flex justify-between gap-4">
          <div>
            <h3 className="font-semibold leading-tight line-clamp-2">{item.name}</h3>
            {item.variationLabel && (
              <p className="mt-1 text-sm text-muted-foreground">{item.variationLabel}</p>
            )}
            <p className="mt-2 text-sm">
              {item.quantity} x {formatRupiah(unitPrice)}
              {unitPrice !== item.price && (
                <span className="ml-2 text-muted-foreground line-through">
                  {formatRupiah(item.price)}
                </span>
              )}
            </p>
            {unavailable && (
              <p className="mt-1 text-sm font-semibold text-sale-red">
                Sudah tidak tersedia — tidak ikut dipesan
              </p>
            )}
          </div>
          <div className="text-right font-bold text-foreground">
            {unavailable ? "—" : formatRupiah(unitPrice * item.quantity)}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Paket rakitan di ringkasan pesanan.
 *
 * Satu harga untuk keseluruhan, komponennya terdaftar tanpa harga satuan —
 * bentuk yang sama dengan yang akan diterima CS lewat WhatsApp. Halaman ini
 * adalah kesempatan terakhir pelanggan memeriksa pesanannya sebelum terkirim,
 * jadi yang tampil di sini harus sepersis mungkin dengan yang dikirim.
 */
function BundleSummary({
  group,
  blocked,
  isUnavailable,
  total,
  discount,
}: {
  group: Extract<CartGroup, { kind: "bundle" }>
  blocked: boolean
  isUnavailable: (item: { id: string }) => boolean
  /** Setelah potongan paket. */
  total: number
  /** Potongan paket untuk seluruh jumlah paket; 0 = tidak ada. */
  discount: number
}) {
  return (
    <div className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-green/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brand-green">
            <PackageOpen className="h-3.5 w-3.5" />
            Paket Rakitan
          </span>
          <h3 className="mt-1.5 font-semibold leading-tight">
            {group.name}
            {group.quantity > 1 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {group.quantity} paket
              </span>
            )}
          </h3>
        </div>

        <div className="text-right">
          {discount > 0 && !blocked && (
            <p className="text-xs text-muted-foreground line-through">
              {formatRupiah(total + discount)}
            </p>
          )}
          <p className="font-bold text-foreground">{blocked ? "—" : formatRupiah(total)}</p>
          {discount > 0 && !blocked && (
            <p className="text-[11px] font-semibold text-brand-green">
              Potongan paket {formatRupiah(discount)}
            </p>
          )}
        </div>
      </div>

      {blocked && (
        <p className="mt-2 flex items-start gap-1.5 text-sm font-semibold text-sale-red">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          Ada komponen yang tidak tersedia — paket ini tidak ikut dipesan.
        </p>
      )}

      <ul className="mt-3 space-y-1 border-l-2 pl-3">
        {group.lines.map((line) => (
          <li key={line.id} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0">
              <span className={isUnavailable(line) ? "text-sale-red line-through" : ""}>
                {line.name}
              </span>
              {line.variationLabel && (
                <span className="ml-1.5 text-xs text-muted-foreground">
                  {line.variationLabel}
                </span>
              )}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">x{line.quantity}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
