/**
 * Bentuk state formulir daftar/kirim-ulang-verifikasi, terpisah dari
 * `actions.ts` — pola sama seperti `admin/login/state.ts`: berkas bertanda
 * `"use server"` hanya boleh mengekspor fungsi async.
 */

export type RegisterState = { error: string | null; ok: boolean }
export const EMPTY_REGISTER_STATE: RegisterState = { error: null, ok: false }

export type ResendVerificationState = { error: string | null; ok: boolean }
export const EMPTY_RESEND_VERIFICATION_STATE: ResendVerificationState = { error: null, ok: false }

export type VerifyEmailResult = { ok: true } | { ok: false; reason: "not_found" | "expired" }
