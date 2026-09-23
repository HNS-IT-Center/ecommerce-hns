/**
 * Bentuk state formulir akun, beserta nilai awalnya.
 *
 * Terpisah dari `actions.ts` karena berkas 'use server' hanya boleh
 * mengekspor fungsi async — lihat penjelasan lengkapnya di
 * `src/app/admin/login/state.ts`.
 *
 * Tinggal di `features/account` sejak 23 September 2026: formulir yang
 * memakainya hidup di DUA halaman — `/admin/akun` dan `/profile` — dan
 * konstanta yang menumpang di salah satu halaman lalu diimpor halaman lain
 * adalah cara dua halaman saling mengikat tanpa ada yang menyadarinya.
 */
export type AccountActionState = { error: string | null; ok: string | null }

export const EMPTY_ACCOUNT_STATE: AccountActionState = { error: null, ok: null }
