"use client"

import { useCartStore } from "@/store/cart"
import { formatRupiah } from "@/lib/utils"
import { Trash2, Plus, Minus, MessageCircle, ShoppingBag, Loader2 } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { useState } from "react"
import { Button, buttonVariants } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useCatalogPricing } from "@/features/checkout/hooks/use-catalog-pricing"
import {
  PriceChangedBadge,
  UnavailableNotice,
} from "@/components/shared/price-change-notice"

/**
 * Prop `whatsappNumber` dihapus: nomor tujuan sekarang dibaca dari tabel stores
 * di server, bersama harganya. Membiarkan nomor env tetap masuk ke sini berarti
 * dua sumber nomor hidup berdampingan, dan yang satu pasti akan basi.
 */
export function CartView() {
  const { items, removeItem, updateQuantity, clearCart } = useCartStore()
  const [clearOpen, setClearOpen] = useState(false)

  /**
   * Harga dibaca dari katalog begitu halaman dibuka — bukan menunggu tombol.
   *
   * Di sinilah barang benar-benar mengendap: keranjang bertahan di localStorage
   * berhari-hari, dan harga yang tersimpan bisa sudah lama berubah. Halaman
   * checkout memeriksa saat tombol ditekan karena di sana orang sudah siap
   * mengirim; di sini orang masih menimbang, jadi angkanya harus benar sejak
   * pertama dilihat.
   *
   * Satu kueri per kunjungan, tidak diulang saat kuantitas diubah.
   */
  const { pricing, loading, error, refresh } = useCatalogPricing({ auto: true })

  const unitPriceOf = (item: { id: string; price: number }) =>
    pricing?.unitPriceByCartItemId[item.id] ?? item.price

  const isUnavailable = (item: { id: string }) =>
    pricing?.unavailableCartItemIds.includes(item.id) ?? false

  const changeOf = (item: { id: string }) =>
    pricing?.changes.find((c) => c.cartItemId === item.id)

  // Barang yang sudah tidak terbit tidak ikut dihitung — ia juga tidak ikut
  // dikirim ke CS.
  const availableItems = items.filter((i) => !isUnavailable(i))
  const totalUnits = availableItems.reduce((sum, item) => sum + item.quantity, 0)
  const displayedTotal =
    pricing?.total ??
    items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  /**
   * Item yang menunggu konfirmasi hapus. Sama seperti di panel keranjang:
   * tombol `−` berubah jadi ikon hapus saat kuantitas tinggal 1, jadi keduanya
   * menempati posisi yang sama dan satu tekanan berlebih bisa menghilangkan
   * barang tanpa sengaja.
   */
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null)

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

  /**
   * Dulu di sini `generateOrderMessage(items, getTotalPrice())` — pesan disusun
   * dari harga di localStorage, jadi siapa pun bisa menyunting keranjangnya dan
   * mengirim total karangan ke CS. Sekarang URL-nya datang dari server bersama
   * harganya. Lihat CLAUDE.md §2.7.
   *
   * Katalog dibaca ulang di sini, tidak memakai hasil saat halaman dibuka:
   * kuantitas mungkin sudah diubah sejak itu, dan yang dikirim ke CS harus
   * mencerminkan keranjang pada detik tombol ditekan.
   */
  const handleCheckoutWA = async () => {
    const hasil = await refresh()
    if (hasil) window.open(hasil.waUrl, "_blank", "noopener,noreferrer")
  }

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      {/* Cart Items */}
      <div className="lg:col-span-8">
        <div className="rounded-xl border bg-card">
          <div className="flex items-center justify-between gap-3 border-b p-6">
            <h2 className="text-xl font-bold">Keranjang Belanja</h2>
            <button
              onClick={() => setClearOpen(true)}
              className="cursor-pointer rounded-md px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              Hapus Semua
            </button>
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
                      // 96px (h-24) di bawah breakpoint sm, 128px (sm:h-32) di atasnya.
                      sizes="(min-width: 640px) 128px, 96px"
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
                      {isUnavailable(item) ? "—" : formatRupiah(unitPriceOf(item))}
                    </div>
                  </div>

                  {/* Perubahan disebut di baris barangnya sendiri, bukan hanya
                      terlihat sebagai total yang bergeser. */}
                  {(() => {
                    const perubahan = changeOf(item)
                    if (isUnavailable(item)) {
                      return (
                        <UnavailableNotice
                          name={item.name}
                          onRemove={() => removeItem(item.id)}
                        />
                      )
                    }
                    if (perubahan) {
                      return (
                        <PriceChangedBadge
                          oldUnitPrice={perubahan.oldUnitPrice}
                          newUnitPrice={perubahan.newUnitPrice}
                        />
                      )
                    }
                    return null
                  })()}

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <div className="flex items-center rounded-lg border bg-background">
                      <button
                        onClick={() =>
                          item.quantity <= 1
                            ? setPendingRemoveId(item.id)
                            : updateQuantity(item.id, item.quantity - 1)
                        }
                        className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-l-lg transition-colors ${
                          item.quantity <= 1
                            ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                        aria-label={
                          item.quantity <= 1
                            ? `Hapus ${item.name}`
                            : `Kurangi jumlah ${item.name}`
                        }
                      >
                        {item.quantity <= 1 ? (
                          <Trash2 className="h-4 w-4" />
                        ) : (
                          <Minus className="h-4 w-4" />
                        )}
                      </button>
                      <span className="flex h-9 w-12 items-center justify-center text-sm font-semibold tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label={`Tambah jumlah ${item.name}`}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    {pendingRemoveId === item.id && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Hapus item ini?</span>
                        <button
                          onClick={() => setPendingRemoveId(null)}
                          className="cursor-pointer rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted"
                        >
                          Batal
                        </button>
                        <button
                          onClick={() => {
                            removeItem(item.id)
                            setPendingRemoveId(null)
                          }}
                          className="cursor-pointer rounded-md bg-destructive px-3 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90"
                        >
                          Hapus
                        </button>
                      </div>
                    )}
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
              <span className="font-medium">{formatRupiah(displayedTotal)}</span>
            </div>

            <div className="my-4 border-t border-dashed" />

            <div className="flex justify-between">
              <span className="font-bold">Total Belanja</span>
              <span className="text-lg font-extrabold text-sale-red">
                {formatRupiah(displayedTotal)}
              </span>
            </div>

            {loading && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                Memeriksa harga terbaru…
              </p>
            )}

            {/* Menyebut sebabnya, bukan sekadar menampilkan angka lain. */}
            {!loading && pricing && pricing.changes.length > 0 && (
              <p className="text-xs leading-relaxed text-muted-foreground">
                {pricing.changes.length === 1 ? "Satu barang" : `${pricing.changes.length} barang`}{" "}
                berubah harganya sejak terakhir Anda lihat. Perubahannya ditandai
                di daftar sebelah.
              </p>
            )}

            {!loading && pricing && pricing.unavailableCartItemIds.length > 0 && (
              <p className="text-xs leading-relaxed text-sale-red">
                {pricing.unavailableCartItemIds.length} barang sudah tidak
                tersedia dan tidak ikut dihitung.
              </p>
            )}

            {error && (
              <p className="text-xs leading-relaxed text-sale-red" role="alert">
                {error}
              </p>
            )}
          </div>

          <Button
            variant="default"
            size="lg"
            onClick={handleCheckoutWA}
            disabled={loading || availableItems.length === 0}
            className="mt-6 h-14 w-full bg-[#25D366] hover:bg-[#128C7E] text-white shadow-lg shadow-whatsapp/20"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <MessageCircle className="h-5 w-5" />
            )}
            {loading ? "Memeriksa harga…" : "Checkout via WhatsApp"}
          </Button>
          
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Anda akan diarahkan ke WhatsApp untuk menyelesaikan pesanan.
          </p>
        </div>
      </div>

      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="Hapus semua item?"
        description={`${items.length} produk akan dikeluarkan dari keranjang. Tindakan ini tidak bisa dibatalkan.`}
        confirmLabel="Hapus Semua"
        destructive
        onConfirm={() => {
          clearCart()
          setPendingRemoveId(null)
        }}
      />
    </div>
  )
}
