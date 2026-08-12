"use client"

import { useActionState, useState } from "react"
import { Loader2 } from "lucide-react"
import { resendVerificationAction } from "../actions"
import { EMPTY_RESEND_VERIFICATION_STATE } from "../state"

const inputClass =
  "w-full rounded-xl border border-input bg-muted/50 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:bg-background"

/**
 * Pesan sukses SELALU ditampilkan setelah submit — server action ini
 * membalas generik apa pun kondisinya, lihat komentar di
 * `resendVerificationAction` kenapa. Form ini cuma mengikuti apa yang
 * server katakan, tidak menambah logic pembeda sendiri.
 */
export function ResendVerificationForm() {
  const [state, action, pending] = useActionState(resendVerificationAction, EMPTY_RESEND_VERIFICATION_STATE)
  const [submitted, setSubmitted] = useState(false)

  if (submitted && state.ok) {
    return (
      <p className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        Kalau email itu terdaftar dan belum aktif, tautan verifikasi baru sudah dikirim.
      </p>
    )
  }

  return (
    <form
      action={(formData) => {
        setSubmitted(true)
        return action(formData)
      }}
      className="space-y-3 text-left"
    >
      <div>
        <label className="mb-1 block text-xs font-semibold" htmlFor="resend-email">
          Belum menerima email? Masukkan email Anda lagi
        </label>
        <input id="resend-email" name="email" type="email" required className={inputClass} />
      </div>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-input px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted disabled:opacity-60"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Kirim Ulang
      </button>
    </form>
  )
}
