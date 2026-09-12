"use client"

import Image from "next/image"
import { Minus, Plus, Repeat2 } from "lucide-react"
import { formatRupiah } from "@/lib/utils"
import { BuilderProduct } from "@/store/new-builder"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import EyeIcon from "@/components/icons/eye-icon"

/** Satu varian produk ini yang sudah masuk rakitan pada langkah yang sedang aktif. */
export type SelectedVariationLine = {
  variationId: number
  label: string
  quantity: number
  stock: number
}

interface ProductCardBuilderProps {
  product: BuilderProduct
  /**
   * Untuk produk biasa: kuantitas yang dipilih. Untuk produk bervarian: jumlah
   * seluruh varian yang dipilih dari kartu ini — dipakai hanya untuk menandai
   * kartunya sebagai terpilih, karena kuantitas sebenarnya diatur per varian.
   */
  quantity: number
  /**
   * Untuk produk biasa: masukkan ke rakitan. Untuk produk bervarian: BUKA
   * pemilih varian — kartu induk tidak pernah masuk rakitan tanpa varian, dan
   * itulah satu-satunya alasan produk VARIABLE boleh tampil di grid ini.
   */
  onSelect: () => void
  /**
   * Buka Quick Preview kartu ini. Sengaja TIDAK ikut dimatikan saat stok habis:
   * produk habis tetap tampil di grid (sama seperti di katalog), dan justru
   * barang itulah yang paling sering ditanyakan spesifikasinya sambil menunggu
   * restock. Yang dimatikan hanya tombol pilih komponennya, di dalam dialog.
   */
  onQuickView: () => void
  onUpdateQuantity: (quantity: number) => void
  displayAttributeIds: number[]
  /** Kosong untuk produk biasa; berisi untuk kartu bervarian yang sudah dipilih. */
  selectedVariations?: SelectedVariationLine[]
  /** Langkah ini boleh menampung lebih dari satu komponen (`step.allowMultiple`). */
  allowMultiple?: boolean
  onUpdateVariationQuantity?: (variationId: number, quantity: number) => void
}

export function ProductCardBuilder({
  product,
  quantity,
  onSelect,
  onQuickView,
  onUpdateQuantity,
  displayAttributeIds,
  selectedVariations = [],
  allowMultiple = false,
  onUpdateVariationQuantity,
}: ProductCardBuilderProps) {
  // Show only attributes that are required by the builder configuration across all steps
  const displayAttributes = product.attributes.filter(attr => displayAttributeIds.includes(attr.attributeId))

  const hasVariations = (product.variations?.length ?? 0) > 0

  const hasDiscount = Boolean(product.regularPrice && product.salePrice && product.regularPrice > product.salePrice)
  const discountPercent = hasDiscount
    ? Math.round((1 - product.salePrice! / product.regularPrice!) * 100)
    : 0

  const isSelected = quantity > 0

  return (
    <div className={`group relative flex flex-col rounded-xl bg-card shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${isSelected ? 'ring-2 ring-brand-green' : ''}`}>
      {/* Folded Discount Badge */}
      {hasDiscount && (
        <div className="absolute -left-1.5 top-3 z-[40] drop-shadow-sm pointer-events-none">
          <div className="rounded-r-md rounded-tl-md bg-red-500 px-2 py-0.5 text-xs font-bold text-white tracking-wide">
            {discountPercent}%
          </div>
          <div
             className="h-1.5 w-1.5 bg-red-800"
             style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%)' }}
          />
        </div>
      )}

      {/* Image Container.
        Wadahnya sebuah `div`, bukan `button`: tombol Quick Preview di bawah
        harus jadi SAUDARA tombol pilih-komponen, bukan anaknya. Tombol di dalam
        tombol bukan HTML yang sah, dan browser menormalisasinya dengan
        memutus struktur — klik pratinjaunya ikut memilih komponen. */}
      <div className="relative aspect-square w-full overflow-hidden bg-secondary/50 rounded-t-xl group/image">
        <button
          type="button"
          onClick={product.stock > 0 ? onSelect : undefined}
          className="absolute inset-0 block h-full w-full cursor-pointer text-left disabled:cursor-not-allowed"
          aria-label={`Pilih ${product.name}`}
          disabled={product.stock === 0}
        >
          <Image
            src={product.image || "/placeholder.jpg"}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-contain transition-transform duration-500 group-hover:scale-105"
          />
        </button>

        {/* Out of Stock Overlay */}
        {product.stock === 0 && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex items-center justify-center z-10 pointer-events-none">
            <span className="rounded-full bg-foreground px-3 py-1 text-xs font-bold text-background shadow-sm">
              HABIS
            </span>
          </div>
        )}

        {/* Quick Preview — hover (desktop). Perlakuannya disamakan dengan kartu
          katalog (`components/ui/product-card.tsx`) supaya sales dan pelanggan
          tidak perlu belajar dua gerakan untuk hal yang sama. */}
        <div className="absolute inset-0 z-20 hidden md:flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover/image:opacity-100 group-hover/image:bg-background/40 group-hover/image:backdrop-blur-sm pointer-events-none">
          <button
            type="button"
            onClick={onQuickView}
            className="flex flex-col items-center justify-center text-foreground hover:text-brand-green transition-colors pointer-events-auto"
            title="Quick Preview"
          >
            <div className="rounded-full bg-background/80 p-3 shadow-lg mb-1">
              <EyeIcon size={24} />
            </div>
            <span className="text-[10px] font-bold bg-background/80 px-2 py-0.5 rounded shadow-sm">
              Quick Preview
            </span>
          </button>
        </div>

        {/* Quick Preview — tombol tetap (mobile), karena tidak ada hover di sana. */}
        <button
          type="button"
          onClick={onQuickView}
          className="absolute top-2 right-2 z-[40] flex md:hidden h-8 w-8 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm hover:bg-background cursor-pointer"
          title="Quick Preview"
          aria-label={`Pratinjau ${product.name}`}
        >
          <EyeIcon size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-3 rounded-b-xl">
        {/* Badges for Required Attributes */}
        {(displayAttributes.length > 0 || hasVariations) && (
          <div className="mb-1.5 flex flex-wrap gap-1">
            {/* Penanda "ada pilihan" muncul lebih dulu: ia mengubah arti tombol
                di dasar kartu, jadi pelanggan sudah tahu sebelum menekannya. */}
            {hasVariations && (
              <Badge variant="secondary" className="text-[8px] px-1.5 py-0 font-medium bg-blue-600 text-white hover:bg-blue-700">
                {product.variations!.length} Opsi
              </Badge>
            )}
            {displayAttributes.map((attr, idx) => (
              <Badge key={idx} variant="secondary" className="text-[8px] px-1.5 py-0 font-medium bg-red-600 text-white hover:bg-red-700">
                {attr.valueName}
              </Badge>
            ))}
          </div>
        )}

        {/* Product Name */}
        <button
          type="button"
          onClick={product.stock > 0 ? onSelect : undefined}
          className="text-left cursor-pointer disabled:cursor-not-allowed"
          disabled={product.stock === 0}
        >
          {/* Tingginya dikunci dua baris, sama seperti kartu katalog, supaya
            nama pendek tidak membuat kartu ini lebih pendek dari tetangganya.
            `2lh` ikut leading elemen; rem di depannya cadangan browser lama. */}
          <h3 className="line-clamp-2 min-h-[2.0625rem] min-h-[2lh] text-xs font-medium leading-snug text-foreground transition-colors group-hover:text-brand-green">
            {product.name}
          </h3>
        </button>

        <div className="mt-auto pt-3">
          {/* Price + Discount */}
          {hasVariations && (
            // Harga di kartu induk adalah harga varian TERMURAH yang masih ada
            // stoknya — bukan harga satu-satunya. Tanpa keterangan ini, angka
            // yang naik setelah varian lain dipilih terasa seperti harga
            // berubah sendiri.
            <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
              Mulai dari
            </div>
          )}
          {hasDiscount ? (
            <div className="flex items-baseline gap-1.5">
              <div className="text-sm font-bold text-red-500">
                {formatRupiah(product.price)}
              </div>
              <span className="rounded bg-red-500/10 px-1 py-0.5 text-[9px] font-bold text-red-500">
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
              {formatRupiah(product.regularPrice!)}
            </div>
          )}

          {/* Footer of Card: Button or Quantity Control */}
          {hasVariations ? (
            <div className="mt-3 flex flex-col gap-1.5">
              {/* Setiap varian terpilih punya barisnya sendiri: label opsinya
                  ditulis apa adanya, karena inilah yang membedakannya dari
                  saudara-saudaranya di rakitan, di PDF, dan di build log. */}
              {selectedVariations.map((line) => (
                <div
                  key={line.variationId}
                  className="flex items-center justify-between gap-1.5 rounded-lg border border-brand-green/30 bg-brand-green/5 px-1.5 py-1"
                >
                  <span className="min-w-0 flex-1 truncate text-[10px] font-bold text-brand-green">
                    {line.label}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Kurangi ${line.label}`}
                      className="h-5 w-5 rounded-full bg-background hover:bg-red-100 hover:text-red-600 shadow-sm cursor-pointer active:scale-95 transition-all"
                      onClick={() => onUpdateVariationQuantity?.(line.variationId, line.quantity - 1)}
                    >
                      <Minus className="h-2.5 w-2.5" />
                    </Button>
                    <span className="w-3 text-center text-[10px] font-bold">{line.quantity}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Tambah ${line.label}`}
                      className="h-5 w-5 rounded-full bg-background hover:bg-brand-green/20 hover:text-brand-green shadow-sm cursor-pointer active:scale-95 transition-all disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => onUpdateVariationQuantity?.(line.variationId, line.quantity + 1)}
                      disabled={line.quantity >= line.stock}
                    >
                      <Plus className="h-2.5 w-2.5" />
                    </Button>
                  </div>
                </div>
              ))}

              <Button
                size="sm"
                onClick={onSelect}
                disabled={product.stock === 0}
                className={`h-7 w-full px-3 text-[10px] font-bold rounded-full transition-all duration-300 cursor-pointer shadow-md ${
                  selectedVariations.length > 0
                    ? "bg-background text-foreground border border-border hover:bg-accent shadow-none"
                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20"
                }`}
              >
                {selectedVariations.length === 0 ? (
                  "Pilih Opsi"
                ) : (
                  <>
                    <Repeat2 className="h-3 w-3" />
                    {/* Di langkah yang cuma menampung satu komponen, memilih
                        opsi lain MENGGANTI yang sekarang — jadi tombolnya tidak
                        boleh menjanjikan "tambah". */}
                    {allowMultiple ? "Tambah / Ganti Opsi" : "Ganti Opsi"}
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="mt-3 flex items-center justify-end">
              {isSelected ? (
                <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-full border border-border/50 shadow-sm">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-full bg-background hover:bg-red-100 hover:text-red-600 shadow-sm cursor-pointer active:scale-95 transition-all"
                    onClick={() => onUpdateQuantity(quantity - 1)}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="text-xs font-bold w-4 text-center">{quantity}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-full bg-background hover:bg-brand-green/20 hover:text-brand-green shadow-sm cursor-pointer active:scale-95 transition-all disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => onUpdateQuantity(quantity + 1)}
                    disabled={quantity >= product.stock}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  onClick={onSelect}
                  disabled={product.stock === 0}
                  className="h-7 px-4 text-[10px] font-bold rounded-full transition-all duration-300 cursor-pointer bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20"
                >
                  Select
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
