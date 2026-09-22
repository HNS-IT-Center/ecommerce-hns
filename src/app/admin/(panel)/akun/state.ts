/**
 * Bentuk state halaman akun, beserta nilai awalnya.
 *
 * Terpisah dari `actions.ts` karena berkas 'use server' hanya boleh
 * mengekspor fungsi async — lihat penjelasan lengkapnya di
 * `src/app/admin/login/state.ts`.
 */
export type AccountActionState = { error: string | null; ok: string | null }

export const EMPTY_ACCOUNT_STATE: AccountActionState = { error: null, ok: null }

/**
 * Batas nama tampilan sales — sama dengan `users.sales_display_name`
 * (VARCHAR(60)) di database. Ditulis sekali di sini lalu dipakai bersama
 * formulir dan server action, supaya batas di layar dan batas di kolom tidak
 * bisa menyimpang tanpa ada yang menyadarinya.
 */
export const MAX_SALES_DISPLAY_NAME = 60
