"use server"

import { revalidatePath } from "next/cache"

import { reopenQuotation, type StatusChangeResult } from "@/lib/api/pc-build-quotes"
import { requirePermission, ForbiddenError, UnauthorizedError } from "@/lib/auth"

const MIN_ALASAN = 5
const MAX_ALASAN = 255

/**
 * Membatalkan status TERJUAL sebuah quotation.
 *
 * Tindakan paling sensitif di seluruh alur ini: ia mengurangi angka penjualan
 * seorang sales pada bulan berjalan. Tiga pengaman, dan ketiganya disengaja:
 *
 *  1. `quotation: edit` — bukan `verify: edit`. Kasir yang menandai terjual
 *     TIDAK boleh membatalkannya sendiri; kalau boleh, dialog konfirmasi di
 *     `/verify` kehilangan seluruh maknanya.
 *  2. Alasan WAJIB, minimal beberapa kata. Tanpa itu, satu-satunya jejak yang
 *     tersisa adalah bahwa angkanya pernah lebih besar.
 *  3. Tercatat di `pc_build_quote_status_logs` bersama siapa dan kapan.
 */
export async function reopenQuotationAction(input: {
  code: string
  reason: string
}): Promise<StatusChangeResult> {
  let user: { id: string }
  try {
    user = await requirePermission("quotation", "edit")
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof UnauthorizedError) {
      return { ok: false, error: error.message }
    }
    throw error
  }

  const code = String(input?.code ?? "").trim().toUpperCase()
  const reason = String(input?.reason ?? "").trim()

  if (!code) return { ok: false, error: "Kode quotation tidak dikenali." }
  if (reason.length < MIN_ALASAN) {
    return { ok: false, error: `Alasan wajib diisi, minimal ${MIN_ALASAN} karakter.` }
  }
  if (reason.length > MAX_ALASAN) {
    return { ok: false, error: `Alasan maksimal ${MAX_ALASAN} karakter.` }
  }

  const hasil = await reopenQuotation(code, user.id, reason)
  if (!hasil.ok) return hasil

  revalidatePath("/admin/quotation")
  revalidatePath("/verify")
  revalidatePath(`/verify/${code}`)
  revalidatePath("/profile/quotation")
  revalidatePath(`/profile/quotation/${code}`)

  return { ok: true }
}
