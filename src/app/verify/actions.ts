"use server"

import { revalidatePath } from "next/cache"

import { markQuotationClosed, type StatusChangeResult } from "@/lib/api/pc-build-quotes"
import { requirePermission, ForbiddenError, UnauthorizedError } from "@/lib/auth"

/**
 * Menandai quotation TERJUAL — satu-satunya aksi kasir yang menulis.
 *
 * `requirePermission("verify", "edit")` dipanggil DI DALAM action, bukan
 * diandalkan dari halaman yang menyembunyikan tombolnya. Server action adalah
 * endpoint HTTP tersendiri yang bisa dipanggil tanpa pernah memuat halaman itu;
 * tombol yang tidak dirender cuma tombol yang tidak dirender.
 *
 * Membatalkan status ini TIDAK ada di sini. Itu kuasa admin, hidup di
 * `/admin/quotation`, dan menuntut alasan tertulis.
 */
export async function markQuotationClosedAction(input: {
  code: string
  expectedRevision: number
}): Promise<StatusChangeResult> {
  let user: { id: string }
  try {
    user = await requirePermission("verify", "edit")
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof UnauthorizedError) {
      return { ok: false, error: error.message }
    }
    throw error
  }

  const code = String(input?.code ?? "").trim().toUpperCase()
  const expectedRevision = Number(input?.expectedRevision)
  if (!code || !Number.isInteger(expectedRevision) || expectedRevision < 1) {
    return { ok: false, error: "Data yang dikirim tidak valid." }
  }

  const hasil = await markQuotationClosed(code, expectedRevision, user.id)
  if (!hasil.ok) return hasil

  /**
   * Empat halaman ikut berubah artinya, jadi empat-empatnya disegarkan:
   * daftar kasir, detail yang sedang dibuka, riwayat sales (badge "Terjual"
   * dan rekap bulanannya), dan pengawasan admin.
   */
  revalidatePath("/verify")
  revalidatePath(`/verify/${code}`)
  revalidatePath("/profile/quotation")
  revalidatePath(`/profile/quotation/${code}`)
  revalidatePath("/admin/quotation")

  return { ok: true }
}
