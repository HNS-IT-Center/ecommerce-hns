/**
 * Bentuk state formulir kebijakan beserta nilai awalnya.
 *
 * Terpisah dari `actions.ts` karena berkas 'use server' hanya boleh mengekspor
 * fungsi async — konvensi yang sama dipakai layar toko, kategori, dan login.
 */
export type PolicyActionState = { error: string | null }

export const EMPTY_POLICY_STATE: PolicyActionState = { error: null }
