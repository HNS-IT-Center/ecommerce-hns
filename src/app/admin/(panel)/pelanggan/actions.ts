"use server"

import { revalidatePath } from "next/cache"
import { ForbiddenError, UnauthorizedError, requireOwner } from "@/lib/auth"
import { CustomerNotFoundError, deleteCustomerPermanently } from "@/lib/api/customers"
import {
  DELETE_CONFIRMATION_WORD,
  MAX_REASON_LENGTH,
  MIN_REASON_WORDS,
  type CustomerActionState,
} from "./state"

/**
 * Hapus akun pelanggan secara permanen.
 *
 * `requireOwner()` dipanggil DI DALAM action ini, bukan diandalkan dari layout
 * atau middleware. Server action adalah endpoint HTTP tersendiri: ia bisa
 * dipanggil langsung tanpa pernah memuat halaman yang menyembunyikan tombolnya.
 * Menyembunyikan tombol di UI cuma menyembunyikan tombol — yang benar-benar
 * menahan permintaan adalah baris di bawah ini.
 *
 * Pemeriksaannya juga sengaja PALING AWAL, sebelum apa pun dibaca dari
 * formulir: staff yang tidak berhak tidak perlu tahu apakah id yang dikirimnya
 * cocok dengan akun yang ada.
 */
export async function deleteCustomer(
  _prev: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  try {
    const actor = await requireOwner()

    const customerId = String(formData.get("customerId") ?? "").trim()
    const reason = String(formData.get("reason") ?? "").trim()
    const confirmation = String(formData.get("confirmation") ?? "").trim()

    if (!customerId) {
      return { error: "Akun yang mau dihapus tidak dikenali.", success: null }
    }

    // Ketik ulang, pola yang sama seperti hapus toko. Bukan sekadar formalitas:
    // penghapusan ini tidak bisa dibatalkan, jadi satu klik tidak boleh cukup.
    if (confirmation !== DELETE_CONFIRMATION_WORD) {
      return {
        error: `Ketik "${DELETE_CONFIRMATION_WORD}" persis untuk mengonfirmasi penghapusan.`,
        success: null,
      }
    }

    // Alasan wajib. Dihitung per kata — lihat catatan di `state.ts`.
    const wordCount = reason.split(/\s+/).filter(Boolean).length
    if (wordCount < MIN_REASON_WORDS) {
      return {
        error: `Alasan penghapusan wajib diisi, minimal ${MIN_REASON_WORDS} kata (mis. "permintaan hapus data via CS").`,
        success: null,
      }
    }
    if (reason.length > MAX_REASON_LENGTH) {
      return {
        error: `Alasan terlalu panjang (maksimal ${MAX_REASON_LENGTH} karakter).`,
        success: null,
      }
    }

    const { savedBuildCount } = await deleteCustomerPermanently({
      customerId,
      deletedByUserId: actor.id,
      reason,
    })

    revalidatePath("/admin/pelanggan")

    return {
      error: null,
      success:
        savedBuildCount > 0
          ? `Akun dihapus permanen, beserta ${savedBuildCount} rakitan tersimpan.`
          : "Akun dihapus permanen.",
    }
  } catch (error) {
    if (
      error instanceof UnauthorizedError ||
      error instanceof ForbiddenError ||
      error instanceof CustomerNotFoundError
    ) {
      return { error: error.message, success: null }
    }
    throw error
  }
}
