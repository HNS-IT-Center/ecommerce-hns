/**
 * Nilai bersama formulir "Data Pelanggan" dan server action-nya.
 *
 * Modul biasa, BUKAN `"use server"`: berkas server action hanya boleh
 * mengekspor fungsi async (docs/17 §11.1).
 */

export type CustomerEditState = { error: string | null; ok: string | null }

export const EMPTY_CUSTOMER_EDIT_STATE: CustomerEditState = { error: null, ok: null }

/**
 * Nomor yang terlalu pendek untuk bisa jadi nomor HP Indonesia.
 *
 * Kolomnya teks bebas — staff bisa terlanjur menyimpan "-", "0812" setengah
 * jadi, atau nomor telepon rumah. wa.me tetap membuka halaman untuk nomor
 * seperti itu, hanya saja isinya "nomor tidak valid" setelah aplikasi WhatsApp
 * terbuka.
 *
 * Ambang ini TIDAK dipakai untuk menolak simpanan: nomor yang aneh tetap boleh
 * tersimpan, karena staff kadang mencatat apa yang ia dengar lalu
 * membetulkannya kemudian. Yang diputuskan olehnya hanya apakah tombol follow-up
 * langsung membuka WhatsApp atau membuka dialog perbaikan lebih dulu.
 */
export const MIN_DIGIT_NOMOR = 10
