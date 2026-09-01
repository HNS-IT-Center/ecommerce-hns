"use client"

import { useEffect, useState } from "react"
import { Check, ExternalLink, Loader2, Plus } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatRupiah } from "@/lib/utils"
import { stripHtml, stripRedundantProductNameHeading } from "@/lib/utils/html"
import type { BuilderProduct, BuilderVariation } from "@/store/new-builder"
import {
  ProductGallery,
  type GalleryImage,
} from "@/features/product/components/product-gallery"
import { fetchBuilderProductDescription } from "../actions"
import { VariationList } from "./variation-list"

type BuilderQuickViewDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Kartu yang sedang dipratinjau. Boleh `null` — dan pemanggilnya WAJIB tetap
   * merender komponen ini saat null. Lihat catatan "Selalu ter-mount" di
   * `variation-picker-dialog.tsx`; alasannya sama persis.
   */
  product: BuilderProduct | null
  /** Jumlah seluruh baris rakitan di langkah aktif yang berasal dari kartu ini. */
  selectedQuantity: number
  /** Id varian dari kartu ini yang sudah masuk rakitan pada langkah aktif. */
  selectedVariationIds: number[]
  /** Langkah aktif boleh menampung lebih dari satu komponen (`step.allowMultiple`). */
  allowMultiple: boolean
  /** Masukkan produk BIASA ini ke rakitan. Tidak dipakai untuk produk bervarian. */
  onSelect: () => void
  /** Satu varian dipilih dari daftar di dalam pratinjau ini. */
  onPickVariation: (variation: BuilderVariation) => void
}

/**
 * Quick Preview untuk kartu komponen di PC Builder.
 *
 * Diminta tim sales: sebelum memasukkan komponen ke rakitan, mereka perlu
 * membaca deskripsi produknya tanpa meninggalkan wizard — keluar ke halaman
 * produk berarti kehilangan langkah yang sedang dikerjakan.
 *
 * Bedanya dengan Quick View katalog (`components/ui/quick-view-modal.tsx`):
 * tidak ada "Tambah ke Keranjang" di sini. Tombolnya memilih komponen ke
 * rakitan, karena itulah satu-satunya aksi yang masuk akal di dalam wizard.
 * Komponen katalog itu sengaja tidak dipakai ulang — ia terikat ke
 * `useCartStore` dan ke bentuk `Product` yang berbeda dari `BuilderProduct`,
 * dan ia dipakai di sebelas tempat lain yang tidak boleh ikut terguncang.
 *
 * ## Kenapa daftar varian ada DI DALAM sini, bukan membuka VariationPickerDialog
 *
 * Dialog di project ini TIDAK BOLEH dirantai. `useBackToClose` mendorong satu
 * entri riwayat boneka saat dialog dibuka dan memanggil `history.back()` saat
 * ditutup. Menutup pratinjau ini sambil membuka pemilih varian pada render yang
 * sama membuat urutannya begini: cleanup pratinjau memanggil `history.back()`
 * (tugasnya ditunda), lalu pemilih varian mendorong entri barunya, lalu
 * `popstate` menyala dan justru memakan entri milik pemilih varian — dialognya
 * tertutup pada detik yang sama ia dibuka, tanpa error apa pun di layar.
 *
 * Rantai `StartNewBuildDialog` ke `SaveBuildDialog` yang sudah ada aman karena
 * `AlertDialog` tidak memakai hook itu; rantai antar `Dialog` tidak.
 *
 * Karena itu varian dipilih langsung di sini lewat `VariationList` — komponen
 * yang sama yang dipakai `VariationPickerDialog`, jadi harga dan status stok
 * per varian tidak mungkin berbeda antara dua layar itu.
 *
 * ## Harga
 *
 * Seluruh angka di layar ini dibaca apa adanya dari katalog (`product.price`,
 * `regularPrice`, `salePrice`) — tidak ada satu pun harga yang diturunkan dari
 * rumus (CLAUDE.md §2.7). Persentase diskon boleh dihitung karena ia keterangan
 * atas selisih dua angka katalog, bukan sumber potongannya.
 */
export function BuilderQuickViewDialog({
  open,
  onOpenChange,
  product,
  selectedQuantity,
  selectedVariationIds,
  allowMultiple,
  onSelect,
  onPickVariation,
}: BuilderQuickViewDialogProps) {
  /**
   * Deskripsi dimuat saat pratinjau dibuka, bukan dibawa oleh kartu produk:
   * `description` bertipe MediumText dan satu halaman grid berisi 20 kartu,
   * jadi menyertakannya di depan berarti menarik ratusan KB HTML untuk modal
   * yang mungkin tidak pernah dibuka. Pola yang sama dipakai Quick View katalog
   * saat memuat variannya.
   */
  const [completed, setCompleted] = useState<{
    id: number
    description: string
    shortDescription: string
  } | null>(null)

  useEffect(() => {
    if (!open || !product) return

    let cancelled = false
    const id = product.id

    fetchBuilderProductDescription(id)
      .then((data) => {
        if (!cancelled) setCompleted({ id, ...data })
      })
      .catch(() => {
        // Gagal memuat deskripsi tidak boleh mengunci pratinjau — tombol pilih
        // komponennya tetap harus bisa dipakai.
        if (!cancelled) setCompleted({ id, description: "", shortDescription: "" })
      })

    return () => {
      cancelled = true
    }
  }, [open, product])

  const hasVariations = (product?.variations?.length ?? 0) > 0
  const isSelected = selectedQuantity > 0
  const isOutOfStock = (product?.stock ?? 0) <= 0

  // Nilai turunan, bukan setState di badan efek — pola yang sama dengan
  // `use-live-search.ts` dan `component-selection-modal.tsx`.
  const loadingDescription = !product || !completed || completed.id !== product.id
  const shortDescription = loadingDescription ? "" : completed.shortDescription
  const description =
    loadingDescription || !product
      ? ""
      : stripRedundantProductNameHeading(completed.description, product.name)

  // Kekosongan dinilai dari teks yang benar-benar TERLIHAT, bukan dari panjang
  // stringnya: sebagian deskripsi warisan WooCommerce berisi `<p>&nbsp;</p>`
  // atau tag kosong — panjangnya bukan nol, tapi layarnya tetap kosong. Aturan
  // yang sama dipakai `product-tabs.tsx` di halaman produk.
  const hasDescription =
    stripHtml(shortDescription).length > 0 || stripHtml(description).length > 0

  const hasDiscount = Boolean(
    product?.regularPrice && product?.salePrice && product.regularPrice > product.salePrice
  )
  const discountPercent =
    hasDiscount && product
      ? Math.round((1 - product.salePrice! / product.regularPrice!) * 100)
      : 0

  /**
   * Galeri dirakit dari gambar induk ditambah gambar tiap varian, tanpa
   * duplikat. Varian menyumbang label pembedanya supaya galeri bisa menandai
   * gambar itu milik opsi yang mana — persis seperti di halaman produk.
   */
  const galleryImages: GalleryImage[] = (() => {
    if (!product) return []
    const seen = new Set<string>()
    const images: GalleryImage[] = []

    const push = (src: string | undefined, variantLabel?: string) => {
      if (!src || seen.has(src)) return
      seen.add(src)
      images.push({ src, alt: product.name, variantLabel })
    }

    push(product.image)
    for (const variation of product.variations ?? []) push(variation.image, variation.label)

    return images.length > 0 ? images : [{ src: "/placeholder.jpg", alt: product.name }]
  })()

  /**
   * Label tombol untuk produk BIASA. Produk bervarian tidak memakainya — di
   * sana yang tampil adalah daftar opsinya.
   *
   * Kalau produk ini sudah masuk rakitan di langkah yang cuma menampung satu
   * komponen, tombolnya dimatikan alih-alih memanggil `selectProduct` lagi:
   * pemanggilan kedua mengembalikan kuantitasnya ke 1, dan pelanggan yang sudah
   * menaikkannya jadi 3 akan kehilangan angka itu tanpa pernah memintanya.
   * Pengatur kuantitasnya ada di kartu, tempat yang memang mengurus itu.
   */
  const selectDisabled = isOutOfStock || (isSelected && !allowMultiple)
  const selectLabel = isOutOfStock
    ? "Stok Habis"
    : isSelected
      ? allowMultiple
        ? "Tambah Lagi"
        : "Sudah Dipilih"
      : "Pilih Komponen"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] gap-0 overflow-hidden p-0 sm:max-w-[65vw] sm:rounded-xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{product?.name ?? ""}</DialogTitle>
          <DialogDescription>Pratinjau {product?.name ?? "komponen"}</DialogDescription>
        </DialogHeader>

        {/*
          SATU wadah gulung untuk seluruh isi dialog, di mobile maupun desktop.

          Dulu kolom kanan yang menggulir sendiri sementara pembungkus ini
          `overflow-hidden` — dan itu membuat roda mouse mati di sepanjang 40%
          kiri layar, karena galeri bukan wadah gulung dan induknya menolak
          meneruskan. Produk biasa tidak terlihat kena: isinya cukup pendek
          sehingga tidak pernah perlu digulir sama sekali.

          `overscroll-contain` di sini sengaja dipertahankan — ini lapisan
          terluar, tugasnya menahan gulungan supaya tidak bocor ke halaman di
          belakang dialog.
        */}
        <div className="flex max-h-[85vh] flex-col overflow-y-auto overscroll-contain md:flex-row md:items-start">
          {/* Kiri: galeri. `md:self-start` diperlukan supaya `sticky` berfungsi —
              flex item yang meregang penuh setinggi barisnya tidak punya ruang
              untuk menempel pada apa pun. */}
          <div className="relative flex w-full shrink-0 items-center justify-center bg-secondary/10 p-5 md:sticky md:top-0 md:w-[40%] md:self-start md:p-8">
            <div className="w-full max-w-md">
              {product && <ProductGallery images={galleryImages} />}
            </div>
          </div>

          {/* Kanan: keterangan + aksi */}
          <div className="flex w-full flex-col p-5 md:w-[60%] md:p-8">
            {product && (
              <>
                {/* `pr-8` di desktop: tombol X milik DialogContent duduk di
                    pojok kanan atas dialog, yang di layar lebar jatuh tepat di
                    atas kolom ini. */}
                {product.attributes.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1 md:pr-8">
                    {product.attributes.map((attr) => (
                      <Badge
                        key={`${attr.attributeId}-${attr.valueId}`}
                        variant="secondary"
                        className="bg-red-600 px-1.5 py-0 text-[9px] font-medium text-white hover:bg-red-700"
                      >
                        {attr.valueName}
                      </Badge>
                    ))}
                  </div>
                )}

                <h2 className="mb-3 text-lg font-semibold leading-tight text-foreground md:pr-8 md:text-2xl">
                  {product.name}
                </h2>

                <div className="mb-4 flex items-center justify-between border-b border-border pb-4 text-sm">
                  <span className="text-muted-foreground">Status Stok</span>
                  <span className="font-semibold text-foreground">
                    {isOutOfStock ? "Habis" : "Tersedia"}
                  </span>
                </div>

                {/* Harga katalog apa adanya. Untuk kartu induk bervarian,
                    angkanya adalah harga varian TERMURAH yang masih ada
                    stoknya — karena itu diberi keterangan "Mulai dari", sama
                    seperti di kartunya. */}
                <div className="mb-5">
                  {hasVariations && (
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Mulai dari
                    </div>
                  )}
                  {hasDiscount ? (
                    <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
                      <div className="text-2xl font-bold text-sale-red md:text-3xl">
                        {formatRupiah(product.price)}
                      </div>
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-sm text-muted-foreground line-through">
                          {formatRupiah(product.regularPrice!)}
                        </span>
                        <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-xs font-bold text-sale-red">
                          -{discountPercent}%
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-2xl font-bold text-foreground md:text-3xl">
                      {formatRupiah(product.price)}
                    </div>
                  )}
                </div>

                {/* Deskripsi. Tingginya dibatasi dan menggulir sendiri: sebagian
                    deskripsi warisan WooCommerce panjangnya ribuan kata, dan
                    tanpa batas ini tombol pilih komponen terdorong jauh ke bawah
                    layar — persis hal yang membuat pratinjau ini tidak berguna.

                    Kotaknya sengaja TANPA `overscroll-contain`: ia cuma satu
                    blok kecil di tengah dialog, bukan isi utamanya. Dengan
                    `contain`, roda mouse di atasnya berhenti total begitu
                    deskripsinya mentok — pembaca terjebak di kotak setinggi
                    200px dan tidak bisa turun ke daftar opsi di bawahnya.
                    Dibiarkan meneruskan, gulungan lanjut ke dialog begitu
                    deskripsinya habis, dan lapisan terluar yang menahannya
                    supaya tidak bocor ke halaman di belakang. */}
                <div className="mb-5">
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Deskripsi
                  </h3>
                  {loadingDescription ? (
                    <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Memuat deskripsi...
                    </div>
                  ) : hasDescription ? (
                    <div className="prose prose-sm max-h-[200px] max-w-none overflow-y-auto pr-2 md:max-h-[240px]">
                      {shortDescription && (
                        <div
                          className="mb-3 leading-relaxed text-muted-foreground"
                          dangerouslySetInnerHTML={{ __html: shortDescription }}
                        />
                      )}
                      <div dangerouslySetInnerHTML={{ __html: description }} />
                    </div>
                  ) : (
                    <p className="py-2 text-sm text-muted-foreground">
                      Belum ada deskripsi untuk produk ini.
                    </p>
                  )}
                </div>

                {/* Aksi: pilih komponen. Untuk produk bervarian, yang masuk
                    rakitan adalah VARIANNYA — kartu induk tidak pernah masuk
                    tanpa varian, karena harga induknya sering nol dan bukan
                    harga barang mana pun. */}
                <div className="pt-1">
                  {hasVariations ? (
                    <>
                      <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Pilih Opsi
                      </h3>
                      {/* Mengalir apa adanya, TANPA kotak gulung sendiri —
                          beda dari `VariationPickerDialog`, di mana daftar ini
                          memang satu-satunya isi dialog. Di sini ia berbagi
                          ruang dengan deskripsi, dan kotak gulung kedua di
                          dalam kolom yang sudah menggulir hanya membuat roda
                          mouse berebut wadah. */}
                      <VariationList
                        variations={product.variations ?? []}
                        selectedVariationIds={selectedVariationIds}
                        onPick={onPickVariation}
                        fallbackImage={product.image}
                      />
                    </>
                  ) : (
                    <Button
                      onClick={onSelect}
                      disabled={selectDisabled}
                      className="h-11 w-full cursor-pointer rounded-lg bg-blue-600 text-sm font-bold text-white shadow-md shadow-blue-600/20 transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSelected && !allowMultiple ? (
                        <Check className="h-4 w-4" strokeWidth={3} />
                      ) : (
                        !isOutOfStock && <Plus className="h-4 w-4" strokeWidth={3} />
                      )}
                      {selectLabel}
                    </Button>
                  )}

                  {/* Tab baru, bukan navigasi biasa: rakitan yang sedang
                      dikerjakan memang selamat di localStorage, tapi melempar
                      orang keluar dari wizard di tengah langkah tetap membuatnya
                      harus mencari jalan kembali. */}
                  <div className="mt-3 flex justify-center">
                    <a
                      href={`/product/${product.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Lihat halaman produk lengkap
                    </a>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
