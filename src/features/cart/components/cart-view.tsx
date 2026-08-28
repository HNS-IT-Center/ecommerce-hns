"use client"

import { useCartStore, type CartItem } from "@/store/cart"
import {
  groupCartItems,
  groupLines,
  groupTotal,
  isGroupBlocked,
  type CartGroup,
} from "@/lib/cart/grouping"
import { formatRupiah } from "@/lib/utils"
import {
  Trash2,
  Plus,
  Minus,
  MessageCircle,
  ShoppingBag,
  Loader2,
  PackageOpen,
  TriangleAlert,
} from "lucide-react"
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
 *
 * ## Paket PC Prebuild
 *
 * Komponen paket tersimpan sebagai baris keranjang biasa supaya jalur harganya
 * tidak bercabang (lihat `CartBundleRef` di store/cart.ts). Yang membuatnya
 * tampil sebagai satu kesatuan adalah `groupCartItems()`: satu blok bernama,
 * harga per komponen tidak ditampilkan, dan jumlah/hapus bekerja di level paket.
 */
export function CartView() {
  const { items, removeItem, updateQuantity, clearCart, removeBundle, updateBundleQuantity } =
    useCartStore()
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

  const unitPriceOf = (item: CartItem) => pricing?.unitPriceByCartItemId[item.id] ?? item.price

  const isUnavailable = (item: { id: string }) =>
    pricing?.unavailableCartItemIds.includes(item.id) ?? false

  const changeOf = (item: { id: string }) =>
    pricing?.changes.find((c) => c.cartItemId === item.id)

  const groups = groupCartItems(items)
  const takTersedia = pricing?.unavailableCartItemIds ?? []

  /**
   * Yang benar-benar akan dikirim ke CS.
   *
   * Untuk barang lepas: yang produknya masih terbit. Untuk paket: paket yang
   * SELURUH komponennya masih ada — satu komponen hilang membuat seluruh
   * paketnya ditahan, karena PC tanpa motherboard bukan pesanan yang lebih
   * murah melainkan pesanan yang tidak bisa dipenuhi. Aturan yang sama
   * ditegakkan ulang di server (`prepareCheckoutWhatsApp`); yang di sini hanya
   * supaya tombolnya tidak menjanjikan sesuatu yang akan ditolak.
   */
  const grupTerkirim = groups.filter((g) => !isGroupBlocked(g, takTersedia))
  const itemTerkirim = grupTerkirim.flatMap(groupLines)
  const paketDitahan = groups.filter(
    (g) => g.kind === "bundle" && isGroupBlocked(g, takTersedia)
  )

  const totalUnits = itemTerkirim.reduce((sum, item) => sum + item.quantity, 0)
  const displayedTotal =
    pricing?.total ?? items.reduce((sum, i) => sum + i.price * i.quantity, 0)

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
            {groups.map((group) =>
              group.kind === "bundle" ? (
                <BundleBlock
                  key={group.key}
                  group={group}
                  blocked={isGroupBlocked(group, takTersedia)}
                  isUnavailable={isUnavailable}
                  // Harga per komponen tidak ditampilkan, jadi perubahannya
                  // disebut di level paket. Tanpa ini, ringkasan di samping
                  // menyatakan "perubahannya ditandai di daftar sebelah" sambil
                  // menunjuk daftar yang tidak menandai apa pun.
                  changedCount={group.lines.filter((line) => changeOf(line)).length}
                  total={groupTotal(group, unitPriceOf)}
                  onQuantity={(qty) => updateBundleQuantity(group.key, qty)}
                  onRemove={() => removeBundle(group.key)}
                />
              ) : (
                <ItemRow
                  key={group.key}
                  item={group.item}
                  unitPrice={unitPriceOf(group.item)}
                  unavailable={isUnavailable(group.item)}
                  change={changeOf(group.item)}
                  pendingRemove={pendingRemoveId === group.item.id}
                  onPendingRemove={setPendingRemoveId}
                  onRemove={() => removeItem(group.item.id)}
                  onQuantity={(qty) => updateQuantity(group.item.id, qty)}
                />
              )
            )}
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

            {!loading && paketDitahan.length > 0 && (
              <p className="text-xs leading-relaxed text-sale-red">
                {paketDitahan.length === 1 ? "Satu paket rakitan" : `${paketDitahan.length} paket rakitan`}{" "}
                ditahan karena ada komponennya yang tidak tersedia. Keluarkan paketnya dulu, atau
                hubungi kami untuk penggantinya.
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
            disabled={loading || itemTerkirim.length === 0}
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

/* ------------------------------------------------------------------------- *
 * Satu barang lepas
 * ------------------------------------------------------------------------- */

function ItemRow({
  item,
  unitPrice,
  unavailable,
  change,
  pendingRemove,
  onPendingRemove,
  onRemove,
  onQuantity,
}: {
  item: CartItem
  unitPrice: number
  unavailable: boolean
  change?: { oldUnitPrice: number; newUnitPrice: number }
  pendingRemove: boolean
  onPendingRemove: (id: string | null) => void
  onRemove: () => void
  onQuantity: (quantity: number) => void
}) {
  return (
    <div className="flex items-stretch gap-4 p-4 sm:items-start sm:gap-6 sm:p-6">
      {/* Product Image
          Di mobile kotaknya ikut tinggi kolom kanan (nama–harga–kuantitas)
          lewat items-stretch, jadi tidak ada ruang menganga di bawahnya.
          Di sm ke atas kembali kotak 128px seperti sebelumnya. */}
      <div className="relative w-24 shrink-0 self-stretch overflow-hidden rounded-lg border bg-background p-1.5 sm:h-32 sm:w-32 sm:self-auto">
        {item.image ? (
          <Image
            src={item.image}
            alt={item.name}
            fill
            // 96px (w-24) di bawah breakpoint sm, 128px (sm:w-32) di atasnya.
            sizes="(min-width: 640px) 128px, 96px"
            className="object-contain object-center"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <ShoppingBag className="h-8 w-8 text-muted-foreground/30" />
          </div>
        )}
      </div>

      {/* Product Details */}
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        {/* Mobile: nama lalu harga menumpuk ke bawah — di lebar ~200px
            keduanya berdampingan membuat nama terpotong dan harga
            membungkus. Dari sm ke atas kembali sebaris. */}
        <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h3 className="font-semibold leading-tight line-clamp-2">{item.name}</h3>
            {item.variationLabel && (
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                {item.variationLabel}
              </p>
            )}
            {item.sku && (
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">SKU: {item.sku}</p>
            )}
          </div>
          <div className="shrink-0 font-bold text-foreground sm:text-right sm:text-lg">
            {unavailable ? "—" : formatRupiah(unitPrice)}
          </div>
        </div>

        {/* Perubahan disebut di baris barangnya sendiri, bukan hanya
            terlihat sebagai total yang bergeser. */}
        {unavailable ? (
          <UnavailableNotice name={item.name} onRemove={onRemove} />
        ) : change ? (
          <PriceChangedBadge
            oldUnitPrice={change.oldUnitPrice}
            newUnitPrice={change.newUnitPrice}
          />
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-4 sm:gap-3">
          <div className="flex items-center rounded-lg border bg-background">
            <button
              onClick={() =>
                item.quantity <= 1 ? onPendingRemove(item.id) : onQuantity(item.quantity - 1)
              }
              className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-l-lg transition-colors ${
                item.quantity <= 1
                  ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
              aria-label={
                item.quantity <= 1 ? `Hapus ${item.name}` : `Kurangi jumlah ${item.name}`
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
              onClick={() => onQuantity(item.quantity + 1)}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={`Tambah jumlah ${item.name}`}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {pendingRemove && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Hapus item ini?</span>
              <button
                onClick={() => onPendingRemove(null)}
                className="cursor-pointer rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  onRemove()
                  onPendingRemove(null)
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
  )
}

/* ------------------------------------------------------------------------- *
 * Satu paket rakitan
 * ------------------------------------------------------------------------- */

/**
 * Satu blok paket: nama di atas, komponennya di bawah, satu harga untuk
 * keseluruhan.
 *
 * Harga per komponen SENGAJA tidak ditampilkan — yang dipesan pelanggan adalah
 * rakitannya, dan angka satuan di tiap baris mengundang penjumlahan sendiri
 * yang tidak akan cocok dengan yang diterima CS. Kuantitas per komponen juga
 * tidak bisa diubah: yang bisa ditambah-kurang adalah jumlah PAKETNYA, dan
 * itulah yang menjaga rakitannya tetap masuk akal.
 */
function BundleBlock({
  group,
  blocked,
  isUnavailable,
  changedCount,
  total,
  onQuantity,
  onRemove,
}: {
  group: Extract<CartGroup, { kind: "bundle" }>
  blocked: boolean
  isUnavailable: (item: { id: string }) => boolean
  /** Komponen yang harganya berubah sejak paket ini dimasukkan. */
  changedCount: number
  total: number
  onQuantity: (quantity: number) => void
  onRemove: () => void
}) {
  const [konfirmasiHapus, setKonfirmasiHapus] = useState(false)

  return (
    <div className="p-4 sm:p-6">
      <div className="rounded-xl border bg-muted/20">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 rounded-md bg-brand-green/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brand-green">
              <PackageOpen className="h-3.5 w-3.5" />
              Paket Rakitan
            </p>
            <h3 className="mt-1.5 font-bold leading-tight">{group.name}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {group.lines.length} komponen · dipesan sebagai satu kesatuan
            </p>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Harga paket
            </p>
            <p className="text-lg font-extrabold text-sale-red">{formatRupiah(total)}</p>
            {changedCount > 0 && !blocked && (
              <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">
                Harga {changedCount} komponen berubah
              </p>
            )}
          </div>
        </div>

        {blocked && (
          <p className="flex items-start gap-2 border-b bg-sale-red/5 px-4 py-3 text-xs leading-relaxed text-sale-red">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Ada komponen di paket ini yang sudah tidak tersedia. Paketnya tidak ikut dikirim ke
              CS supaya Anda tidak menerima rakitan yang kurang — keluarkan paketnya, atau hubungi
              kami untuk komponen penggantinya.
            </span>
          </p>
        )}

        <ul className="divide-y">
          {group.lines.map((line) => (
            <li key={line.id} className="flex items-center gap-3 px-4 py-3">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border bg-background">
                {line.image ? (
                  <Image src={line.image} alt="" fill sizes="48px" className="object-contain p-1" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-muted">
                    <ShoppingBag className="h-4 w-4 text-muted-foreground/40" />
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{line.name}</p>
                {line.variationLabel && (
                  <p className="truncate text-xs text-muted-foreground">{line.variationLabel}</p>
                )}
                {isUnavailable(line) && (
                  <p className="mt-0.5 text-xs font-semibold text-sale-red">Tidak tersedia</p>
                )}
              </div>

              <span className="shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
                x{line.quantity}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-lg border bg-background">
              <button
                onClick={() =>
                  group.quantity <= 1 ? setKonfirmasiHapus(true) : onQuantity(group.quantity - 1)
                }
                className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-l-lg transition-colors ${
                  group.quantity <= 1
                    ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                aria-label={
                  group.quantity <= 1
                    ? `Hapus paket ${group.name}`
                    : `Kurangi jumlah paket ${group.name}`
                }
              >
                {group.quantity <= 1 ? (
                  <Trash2 className="h-4 w-4" />
                ) : (
                  <Minus className="h-4 w-4" />
                )}
              </button>
              <span className="flex h-9 w-12 items-center justify-center text-sm font-semibold tabular-nums">
                {group.quantity}
              </span>
              <button
                onClick={() => onQuantity(group.quantity + 1)}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={`Tambah jumlah paket ${group.name}`}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <span className="text-xs text-muted-foreground">paket</span>
          </div>

          {konfirmasiHapus ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Hapus seluruh paket?</span>
              <button
                onClick={() => setKonfirmasiHapus(false)}
                className="cursor-pointer rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted"
              >
                Batal
              </button>
              <button
                onClick={onRemove}
                className="cursor-pointer rounded-md bg-destructive px-3 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90"
              >
                Hapus
              </button>
            </div>
          ) : (
            <button
              onClick={() => setKonfirmasiHapus(true)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Hapus paket
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
