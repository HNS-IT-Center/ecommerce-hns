"use client"

import { useCartStore } from "@/store/cart"
import { formatRupiah } from "@/lib/utils"
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useIsHydrated } from "@/hooks/use-is-hydrated"
import { useState } from "react"
import { useRouter } from "next/navigation"

export function CartSheet({ children }: { children: React.ReactNode }) {
  const {
    items,
    removeItem,
    updateQuantity,
    toggleSelect,
    toggleSelectAll,
    getSelectedTotalPrice,
    clearCart,
  } = useCartStore()
  const mounted = useIsHydrated()
  const router = useRouter()

  const [isOpen, setIsOpen] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  /**
   * Item yang tombol hapusnya baru ditekan dan sedang menunggu konfirmasi.
   *
   * Tombol `−` berubah jadi ikon hapus saat kuantitas tinggal 1, jadi keduanya
   * menempati posisi yang sama persis. Tanpa langkah konfirmasi, orang yang
   * menekan `−` beruntun dari 3 ke 1 tinggal sekali tekan lagi untuk kehilangan
   * barangnya — konfirmasinya ditaruh inline di kartu, bukan sebagai dialog,
   * supaya tidak memutus alur untuk perbuatan sekecil ini.
   */
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null)

  if (!mounted) {
    return <div onClick={(e) => e.preventDefault()}>{children}</div>
  }

  const allSelected = items.length > 0 && items.every((i) => i.selected !== false)
  const selectedCount = items.filter((i) => i.selected !== false).length
  const totalUnits = items.reduce((sum, i) => sum + i.quantity, 0)

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    // Konfirmasi yang menggantung tidak boleh ikut hidup lagi saat panel dibuka
    // berikutnya — orangnya sudah lupa apa yang tadi mau dihapus.
    if (!open) setPendingRemoveId(null)
  }

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetTrigger className="appearance-none bg-transparent p-0 m-0 border-none inline-flex items-center justify-center">
        {children}
      </SheetTrigger>

      {/*
        Lebarnya naik bertahap, bukan melompat dari penuh ke `max-w-md`: tablet
        (768–1024px) dulu kebagian panel sesempit ponsel padahal layarnya lapang.

        Tingginya pakai `100dvh`, bukan `h-full`/`vh`. Di Safari iOS satuan `vh`
        dihitung dari viewport saat bilah alamat terbentang, jadi panelnya lebih
        tinggi dari layar sebenarnya dan bagian bawah — tepat tempat tombol
        Checkout — tertutup bilah itu.
      */}
      <SheetContent
        className="flex w-full flex-col gap-0 border-none p-0 drop-shadow-2xl sm:max-w-sm md:max-w-md lg:max-w-lg"
        style={{ height: "100dvh" }}
      >
        <SheetHeader className="shrink-0 border-b px-4 py-4 sm:px-6">
          <SheetTitle className="flex items-center justify-between gap-3 text-lg font-bold sm:text-xl">
            <span>Keranjang</span>
            {items.length > 0 && (
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground tabular-nums">
                {totalUnits} unit
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <ShoppingBag className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-base font-bold">Keranjang Kosong</h3>
            <p className="max-w-[26ch] text-sm text-muted-foreground">
              Belum ada produk di keranjang Anda.
            </p>
            <Button onClick={() => setIsOpen(false)} className="mt-2">
              Mulai Belanja
            </Button>
          </div>
        ) : (
          <>
            {/* Baris aksi massal. Dipisah dari daftar supaya tidak ikut
                menggulung dan selalu terjangkau. */}
            <div className="flex shrink-0 items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2.5 sm:px-6">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(checked) => toggleSelectAll(checked === true)}
                />
                Pilih Semua
              </label>

              <button
                onClick={() => setClearOpen(true)}
                className="cursor-pointer rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                Hapus Semua
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-6 sm:py-4">
              <ul className="space-y-2.5">
                {items.map((item) => {
                  const isPending = pendingRemoveId === item.id
                  const isLast = item.quantity <= 1

                  return (
                    <li
                      key={item.id}
                      className="relative overflow-hidden rounded-xl border border-border/60 bg-card transition-colors"
                    >
                      <div
                        onClick={() => !isPending && toggleSelect(item.id)}
                        className="flex cursor-pointer items-start gap-3 p-3"
                      >
                        <Checkbox
                          checked={item.selected !== false}
                          onCheckedChange={() => toggleSelect(item.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-0.5 shrink-0"
                          aria-label={`Pilih ${item.name}`}
                        />

                        {/* Gambar mengecil di layar sempit supaya nama produk
                            tetap kebagian ruang baca yang layak. */}
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted sm:h-20 sm:w-20">
                          {item.image ? (
                            <Image
                              src={item.image}
                              alt={item.name}
                              fill
                              sizes="80px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <ShoppingBag className="h-6 w-6 text-muted-foreground/30" />
                            </div>
                          )}
                        </div>

                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <h4 className="line-clamp-2 text-sm font-semibold leading-snug">
                            {item.name}
                          </h4>
                          {item.variationLabel && (
                            <p className="text-xs text-muted-foreground">
                              {item.variationLabel}
                            </p>
                          )}

                          <div className="mt-0.5 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-bold tabular-nums text-sale-red">
                              {formatRupiah(item.price * item.quantity)}
                            </span>

                            {/* Target sentuh 32px: di bawah itu tombolnya sulit
                                dikenai jempol pada layar kecil. */}
                            <div
                              className="flex items-center rounded-lg border bg-background"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() =>
                                  isLast
                                    ? setPendingRemoveId(item.id)
                                    : updateQuantity(item.id, item.quantity - 1)
                                }
                                className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-l-lg transition-colors ${
                                  isLast
                                    ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                }`}
                                aria-label={
                                  isLast ? `Hapus ${item.name}` : `Kurangi jumlah ${item.name}`
                                }
                              >
                                {isLast ? (
                                  <Trash2 className="h-3.5 w-3.5" />
                                ) : (
                                  <Minus className="h-3.5 w-3.5" />
                                )}
                              </button>

                              <span className="flex h-8 min-w-8 items-center justify-center px-1 text-xs font-semibold tabular-nums">
                                {item.quantity}
                              </span>

                              <button
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                aria-label={`Tambah jumlah ${item.name}`}
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Konfirmasi menutupi kartunya sendiri — jelas item mana
                          yang dimaksud, tanpa dialog yang menghentikan semuanya. */}
                      {isPending && (
                        <div className="absolute inset-0 z-10 flex items-center justify-between gap-3 bg-card/95 px-3 backdrop-blur-sm">
                          <p className="min-w-0 flex-1 text-xs font-medium">
                            Hapus item ini dari keranjang?
                          </p>
                          <div className="flex shrink-0 gap-2">
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
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>

            {/*
              Footer diringkas jadi satu tombol utama; "Lihat keranjang" turun
              jadi tautan teks. Susunan lama (dua tombol tinggi + total) memakan
              ~190px, dan di layar pendek seperti ponsel dalam mode lanskap
              daftar produknya nyaris tidak kebagian ruang.

              `env(safe-area-inset-bottom)` mencegah tombol tertutup home
              indicator di iPhone — pola yang sama sudah dipakai mobile dock.
            */}
            <div
              className="shrink-0 space-y-3 border-t bg-card px-4 pt-3 sm:px-6"
              style={{ paddingBottom: "max(0.875rem, env(safe-area-inset-bottom))" }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm text-muted-foreground">
                  Total{" "}
                  <span className="tabular-nums">({selectedCount})</span> item
                </span>
                <span className="text-lg font-extrabold tabular-nums text-sale-red sm:text-xl">
                  {formatRupiah(getSelectedTotalPrice())}
                </span>
              </div>

              <Button
                className="h-12 w-full gap-2 text-base font-bold"
                disabled={selectedCount === 0}
                onClick={() => {
                  setIsOpen(false)
                  router.push("/checkout")
                }}
              >
                Checkout
                <ArrowRight className="h-4 w-4" />
              </Button>

              <button
                onClick={() => {
                  setIsOpen(false)
                  router.push("/cart")
                }}
                className="w-full cursor-pointer py-1 text-center text-xs font-semibold text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                Lihat keranjang selengkapnya
              </button>
            </div>
          </>
        )}
      </SheetContent>

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
    </Sheet>
  )
}
