"use server"

import { ForbiddenError, UnauthorizedError, requirePermission } from "@/lib/auth"
import {
  getProductFlagSummary,
  getProductTypeTotals,
  getRecentProductLogs,
  type DashboardLogItem,
  type ProductFlagSummary,
  type ProductTypeTotals,
} from "@/lib/api/admin-dashboard"
import type { ProductFlag } from "@/lib/api/woocommerce/product-health"

/**
 * Pemuat ulang kartu dashboard saat penyaringnya diganti.
 *
 * Tiap kartu memanggil action-nya sendiri, bukan menaruh penyaring di URL:
 * dengan URL, mengganti kategori di satu kartu merender ulang seluruh halaman —
 * termasuk kartu log dan produk terbaru yang tidak ada hubungannya — dan dua
 * kartu yang sama-sama punya penyaring kategori harus berebut nama parameter.
 *
 * Izin diperiksa lagi di sini walau halamannya sudah menyembunyikan kartu:
 * server action bisa dipanggil langsung tanpa melewati halaman.
 */

export type DashboardResult<T> = { ok: true; data: T } | { ok: false; error: string }

const FLAGS: ReadonlySet<string> = new Set<ProductFlag>(["missing-sku", "empty-stock"])

/** Id kategori datang dari klien — hanya bilangan bulat positif atau null. */
function parseCategoryId(value: unknown): number | null | undefined {
  if (value === null) return null
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined
}

function toError(error: unknown): { ok: false; error: string } {
  if (error instanceof UnauthorizedError) return { ok: false, error: "Sesi berakhir. Silakan masuk lagi." }
  if (error instanceof ForbiddenError) return { ok: false, error: "Anda tidak punya akses ke data ini." }
  console.error("[dashboard]", error)
  return { ok: false, error: "Gagal memuat data. Coba lagi sebentar." }
}

export async function loadProductFlagSummary(
  flag: ProductFlag,
  rootCategoryId: number | null
): Promise<DashboardResult<ProductFlagSummary>> {
  const categoryId = parseCategoryId(rootCategoryId)
  if (!FLAGS.has(flag) || categoryId === undefined) {
    return { ok: false, error: "Penyaring tidak valid." }
  }

  try {
    await requirePermission("produk")
    return { ok: true, data: await getProductFlagSummary(flag, categoryId) }
  } catch (error) {
    return toError(error)
  }
}

export async function loadProductTypeTotals(
  rootCategoryId: number | null
): Promise<DashboardResult<ProductTypeTotals>> {
  const categoryId = parseCategoryId(rootCategoryId)
  if (categoryId === undefined) return { ok: false, error: "Penyaring tidak valid." }

  try {
    await requirePermission("produk")
    return { ok: true, data: await getProductTypeTotals(categoryId) }
  } catch (error) {
    return toError(error)
  }
}

export async function loadRecentLogs(filter: string): Promise<DashboardResult<DashboardLogItem[]>> {
  // Nama aksi selalu huruf besar + garis bawah; nilainya masuk ke `where`
  // sebagai pencocokan persis, jadi apa pun di luar bentuk itu ditolak.
  if (typeof filter !== "string" || !/^(price|all|[A-Z_]{1,100})$/.test(filter)) {
    return { ok: false, error: "Penyaring tidak valid." }
  }

  try {
    await requirePermission("logs")
    return { ok: true, data: await getRecentProductLogs(filter) }
  } catch (error) {
    return toError(error)
  }
}
