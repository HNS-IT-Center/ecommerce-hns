"use server"

import { revalidatePath } from "next/cache"

import {
  markHandoverSeen,
  previewLatestPrices,
  refreshQuotationPrices,
  setQuotationDp,
  updateQuotationCustomer,
  type IssueQuotationResult,
  type LatestPricePreview,
  type StatusChangeResult,
} from "@/lib/api/pc-build-quotes"
import { setSalesDisplayName } from "@/lib/api/admin-users"
import { getCurrentUser } from "@/lib/auth"
import { bisaAkses, muatIzinUser } from "@/lib/auth/permissions"

import {
  MAX_CUSTOMER_NAME,
  MAX_INTERNAL_NOTE,
} from "@/features/builder/quotation-constants"

import type { CustomerEditState } from "./lib/customer-edit"
import {
  MAX_SALES_DISPLAY_NAME,
  type SalesNameState,
} from "./lib/sales-name"

/**
 * Menandai satu operan dari CS sudah dibaca — dipanggil saat sales menutup
 * toast-nya.
 *
 * Tidak mengembalikan pesan error untuk ditampilkan: kalau gagal, toast-nya
 * akan muncul lagi pada polling berikutnya, dan itulah perilaku yang benar.
 * Memberi tahu sales bahwa "penandaan gagal" tidak menambah apa pun yang bisa
 * ia lakukan.
 */
export async function markHandoverSeenAction(code: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser()
  if (!user) return { ok: false }
  return { ok: await markHandoverSeen(String(code ?? ""), user.id) }
}

/**
 * Penjaga bersama tiga aksi di bawah.
 *
 * Izinnya diperiksa DI DALAM action, bukan diandalkan dari halaman yang
 * menyembunyikan tombolnya — server action adalah endpoint HTTP tersendiri yang
 * bisa dipanggil tanpa pernah memuat halaman itu.
 *
 * Yang dituntut cuma `quotation-terbit`; syarat "ini milik Anda" ditegakkan di
 * lapisan data, lewat `ownerUserId` yang ikut di WHERE. Dua penjaga untuk dua
 * pertanyaan berbeda: yang ini menjawab "boleh memegang quotation?", yang di
 * sana menjawab "quotation yang mana?".
 */
async function pemegangQuotation(): Promise<{ id: string } | null> {
  const user = await getCurrentUser()
  if (!user) return null
  const izin = await muatIzinUser(user)
  if (!bisaAkses(izin, "quotation-terbit", "edit")) return null
  return { id: user.id }
}

/** Empat halaman berubah artinya saat satu quotation berubah. */
function segarkanHalamanQuotation(code: string): void {
  revalidatePath("/profile/quotation")
  revalidatePath(`/profile/quotation/${code}`)
  revalidatePath("/admin/quotation")
  revalidatePath(`/verify/${code}`)
}

/**
 * Tandai / batalkan tanda "sudah DP".
 *
 * PENANDA, bukan kunci. Harga sudah terkunci sejak quotation disimpan, dan
 * aksi ini sengaja tidak menyentuh `status` — lihat catatan di `setQuotationDp`
 * dan docs/17 §13.
 */
export async function setQuotationDpAction(input: {
  code: string
  dp: boolean
}): Promise<StatusChangeResult> {
  const user = await pemegangQuotation()
  if (!user) return { ok: false, error: "Anda tidak punya izin untuk tindakan ini." }

  const code = String(input?.code ?? "").trim().toUpperCase()
  if (!code) return { ok: false, error: "Data yang dikirim tidak valid." }

  const hasil = await setQuotationDp(code, user.id, input.dp === true)
  if (hasil.ok) segarkanHalamanQuotation(code)
  return hasil
}

/**
 * Berapa jadinya kalau harga disegarkan — dipanggil saat dialog konfirmasi
 * dibuka, sebelum apa pun ditulis. Tidak mengubah satu baris pun.
 */
export async function previewLatestPricesAction(code: string): Promise<LatestPricePreview> {
  const user = await pemegangQuotation()
  if (!user) return { ok: false, error: "Anda tidak punya izin untuk tindakan ini." }

  const kode = String(code ?? "").trim().toUpperCase()
  if (!kode) return { ok: false, error: "Data yang dikirim tidak valid." }

  return previewLatestPrices(kode, user.id)
}

/**
 * Segarkan harga ke katalog hari ini. Lahir sebagai revisi baru, dengan
 * riwayatnya — bukan penulisan diam-diam atas angka yang sudah dicetak.
 */
export async function refreshQuotationPricesAction(
  code: string,
): Promise<IssueQuotationResult> {
  const user = await pemegangQuotation()
  if (!user) return { ok: false, error: "Anda tidak punya izin untuk tindakan ini." }

  const kode = String(code ?? "").trim().toUpperCase()
  if (!kode) return { ok: false, error: "Data yang dikirim tidak valid." }

  const hasil = await refreshQuotationPrices(kode, user.id)
  if (hasil.ok) segarkanHalamanQuotation(kode)
  return hasil
}

/**
 * Atur nama tampilan milik sendiri — yang tercetak sebagai "Sales:" di PDF
 * quotation DAN yang dipakai memperkenalkan diri di pesan follow-up WhatsApp.
 *
 * Terpisah dari `name` akun, dan bedanya bukan kosmetik: `name` dipakai di
 * seluruh panel untuk mengenali siapa melakukan apa, sedangkan yang ini dibaca
 * pelanggan. Sales yang ingin dokumennya bertuliskan "Tyo" tidak seharusnya
 * ikut mengubah namanya di daftar admin, log produk, dan jejak audit.
 *
 * **Izinnya `quotation-terbit`, bukan `quotation-sales`** — dilonggarkan
 * 23 September 2026. Selama syaratnya `quotation-sales`, CS tidak pernah bisa
 * mengatur nama ini, padahal pesan follow-up memperkenalkan ORANG YANG MENEKAN
 * TOMBOL (lihat `buildFollowUpMessage`). Akibatnya pelanggan menerima pesan
 * dari "Customer Service 2" — nama akun, apa adanya, karena tidak ada nilai
 * lain yang bisa dipakai. Yang tercetak di PDF tetap hanya milik Sales: baris
 * "Sales:" diisi `pc_build_quotes.sales_name`, yang memang NULL untuk CS.
 *
 * Nilainya TIDAK berlaku surut. Quotation menyimpan salinan nama ini saat
 * terbit, jadi mengubahnya di sini hanya mempengaruhi dokumen yang terbit
 * SESUDAHNYA — PDF yang sudah di tangan pelanggan tetap apa adanya.
 */
export async function updateSalesDisplayNameAction(
  _prev: SalesNameState,
  formData: FormData,
): Promise<SalesNameState> {
  // Ditegakkan di SERVER, bukan cuma dengan menyembunyikan formulirnya: server
  // action adalah endpoint HTTP tersendiri yang bisa dipanggil tanpa pernah
  // memuat halamannya.
  const user = await pemegangQuotation()
  if (!user) {
    return { error: "Akun Anda tidak punya izin menerbitkan quotation.", ok: null }
  }

  const raw = String(formData.get("salesDisplayName") ?? "").trim()
  if (raw.length > MAX_SALES_DISPLAY_NAME) {
    return { error: `Nama tampilan maksimal ${MAX_SALES_DISPLAY_NAME} karakter.`, ok: null }
  }

  // Kosong = hapus, lalu `name` akun yang dipakai. Disimpan NULL, bukan string
  // kosong, supaya "belum diatur" dan "sengaja dikosongkan" tidak jadi dua
  // keadaan berbeda yang harus dibedakan setiap pembacanya.
  const tersimpan = await setSalesDisplayName(user.id, raw.length > 0 ? raw : null)
  if (!tersimpan) {
    return { error: "Akun Anda tidak ditemukan.", ok: null }
  }

  // Dua halaman memuat formulir yang sama, jadi dua-duanya disegarkan — yang
  // menyimpan di salah satunya tidak boleh melihat nilai lama di yang lain.
  revalidatePath("/admin/akun")
  revalidatePath("/profile/quotation")

  return {
    error: null,
    ok:
      raw.length > 0
        ? `Quotation dan pesan follow-up berikutnya memakai nama "${raw}".`
        : "Nama tampilan dikosongkan — yang dipakai nama akun Anda.",
  }
}

/**
 * Perbaiki nama, nomor WhatsApp, dan catatan internal pelanggan.
 *
 * TIDAK menaikkan nomor revisi — identitas pelanggan memang tidak ikut
 * diversikan (lihat `updateQuotationCustomer`). Sebelum ada aksi ini,
 * membetulkan satu digit nomor HP menuntut revisi baru, dan riwayat revisi jadi
 * berisi versi-versi yang isi rakitannya sama persis.
 */
export async function updateQuotationCustomerAction(
  formData: FormData,
): Promise<CustomerEditState> {
  const user = await pemegangQuotation()
  if (!user) return { error: "Anda tidak punya izin untuk tindakan ini.", ok: null }

  const code = String(formData.get("code") ?? "").trim().toUpperCase()
  const nama = String(formData.get("customerName") ?? "").trim()
  const nomor = String(formData.get("customerPhone") ?? "").trim()
  const catatan = String(formData.get("internalNote") ?? "").trim()

  if (!code) return { error: "Data yang dikirim tidak valid.", ok: null }
  if (nama.length < 2) return { error: "Nama pelanggan wajib diisi.", ok: null }
  if (nama.length > MAX_CUSTOMER_NAME) {
    return { error: `Nama pelanggan maksimal ${MAX_CUSTOMER_NAME} karakter.`, ok: null }
  }
  if (catatan.length > MAX_INTERNAL_NOTE) {
    return { error: `Catatan internal maksimal ${MAX_INTERNAL_NOTE} karakter.`, ok: null }
  }

  /**
   * Nomor tidak divalidasi ketat, dan itu disengaja — pola yang sama dengan
   * penerbitan (`actions-quotation.ts`). Yang mengetik ini staff yang sedang
   * menyalin dari layar HP pelanggan, bukan pelanggan yang mendaftar. Validasi
   * ketat di situ hanya menghasilkan nomor yang "dibetulkan" supaya lolos, dan
   * nomor yang dibetulkan lebih buruk daripada nomor yang formatnya tidak rapi
   * tapi benar.
   */
  if (nomor.length > 20) return { error: "Nomor WhatsApp terlalu panjang.", ok: null }

  const hasil = await updateQuotationCustomer(code, user.id, {
    customerName: nama,
    customerPhone: nomor || null,
    internalNote: catatan || null,
  })
  if (!hasil.ok) return { error: hasil.error, ok: null }

  segarkanHalamanQuotation(code)
  return { error: null, ok: "Data pelanggan tersimpan." }
}
