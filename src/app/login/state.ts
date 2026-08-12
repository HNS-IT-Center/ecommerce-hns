/**
 * Bentuk state formulir masuk/lupa-password/reset-password, terpisah dari
 * `actions.ts` — pola sama seperti `admin/login/state.ts`: berkas bertanda
 * `"use server"` hanya boleh mengekspor fungsi async, dan sebuah `type`
 * bukan itu.
 */

export type LoginState = { error: string | null }
export const EMPTY_LOGIN_STATE: LoginState = { error: null }

export type ForgotPasswordState = { error: string | null; ok: boolean }
export const EMPTY_FORGOT_PASSWORD_STATE: ForgotPasswordState = { error: null, ok: false }

export type ResetPasswordState = { error: string | null; ok: boolean }
export const EMPTY_RESET_PASSWORD_STATE: ResetPasswordState = { error: null, ok: false }
