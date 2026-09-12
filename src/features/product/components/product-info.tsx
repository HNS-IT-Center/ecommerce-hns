"use client";

import { useState } from "react";
import { Shield, Truck, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildWhatsAppUrl } from "@/lib/api/whatsapp";
import { useCartStore } from "@/store/cart";
import { calculateProductPrice } from "@/features/product/lib/calculate-product-price";
import { calculateVariationPriceRange } from "@/features/product/lib/calculate-variation-price-range";
import type { ProductVariation } from "@/types/woocommerce";
import { useFlyToCart } from "@/components/providers/fly-to-cart-provider";
import { ProductPriceBox } from "./product-price-box";
import { ProductActions } from "./product-actions";
import {
  ProductVariantSelector,
  type VariantAttribute,
} from "./product-variant-selector";
import { QRCodeCanvas } from "qrcode.react";

interface ProductInfoProps {
  id: number;
  name: string;
  sku: string;
  brand: string;
  categoryName: string;
  price: string;
  regularPrice: string;
  salePrice: string;
  onSale: boolean;
  type: "simple" | "variable" | "grouped" | "external";
  image?: string;
  stockStatus: string;
  stockQuantity: number | null;
  averageRating: string;
  ratingCount: number;
  whatsappNumber: string;
  variantAttributes: VariantAttribute[];
  variations: ProductVariation[];
  siteUrl: string;
  /**
   * Pilihan varian dikendalikan dari luar supaya galeri dan panel ini berbagi
   * satu sumber kebenaran — memilih warna menggeser galeri, dan menggulir
   * galeri mengubah harga di sini. Lihat `product-detail.tsx`.
   */
  selected: Record<string, string>;
  onSelectedChange: (selected: Record<string, string>) => void;
  /** Memilih/membatalkan satu atribut. Dibagi dengan strip varian di mobile. */
  onSelectAttribute: (attributeName: string, option: string) => void;
  /** Sorotan sesaat saat pembeli menekan keranjang tanpa varian lengkap. */
  isVariantHighlighted: boolean;
  onRequestVariantChoice: () => void;
  /** Kombinasi varian yang tidak ada di katalog — dihitung di `ProductDetail`. */
  unavailableOptions?: Set<string>;
  className?: string;
}

export function ProductInfo({
  id,
  name,
  sku,
  brand,
  categoryName,
  price,
  regularPrice,
  salePrice,
  onSale,
  type,
  image,
  stockStatus,
  stockQuantity,
  averageRating,
  ratingCount,
  whatsappNumber,
  variantAttributes,
  variations,
  siteUrl,
  selected,
  onSelectAttribute,
  isVariantHighlighted,
  onRequestVariantChoice,
  unavailableOptions,
  className,
}: ProductInfoProps) {
  const isSimpleProduct = type === "simple";
  const hasVariants =
    type === "variable" &&
    variantAttributes.length > 0 &&
    variations.length > 0;

  const addItem = useCartStore((state) => state.addItem);
  const { flyToCart } = useFlyToCart();

  const [isAdding, setIsAdding] = useState(false);

  // Varian yang cocok dengan kombinasi pilihan saat ini — undefined selama
  // belum semua atribut dipilih, atau kombinasinya memang tidak ada.
  const resolvedVariation = hasVariants
    ? variations.find((variation) =>
        variantAttributes.every((attr) => {
          const chosen = selected[attr.name];
          if (!chosen) return false;
          const match = variation.attributes.find(
            (a) =>
              a.name.trim().toLowerCase() === attr.name.trim().toLowerCase(),
          );
          return (
            match?.option.trim().toLowerCase() === chosen.trim().toLowerCase()
          );
        }),
      )
    : undefined;

  /**
   * Rentang harga varian, hanya selama belum ada varian yang dipilih.
   *
   * Begitu `resolvedVariation` terisi, rentang dimatikan dan panel kembali
   * menampilkan harga tunggal varian itu — lengkap dengan badge diskon dan
   * harga coretnya.
   */
  const priceRange =
    hasVariants && !resolvedVariation ? calculateVariationPriceRange(variations) : null;

  const effectivePrice = resolvedVariation?.price ?? price;
  const effectiveRegularPrice = resolvedVariation?.regular_price ?? regularPrice;
  const effectiveSalePrice = resolvedVariation?.sale_price ?? salePrice;
  const effectiveOnSale = resolvedVariation?.on_sale ?? onSale;
  const effectiveSku = resolvedVariation?.sku || sku;

  /**
   * SKU yang ditampilkan di bawah nama produk.
   *
   * Produk biasa punya satu SKU. Produk bervariasi punya satu SKU per varian,
   * dan sebelum pembeli memilih, semuanya relevan — jadi seluruhnya
   * ditampilkan. Begitu satu varian dipilih, hanya SKU varian itu yang tersisa,
   * karena itulah barang yang benar-benar akan dibeli.
   *
   * Varian tanpa SKU (26% katalog) dilewati, bukan ditampilkan sebagai kosong.
   */
  const displaySkus = (() => {
    if (!hasVariants) return effectiveSku ? [effectiveSku] : [];
    if (resolvedVariation) return resolvedVariation.sku ? [resolvedVariation.sku] : [];

    const unique: string[] = [];
    for (const variation of variations) {
      if (variation.sku && !unique.includes(variation.sku)) unique.push(variation.sku);
    }
    return unique.length > 0 ? unique : sku ? [sku] : [];
  })();
  const effectiveImage = resolvedVariation?.image?.src || image;

  const {
    displayPrice,
    displayRegular,
    displaySale,
    finalPrice,
    discountPercent,
  } = calculateProductPrice({
    price: effectivePrice,
    regularPrice: effectiveRegularPrice,
    salePrice: effectiveSalePrice,
    onSale: effectiveOnSale,
  });

  /**
   * Harga coret untuk bar mengambang.
   *
   * Mengikuti urutan yang sama dengan ProductPriceBox supaya angkanya tidak
   * pernah berbeda antara panel dan bar. Bernilai `null` saat tidak ada
   * potongan apa pun — bar lalu menampilkan satu harga saja tanpa coretan.
   */
  const barOriginalPrice =
    effectiveOnSale && displaySale && displayRegular > displaySale
      ? displayRegular
      : null;

  /**
   * Ringkasan varian terpilih untuk bar mengambang, mis. "MERAH / XL".
   *
   * Hanya menampilkan atribut yang sudah benar-benar dipilih, jadi pilihan
   * separuh jalan pun tetap terbaca — pembeli bisa memastikan variannya tanpa
   * menggulir kembali ke atas.
   */
  const selectedVariantLabel = hasVariants
    ? variantAttributes
        .map((attr) => selected[attr.name])
        .filter(Boolean)
        .join(" / ")
    : "";

  const canAddToCart = isSimpleProduct
    ? stockStatus === "instock"
    : hasVariants && resolvedVariation?.stock_status === "instock";

  const showCartButton = isSimpleProduct || hasVariants;

  const addToCartHint = isSimpleProduct
    ? undefined
    : !hasVariants
      ? "Produk ini memiliki beberapa varian — hubungi kami via WhatsApp untuk pilihan yang tersedia."
      : !resolvedVariation
        ? "Pilih semua opsi di atas untuk melihat harga & stok."
        : resolvedVariation.stock_status !== "instock"
          ? "Varian ini sedang habis."
          : undefined;

  const waLabel = canAddToCart ? "Beli via WhatsApp" : "Tanya via WhatsApp";

  const variantSuffix =
    type === "variable" && Object.keys(selected).length > 0
      ? ` (${variantAttributes.map((a) => `${a.name}: ${selected[a.name] ?? "?"}`).join(", ")})`
      : "";
  /**
   * Tautan pendek produk, dipakai bersama oleh QR, tombol bagikan, dan pesan
   * WhatsApp. `/p/{id}` mengalihkan permanen ke slug kanonik (lihat
   * `app/p/[id]/route.ts`), jadi ia aman dibagikan sekaligus jauh lebih pendek
   * daripada URL slug penuh yang sering memakan dua baris di gelembung chat.
   */
  const shortUrl = `${siteUrl}/p/${id}`;

  // Tautannya disertakan supaya CS langsung tahu barang yang dimaksud tanpa
  // harus mencari SKU-nya manual di panel admin.
  const waMessage = `Halo HNS IT Center, saya tertarik dengan produk: ${name}${variantSuffix} (SKU: ${effectiveSku}).\n${shortUrl}\nApakah tersedia?`;
  const waUrl = buildWhatsAppUrl(whatsappNumber, waMessage);

  const handleAddToCart = (e: React.MouseEvent) => {
    if (isAdding) return;

    if (type === "variable") {
      if (!resolvedVariation) return;
      setIsAdding(true);
      flyToCart(e.clientX, e.clientY, effectiveImage);
      const variantLabel = variantAttributes
        .map((a) => selected[a.name])
        .join(", ");

      setTimeout(() => {
        addItem({
          id: `${id}_${resolvedVariation.id}`,
          productId: id,
          name,
          price: finalPrice,
          quantity: 1,
          sku: effectiveSku,
          image: effectiveImage,
          variationLabel: variantLabel,
        });
        setIsAdding(false);
      }, 800);
      return;
    }

    setIsAdding(true);
    flyToCart(e.clientX, e.clientY, image);

    setTimeout(() => {
      addItem({
        id: id.toString(),
        productId: id,
        name,
        price: finalPrice,
        quantity: 1,
        sku,
        image,
      });
      setIsAdding(false);
    }, 800);
  };

  return (
    /* `flex` + `order-*`, bukan dua salinan markup.

       Di mobile harganya naik ke paling atas — pola marketplace, tempat angka
       adalah hal pertama yang dicari pembeli — sementara desktop tetap pada
       urutan lamanya: merek, nama, SKU, baru harga. Satu DOM dengan urutan
       visual berbeda membuat keduanya mustahil berbeda isi, dan pembaca layar
       tetap membacanya dalam urutan sumber yang masuk akal. */
    <div className={cn("flex flex-col space-y-3 md:space-y-6", className)}>
      {/* Brand + Category */}
      <div className="order-2 flex items-center gap-2 text-sm md:order-1">
        {brand && (
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-wider">
            {brand}
          </span>
        )}
        <span className="text-sale-red font-bold uppercase tracking-wider">
          {categoryName}
        </span>
      </div>

      {/* Product Name */}
      <h1 className="order-3 text-lg font-extrabold leading-snug tracking-tight md:order-2 md:text-3xl md:leading-tight">
        {name}
      </h1>

      {/* SKU + Rating. Jumlah terjual sengaja tidak ditampilkan — angkanya
          berasal dari view count hasil migrasi, bukan penjualan sungguhan. */}
      <div className="order-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground md:order-3">
        {displaySkus.length > 0 && (
          <span>
            SKU: {displaySkus.join(", ")}
          </span>
        )}
        {ratingCount > 0 && (
          <>
            <span>•</span>
            <span>
              ⭐ {averageRating} ({ratingCount} ulasan)
            </span>
          </>
        )}
      </div>

      <div className="order-1 md:order-4">
        <ProductPriceBox
          onSale={effectiveOnSale}
          displaySale={displaySale}
          discountPercent={discountPercent}
          displayRegular={displayRegular}
          displayPrice={displayPrice}
          priceRange={priceRange}
        />
      </div>

      {/* Desktop saja: di mobile pemilih variannya sudah berdiri sebagai strip
          berfoto tepat di bawah galeri. Dua pemilih untuk satu hal yang sama di
          satu layar hanya membuat pembeli ragu mana yang berlaku. */}
      {hasVariants && (
        <div className="order-5 hidden md:block">
          <ProductVariantSelector
            attributes={variantAttributes}
            selected={selected}
            onSelect={onSelectAttribute}
            unavailableOptions={unavailableOptions}
            isHighlighted={isVariantHighlighted}
          />
        </div>
      )}

      {/* Stock Status */}
      <div className="order-6 flex items-center gap-2">
        {isSimpleProduct ? (
          stockStatus === "instock" ? (
            <>
              <Check className="h-4 w-4 text-success" />
              <span className="text-sm font-semibold text-success">
                Tersedia
                {stockQuantity != null &&
                  stockQuantity <= 5 &&
                  ` (Sisa ${stockQuantity})`}
              </span>
            </>
          ) : (
            <span className="text-sm font-semibold text-sale-red">
              Stok Habis
            </span>
          )
        ) : !hasVariants ? null : !resolvedVariation ? (
          <span className="text-sm text-muted-foreground">
            Pilih varian untuk melihat ketersediaan stok
          </span>
        ) : resolvedVariation.stock_status === "instock" ? (
          <>
            <Check className="h-4 w-4 text-success" />
            <span className="text-sm font-semibold text-success">
              Tersedia
              {resolvedVariation.stock_quantity != null &&
                resolvedVariation.stock_quantity <= 5 &&
                ` (Sisa ${resolvedVariation.stock_quantity})`}
            </span>
          </>
        ) : (
          <span className="text-sm font-semibold text-sale-red">
            Stok Habis
          </span>
        )}
      </div>

      <div className="order-7">
        <ProductActions
          onAddToCart={handleAddToCart}
          canAddToCart={canAddToCart && !isAdding}
          showCartButton={showCartButton}
          addToCartHint={addToCartHint}
          waUrl={waUrl}
          waLabel={waLabel}
          price={finalPrice}
          originalPrice={barOriginalPrice}
          selectedVariantLabel={selectedVariantLabel}
          needsVariantChoice={hasVariants && !resolvedVariation}
          onRequestVariantChoice={onRequestVariantChoice}
        />
      </div>
      {/* Trust Badges */}
      <div className="order-9 grid grid-cols-2 gap-2 md:gap-3 md:pt-2">
        <div className="flex items-center gap-1.5 rounded-lg border border-border p-2.5 text-xs md:gap-2 md:p-3 md:text-sm">
          <Shield className="h-4 w-4 shrink-0 text-brand-green md:h-5 md:w-5" />
          <span>Garansi Resmi</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-border p-2.5 text-xs md:gap-2 md:p-3 md:text-sm">
          <Truck className="h-4 w-4 shrink-0 text-brand-green md:h-5 md:w-5" />
          <span>
            Gratis ongkir Batam (syarat berlaku) —{" "}
            <a
              href="/kebijakan/pengiriman"
              className="underline hover:text-brand-green"
            >
              lihat kebijakan
            </a>
          </span>
        </div>
      </div>

      {/* QR Code */}
      <div className="order-10 flex items-center justify-between rounded-lg border border-border bg-muted/20 p-4 md:mt-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-primary">Scan QR Produk</p>
          <p className="text-xs text-muted-foreground max-w-[200px]">
            Buka halaman ini kapan saja dari smartphone Anda.
          </p>
        </div>
        <div className="rounded-md bg-white p-1.5 shadow-sm">
          <QRCodeCanvas
            value={shortUrl}
            size={350}
            level="L"
            style={{ width: 64, height: 64 }}
          />
        </div>
      </div>

      {/* JANGAN HAPUS — ini ganjalan untuk bar aksi mengambang, bukan celah
          dekoratif yang tertinggal.

          `ProductActions` berubah jadi bar `fixed` di dasar layar pada mobile
          (lihat product-actions.tsx). Elemen `fixed` keluar dari alur dokumen,
          jadi ia tidak memesan ruang apa pun untuk dirinya dan menutupi apa pun
          yang kebetulan berada di bawahnya. Tanpa ganjalan ini, blok terakhir
          di panel — QR produk — tersembunyi permanen di balik bar dan tidak
          bisa dicapai dengan menggulir sejauh apa pun.

          Terlihat "kosong" memang wujud yang benar: tugasnya menyediakan ruang,
          bukan menampilkan sesuatu.

          TINGGINYA HARUS IKUT TINGGI BAR. Sejak bar memakai tata letak dua
          baris (harga di atas, tombol lebar di bawah), ukurannya jadi:

            border-t          1px
            pt-2              8px
            baris harga     ~22px
            mb-2              8px
            tombol h-12      48px
            pb-2.5           10px
            ─────────────────────
                             97px  →  h-24 (96px)

          Sisa satu piksel ditanggung `pb-safe` milik bar, yang di ponsel modern
          selalu menambah ruang di bawahnya.

          Kalau tata letak bar diubah lagi, angka ini ikut diperbarui — kalau
          tidak, QR kembali tertutup (ganjalan kekecilan) atau muncul celah
          putih di ujung halaman (kebesaran). */}
      <div className="order-last h-24 md:hidden" aria-hidden="true" />
    </div>
  );
}
