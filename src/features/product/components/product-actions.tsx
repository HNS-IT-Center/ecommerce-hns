"use client"

import { ShoppingCart } from "lucide-react"
import WhatsappIcon from "@/components/icons/whatsapp-icon"
import { Button, buttonVariants } from "@/components/ui/button"
import { formatRupiah } from "@/lib/utils"

type ProductActionsProps = {
  onAddToCart: (e: React.MouseEvent) => void
  canAddToCart: boolean
  showCartButton: boolean
  addToCartHint?: string
  waUrl: string
  waLabel: string
  price: number
  /**
   * Harga sebelum potongan. Hanya diisi saat benar-benar ada diskon, supaya
   * bar mengambang bisa menampilkan coretan di sebelah harga akhir.
   */
  originalPrice?: number | null
  /** Ringkasan varian terpilih, mis. "MERAH / XL". Kosong bila belum dipilih. */
  selectedVariantLabel?: string
  /**
   * Varian belum lengkap dipilih. Di mobile tombol keranjang tidak dimatikan
   * karena itu — ia berubah jadi jalan pintas menuju pemilih varian.
   */
  needsVariantChoice?: boolean
  onRequestVariantChoice?: () => void
}

export function ProductActions({
  onAddToCart,
  canAddToCart,
  showCartButton,
  addToCartHint,
  waUrl,
  waLabel,
  price,
  originalPrice = null,
  selectedVariantLabel = "",
  needsVariantChoice = false,
  onRequestVariantChoice,
}: ProductActionsProps) {
  /**
   * Tombol keranjang tidak pernah jadi tombol mati di mobile.
   *
   * Tombol mati tidak menjelaskan apa pun: pembeli menekannya, tidak terjadi
   * apa-apa, dan hint kecil di atas bar mudah terlewat. Selama variannya belum
   * lengkap, tombol ini mengantar pembeli ke pemilih varian dan menyorotnya —
   * jadi tekanannya selalu membuahkan sesuatu.
   */
  const handleCartClick = (e: React.MouseEvent) => {
    if (needsVariantChoice) {
      onRequestVariantChoice?.()
      return
    }
    onAddToCart(e)
  }

  /**
   * Desktop: dua tombol berdampingan di dalam panel informasi.
   *
   * `flex-1 min-w-0` — BUKAN `w-full`. Di dalam flex container, `w-full`
   * membuat tiap tombol meminta selebar induknya dan menolak menyusut, jadi
   * label sepanjang "Tambah ke Keranjang" + "Beli via WhatsApp" mendorong
   * keduanya melewati tepi kolom. `flex-1` membagi ruang yang ada, dan
   * `min-w-0` mengizinkan penyusutan di bawah lebar konten.
   */
  const cartButton = showCartButton && (
    <Button
      variant="default"
      size="lg"
      onClick={handleCartClick}
      disabled={!canAddToCart && !needsVariantChoice}
      className="flex-1 min-w-0"
    >
      <ShoppingCart className="h-5 w-5 shrink-0" />
      <span className="truncate">Tambah ke Keranjang</span>
    </Button>
  )

  const waButton = (
    <a
      href={waUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonVariants({
        variant: "default",
        size: "lg",
        className: "flex-1 min-w-0 bg-[#25D366] hover:bg-[#128C7E] text-white",
      })}
    >
      <WhatsappIcon size={20} color="white" />
      <span className="truncate">{waLabel}</span>
    </a>
  )

  /**
   * Mobile: tombol ikon saja — label teksnya dibuang supaya ruang bar tersisa
   * untuk harga, yang jauh lebih penting dibaca sekilas. Ukuran 40px tetap di
   * atas ambang sasaran sentuh yang nyaman, dan `aria-label` menjaga keduanya
   * tetap terbaca pembaca layar.
   */
  const cartButtonMobile = showCartButton && (
    <button
      type="button"
      onClick={handleCartClick}
      disabled={!canAddToCart && !needsVariantChoice}
      aria-label="Tambah ke keranjang"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors disabled:opacity-50"
    >
      <ShoppingCart className="h-[18px] w-[18px]" />
    </button>
  )

  const waButtonMobile = (
    <a
      href={waUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={waLabel}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#25D366] text-white transition-colors hover:bg-[#128C7E]"
    >
      <WhatsappIcon size={18} color="white" />
    </a>
  )

  return (
    <>
      {/* Desktop: mengalir normal di dalam panel informasi. */}
      <div className="hidden flex-col gap-2 md:flex">
        {addToCartHint && <p className="text-xs text-muted-foreground">{addToCartHint}</p>}
        <div className="flex items-center gap-3">
          {cartButton}
          {waButton}
        </div>
      </div>

      {/*
        Mobile: bar mengambang di dasar layar.

        Dock navigasi disembunyikan khusus di halaman produk (lihat
        mobile-dock.tsx), jadi bar ini duduk langsung di dasar layar tanpa
        bertumpuk dengan apa pun. `pb-safe` menjaganya tetap di atas home
        indicator iPhone.

        `z-[45]` dipilih dengan sengaja: badge/flag di ProductCard memakai
        `z-[40]` (lihat product-card.tsx), dan kartu produk terkait ikut
        tergulung melewati bar ini — tanpa lapisan yang lebih tinggi, flag
        "Deal"/"Hot" akan menembus di atasnya. Tetap di bawah header (`z-50`)
        dan lightbox galeri (`z-[100]`).
      */}
      <div className="fixed inset-x-0 bottom-0 z-[45] px-3 pb-2 pb-safe md:hidden print:hidden">
        <div className="rounded-xl border border-border bg-background/95 px-3 py-2 shadow-[0_2px_16px_rgba(0,0,0,0.15)] backdrop-blur supports-[backdrop-filter]:bg-background/80">
          {/* Hint "pilih varian dulu" tidak diulang di sini: di mobile tombol
              keranjangnya sudah mengantar ke pemilih varian, jadi kalimatnya
              hanya memakan ruang layar. Hint lain (mis. "varian ini habis")
              tetap tampil karena tidak ada aksi yang menggantikannya. */}
          {addToCartHint && !needsVariantChoice && (
            <p className="mb-1.5 text-center text-[11px] text-muted-foreground">{addToCartHint}</p>
          )}
          <div className="flex items-center gap-2">
            {/* Blok harga memakai sisa ruang (`min-w-0` + `truncate`) sementara
                kedua tombol ikon lebarnya tetap — jadi nama varian sepanjang
                apa pun terpotong rapi, bukan mendorong tombol keluar bar. */}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <span className="text-base font-extrabold leading-tight text-sale-red">
                  {formatRupiah(price)}
                </span>
                {originalPrice !== null && originalPrice > price && (
                  <span className="text-[11px] leading-tight text-muted-foreground line-through">
                    {formatRupiah(originalPrice)}
                  </span>
                )}
              </div>
              {selectedVariantLabel && (
                <p className="truncate text-[11px] leading-tight text-muted-foreground">
                  {selectedVariantLabel}
                </p>
              )}
            </div>
            {cartButtonMobile}
            {waButtonMobile}
          </div>
        </div>
      </div>
    </>
  )
}
