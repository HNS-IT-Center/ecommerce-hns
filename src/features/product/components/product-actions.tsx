"use client"

import { ShoppingCart } from "lucide-react"
import WhatsappIcon from "@/components/icons/whatsapp-icon"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn, formatRupiah } from "@/lib/utils"

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
   * Mobile: tombol keranjang membentang selebar sisa bar, berlabel teks.
   *
   * Sebelumnya ia kotak ikon 40px yang duduk sebaris dengan harga — dan di sana
   * seluruh bar praktis tidak terlihat: latarnya sewarna halaman, dan satu-satunya
   * penanda aksi cuma dua kotak kecil di ujung kanan. Aksi utama halaman produk
   * pantas jadi sasaran sentuh terbesar di layar, bukan yang terkecil.
   *
   * 48px tinggi — di atas ambang 44px yang nyaman disentuh ibu jari.
   */
  const cartButtonMobile = showCartButton && (
    <button
      type="button"
      onClick={handleCartClick}
      disabled={!canAddToCart && !needsVariantChoice}
      className="flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-colors disabled:opacity-50"
    >
      <ShoppingCart className="h-[18px] w-[18px] shrink-0" />
      <span className="truncate">Tambah ke Keranjang</span>
    </button>
  )

  /**
   * WhatsApp tetap tombol ikon: ia jalur pendamping, bukan aksi utama. Dua
   * tombol berlabel bersebelahan akan saling bersaing dan memaksa keduanya
   * menyusut sampai labelnya terpotong.
   *
   * Saat produknya tidak bisa masuk keranjang sama sekali (mis. varian tanpa
   * data), tidak ada tombol lain di baris ini — jadi ia yang melebar dan
   * memakai labelnya, supaya barisnya tidak berisi satu kotak kecil sendirian.
   */
  const waButtonMobile = (
    <a
      href={waUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={showCartButton ? waLabel : undefined}
      className={cn(
        "flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#25D366] text-white transition-colors hover:bg-[#128C7E]",
        showCartButton ? "w-12" : "min-w-0 flex-1 px-4 text-sm font-bold",
      )}
    >
      <WhatsappIcon size={20} color="white" />
      {!showCartButton && <span className="truncate">{waLabel}</span>}
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
      <div className="fixed inset-x-0 bottom-0 z-[45] pb-safe md:hidden print:hidden">
        {/* Barnya menempel penuh ke tepi layar: tanpa margin luar, tanpa sudut
            membulat, dan pemisahnya hanya garis atas — satu-satunya sisi yang
            masih berbatasan dengan konten saat lebarnya penuh. `pb-safe` di
            pembungkus menjaga isinya tetap di atas home indicator iPhone
            sementara latar barnya sendiri tetap turun sampai dasar layar. */}
        {/* Latarnya `--background-100`, BUKAN `bg-background` — dan bukan pula
            `bg-card`.

            Ini inti perbaikannya: sebelumnya bar memakai warna yang sama persis
            dengan halaman, jadi satu-satunya yang memisahkannya cuma garis 1px
            — dan barnya terbaca sebagai bagian bawah konten, bukan lapisan aksi
            yang mengambang di atasnya.

            `bg-card` terlihat seperti jawabannya, tapi di tema project ini
            `--card` dan `--background` SAMA-SAMA menunjuk `--background-50`
            (lihat globals.css), jadi memakainya tidak akan mengubah apa pun.
            `--background-100` adalah tingkat berikutnya yang benar-benar
            berbeda, dan ia punya nilainya sendiri di tema terang maupun gelap.

            `backdrop-blur` dilepas: ia hanya berguna kalau latarnya tembus
            pandang, sementara di sini justru kepekatan yang dibutuhkan. */}
        <div className="border-t border-border bg-[var(--background-50)] px-3 pb-2.5 pt-4 shadow-[0_-4px_20px_rgba(0,0,0,0.14)]">
          {/* Hint "pilih varian dulu" tidak diulang di sini: di mobile tombol
              keranjangnya sudah mengantar ke pemilih varian, jadi kalimatnya
              hanya memakan ruang layar. Hint lain (mis. "varian ini habis")
              tetap tampil karena tidak ada aksi yang menggantikannya. */}
          {addToCartHint && !needsVariantChoice && (
            <p className="mb-1 text-center text-[11px] text-muted-foreground">{addToCartHint}</p>
          )}

          {/* Baris harga berdiri sendiri di ATAS tombol, tidak lagi berebut
              lebar dengan mereka. Harga dan nama varian sama-sama dapat ruang
              penuh — sebelumnya keduanya terjepit di sisa ruang setelah dua
              tombol ikon mengambil bagiannya. */}
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <div className="flex min-w-0 items-baseline gap-1.5">
              <span className="text-lg font-extrabold leading-tight text-sale-red">
                {formatRupiah(price)}
              </span>
              {originalPrice !== null && originalPrice > price && (
                <span className="text-xs leading-tight text-muted-foreground line-through">
                  {formatRupiah(originalPrice)}
                </span>
              )}
            </div>
            {selectedVariantLabel && (
              <p className="min-w-0 truncate text-right text-[12px] leading-tight text-muted-foreground">
                {selectedVariantLabel}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {cartButtonMobile}
            {waButtonMobile}
          </div>
        </div>
      </div>
    </>
  )
}
