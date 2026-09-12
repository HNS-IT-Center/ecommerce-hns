"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ArrowLeft, ImageOff, Layers } from "lucide-react"

import { ProductGallery, type GalleryImage } from "@/features/product/components/product-gallery"
import { useAddToCartToast } from "@/features/cart/hooks/use-add-to-cart-toast"
import type { PrebuildGame } from "@/lib/pc-prebuild/games"
import { useCartStore } from "@/store/cart"

import {
  builderUrl,
  selectionTotal,
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
 * katalog. Tidak ada perkalian, persentase, atau potongan; satu-satunya
 * potongan yang sah adalah `salePrice` katalog, dan itu sudah ikut di harga
 * satuannya (CLAUDE.md §2.7, docs/11-pc-prebuild.md §3).
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

  const total = useMemo(() => selectionTotal(view, selection), [view, selection])
  const href = useMemo(() => builderUrl(view, selection), [view, selection])
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

  function pilih(componentKey: string, productId: number) {
    setSelection((sebelum) => ({ ...sebelum, [componentKey]: productId }))
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
        <div className="lg:sticky lg:top-24 lg:self-start">
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
            <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{view.name}</h1>
            {view.summary && (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground md:text-base">
                {view.summary}
              </p>
            )}
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
        total={total}
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
