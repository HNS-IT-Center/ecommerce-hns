/**
 * Nilai bersama formulir "Nama Sales di Quotation" dan server action-nya.
 *
 * Modul biasa, BUKAN `"use server"`: berkas server action hanya boleh
 * mengekspor fungsi async, dan sebuah `export const` di dalamnya lolos
 * `tsc --noEmit` tapi mematikan seluruh aplikasi saat dijalankan (docs/17 §11.1).
 *
 * Tinggal di `features/quotation` dan bukan di folder halaman mana pun karena
 * ia dipakai tiga tempat sekaligus: `/admin/akun`, `/profile/quotation`, dan
 * Manajemen User → tab Admin. Konstanta yang tinggal di salah satu halaman lalu
 * diimpor dua halaman lain adalah cara halaman saling mengikat tanpa ada yang
 * menyadarinya.
 */

/** Bentuk state `useActionState` untuk formulir nama tampilan. */
export type SalesNameState = { error: string | null; ok: string | null }

export const EMPTY_SALES_NAME_STATE: SalesNameState = { error: null, ok: null }

/**
 * Batas nama tampilan sales — sama dengan `users.sales_display_name`
 * (VARCHAR(60)) di database. Ditulis sekali di sini lalu dipakai bersama
 * formulir dan server action, supaya batas di layar dan batas di kolom tidak
 * bisa menyimpang tanpa ada yang menyadarinya.
 */
export const MAX_SALES_DISPLAY_NAME = 60
