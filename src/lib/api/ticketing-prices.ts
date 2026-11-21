import "server-only"

import { ProductStatus, ProductType } from "@prisma/client"
import { env } from "@/config/env"
import { getPrisma } from "@/lib/prisma/client"
import { resolveCatalogPrice } from "@/lib/api/woocommerce/cart-pricing"
import { decodeHtmlEntities } from "@/lib/utils/html"

/**
 * Harga jual web per kode Accurate untuk aplikasi Ticketing HNS — docs/17 §23.
 *
 * Aturan owner: part yang dijual di website dicatat teknisi dengan harga
 * website. `products.accurate_code` adalah satu-satunya kunci yang sama di
 * kedua sistem. Jalur ini HANYA MEMBACA.
 *
 * **Yang TIDAK PERNAH ikut:** stok, harga modal (CP / `accurate_products`),
 * dan data pelanggan apa pun. Kolom dipilih satu per satu di `select` — jangan
 * diganti spread baris, supaya kolom baru tidak ikut terkirim tanpa keputusan.
 *
 * Kode yang tidak dijawab (Ticketing membacanya "tidak ada di website"):
 * - tidak tertaut ke produk mana pun;
 * - produknya bukan PUBLISHED — untuk varian, induknya juga wajib PUBLISHED;
 * - tanpa harga normal (kosong atau 0);
 * - induk produk bervarian (VARIABLE): harganya ada di varian. Sejak 20 Okt
 *   2026 induk tidak bisa ditautkan lagi; ini menjaga sisa tautan lama.
 *
 * Varian (VARIATION) DIJAWAB — kode Accurate memang ditautkan ke varian,
 * dan harganya pasti (keputusan 21 Nov 2026, berbeda dari brief awal Ticketing).
 */

export const MAX_PRICE_CODES = 100
/** Lebar kolom `accurate_code` (VarChar 50). Kode lebih panjang pasti cacat. */
const MAX_CODE_LENGTH = 50

export type TicketingPrice = {
  /** `Product.id` internal — BUKAN `wooId` (dua ruang id itu bertabrakan). */
  productId: number
  name: string
  url: string
  regularPrice: number
  /** `null` kalau diskon tidak berlaku (kosong, 0, atau sudah lewat tanggal). */
  salePrice: number | null
  saleEndsAt: string | null
  onSale: boolean
  /** Harga yang tampil dan dibayar di website saat ini — sama dengan keranjang. */
  price: number
}

export type TicketingPricesResponse = {
  checkedAt: string
  prices: Record<string, TicketingPrice>
}

/** Kolom `accurate_code` ber-collation tak peka huruf — pembanding ikut begitu. */
const keyOf = (code: string) => code.trim().toUpperCase()

/**
 * `?codes=` → daftar kode unik, atau `null` kalau tidak sah (400).
 * Trim, buang yang kosong, hapus dobel; sah kalau 1–100 kode.
 */
export function parseTicketingPriceCodes(raw: string | null): string[] | null {
  if (raw === null) return null
  const unique = new Map<string, string>()
  for (const part of raw.split(",")) {
    const code = part.trim()
    if (code === "") continue
    if (code.length > MAX_CODE_LENGTH) return null
    if (!unique.has(keyOf(code))) unique.set(keyOf(code), code)
  }
  if (unique.size === 0 || unique.size > MAX_PRICE_CODES) return null
  return [...unique.values()]
}

const rupiah = (n: number) => Math.round(n)

export async function getTicketingPrices(codes: string[]): Promise<TicketingPricesResponse> {
  const checkedAt = new Date().toISOString()
  const rows = await getPrisma().product.findMany({
    where: { accurateCode: { in: codes } },
    select: {
      id: true,
      name: true,
      slug: true,
      sku: true,
      type: true,
      status: true,
      accurateCode: true,
      regularPrice: true,
      salePrice: true,
      saleEndDate: true,
      parent: { select: { slug: true, status: true } },
    },
  })

  const requested = new Map(codes.map((c) => [keyOf(c), c]))
  const origin = env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "")
  const prices: Record<string, TicketingPrice> = {}

  for (const row of rows) {
    const code = requested.get(keyOf(row.accurateCode ?? ""))
    if (!code) continue
    if (row.status !== ProductStatus.PUBLISHED) continue
    if (row.type === ProductType.VARIABLE) continue

    const isVariation = row.type === ProductType.VARIATION
    // Varian tanpa induk tayang tidak bisa dibeli siapa pun.
    if (isVariation && row.parent?.status !== ProductStatus.PUBLISHED) continue

    const regular = Number(row.regularPrice ?? 0)
    if (!(regular > 0)) continue

    // Aturan yang SAMA dengan keranjang/checkout — jangan disalin.
    const { price, saleActive } = resolveCatalogPrice(row.regularPrice, row.salePrice, row.saleEndDate)

    const pageSlug = isVariation ? row.parent!.slug : row.slug
    const url = `${origin}/product/${pageSlug}${isVariation && row.sku ? `?sku=${encodeURIComponent(row.sku)}` : ""}`

    prices[code] = {
      productId: row.id,
      name: decodeHtmlEntities(row.name),
      url,
      regularPrice: rupiah(regular),
      salePrice: saleActive ? rupiah(price) : null,
      saleEndsAt: saleActive && row.saleEndDate ? row.saleEndDate.toISOString() : null,
      onSale: saleActive,
      price: rupiah(price),
    }
  }

  return { checkedAt, prices }
}
