/**
 * Bentuk state halaman akun, beserta nilai awalnya.
 *
 * Terpisah dari `actions.ts` karena berkas 'use server' hanya boleh
 * mengekspor fungsi async — lihat penjelasan lengkapnya di
 * `src/app/admin/login/state.ts`.
 */
export type AccountActionState = { error: string | null; ok: string | null }

export const EMPTY_ACCOUNT_STATE: AccountActionState = { error: null, ok: null }
