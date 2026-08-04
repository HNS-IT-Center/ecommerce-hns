import "server-only"

import { createHash } from "crypto"

import { getPrisma } from "@/lib/prisma/client"

export type QuoteLineItem = {
  productId: number
  name: string
  sku: string | null
  image?: string
  price: number
  quantity: number
  stepName: string | null
}

/**
 * Sidik jari isi rakitan. Dihitung dari pasangan `productId:qty` yang DIURUTKAN
 * lebih dulu, supaya urutan pemilihan komponen tidak menghasilkan hash berbeda
 * untuk rakitan yang sebenarnya identik.
 */
function computeContentHash(items: QuoteLineItem[]): string {
  const normalized = items
    .map((item) => `${item.productId}:${item.quantity}`)
    .sort()
    .join(",")

  return createHash("sha256").update(normalized).digest("hex")
}

/**
 * `HNSPC-260804-7K3M` — tanggal terbit + 4 karakter dari hash.
 *
 * Sengaja BUKAN nomor berurutan: urutan seperti HNSPC00001 membocorkan berapa
 * banyak quotation yang sudah pernah dibuat kepada siapa pun yang memegang dua
 * dokumen berbeda.
 */
function buildQuoteCode(contentHash: string, issuedAt: Date): string {
  const yy = String(issuedAt.getFullYear()).slice(-2)
  const mm = String(issuedAt.getMonth() + 1).padStart(2, "0")
  const dd = String(issuedAt.getDate()).padStart(2, "0")

  // Base36 dari potongan hash: 0-9 + A-Z, mudah dibaca & diketik ulang.
  const suffix = parseInt(contentHash.slice(0, 8), 16)
    .toString(36)
    .toUpperCase()
    .padStart(4, "0")
    .slice(-4)

  return `HNSPC-${yy}${mm}${dd}-${suffix}`
}

/**
 * Catat quotation, atau naikkan penghitung kalau rakitan yang sama sudah pernah
 * dicetak. Mengembalikan kode & snapshot yang tersimpan.
 *
 * Kegagalan di sini TIDAK boleh menggagalkan pencetakan — dokumen tetap harus
 * bisa keluar walau pencatatan gagal, jadi pemanggilnya menangani error.
 */
export async function recordPcBuildQuote(items: QuoteLineItem[]) {
  const prisma = getPrisma()
  const contentHash = computeContentHash(items)

  const existing = await prisma.pcBuildQuote.findUnique({ where: { contentHash } })

  if (existing) {
    const updated = await prisma.pcBuildQuote.update({
      where: { contentHash },
      data: {
        printCount: { increment: 1 },
        lastPrintedAt: new Date(),
      },
    })
    return { code: updated.code, isNew: false }
  }

  const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0)
  const issuedAt = new Date()

  const created = await prisma.pcBuildQuote.create({
    data: {
      code: buildQuoteCode(contentHash, issuedAt),
      contentHash,
      items,
      subtotal,
      // Jasa rakit sekarang jadi step biasa di PC Builder, jadi nilainya sudah
      // ikut di `subtotal`. Kolomnya dipertahankan untuk membaca quotation lama
      // yang biayanya masih terpisah.
      assemblyFee: 0,
      total: subtotal,
      itemCount: items.length,
      createdAt: issuedAt,
      lastPrintedAt: issuedAt,
    },
  })

  return { code: created.code, isNew: true }
}

/** Dipakai halaman verifikasi publik /q/[code]. */
export async function getQuoteByCode(code: string) {
  const prisma = getPrisma()
  return prisma.pcBuildQuote.findUnique({
    where: { code: code.toUpperCase() },
  })
}
