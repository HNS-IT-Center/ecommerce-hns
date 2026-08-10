"use client";

import { useState } from "react";
import { Shield, Truck, Check } from "lucide-react";
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
  onSelectedChange,
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
  const waMessage = `Halo HNS IT Center, saya tertarik dengan produk: ${name}${variantSuffix} (SKU: ${effectiveSku}). Apakah tersedia?`;
  const waUrl = buildWhatsAppUrl(whatsappNumber, waMessage);

  const handleSelectVariant = (attributeName: string, option: string) => {
    // Menekan pilihan yang sedang aktif membatalkannya — harga kembali "mulai
    // dari" dan galeri lepas dari varian itu. Tanpa ini pembeli yang salah
    // pilih tidak punya jalan kembali selain memuat ulang halaman.
    if (selected[attributeName] === option) {
      const next = { ...selected };
      delete next[attributeName];
      onSelectedChange(next);
      return;
    }
    onSelectedChange({ ...selected, [attributeName]: option });
  };

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
    <div className="space-y-6">
      {/* Brand + Category */}
      <div className="flex items-center gap-2 text-sm">
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
      <h1 className="text-2xl font-extrabold leading-tight tracking-tight md:text-3xl">
        {name}
      </h1>

      {/* SKU + Rating. Jumlah terjual sengaja tidak ditampilkan — angkanya
          berasal dari view count hasil migrasi, bukan penjualan sungguhan. */}
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
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

      <ProductPriceBox
        onSale={effectiveOnSale}
        displaySale={displaySale}
        discountPercent={discountPercent}
        displayRegular={displayRegular}
        displayPrice={displayPrice}
        priceRange={priceRange}
      />

      {hasVariants && (
        <ProductVariantSelector
          attributes={variantAttributes}
          selected={selected}
          onSelect={handleSelectVariant}
        />
      )}

      {/* Stock Status */}
      <div className="flex items-center gap-2">
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

      <ProductActions
        onAddToCart={handleAddToCart}
        canAddToCart={canAddToCart && !isAdding}
        showCartButton={showCartButton}
        addToCartHint={addToCartHint}
        waUrl={waUrl}
        waLabel={waLabel}
        price={finalPrice}
      />
      {/* Spacer: ProductActions jadi fixed di mobile, sisakan ruang agar
          konten di bawahnya (trust badge, tabs, footer) tidak tertutup. */}
      <div className="h-20 md:hidden" aria-hidden="true" />

      {/* Trust Badges */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <div className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
          <Shield className="h-5 w-5 text-brand-green shrink-0" />
          <span>Garansi Resmi</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
          <Truck className="h-5 w-5 text-brand-green shrink-0" />
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
      <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-muted/20 p-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-primary">Scan QR Produk</p>
          <p className="text-xs text-muted-foreground max-w-[200px]">
            Buka halaman ini kapan saja dari smartphone Anda.
          </p>
        </div>
        <div className="rounded-md bg-white p-1.5 shadow-sm">
          <QRCodeCanvas
            value={`${siteUrl}/p/${id}`}
            size={350}
            level="L"
            style={{ width: 64, height: 64 }}
          />
        </div>
      </div>
    </div>
  );
}
