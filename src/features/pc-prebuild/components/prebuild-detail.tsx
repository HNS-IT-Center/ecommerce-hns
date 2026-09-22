"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ArrowLeft, FileDown, ImageOff, Layers } from "lucide-react"

import { ProductGallery, type GalleryImage } from "@/features/product/components/product-gallery"
import { useAddToCartToast } from "@/features/cart/hooks/use-add-to-cart-toast"
import type { PrebuildGame } from "@/lib/pc-prebuild/games"
import { useCartStore } from "@/store/cart"

import {
  builderUrl,
  printUrl,
  selectionPrice,
  toCartLines,
  type PrebuildSelection,
} from "../lib/selection"
import type { PrebuildView } from "../lib/types"
import { ComponentPicker } from "./component-picker"
import { PerformancePanel } from "./performance-panel"
import { PrebuildActionBar } from "./prebuild-action-bar"

/**
 * Halaman satu paket.
 *
 * Client Component karena pilihan tukar mengubah tiga hal sekaligus: daftar
 * komponen, total di bilah bawah, dan tautan ke wizard. Datanya sudah selesai
 * dihitung di server (`toPrebuildView`) — di sini tidak ada satu pun kueri.
 *
 * ## Harga
 *
 * Yang terjadi di sini cuma PENJUMLAHAN harga satuan yang dikirim server dari
 * katalog, dikurangi potongan paket yang ditetapkan staff (`packagePrice`).
 * Tidak ada perkalian atau persentase; potongan produk (`salePrice`) sudah ikut
 * di harga satuannya (CLAUDE.md §2.7, docs/11-pc-prebuild.md §3).
 *
 * ## Yang TIDAK dirender
 *
 * `bottleneck` dan saran upgrade — keduanya khusus panel admin/sudah dibuang
 * (docs/11-pc-prebuild.md §9). Keduanya juga tidak ikut menyeberang dari server:
 * `PrebuildView.performance` hanya memuat `performancePublic`.
 */

type Props = {
  view: PrebuildView
  games: PrebuildGame[]
}

export function PrebuildDetail({ view, games }: Props) {
  const [selection, setSelection] = useState<PrebuildSelection>({})
  const addBundle = useCartStore((s) => s.addBundle)
  const cartItems = useCartStore((s) => s.items)
  const toast = useAddToCartToast()

  const harga = useMemo(() => selectionPrice(view, selection), [view, selection])
  const href = useMemo(() => builderUrl(view, selection), [view, selection])
  const pdfHref = useMemo(() => printUrl(view, selection), [view, selection])
  const lines = useMemo(() => toCartLines(view, selection), [view, selection])

  /**
   * Kombinasi yang SEDANG dipilih ini sudah di keranjang atau belum. Kombinasi
   * lain dari paket yang sama berdiri sebagai blok tersendiri, jadi memeriksanya
   * lewat kunci — bukan lewat id preset.
   *
   * Kuncinya diambil eksplisit, bukan dari `lines[0]`: paket yang SELURUH
   * komponennya hilang dari katalog menghasilkan `lines` kosong, dan
   * membandingkan `item.bundle?.key` dengan `undefined` akan cocok dengan setiap
   * barang biasa di keranjang — tombolnya lalu berbunyi "Tambah Lagi" untuk
   * paket yang belum pernah dimasukkan.
   */
  const kunciPaket = lines[0]?.bundle?.key ?? null
  const sudahDiKeranjang =
    kunciPaket !== null && cartItems.some((item) => item.bundle?.key === kunciPaket)

  const galeri: GalleryImage[] = view.images.map((src) => ({ src, alt: view.name }))

  function pilih(componentKey: string, id: number) {
    setSelection((sebelum) => ({ ...sebelum, [componentKey]: id }))
  }

  function masukkanKeranjang() {
    if (lines.length === 0) return
    addBundle(lines)
    toast(view.name)
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-10">
      <Link
        href="/pc-prebuild"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Semua paket
      </Link>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
        {/* `min-w-0`: butir grid bawaannya tidak boleh menyusut di bawah lebar
            intrinsik isinya, dan galeri di dalamnya membawa kanvas selebar
            layar. Tanpa ini, kolom yang memaksa dirinya lebih lebar dari grid
            akan terpotong diam-diam oleh `overflow-x-clip` di html/body —
            kolom kanan sudah memilikinya sejak awal. */}
        <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          {galeri.length > 0 ? (
            <ProductGallery images={galeri} />
          ) : (
            // Paket tanpa foto tetap punya halaman yang utuh — daftar
            // komponennya yang menjelaskan isinya (docs/11-pc-prebuild.md §6).
            <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed text-muted-foreground">
              <ImageOff className="h-10 w-10" strokeWidth={1.25} />
              <span className="text-sm">Foto rakitan belum tersedia</span>
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-6">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight break-words md:text-3xl">{view.name}</h1>
            {view.summary && (
              <p className="mt-2 text-justify text-sm leading-relaxed text-muted-foreground break-words hyphens-auto md:text-base">
                {view.summary}
              </p>
            )}

            {/* Lembar cetak dibuka di tab baru dan langsung memanggil dialog
                cetak — di sana pelanggan memilih "Simpan sebagai PDF", lalu
                membagikan berkasnya dari HP/PC. Pilihan tukar yang sedang aktif
                ikut terbawa, begitu juga harganya. Tidak dicatat sebagai
                quotation (lihat app/pc-prebuild/[id]/print/page.tsx). */}
            <a
              href={pdfHref}
              target="_blank"
              rel="noopener"
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl border bg-card px-4 text-sm font-bold transition-colors hover:border-brand-green hover:text-brand-green"
            >
              <FileDown className="h-4 w-4" />
              Bagikan PDF
            </a>
          </div>

          {view.performance ? (
            <PerformancePanel performance={view.performance} games={games} />
          ) : (
            // Tidak ada panel kosong berisi "belum dianalisis": itu memberi tahu
            // pelanggan tentang pekerjaan internal HNS yang bukan urusannya.
            <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              Perkiraan performa untuk paket ini belum tersedia. Hubungi kami kalau Anda punya
              target FPS atau kebutuhan tertentu — teknisi kami bisa membantu menilainya.
            </p>
          )}
        </div>
      </div>

      <section className="mt-10">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Layers className="h-5 w-5 text-brand-green" />
          Isi Paket
          <span className="text-sm font-normal text-muted-foreground">
            ({view.components.length} komponen)
          </span>
        </h2>

        {view.branchingCount > 0 && (
          <p className="mt-1.5 text-sm text-muted-foreground">
            Beberapa komponen punya pilihan. Yang Anda pilih di sini ikut terbawa, baik saat
            dimasukkan ke keranjang maupun saat dibuka di PC Builder.
          </p>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {view.components.map((component) => (
            <ComponentPicker
              key={component.key}
              component={component}
              selection={selection}
              onSelect={pilih}
            />
          ))}
        </div>
      </section>

      <PrebuildActionBar
        price={harga}
        discountEndsAt={view.discountEndsAt}
        missingCount={view.missingCount}
        onAddToCart={masukkanKeranjang}
        added={sudahDiKeranjang}
        // Paket yang tidak menyisakan satu komponen pun tidak bisa dipesan —
        // tombolnya dimatikan, bukan mengirim keranjang kosong ke CS.
        disabled={lines.length === 0}
        builderHref={href}
      />
    </div>
  )
}
