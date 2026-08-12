"use server"

import { revalidatePath } from "next/cache"
import { ForbiddenError, UnauthorizedError, requireOwner } from "@/lib/auth"
import {
  CustomerNotFoundError,
  deleteCustomerPermanently,
  getCustomerForDeletion,
} from "@/lib/api/customers"
import { MAX_REASON_LENGTH, MIN_REASON_WORDS, type CustomerActionState } from "./state"

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

    /**
     * Yang diketik ulang adalah EMAIL pelanggan, dicocokkan ke email yang
     * TERSIMPAN DI DATABASE — bukan ke nilai yang ikut dikirim formulir.
     * Kalau pembandingnya datang dari formulir juga, pengirim bisa mengubah
     * keduanya sekaligus dan konfirmasinya cuma mencocokkan dirinya sendiri.
     *
     * Ini juga sekaligus memastikan akunnya masih ada sebelum apa pun
     * dikerjakan.
     */
    const target = await getCustomerForDeletion(customerId)
    if (!target) {
      return { error: "Akun pelanggan tidak ditemukan — mungkin sudah dihapus.", success: null }
    }

    if (confirmation.toLowerCase() !== target.email.toLowerCase()) {
      return {
        error: "Email konfirmasi tidak cocok dengan akun yang dipilih.",
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

    /**
     * Keterangannya menyebut SIAPA yang terhapus, bukan sekadar "berhasil".
     *
     * Nama dan emailnya diambil dari `target` yang dibaca SEBELUM penghapusan —
     * sesudah ini barisnya sudah tidak ada, dan memang tidak disalin ke tabel
     * audit (justru data itu yang diminta hilang). Kalimat ini hidup di layar
     * staff saja, tidak tersimpan di mana pun.
     *
     * Gunanya: staff bisa langsung membalas CS dengan yakin bahwa yang terhapus
     * benar orang yang diminta, tanpa harus mengingat baris mana yang tadi
     * ditekan.
     */
    const buildNote =
      savedBuildCount > 0
        ? ` beserta ${savedBuildCount} rakitan tersimpan`
        : " (tidak ada rakitan tersimpan)"

    return {
      error: null,
      success: `Akun ${target.name} (${target.email}) sudah dihapus permanen${buildNote}.`,
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
