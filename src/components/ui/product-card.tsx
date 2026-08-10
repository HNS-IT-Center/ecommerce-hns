"use client";

import Image from "next/image"
import Link from "next/link"
import { LayoutGrid, ShoppingCart, Percent } from "lucide-react"
import WhatsappIcon from "@/components/icons/whatsapp-icon"
import FlameIcon from "@/components/icons/fire-icon"
import EyeIcon from "@/components/icons/eye-icon"
import { buildWhatsAppUrl } from "@/lib/api/whatsapp"

import { formatRupiah } from "@/lib/utils";
import { getBadgeColorClass } from "@/lib/utils/product";
import { useCartStore } from "@/store/cart";
import { Rating } from "@/components/ui/rating";
import { useFlyToCart } from "@/components/providers/fly-to-cart-provider";
import { useState, useEffect } from "react";
import { QuickViewModal } from "@/components/ui/quick-view-modal";
import { ChristmasCardDecor } from "@/components/theme/christmas-card-decor";

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  regular_price?: number;
  on_sale?: boolean;
  image_url: string;
  sold: number;
  badge?: "Hot" | "Deal" | "New" | null;
  stock: number;
  type: "simple" | "variable" | "grouped" | "external";
  average_rating?: number;
  rating_count?: number;
  images?: { src: string; alt: string }[];
}

interface ProductCardProps {
  product: Product
  /**
   * Tandai HANYA kartu yang sudah terlihat tanpa menggulir.
   *
   * Bawaannya lazy-load, yang tepat untuk hampir semua kartu — tapi kartu yang
   * sudah ada di viewport saat halaman dimuat jadi harus menunggu JavaScript
   * jalan sebelum gambarnya mulai diunduh, dan itu menunda LCP.
   *
   * Jangan dinyalakan untuk seluruh daftar: satu halaman katalog berisi 30
   * kartu, dan 30 unduhan prioritas tinggi yang berebut bandwidth justru
   * membuat LCP lebih lambat daripada tanpa penanda ini sama sekali.
   */
  priority?: boolean
}

export function ProductCard({ product, priority = false }: ProductCardProps) {
  const addItem = useCartStore((state) => state.addItem)
  const { flyToCart, showCartToast } = useFlyToCart()
  const [isAdding, setIsAdding] = useState(false)
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false)

  const isSimpleProduct = product.type === "simple";
  const hasDiscount =
    product.on_sale &&
    product.regular_price != null &&
    product.regular_price > product.price;
  const discountPercent = hasDiscount
    ? Math.round((1 - product.price / product.regular_price!) * 100)
    : 0;

  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const productUrl = `${origin || "https://hnsitcenter.id"}/product/${product.slug}`;

  const waMessage = `${productUrl}

Hallo Saya ingin menanyakan soal Product ${product.name} dengan harga ${formatRupiah(hasDiscount ? product.regular_price! : product.price)}${hasDiscount ? ` dengan harga discount ${formatRupiah(product.price)}` : ""}`;

  const handleAddToCart = (event: React.MouseEvent) => {
    if (isAdding) return;

    // Produk bervariasi tidak bisa langsung masuk keranjang dari kartu —
    // variannya harus dipilih dulu. Quick View dibuka di tempat, bukan
    // memindahkan pembeli ke halaman produk: pilihan varian, harga, dan tombol
    // keranjang sudah lengkap di sana, jadi ia bisa menyelesaikan pembelian
    // tanpa kehilangan posisi di daftar katalog.
    if (!isSimpleProduct) {
      event.preventDefault()
      event.stopPropagation()
      setIsQuickViewOpen(true)
      return
    }

    event.preventDefault();
    event.stopPropagation();
    setIsAdding(true);

    flyToCart(event.clientX, event.clientY, product.image_url);

    setTimeout(() => {
      addItem({
        id: product.id,
        productId: Number(product.id),
        name: product.name,
        price: product.price,
        quantity: 1,
        image: product.image_url,
      });
      setIsAdding(false);
      showCartToast();
    }, 800);
  };

  const handleQuickView = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsQuickViewOpen(true);
  };

  return (
    <>
      <div className="theme-card group relative flex flex-col rounded-xl bg-card shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
        <Link
          href={`/product/${product.slug}`}
          className="absolute inset-0 z-10 rounded-xl focus-visible:outline-2 focus-visible:outline-ring"
        >
          <span className="sr-only">{product.name}</span>
        </Link>

        {/* Folded Discount Badge */}
        {hasDiscount && (
          <div className="absolute -left-1.5 top-3 z-[40] drop-shadow-sm pointer-events-none">
            <div className="rounded-r-md rounded-tl-md bg-(--card-badge-sale) px-2 py-0.5 text-xs font-bold text-white tracking-wide">
              {discountPercent}%
            </div>
            <div
              className="h-1.5 w-1.5 bg-(--card-badge-sale-fold)"
              style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%)" }}
            />
          </div>
        )}

        {/* Hot Badge Folded (when not on sale) */}
        {!hasDiscount && product.badge === "Hot" && (
          <div className="absolute -left-1.5 top-3 z-[40] drop-shadow-sm pointer-events-none">
            <div className="flex items-center gap-0.5 rounded-r-md rounded-tl-md bg-(--card-badge-hot) px-1.5 py-0.5 text-xs font-bold text-white tracking-wide">
              <FlameIcon size={14} className="text-white" />
              HOT
            </div>
            <div
              className="h-1.5 w-1.5 bg-(--card-badge-hot-fold)"
              style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%)" }}
            />
          </div>
        )}

        {/* Image Container */}
        <div className="relative aspect-square w-full overflow-hidden bg-secondary/50 rounded-t-xl group/image">
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            priority={priority}
            className="object-contain transition-transform duration-500 group-hover:scale-105"
          />

          {/* Hiasan Natal saat hover. Tidak diberi kondisi di React: seluruh
            gerbangnya ada di CSS lewat `--card-decor`, yang hanya diset tema
            kartu Natal. Kartu ini dipakai di sebelas tempat — mengoper prop
            tema ke semuanya berarti sebelas jalur yang bisa lupa diperbarui. */}
          <ChristmasCardDecor />

          {/* Quick View Hover State (Desktop) */}
          <div className="absolute inset-0 z-20 hidden md:flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover/image:opacity-100 group-hover/image:bg-background/40 group-hover/image:backdrop-blur-sm pointer-events-none">
            <button
              onClick={handleQuickView}
              className="flex flex-col items-center justify-center text-foreground hover:text-brand-green transition-colors pointer-events-auto"
              title="Quickview"
            >
              <div className="rounded-full bg-background/80 p-3 shadow-lg mb-1">
                <EyeIcon size={24} />
              </div>
              <span className="text-[10px] font-bold bg-background/80 px-2 py-0.5 rounded shadow-sm">
                Quickview
              </span>
            </button>
          </div>

          {/* Quick View Button (Mobile).
            Dulu `bg-cyan-100 text-white`: ikon putih di atas lingkaran nyaris
            putih, rasio kontras ~1.2:1 — praktis tidak terlihat. Sekarang
            mengikuti perlakuan tombol hover versi desktop di atas. */}
          <button
            onClick={handleQuickView}
            className="absolute top-2 right-2 z-[40] flex md:hidden h-8 w-8 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm hover:bg-background pointer-events-auto"
            title="Quickview"
          >
            <EyeIcon size={18} />
          </button>

          {/* Regular Badge */}
          {!hasDiscount && product.badge && product.badge !== "Hot" && (
            <span
              className={`absolute left-2 top-2 z-[40] rounded-md px-2 py-1 text-[10px] font-bold tracking-wider text-white uppercase shadow-sm ${getBadgeColorClass(product.badge)} pointer-events-none`}
            >
              {product.badge}
            </span>
          )}

          {/* Out of Stock Overlay */}
          {product.stock === 0 && (
            <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex items-center justify-center z-10 pointer-events-none">
              <span className="rounded-full bg-foreground px-3 py-1 text-xs font-bold text-background shadow-sm">
                HABIS
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col p-3 rounded-b-xl">
          {/* Product Name */}
          <h3 className="line-clamp-2 text-xs font-medium leading-snug text-foreground transition-colors group-hover:text-brand-green">
            {product.name}
          </h3>

          {/* Rating */}
          {!!product.rating_count && (
            <Rating
              value={product.average_rating ?? 0}
              count={product.rating_count}
              className="mt-1"
            />
          )}

          <div className="mt-auto pt-3">
            {/* Price + Discount */}
            {hasDiscount ? (
              <div className="flex items-baseline gap-1.5">
                <div className="text-sm font-bold text-(--card-price)">
                  {formatRupiah(product.price)}
                </div>
                <span className="rounded bg-(--card-price)/10 px-1 py-0.5 text-[9px] font-bold text-(--card-price)">
                  -{discountPercent}%
                </span>
              </div>
            ) : (
              <div className="text-sm font-bold text-foreground">
                {formatRupiah(product.price)}
              </div>
            )}
            {hasDiscount && (
              <div className="text-[10px] text-muted-foreground line-through">
                {formatRupiah(product.regular_price!)}
              </div>
            )}

            {/* Baris "Member: Rp X" dihapus. Ia menampilkan harga yang tidak
              pernah bisa didapat siapa pun — tidak ada mekanisme member di situs
              ini, dan sekarang tidak ada akun sama sekali. Lihat CLAUDE.md §2.7. */}

            {/* Footer of Card: Cart icon. Jumlah terjual sengaja tidak ditampilkan
                — angkanya berasal dari view count hasil migrasi, bukan penjualan
                sungguhan, jadi menampilkannya menyesatkan pembeli. */}
            <div className="mt-2 flex items-center justify-end pt-2">
              <div className="flex items-center gap-1.5">
                <a
                  href={buildWhatsAppUrl(process.env.NEXT_PUBLIC_WHATSAPP_CS_NUMBER || "", waMessage)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Pesan via WhatsApp"
                  // Hijau WhatsApp SENGAJA tidak ikut tema: warnanya diatur
                  // pedoman merek Meta, dan tombol WhatsApp berwarna lain
                  // terbaca seperti kerusakan tampilan. Dipakai lewat token
                  // `--color-whatsapp` yang sudah ada, bukan hex berulang.
                  className="relative z-20 flex h-7 w-7 items-center justify-center rounded-full bg-whatsapp/10 text-whatsapp transition-all duration-300 ease-in-out hover:bg-whatsapp/20 hover:scale-110 cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <WhatsappIcon size={14} />
                </a>
                <button
                  onClick={handleAddToCart}
                  disabled={isAdding}
                  title={isSimpleProduct ? "Tambah ke keranjang" : "Pilih varian"}
                  className="relative z-20 flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-foreground transition-all duration-300 ease-in-out group-hover:bg-brand-green group-hover:text-white cursor-pointer hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={isSimpleProduct ? "Tambah ke keranjang" : "Lihat pilihan varian"}
                >
                  {isSimpleProduct ? (
                    <ShoppingCart className="h-3.5 w-3.5" />
                  ) : (
                    // Ikon kisi, bukan panah: panah berarti "pergi ke halaman
                    // lain", padahal tombol ini membuka pilihan varian di tempat.
                    <LayoutGrid className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <QuickViewModal
        product={product}
        isOpen={isQuickViewOpen}
        onClose={() => setIsQuickViewOpen(false)}
      />
    </>
  );
}
