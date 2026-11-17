import "server-only"

import { env } from "@/config/env"
import { getPrisma } from "@/lib/prisma/client"
import { isMaster } from "@/lib/auth/permissions"
import { PUBLIC_TOKEN_PATTERN } from "@/lib/utils/public-token"
import { PC_BUILDER_SETTING_KEY, parsePcBuilderSteps, type PcBuilderStepKind } from "@/lib/pc-builder/config"
import type { QuoteLineItem } from "@/lib/api/pc-build-quotes"

/**
 * Isi quotation rakitan untuk aplikasi Ticketing HNS — docs/17 §20.
 *
 * Saat tiket "PC Build" dibuat, teknisi menarik daftar komponen dari sini,
 * bukan lagi dari teks PDF yang diunggah. Jalur ini HANYA MEMBACA: tidak
 * menandai, tidak mencatat status, tidak mengubah apa pun.
 *
 * **Setiap kolom dipilih satu per satu, dan itu satu-satunya penjaganya.**
 * Yang TIDAK BOLEH PERNAH ikut: `internalNote`, `contentHash`, id user mana pun
 * (owner, createdBy, closedBy, dpBy), `handoverSeenAt`, relasi `submissions`
 * (`pc_build_submissions`), dan riwayat revisi. Jangan mengganti `select` di
 * bawah dengan spread baris — kolom baru di tabel akan ikut terkirim ke server
 * lain tanpa ada yang memutuskannya.
 *
 * Nomor HP pelanggan SENGAJA ikut (keputusan pemilik project, 16 Nov 2026):
 * Ticketing adalah aplikasi internal staff, dan teknisi/CS perlu menghubungi
 * pelanggan soal rakitannya. Ini memperluas tabel privasi docs/17 §6 dengan
 * satu kolom "Ticketing".
 */

/** Satu baris komponen seperti yang diterima Ticketing. */
export type TicketingQuoteItem = {
  /** id INTERNAL produk (`products.id`), bukan wooId. */
  productId: number
  name: string
  /** Opsi varian, mis. "1TB · Hitam". `null` untuk komponen biasa. */
  variationLabel: string | null
  /** SKU di snapshot quotation — apa yang tercetak saat terbit. */
  sku: string | null
  /**
   * Kode Accurate SAAT INI, dibaca dari `products.accurate_code` lewat
   * `productId`. Bisa berbeda dengan `sku` kalau produknya ditautkan ulang
   * sesudah quotation terbit. `null` kalau produknya sudah dihapus atau belum
   * tertaut.
   */
  accurateCode: string | null
  quantity: number
  /** Harga satuan di revisi terakhir, Rupiah utuh. */
  unitPrice: number
  stepName: string | null
  /**
   * Jenis baris menurut pengaturan step SAAT INI di `/admin/pc-builder`.
   * `null` kalau step itu belum diatur, atau nama step di snapshot sudah tidak
   * ada di pengaturan (step diganti nama/dihapus) — Ticketing lalu menebak dari
   * `stepName`.
   */
  stepKind: PcBuilderStepKind | null
}

/**
 * Pemilik quotation (sales penerima operan, atau CS yang tidak mengoper) —
 * untuk menautkan tiket ke akun yang sama di Ticketing lewat SSO HNS.
 *
 * `ssoSub` adalah kunci yang dianjurkan: `sub` yang sama dengan yang diterima
 * Ticketing dari SSO. Ia baru terisi setelah staff itu pernah login ecommerce
 * lewat SSO (docs/19), jadi bisa `null` meski akunnya ada. `email` cadangan.
 *
 * TIDAK ada id akun ecommerce di sini — id user termasuk yang dilarang dikirim.
 */
export type TicketingQuoteSales = {
  email: string | null
  ssoSub: string | null
}

export type TicketingQuote = {
  code: string
  kind: "build" | "prebuild"
  prebuildName: string | null
  revision: number
  status: "terbit" | "closing"
  dpAt: string | null
  closedAt: string | null
  customer: { name: string | null; phone: string | null }
  salesName: string | null
  /**
   * `null` kalau quotation tanpa pemilik (akunnya dihapus) atau pemiliknya
   * sudah bukan staff (diturunkan jadi pelanggan saat resign).
   */
  sales: TicketingQuoteSales | null
  items: TicketingQuoteItem[]
  subtotal: number
  assemblyFee: number
  discount: number
  total: number
  /** URL absolut `/q/<publicToken>`; `null` untuk baris lama tanpa token. */
  publicUrl: string | null
  /** Kapan quotation pertama kali terbit. */
  createdAt: string
  /** Tanggal harga: `createdAt` revisi terakhir (bukan `updatedAt`, docs/17 §12). */
  pricedAt: string
  updatedAt: string
}

/**
 * Rapikan kode dari URL: buang spasi tepi, huruf besar. `null` kalau kosong
 * atau tidak berbentuk kode quotation.
 *
 * Karakter asing DITOLAK, bukan dibuang diam-diam: kode yang "dirapikan" bisa
 * berubah jadi kode quotation orang lain. Panjang 4–32 menampung kedua format
 * yang beredar ("HNSPC-260804-7K3M" dan "HNSPC-20260921-0001", nomor urut
 * boleh 5 digit) — tanpa mengunci formatnya, supaya format berikutnya tidak
 * mematahkan Ticketing.
 */
export function normalizeTicketingQuoteCode(raw: string): string | null {
  const code = raw.trim().toUpperCase()
  if (code.length < 4 || code.length > 32) return null
  if (!/^[A-Z0-9-]+$/.test(code)) return null
  return code
}

/**
 * Rupiah utuh dari Decimal(14,2) / angka snapshot.
 *
 * Harga di katalog selalu Rupiah utuh, jadi pembulatan di sini seharusnya tidak
 * pernah mengubah apa pun. Kalau suatu hari ada sen, nilainya tetap dibulatkan
 * supaya Ticketing selalu menerima integer — TAPI dicatat, tidak lolos senyap.
 */
/**
 * Token tautan publik `/q/<token>`, dirapikan seperti halaman `/q` sendiri:
 * spasi tepi dibuang, huruf kecil. `null` kalau bukan berbentuk token —
 * tanpa menyentuh database.
 */
export function normalizeTicketingPublicToken(raw: string): string | null {
  const token = raw.trim().toLowerCase()
  return PUBLIC_TOKEN_PATTERN.test(token) ? token : null
}

/** Pemilik → `sales`. Aturan "staff" sama dengan `isStaffAccount` di sso-link. */
function salesFor(owner: { email: string; ssoSub: string | null; role: string } | null): TicketingQuoteSales | null {
  if (!owner) return null
  if (owner.role === "pelanggan" && !isMaster({ email: owner.email })) return null
  return { email: owner.email, ssoSub: owner.ssoSub }
}

/** Kunci pencocokan nama step: spasi tepi & huruf besar-kecil tidak dihitung. */
function stepKey(name: string): string {
  return name.trim().toLowerCase()
}

/**
 * Nama step → jenisnya, dari pengaturan builder saat ini.
 *
 * Snapshot `items` hanya menyimpan NAMA step, bukan id-nya, jadi pencocokannya
 * lewat nama. Dibaca langsung dari DB, BUKAN lewat `getPcBuilderConfig()` yang
 * ber-cache 300 detik: respons ini `no-store`, dan jenis yang baru diubah staff
 * harus langsung terbaca Ticketing.
 *
 * Dua step bernama sama dengan jenis BERBEDA → nama itu tidak dipetakan sama
 * sekali (null), bukan "yang pertama menang" — lebih baik Ticketing menebak
 * daripada menerima jawaban yang bergantung pada urutan.
 */
async function readStepKinds(): Promise<Map<string, PcBuilderStepKind>> {
  const setting = await getPrisma().setting.findUnique({
    where: { key: PC_BUILDER_SETTING_KEY },
    select: { value: true },
  })
  const kinds = new Map<string, PcBuilderStepKind>()
  const bentrok = new Set<string>()
  for (const step of parsePcBuilderSteps(setting?.value ?? null)) {
    if (!step.kind) continue
    const key = stepKey(step.name)
    const sudah = kinds.get(key)
    if (sudah && sudah !== step.kind) bentrok.add(key)
    else kinds.set(key, step.kind)
  }
  for (const key of bentrok) kinds.delete(key)
  return kinds
}

function toRupiah(value: unknown, label: string, code: string): number {
  const n = Number(value)
  if (!Number.isFinite(n)) {
    console.warn(`[ticketing] ${code}: ${label} bukan angka (${String(value)}), dikirim 0`)
    return 0
  }
  const rounded = Math.round(n)
  if (rounded !== n) console.warn(`[ticketing] ${code}: ${label} ${n} punya pecahan, dibulatkan ke ${rounded}`)
  return rounded
}

function publicUrlFor(token: string | null): string | null {
  if (!token) return null
  // Dari env, bukan `resolveSiteUrl()` — yang itu selalu jatuh ke cadangan di
  // Hostinger. Di sini memang tidak ada request peramban yang bisa ditanya.
  return new URL(`/q/${token}`, env.NEXT_PUBLIC_SITE_URL).toString()
}

/** Cari lewat kode quotation, atau lewat token tautan publik `/q/<token>`. */
export type TicketingQuoteLookup = { code: string } | { publicToken: string }

export async function getQuoteForTicketing(lookup: TicketingQuoteLookup): Promise<TicketingQuote | null> {
  const prisma = getPrisma()
  const row = await prisma.pcBuildQuote.findUnique({
    where: "code" in lookup ? { code: lookup.code } : { publicToken: lookup.publicToken },
    select: {
      code: true,
      kind: true,
      prebuildName: true,
      revision: true,
      status: true,
      dpAt: true,
      closedAt: true,
      customerName: true,
      customerPhone: true,
      salesName: true,
      // Hanya tiga kolom ini dari akun pemilik — bukan id-nya, bukan namanya.
      owner: { select: { email: true, ssoSub: true, role: true } },
      items: true,
      subtotal: true,
      assemblyFee: true,
      discount: true,
      total: true,
      publicToken: true,
      createdAt: true,
      updatedAt: true,
      // Hanya tanggalnya — isi revisi lama tidak pernah ikut (riwayat revisi
      // termasuk yang dilarang dikirim).
      revisions: { select: { createdAt: true }, orderBy: { revision: "desc" }, take: 1 },
    },
  })
  if (!row) return null

  const snapshot = Array.isArray(row.items) ? (row.items as unknown as QuoteLineItem[]) : []

  // SATU kueri untuk seluruh produk, bukan satu per baris.
  const productIds = [...new Set(snapshot.map((i) => i.productId).filter((id) => Number.isInteger(id)))]
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, accurateCode: true },
      })
    : []
  const accurateById = new Map(products.map((p) => [p.id, p.accurateCode]))
  const stepKinds = await readStepKinds()

  const items: TicketingQuoteItem[] = snapshot.map((item) => ({
    productId: item.productId,
    name: item.name,
    variationLabel: item.variationLabel ?? null,
    sku: item.sku ?? null,
    accurateCode: accurateById.get(item.productId) ?? null,
    quantity: item.quantity,
    unitPrice: toRupiah(item.price, `harga ${item.name}`, row.code),
    stepName: item.stepName ?? null,
    stepKind: item.stepName ? stepKinds.get(stepKey(item.stepName)) ?? null : null,
  }))

  return {
    code: row.code,
    kind: row.kind === "prebuild" ? "prebuild" : "build",
    prebuildName: row.kind === "prebuild" ? row.prebuildName : null,
    revision: row.revision,
    status: row.status === "closing" ? "closing" : "terbit",
    dpAt: row.dpAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
    customer: { name: row.customerName, phone: row.customerPhone },
    salesName: row.salesName,
    sales: salesFor(row.owner),
    items,
    subtotal: toRupiah(row.subtotal, "subtotal", row.code),
    assemblyFee: toRupiah(row.assemblyFee, "assemblyFee", row.code),
    discount: toRupiah(row.discount, "discount", row.code),
    total: toRupiah(row.total, "total", row.code),
    publicUrl: publicUrlFor(row.publicToken),
    createdAt: row.createdAt.toISOString(),
    pricedAt: (row.revisions[0]?.createdAt ?? row.createdAt).toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
