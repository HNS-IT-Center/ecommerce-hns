"use client"

import Image from "next/image"

import { cn } from "@/lib/utils"
import { optionKey } from "@/features/product/lib/get-unavailable-options"
import type { VariantAttribute } from "./product-variant-selector"
import type { ProductVariation } from "@/types/woocommerce"

/** Sasaran gulungan dari tombol keranjang di bar aksi mengambang (mobile). */
export const VARIANT_STRIP_ID = "product-variant-strip"

type ProductVariantStripProps = {
  attributes: VariantAttribute[]
  variations: ProductVariation[]
  selected: Record<string, string>
  onSelect: (attributeName: string, option: string) => void
  /** Gambar produk induk, dipakai varian yang tidak punya fotonya sendiri. */
  fallbackImage?: string
  /**
   * Kombinasi yang tidak ada di katalog, dari `getUnavailableOptions`. Dihitung
   * di induk supaya strip ini dan pemilih desktop memakai hasil yang sama.
   */
  unavailableOptions?: Set<string>
  isHighlighted?: boolean
}

/** Membandingkan nilai atribut apa adanya dari Woo — spasi dan kapital bebas. */
const sameOption = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * Pemilih varian bergaya marketplace untuk mobile.
 *
 * Menggantikan deretan thumbnail foto yang dulu ada di bawah galeri. Alasannya
 * ruang: di layar ponsel, baris di bawah gambar adalah tempat paling mahal di
 * halaman, dan mengisinya dengan foto-foto yang sudah bisa dijangkau lewat
 * geseran berarti membayar tempat itu untuk sesuatu yang mubazir. Penanda
 * "3/7" di sudut gambarlah yang kini memberi tahu masih ada foto lain.
 *
 * Atribut PERTAMA ditampilkan sebagai foto, sisanya sebagai tombol teks. Foto
 * melekat pada varian utuh (mis. MERAH+XL), bukan pada satu nilai atribut, jadi
 * menampilkan semuanya sebagai foto akan melahirkan deretan gambar kembar untuk
 * produk dua-atribut — 12 kotak untuk 3 warna × 4 ukuran, yang sebelas di
 * antaranya terlihat sama.
 */
export function ProductVariantStrip({
  attributes,
  variations,
  selected,
  onSelect,
  fallbackImage,
  unavailableOptions,
  isHighlighted = false,
}: ProductVariantStripProps) {
  if (attributes.length === 0) return null

  const [primary, ...rest] = attributes

  /**
   * Foto wakil untuk sebuah nilai atribut, mis. foto untuk "MERAH".
   *
   * Nilai atribut sendiri tidak punya gambar di WooCommerce — yang punya adalah
   * varian. Jadi diambil varian pertama yang memuat nilai ini dan benar-benar
   * membawa fotonya sendiri. Pilihan lain yang sedang aktif ikut dihormati
   * lebih dulu, supaya pembeli yang sudah memilih "XL" melihat foto MERAH-XL
   * dan bukan MERAH-S.
   *
   * 877 varian di katalog ini mewarisi gambar induk dan tidak menyimpan foto
   * sendiri; untuk mereka fungsi ini jatuh ke gambar induk, dan kotaknya
   * dibedakan lewat cincin pilihan serta label yang muncul saat ditekan.
   */
  const imageForOption = (option: string): string | undefined => {
    const matching = variations.filter((variation) =>
      variation.attributes.some(
        (attr) => sameOption(attr.name, primary.name) && sameOption(attr.option, option),
      ),
    )

    const honoringOtherChoices = matching.find((variation) =>
      rest.every((attr) => {
        const chosen = selected[attr.name]
        if (!chosen) return true
        return variation.attributes.some(
          (a) => sameOption(a.name, attr.name) && sameOption(a.option, chosen),
        )
      }),
    )

    return (
      honoringOtherChoices?.image?.src ??
      matching.find((variation) => variation.image?.src)?.image?.src ??
      fallbackImage
    )
  }

  return (
    <div
      id={VARIANT_STRIP_ID}
      className={cn(
        "scroll-mt-20 space-y-4 rounded-xl transition-all duration-300",
        isHighlighted &&
          "bg-brand-green/5 p-3 ring-2 ring-brand-green ring-offset-2 ring-offset-background",
      )}
    >
      <div>
        {/* Nama atribut selalu tampil, nilainya menyusul setelah dipilih.
            Tanpa judulnya, deretan foto tanpa keterangan tidak memberi tahu
            pembeli sedang memilih apa. */}
        <div className="px-4 text-sm font-semibold text-foreground">
          {primary.name}
          {selected[primary.name] && (
            <span className="ml-2 font-normal text-muted-foreground">
              {selected[primary.name]}
            </span>
          )}
        </div>

        {/* Padding horizontalnya dipasang di dalam wadah yang menggulung, bukan
            di luarnya, supaya kotak pertama dan terakhir tetap punya jarak dari
            tepi layar saat digulung sampai mentok.

            `py-2` (bukan `pb-1`) memberi ruang di ATAS kotak juga. Wadah ini
            `overflow-x-auto`, yang ikut memotong luapan vertikal — jadi cincin
            pilihan (`ring-2` + `ring-offset-2`, total 4px di luar tepi kotak)
            terpotong rata di sisi atas begitu sebuah varian dipilih. */}
        <div className="mt-2 flex gap-3 overflow-x-auto px-4 py-2 scrollbar-hide">
          {primary.options.map((option) => {
            const isActive = selected[primary.name] === option
            const src = imageForOption(option)
            const isUnavailable =
              unavailableOptions?.has(optionKey(primary.name, option)) ?? false

            return (
              <button
                key={option}
                type="button"
                onClick={() => onSelect(primary.name, option)}
                disabled={isUnavailable}
                aria-pressed={isActive}
                aria-label={`${primary.name}: ${option}${isUnavailable ? " (tidak tersedia)" : ""}`}
                /* Kotak yang kombinasinya tidak ada dipudarkan dan diberi garis
                   miring — foto yang cuma diredupkan masih terbaca sebagai
                   pilihan yang sah di layar kecil. */
                className={cn(
                  "relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-background drop-shadow-sm transition-all",
                  isUnavailable
                    ? "cursor-not-allowed opacity-40 ring-1 ring-border"
                    : isActive
                      ? "ring-2 ring-brand-green ring-offset-2 ring-offset-background"
                      : "opacity-80 ring-1 ring-border",
                )}
              >
                {src ? (
                  <Image
                    src={src}
                    alt=""
                    fill
                    sizes="64px"
                    className="pointer-events-none object-cover p-1"
                  />
                ) : (
                  // Varian tanpa foto DAN tanpa gambar induk untuk dipinjam.
                  // Namanya ditulis di kotak supaya tetap bisa dibedakan.
                  <span className="flex h-full w-full items-center justify-center px-1 text-center text-[10px] font-semibold leading-tight text-muted-foreground">
                    {option}
                  </span>
                )}

                {/* Garis miring dari pojok ke pojok, digambar dengan gradien
                    supaya tidak perlu elemen SVG tambahan per kotak.

                    Warnanya menunjuk `var(--muted-foreground)` langsung, bukan
                    lewat `theme()`: proyek ini memakai Tailwind v4, tempat
                    warna memang sudah berupa custom property dan helper
                    `theme()` gaya v3 tidak lagi dievaluasi. */}
                {isUnavailable && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top_right,transparent_calc(50%-1px),var(--muted-foreground)_50%,transparent_calc(50%+1px))] opacity-60"
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Atribut selain yang pertama: tombol teks. Ukuran dan kapasitas jarang
          mengubah rupa barang, jadi foto tidak menambah apa pun di sini. */}
      {rest.map((attr) => (
        <div key={attr.name} className="px-4">
          <div className="text-sm font-semibold text-foreground">
            {attr.name}
            {selected[attr.name] && (
              <span className="ml-2 font-normal text-muted-foreground">{selected[attr.name]}</span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {attr.options.map((option) => {
              const isActive = selected[attr.name] === option
              const isUnavailable =
                unavailableOptions?.has(optionKey(attr.name, option)) ?? false

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => onSelect(attr.name, option)}
                  disabled={isUnavailable}
                  aria-pressed={isActive}
                  className={cn(
                    "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                    isUnavailable
                      ? "cursor-not-allowed border-border/60 bg-muted/40 text-muted-foreground/50 line-through"
                      : isActive
                        ? "border-brand-green bg-brand-green/10 text-brand-green"
                        : "border-border text-foreground hover:border-brand-green/50",
                  )}
                >
                  {option}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
