"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatRupiah } from "@/lib/utils"
import type { Product } from "@/components/ui/product-card"
import { Rating } from "@/components/ui/rating"
import { ShoppingCart, ArrowRight } from "lucide-react"
import { useCartStore } from "@/store/cart"
import { useFlyToCart } from "@/components/providers/fly-to-cart-provider"
import * as React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { buildWhatsAppUrl } from "@/lib/api/whatsapp"
import WhatsappIcon from "@/components/icons/whatsapp-icon"
import type { ProductVariation } from "@/types/woocommerce"

import { ProductGallery } from "@/features/product/components/product-gallery"
import {
  ProductVariantSelector,
  type VariantAttribute,
} from "@/features/product/components/product-variant-selector"

interface QuickViewModalProps {
  product: Product
  isOpen: boolean
  onClose: () => void
}

export function QuickViewModal({ product, isOpen, onClose }: QuickViewModalProps) {
  const router = useRouter()
  const addItem = useCartStore((state) => state.addItem)
  const { flyToCart, showCartToast } = useFlyToCart()
  const [isAdding, setIsAdding] = useState(false)

  const isSimpleProduct = product.type === "simple"

  /**
   * Varian dimuat saat modal dibuka, bukan dibawa oleh kartu produk: satu
   * halaman katalog berisi puluhan kartu, dan menyertakan varian di semuanya
   * berarti menarik ribuan baris untuk modal yang mungkin tak pernah dibuka.
   */
  const [variations, setVariations] = useState<ProductVariation[]>([])
  const [selected, setSelected] = useState<Record<string, string>>({})

  React.useEffect(() => {
    if (!isOpen || isSimpleProduct) return
    let cancelled = false

    fetch(`/api/products/variations?id=${product.id}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setVariations(data)
      })
      .catch(() => {
        // Gagal memuat varian tidak boleh mengunci modal — pembeli tetap bisa
        // membuka halaman produk lewat tombol "Lihat Detail".
      })

    return () => {
      cancelled = true
    }
  }, [isOpen, isSimpleProduct, product.id])

  // Atribut pembeda diturunkan dari varian yang ada, sama seperti di halaman
  // produk — induk warisan Woo tidak selalu mencatatnya.
  const variantAttributes: VariantAttribute[] = (() => {
    const byName = new Map<string, { name: string; options: string[] }>()
    for (const variation of variations) {
      for (const attr of variation.attributes) {
        if (!attr.name || !attr.option) continue
        const key = attr.name.trim().toLowerCase()
        const entry = byName.get(key) ?? { name: attr.name, options: [] }
        if (!entry.options.includes(attr.option)) entry.options.push(attr.option)
        byName.set(key, entry)
      }
    }
    return [...byName.values()]
  })()

  const hasVariants = !isSimpleProduct && variantAttributes.length > 0

  const resolvedVariation = hasVariants
    ? variations.find((variation) =>
        variantAttributes.every((attr) => {
          const chosen = selected[attr.name]
          if (!chosen) return false
          const match = variation.attributes.find(
            (a) => a.name.trim().toLowerCase() === attr.name.trim().toLowerCase(),
          )
          return match?.option.trim().toLowerCase() === chosen.trim().toLowerCase()
        }),
      )
    : undefined

  // Harga mengikuti varian terpilih; sebelum dipilih tetap harga "mulai dari".
  const displayPrice = resolvedVariation ? Number(resolvedVariation.price) : product.price
  const displayRegular = resolvedVariation
    ? Number(resolvedVariation.regular_price)
    : product.regular_price

  const hasDiscount = resolvedVariation
    ? resolvedVariation.on_sale && displayRegular != null && displayRegular > displayPrice
    : product.on_sale && product.regular_price != null && product.regular_price > product.price
  const discountPercent =
    hasDiscount && displayRegular ? Math.round((1 - displayPrice / displayRegular) * 100) : 0

  const handleAddToCart = (event: React.MouseEvent) => {
    if (isAdding) return

    // Varian belum dipilih — tombolnya memang nonaktif, ini hanya penjaga
    // kalau aksinya terpicu lewat jalan lain (mis. keyboard).
    if (hasVariants && !resolvedVariation) return

    // Produk bervariasi yang variannya gagal dimuat tidak bisa dibeli dari
    // sini: tanpa data varian, tidak ada harga maupun SKU yang benar untuk
    // dimasukkan ke keranjang. Pembeli diarahkan ke halaman produk.
    if (!isSimpleProduct && !hasVariants) {
      onClose()
      router.push(`/product/${product.slug}`)
      return
    }

    event.preventDefault()
    event.stopPropagation()
    setIsAdding(true)

    const image = resolvedVariation?.image?.src ?? product.image_url
    flyToCart(event.clientX, event.clientY, image)

    setTimeout(() => {
      addItem({
        id: resolvedVariation ? `${product.id}_${resolvedVariation.id}` : product.id,
        productId: Number(product.id),
        name: product.name,
        price: displayPrice,
        quantity: 1,
        sku: resolvedVariation?.sku || undefined,
        image,
        variationLabel: resolvedVariation
          ? variantAttributes.map((a) => selected[a.name]).filter(Boolean).join(", ")
          : undefined,
      })
      setIsAdding(false)
      showCartToast()
      onClose()
    }, 800)
  }

  const productUrl = typeof window !== 'undefined' ? `${window.location.origin}/product/${product.slug}` : `https://hnsitcenter.id/product/${product.slug}`

  const waMessage = `${productUrl}

Hallo Saya ingin menanyakan soal Product ${product.name} dengan harga ${formatRupiah(hasDiscount ? product.regular_price! : product.price)}${hasDiscount ? ` dengan harga discount ${formatRupiah(product.price)}` : ""}`

  const galleryImages = product.images && product.images.length > 0 
    ? product.images 
    : [{ src: product.image_url, alt: product.name }]

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-[65vw] p-0 overflow-hidden bg-background border-border sm:rounded-xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{product.name}</DialogTitle>
          <DialogDescription>Quick view for {product.name}</DialogDescription>
        </DialogHeader>
        
        {/* Container is scrollable on mobile, but hidden overflow on desktop where sides handle their own scrolling/stickiness */}
        <div className="flex flex-col md:flex-row h-full md:h-[650px] max-h-[90vh] overflow-y-auto md:overflow-hidden">
          
          {/* Left Side - Image/Gallery */}
          <div className="w-full md:w-[40%] p-6 md:p-8 flex items-center justify-center bg-secondary/10 relative md:sticky md:top-0 shrink-0">
             <div className="w-full max-w-md">
                <ProductGallery images={galleryImages} />
             </div>
          </div>

          {/* Right Side - Scrollable Details on Desktop */}
          <div className="w-full md:w-[60%] p-6 md:p-8 md:overflow-y-auto flex flex-col justify-center">
             
             {/* 1. Category and Brand */}
             <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider">
               <span className="text-red-500">{product.category || "Uncategorized"}</span>
               {product.brand && (
                 <>
                   <span className="text-muted-foreground">•</span>
                   <span className="text-blue-500">{product.brand}</span>
                 </>
               )}
             </div>
             
             {/* 2. Product Name */}
             <h2 className="text-xl md:text-2xl font-semibold text-foreground mb-4 leading-tight">
               {product.name}
             </h2>

             {!!product.rating_count && (
               <div className="flex items-center gap-2 mb-4">
                 <Rating value={product.average_rating ?? 0} count={product.rating_count} />
                 <span className="text-xs text-muted-foreground">({product.rating_count} ulasan)</span>
               </div>
             )}

             {/* 3. Status Stok. Jumlah terjual sengaja tidak ditampilkan —
                 angkanya berasal dari view count hasil migrasi, bukan penjualan
                 sungguhan. */}
             <div className="space-y-3 mb-6 pb-6 border-b border-border">
               <div className="flex items-center justify-between text-sm">
                 <span className="text-muted-foreground">Status Stok</span>
                 <span className="font-semibold text-foreground">
                   {resolvedVariation
                     ? resolvedVariation.stock_status === "instock"
                       ? "Tersedia"
                       : "Habis"
                     : product.stock > 0
                       ? "Tersedia"
                       : "Habis"}
                 </span>
               </div>
             </div>

             {/* 5. Price */}
             <div className="mb-8">
               {hasDiscount ? (
                 <div className="flex items-end gap-3">
                   <div className="text-2xl md:text-3xl font-bold text-red-500">
                     {formatRupiah(displayPrice)}
                   </div>
                   <div className="flex items-center gap-2 mb-1">
                     <span className="text-sm text-muted-foreground line-through">
                       {formatRupiah(displayRegular!)}
                     </span>
                     <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-xs font-bold text-red-500">
                       -{discountPercent}%
                     </span>
                   </div>
                 </div>
               ) : (
                 <div className="text-2xl md:text-3xl font-bold text-foreground">
                   {hasVariants && !resolvedVariation && (
                     <span className="mr-1.5 text-sm font-normal text-muted-foreground">
                       Mulai dari
                     </span>
                   )}
                   {formatRupiah(displayPrice)}
                 </div>
               )}

               {/* Pilihan varian. Sengaja ditempatkan tepat di bawah harga
                   supaya perubahan harga saat memilih langsung terlihat. */}
               {hasVariants && (
                 <div className="mt-4">
                   <ProductVariantSelector
                     attributes={variantAttributes}
                     selected={selected}
                     onSelect={(name, option) =>
                       setSelected((prev) => ({ ...prev, [name]: option }))
                     }
                   />
                 </div>
               )}

               {product.member_price != null && product.member_price < product.price && (
                 <div className="mt-2 text-sm font-medium text-foreground p-2 bg-muted rounded-md inline-block">
                   Member: <span className="font-bold">{formatRupiah(product.member_price)}</span>
                 </div>
               )}
             </div>

             {/* 6. Buttons Add to Cart and WhatsApp in 1 row */}
             <div className="flex gap-2 md:gap-3 mb-4">
                <button
                  onClick={handleAddToCart}
                  // Produk bervariasi: tombol nonaktif sampai variannya dipilih.
                  // Selector-nya sudah terlihat di atas, jadi pembeli tahu apa
                  // yang kurang — tidak perlu dilempar ke halaman produk.
                  disabled={
                    isAdding ||
                    (isSimpleProduct
                      ? product.stock === 0
                      : hasVariants
                        ? !resolvedVariation || resolvedVariation.stock_status !== "instock"
                        : false)
                  }
                  className="flex-1 flex flex-row items-center justify-center gap-1.5 md:gap-2 rounded-lg bg-brand-green text-white px-2 py-2 md:py-3 text-[10px] sm:text-xs md:text-sm font-semibold transition-all hover:bg-brand-green/90 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed shadow-sm hover:shadow text-center leading-tight whitespace-nowrap"
                >
                  {hasVariants && !resolvedVariation ? (
                    <>
                      <ArrowRight className="h-3.5 w-3.5 md:h-5 md:w-5 shrink-0" />
                      <span>Pilih Varian Dulu</span>
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-3.5 w-3.5 md:h-5 md:w-5 shrink-0" />
                      <span>Tambah ke Keranjang</span>
                    </>
                  )}
                </button>
                
                <a 
                  href={buildWhatsAppUrl(process.env.NEXT_PUBLIC_WHATSAPP_CS_NUMBER || "", waMessage)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex flex-row items-center justify-center gap-1.5 md:gap-2 rounded-lg border border-[#25D366] text-[#25D366] bg-[#25D366]/5 px-2 py-2 md:py-3 text-[10px] sm:text-xs md:text-sm font-semibold transition-all hover:bg-[#25D366]/10 cursor-pointer text-center leading-tight whitespace-nowrap"
                >
                  <WhatsappIcon size={14} className="md:hidden shrink-0" />
                  <WhatsappIcon size={20} className="hidden md:block shrink-0" />
                  <span>Tanya via WhatsApp</span>
                </a>
             </div>
             
             {/* 7. Button Lihat Detail with hover effect */}
             <div className="flex justify-center">
                <button
                  onClick={() => {
                    onClose();
                    router.push(`/product/${product.slug}`);
                  }}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4 cursor-pointer"
                >
                  Lihat detail lengkap produk
                </button>
             </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
