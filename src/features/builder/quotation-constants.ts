/**
 * Konstanta bersama untuk alur penerbitan quotation.
 *
 * **Kenapa berkas tersendiri, dan bukan di `actions-quotation.ts`:** berkas
 * bertanda `"use server"` hanya boleh mengekspor fungsi async. Sebuah
 * `export const` di sana membuat SELURUH aplikasi gagal dikompilasi dengan
 * "Only async functions are allowed to be exported in a 'use server' file" —
 * dan `tsc --noEmit` TIDAK menangkapnya, karena itu aturan bundler Next, bukan
 * aturan TypeScript. Yang menemukannya cuma `next build` atau dev server.
 *
 * Berkas ini juga diimpor komponen klien (dialog), jadi ia sengaja tidak
 * menyeret apa pun dari sisi server.
 */

/** Nilai `salesUserId` yang berarti "simpan atas nama saya, tanpa mengoper". */
export const TIDAK_OPER = "none"

/** Batas isian dialog terbitkan. Disamakan dengan kolom di `pc_build_quotes`. */
export const MAX_CUSTOMER_NAME = 120
export const MAX_CUSTOMER_PHONE = 20
export const MAX_INTERNAL_NOTE = 500
