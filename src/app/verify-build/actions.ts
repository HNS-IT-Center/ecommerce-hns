"use server"

import { getQuoteByCode } from "@/lib/api/pc-build-quotes"
import { getPrisma } from "@/lib/prisma/client"

export type VerifiedQuoteItem = {
  productId: number
  name: string
  sku: string | null
  stepName: string | null
  price: number
  quantity: number
  subtotal: number
  currentPrice: number | null
  changed: boolean
}

export type VerifiedQuote = {
  code: string
  createdAt: string
  printCount: number
  items: VerifiedQuoteItem[]
  subtotal: number
  assemblyFee: number
  total: number
  currentTotal: number
  hasChanges: boolean
}

export type LookupResult =
  | { ok: true; quote: VerifiedQuote }
  | { ok: false; error: string }

/**
 * Cari quotation berdasarkan kode tiket (mis. HNSPC-260804-VVGT) dan bandingkan
 * harga saat dokumen dicetak dengan harga terkini di katalog.
 */
export async function lookupBuildQuote(rawCode: string): Promise<LookupResult> {
  const code = rawCode.trim().toUpperCase()

  if (!code) {
    return { ok: false, error: "Masukkan kode quotation terlebih dahulu." }
  }

  if (!/^HNSPC-\d{6}-[A-Z0-9]{4}$/.test(code)) {
    return {
      ok: false,
      error: "Format kode tidak sesuai. Contoh yang benar: HNSPC-260804-VVGT",
    }
  }

  try {
    const quote = await getQuoteByCode(code)
    if (!quote) {
      return { ok: false, error: `Quotation dengan kode ${code} tidak ditemukan.` }
    }

    const items = quote.items as unknown as Array<{
      productId: number
      name: string
      sku: string | null
      stepName: string | null
      price: number
      quantity: number
    }>

    const prisma = getPrisma()
    const current = await prisma.product.findMany({
      where: { id: { in: items.map((i) => i.productId) } },
      select: { id: true, regularPrice: true, salePrice: true },
    })

    const currentPriceById = new Map(
      current.map((p) => {
        const sale = p.salePrice ? Number(p.salePrice) : 0
        const regular = p.regularPrice ? Number(p.regularPrice) : 0
        return [p.id, sale > 0 ? sale : regular]
      })
    )

    const mapped: VerifiedQuoteItem[] = items.map((item) => {
      const currentPrice = currentPriceById.get(item.productId) ?? null
      return {
        ...item,
        subtotal: item.price * item.quantity,
        currentPrice,
        changed: currentPrice !== null && currentPrice !== item.price,
      }
    })

    const assemblyFee = Number(quote.assemblyFee)
    const currentTotal =
      mapped.reduce((acc, i) => acc + (i.currentPrice ?? i.price) * i.quantity, 0) + assemblyFee

    return {
      ok: true,
      quote: {
        code: quote.code,
        createdAt: quote.createdAt.toISOString(),
        printCount: quote.printCount,
        items: mapped,
        subtotal: Number(quote.subtotal),
        assemblyFee,
        total: Number(quote.total),
        currentTotal,
        hasChanges: mapped.some((i) => i.changed),
      },
    }
  } catch (error) {
    console.error("[verify-build] gagal mencari quotation:", error)
    return { ok: false, error: "Terjadi kesalahan saat mengambil data. Coba lagi." }
  }
}
