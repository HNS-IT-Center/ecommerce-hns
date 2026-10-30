import { Prisma } from "@prisma/client"

/**
 * Apakah `error` pelanggaran constraint unik (P2002) pada kolom `column`.
 *
 * Kenapa tidak cukup `error.meta.target`: Prisma 7 dengan driver adapter
 * (`@prisma/adapter-mariadb`, yang dipakai project ini) TIDAK mengisi `target`.
 * Nama constraint-nya ada di tempat lain:
 *
 *   meta: { modelName: "Product", driverAdapterError: { cause: {
 *     kind: "UniqueConstraintViolation", constraint: { index: "products_sku_key" } } } }
 *
 * Diukur 30 Oktober 2026 di database lokal. Pemeriksaan yang hanya membaca
 * `target` selalu gagal mengenali P2002, sehingga SKU varian yang kembar sampai
 * ke staff sebagai 500 "Gagal membuat produk" tanpa keterangan apa pun.
 *
 * Kedua bentuk dibaca supaya fungsi ini tetap benar kalau adapter berganti.
 * Pencocokan memakai substring nama kolom pada nama index (`products_sku_key`),
 * jadi pilih `column` yang tidak menjadi bagian nama kolom unik lain di tabel
 * yang sama.
 */
export function isUniqueViolationOn(error: unknown, column: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false
  }
  const meta = error.meta as
    | { target?: unknown; driverAdapterError?: { cause?: { constraint?: unknown } } }
    | undefined
  const where = JSON.stringify([meta?.target, meta?.driverAdapterError?.cause?.constraint])
  return where.toLowerCase().includes(column.toLowerCase())
}
