/**
 * Bentuk state formulir toko beserta nilai awalnya.
 *
 * Terpisah dari `actions.ts` karena berkas 'use server' hanya boleh mengekspor
 * fungsi async — konvensi yang sama dipakai layar kategori dan login.
 */
export type StoreActionState = { error: string | null }

export const EMPTY_STORE_STATE: StoreActionState = { error: null }
