"use client"

import { useCartStore, type CartItem } from "@/store/cart"
import {
  groupCartItems,
  groupTotal,
  groupsTotal,
  isGroupBlocked,
  type CartGroup,
} from "@/lib/cart/grouping"
import { useCatalogPricing } from "@/features/checkout/hooks/use-catalog-pricing"
import { UnavailableNotice } from "@/components/shared/price-change-notice"
import { formatRupiah } from "@/lib/utils"
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight, X, PackageOpen } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useIsHydrated } from "@/hooks/use-is-hydrated"
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"

export function CartSheet({ children }: { children: React.ReactNode }) {
  const {
    items,
    removeItem,
    updateQuantity,
    toggleSelect,
    toggleSelectAll,
    clearCart,
    removeBundle,
    updateBundleQuantity,
    toggleSelectBundle,
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

  /**
   * Harga di panel ini dulu SATU-SATUNYA total di situs yang tidak pernah
   * dicocokkan ke katalog: ia menjumlahkan `item.price` dari localStorage,
   * yang bisa berumur seminggu dan bisa disunting lewat devtools. Angkanya
   * memang selalu bergerak saat kuantitas diubah — jadi ia tidak membeku
   * seperti bug di `/cart` — tapi "bergerak" tidak sama dengan "benar".
   *
   * Dibaca saat panel DIBUKA, bukan saat halaman dimuat. Panel ini terpasang di
   * header setiap halaman; membacanya otomatis saat mount berarti satu kueri
   * untuk SETIAP kunjungan halaman apa pun di situs, dan kuota koneksi
   * Hostinger tidak akan bertahan lama (alasan yang sama dijelaskan panjang di
   * useBuilderCatalogPricing).
   */
  const { pricing, loading: pricingLoading, refresh: refreshPricing } =
    useCatalogPricing()

  /**
   * Tanda isi keranjang saat katalog terakhir berhasil dibaca. Membuka panel
   * berulang kali tanpa mengubah apa pun tidak perlu bertanya ulang ke
   * database — isinya belum berubah, jawabannya pasti sama.
   */
  const tandaTerakhirDibaca = useRef<string | null>(null)

  if (!mounted) {
    return <div onClick={(e) => e.preventDefault()}>{children}</div>
  }

  const allSelected = items.length > 0 && items.every((i) => i.selected !== false)
  const selectedCount = items.filter((i) => i.selected !== false).length
  const totalUnits = items.reduce((sum, i) => sum + i.quantity, 0)

  // Komponen paket PC Prebuild dikelompokkan jadi satu kartu — di panel sesempit
  // ini, tujuh baris komponen berserakan membuat isi keranjang mustahil dibaca
  // sekilas, dan tidak ada yang menandai bahwa ketujuhnya satu rakitan.
  const groups = groupCartItems(items)

  /** Harga satuan yang ditampilkan: katalog kalau sudah dibaca, keranjang kalau belum. */
  const unitPriceOf = (item: CartItem) =>
    pricing?.unitPriceByCartItemId[item.id] ?? item.price

  const isUnavailable = (item: { id: string }) =>
    pricing?.unavailableCartItemIds.includes(item.id) ?? false

  const takTersedia = pricing?.unavailableCartItemIds ?? []

  /**
   * Total mengikuti aturan yang sama dengan `/cart` dan `/checkout`:
   * dijumlahkan dari kelompok yang BENAR-BENAR akan dibawa ke checkout, memakai
   * `unitPriceOf` yang sama dengan yang tampil di tiap kartu. Lihat
   * `groupsTotal` di lib/cart/grouping.ts.
   */
  const selectedGroups = groupCartItems(items.filter((i) => i.selected !== false))
  const displayedTotal = groupsTotal(selectedGroups, unitPriceOf, takTersedia)

  const paketDitahan = selectedGroups.filter(
    (g) => g.kind === "bundle" && isGroupBlocked(g, takTersedia)
  )
  const barangTakTersedia = selectedGroups.filter(
    (g) => g.kind === "item" && isUnavailable(g.item)
  )

  /**
   * Barang yang katalognya belum pernah ditanya soal dia — panel belum pernah
   * dibuka sejak barang itu masuk, atau pembacaannya gagal. Angkanya masih dari
   * localStorage, jadi disebutkan apa adanya.
   */
  const belumDiverifikasi =
    pricing === null
      ? items.filter((i) => i.selected !== false)
      : items.filter(
          (i) =>
            i.selected !== false &&
            pricing.unitPriceByCartItemId[i.id] === undefined &&
            !pricing.unavailableCartItemIds.includes(i.id)
        )

  /**
   * Keterangan barang/paket yang tidak ikut dihitung.
   *
   * Dipisah karena sebabnya beda: barang lepas memang sudah tidak terbit,
   * sedangkan paket DITAHAN — komponennya yang hilang, bukan paketnya. Menyebut
   * paket sebagai "tidak tersedia" membuat pelanggan mengira rakitannya sudah
   * tidak dijual sama sekali.
   */
  const catatanTakTersedia = (() => {
    const bagian: string[] = []
    if (barangTakTersedia.length > 0) {
      bagian.push(`${barangTakTersedia.length} barang sudah tidak tersedia`)
    }
    if (paketDitahan.length > 0) {
      bagian.push(
        `${paketDitahan.length} paket ditahan karena ada komponennya yang hilang`
      )
    }
    if (bagian.length === 0) return null
    return `${bagian.join(" dan ")} — tidak ikut dihitung.`
  })()

  /** Isi keranjang diringkas jadi satu string, untuk dibandingkan antar bukaan. */
  const tandaKeranjang = items.map((i) => `${i.id}:${i.quantity}`).join(",")

  const bacaKatalogKalauPerlu = async () => {
    if (items.length === 0) return
    if (tandaKeranjang === tandaTerakhirDibaca.current) return
    const hasil = await refreshPricing()
    // Tanda hanya dicatat kalau pembacaannya BERHASIL, supaya kegagalan jaringan
    // masih bisa dicoba lagi dengan menutup dan membuka panel.
    if (hasil) tandaTerakhirDibaca.current = tandaKeranjang
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (open) void bacaKatalogKalauPerlu()
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

        Di ponsel panel menutupi layar sepenuhnya — tanpa bayangan dan tanpa
        sudut membulat. Keduanya menyisakan kesan "kartu yang mengambang di atas
        halaman" padahal tidak ada apa pun di baliknya yang terlihat; di layar
        sesempit itu ia memang layar tersendiri, bukan panel samping. Bayangan
        dan sudutnya kembali dari `sm` ke atas, tempat halaman di belakangnya
        benar-benar tampak.

        Lebarnya WAJIB ditulis sebagai `data-[side=right]:w-full`, bukan
        `w-full` biasa. `SheetContent` membawa bawaan `data-[side=right]:w-3/4`,
        dan selektor beratribut menang atas class polos berapa pun urutannya —
        `w-full` yang ditulis di sini dulu kalah diam-diam, jadi panelnya
        berhenti di 75% lebar layar. Varian `data-[side=right]:` menyamakan
        specificity-nya sehingga urutan Tailwind kembali menentukan. Alasan yang
        sama berlaku untuk `max-w-none` terhadap bawaan `sm:max-w-sm`.

        Tingginya pakai `100dvh`, bukan `h-full`/`vh`. Di Safari iOS satuan `vh`
        dihitung dari viewport saat bilah alamat terbentang, jadi panelnya lebih
        tinggi dari layar sebenarnya dan bagian bawah — tepat tempat tombol
        Checkout — tertutup bilah itu.
      */}
      {/*
        Tombol tutup bawaan dimatikan: ia diposisikan `absolute top-3 right-3`,
        sudut yang sama persis dengan badge "N unit" di ujung header, sehingga
        keduanya bertumpuk. Di sini X dijadikan bagian dari baris header supaya
        keduanya berbagi ruang lewat flex, bukan saling menimpa.
      */}
      <SheetContent
        showCloseButton={false}
        className="flex flex-col gap-0 rounded-none border-none p-0 shadow-none data-[side=right]:w-full data-[side=right]:max-w-none sm:drop-shadow-2xl sm:data-[side=right]:max-w-sm md:data-[side=right]:max-w-md lg:data-[side=right]:max-w-lg"
        style={{ height: "100dvh" }}
      >
        <SheetHeader className="shrink-0 border-b px-4 py-3 sm:px-6 sm:py-4">
          <SheetTitle className="flex items-center gap-3 text-lg font-bold sm:text-xl">
            <span className="min-w-0 flex-1 truncate">Keranjang</span>
            {items.length > 0 && (
              <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground tabular-nums">
                {totalUnits} unit
              </span>
            )}
            {/* Bulatan merah pekat: tombol ini satu-satunya jalan keluar yang
                terlihat di mode layar penuh, jadi ia sengaja tidak berbaur
                dengan header. Warnanya token `destructive` — sama dengan aksi
                hapus di panel ini — bukan merah lepas, supaya ikut menyesuaikan
                di mode gelap.

                Basisnya `variant="default"`, bukan `ghost`: hover milik ghost
                (`hover:bg-muted` + `dark:hover:bg-muted/50`) menyisakan aturan
                gelap yang tidak punya lawan di sini, jadi bulatannya berubah
                abu-abu saat disentuh di mode gelap. Varian default hanya
                membawa satu `hover:bg-*` yang tertimpa bersih oleh tailwind-merge. */}
            <SheetClose
              render={
                <Button
                  variant="default"
                  size="icon-sm"
                  className="-mr-1 shrink-0 rounded-full bg-destructive text-white shadow-none hover:bg-destructive/85 focus-visible:ring-destructive/40"
                  aria-label="Tutup keranjang"
                />
              }
            >
              <X className="h-4 w-4" />
            </SheetClose>
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
                {groups.map((group) =>
                  group.kind === "bundle" ? (
                    <BundleCard
                      key={group.key}
                      group={group}
                      unitPriceOf={unitPriceOf}
                      blocked={isGroupBlocked(group, takTersedia)}
                      // Kunci konfirmasi diberi awalan supaya tidak pernah
                      // bertabrakan dengan id baris keranjang biasa.
                      pending={pendingRemoveId === `bundle:${group.key}`}
                      onPending={setPendingRemoveId}
                      onToggle={() => toggleSelectBundle(group.key)}
                      onQuantity={(quantity) => updateBundleQuantity(group.key, quantity)}
                      onRemove={() => removeBundle(group.key)}
                    />
                  ) : (
                    <ItemCard
                      key={group.key}
                      item={group.item}
                      unitPrice={unitPriceOf(group.item)}
                      unavailable={isUnavailable(group.item)}
                      pending={pendingRemoveId === group.item.id}
                      onPending={setPendingRemoveId}
                      onToggle={() => toggleSelect(group.item.id)}
                      onQuantity={(quantity) => updateQuantity(group.item.id, quantity)}
                      onRemove={() => removeItem(group.item.id)}
                    />
                  )
                )}
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
                  {formatRupiah(displayedTotal)}
                </span>
              </div>

              {/* Satu baris keterangan saja — panel ini sempit, dan yang paling
                  perlu diketahui adalah apakah angka di atas sudah dipastikan
                  ke katalog atau belum. Rinciannya ada di /cart. */}
              {pricingLoading ? (
                <p className="text-[11px] leading-tight text-muted-foreground">
                  Memeriksa harga terbaru…
                </p>
              ) : catatanTakTersedia ? (
                <p className="text-[11px] leading-tight text-sale-red">
                  {catatanTakTersedia}
                </p>
              ) : belumDiverifikasi.length > 0 ? (
                <p className="text-[11px] leading-tight text-muted-foreground">
                  Harga belum diverifikasi ke katalog.
                </p>
              ) : pricing && pricing.changes.length > 0 ? (
                <p className="text-[11px] leading-tight text-muted-foreground">
                  {pricing.changes.length === 1
                    ? "Satu barang"
                    : `${pricing.changes.length} barang`}{" "}
                  disesuaikan dengan harga terbaru di katalog.
                </p>
              ) : null}

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

/* ------------------------------------------------------------------------- *
 * Kartu barang & kartu paket
 * ------------------------------------------------------------------------- */

/**
 * Konfirmasi hapus yang menutupi kartunya sendiri.
 *
 * Dipakai kartu barang dan kartu paket. Sengaja bukan dialog: jelas mana yang
 * dimaksud tanpa menghentikan seluruh panel untuk perbuatan sekecil ini.
 */
function OverlayKonfirmasi({
  teks,
  onCancel,
  onConfirm,
}: {
  teks: string
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-between gap-3 bg-card/95 px-3 backdrop-blur-sm">
      <p className="min-w-0 flex-1 text-xs font-medium">{teks}</p>
      <div className="flex shrink-0 gap-2">
        <button
          onClick={onCancel}
          className="cursor-pointer rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted"
        >
          Batal
        </button>
        <button
          onClick={onConfirm}
          className="cursor-pointer rounded-md bg-destructive px-3 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90"
        >
          Hapus
        </button>
      </div>
    </div>
  )
}

/** Stepper jumlah. Tombol `−` berubah jadi ikon hapus saat tinggal satu. */
function Stepper({
  quantity,
  label,
  onQuantity,
  onLast,
}: {
  quantity: number
  label: string
  onQuantity: (quantity: number) => void
  onLast: () => void
}) {
  const isLast = quantity <= 1

  return (
    <div
      className="flex items-center rounded-lg border bg-background"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => (isLast ? onLast() : onQuantity(quantity - 1))}
        className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-l-lg transition-colors ${
          isLast
            ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
        aria-label={isLast ? `Hapus ${label}` : `Kurangi jumlah ${label}`}
      >
        {isLast ? <Trash2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
      </button>

      <span className="flex h-8 min-w-8 items-center justify-center px-1 text-xs font-semibold tabular-nums">
        {quantity}
      </span>

      <button
        onClick={() => onQuantity(quantity + 1)}
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label={`Tambah jumlah ${label}`}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function ItemCard({
  item,
  unitPrice,
  unavailable,
  pending,
  onPending,
  onToggle,
  onQuantity,
  onRemove,
}: {
  item: CartItem
  /** Harga satuan menurut katalog; harga keranjang selagi katalog belum dibaca. */
  unitPrice: number
  unavailable: boolean
  pending: boolean
  onPending: (id: string | null) => void
  onToggle: () => void
  onQuantity: (quantity: number) => void
  onRemove: () => void
}) {
  return (
    <li className="relative overflow-hidden rounded-xl border border-border/60 bg-card transition-colors">
      <div
        onClick={() => !pending && onToggle()}
        className="flex cursor-pointer items-start gap-3 p-3"
      >
        <Checkbox
          checked={item.selected !== false}
          onCheckedChange={onToggle}
          onClick={(e) => e.stopPropagation()}
          className="mt-0.5 shrink-0"
          aria-label={`Pilih ${item.name}`}
        />

        {/* Gambar mengecil di layar sempit supaya nama produk tetap kebagian
            ruang baca yang layak. */}
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted sm:h-20 sm:w-20">
          {item.image ? (
            <Image src={item.image} alt={item.name} fill sizes="80px" className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ShoppingBag className="h-6 w-6 text-muted-foreground/30" />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h4 className="line-clamp-2 text-sm font-semibold leading-snug">{item.name}</h4>
          {item.variationLabel && (
            <p className="text-xs text-muted-foreground">{item.variationLabel}</p>
          )}

          {unavailable && <UnavailableNotice name={item.name} density="compact" />}

          <div className="mt-0.5 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-bold tabular-nums text-sale-red">
              {/* Barang yang sudah tidak terbit tidak punya harga untuk
                  ditampilkan — ia juga tidak ikut dihitung di total bawah. */}
              {unavailable ? "—" : formatRupiah(unitPrice * item.quantity)}
            </span>

            {/* Target sentuh 32px: di bawah itu tombolnya sulit dikenai jempol
                pada layar kecil. */}
            <Stepper
              quantity={item.quantity}
              label={item.name}
              onQuantity={onQuantity}
              onLast={() => onPending(item.id)}
            />
          </div>
        </div>
      </div>

      {pending && (
        <OverlayKonfirmasi
          teks="Hapus item ini dari keranjang?"
          onCancel={() => onPending(null)}
          onConfirm={() => {
            onRemove()
            onPending(null)
          }}
        />
      )}
    </li>
  )
}

/**
 * Satu paket rakitan di panel keranjang.
 *
 * Komponennya disebut sebagai daftar nama ringkas tanpa foto dan tanpa harga
 * satuan: di panel selebar ini, tujuh kartu bergambar mengubur barang lain di
 * keranjang, sementara yang perlu diketahui pelanggan cuma "paket ini isinya
 * apa saja". Rinciannya tinggal satu ketukan di `/cart`.
 *
 * Centang, jumlah, dan hapus semuanya bekerja untuk SELURUH paket — tidak ada
 * jalan untuk mengeluarkan satu komponen dan merusak rakitannya tanpa sadar.
 */
function BundleCard({
  group,
  unitPriceOf,
  blocked,
  pending,
  onPending,
  onToggle,
  onQuantity,
  onRemove,
}: {
  group: Extract<CartGroup, { kind: "bundle" }>
  /** Harga satuan katalog per komponen paket. */
  unitPriceOf: (item: CartItem) => number
  /** Ada komponennya yang sudah tidak terbit — paketnya ditahan seluruhnya. */
  blocked: boolean
  pending: boolean
  onPending: (id: string | null) => void
  onToggle: () => void
  onQuantity: (quantity: number) => void
  onRemove: () => void
}) {
  const terpilih = group.lines.every((l) => l.selected !== false)

  return (
    <li className="relative overflow-hidden rounded-xl border border-brand-green/30 bg-card transition-colors">
      <div
        onClick={() => !pending && onToggle()}
        className="flex cursor-pointer items-start gap-3 p-3"
      >
        <Checkbox
          checked={terpilih}
          onCheckedChange={onToggle}
          onClick={(e) => e.stopPropagation()}
          className="mt-0.5 shrink-0"
          aria-label={`Pilih paket ${group.name}`}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="inline-flex w-fit items-center gap-1 rounded-md bg-brand-green/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-green">
            <PackageOpen className="h-3 w-3" />
            Paket Rakitan
          </span>

          <h4 className="line-clamp-2 text-sm font-semibold leading-snug">{group.name}</h4>

          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {group.lines.map((l) => l.name).join(" · ")}
          </p>

          {/* Satu komponen hilang menahan SELURUH paket — PC tanpa motherboard
              bukan pesanan yang lebih murah, ia pesanan yang tidak bisa
              dipenuhi. Aturan yang sama ada di /cart dan ditegakkan server. */}
          {blocked && (
            <p className="inline-flex w-fit items-center rounded bg-sale-red/10 px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-sale-red">
              Ada komponen yang tidak tersedia
            </p>
          )}

          <div className="mt-0.5 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-bold tabular-nums text-sale-red">
              {formatRupiah(groupTotal(group, unitPriceOf))}
            </span>

            <Stepper
              quantity={group.quantity}
              label={`paket ${group.name}`}
              onQuantity={onQuantity}
              onLast={() => onPending(`bundle:${group.key}`)}
            />
          </div>
        </div>
      </div>

      {pending && (
        <OverlayKonfirmasi
          teks="Hapus seluruh paket ini dari keranjang?"
          onCancel={() => onPending(null)}
          onConfirm={() => {
            onRemove()
            onPending(null)
          }}
        />
      )}
    </li>
  )
}
