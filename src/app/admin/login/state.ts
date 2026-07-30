/**
 * Bentuk state formulir masuk, beserta nilai awalnya.
 *
 * Tinggal di berkas TERPISAH dari `actions.ts`, dan itu bukan selera penataan:
 * berkas bertanda 'use server' hanya boleh mengekspor fungsi async. Setiap
 * ekspor lain di sana diperlakukan Next sebagai rujukan Server Action, dan
 * sebuah objek biasa tidak bisa menjadi itu — halamannya gagal dirender dengan
 * "A 'use server' file can only export async functions, found object."
 *
 * Berkas ini tidak bertanda `"use server"`, jadi ia boleh diimpor dari server
 * maupun dari komponen klien. Nilai awalnya tetap satu, tidak disalin ke tiap
 * pemakai — kalau bentuk state berubah, hanya ada satu tempat yang perlu ikut
 * berubah.
 */
export type LoginState = { error: string | null }

export const EMPTY_LOGIN_STATE: LoginState = { error: null }
