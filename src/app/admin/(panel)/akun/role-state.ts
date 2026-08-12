/**
 * State formulir pengaturan role, terpisah dari `role-actions.ts` karena berkas
 * 'use server' hanya boleh mengekspor fungsi async.
 */
export type RoleActionState = { error: string | null; success: string | null }

export const EMPTY_ROLE_STATE: RoleActionState = { error: null, success: null }
