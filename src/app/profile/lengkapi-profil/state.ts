/**
 * Bentuk state formulir lengkapi-profil, terpisah dari `actions.ts` — pola
 * sama seperti `login/state.ts`: berkas bertanda `"use server"` hanya boleh
 * mengekspor fungsi async, dan sebuah `type` bukan itu.
 */

export type CompleteProfileState = { error: string | null; ok: boolean }
export const EMPTY_COMPLETE_PROFILE_STATE: CompleteProfileState = { error: null, ok: false }
