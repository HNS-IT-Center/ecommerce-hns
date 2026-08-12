"use client"

import { useActionState } from "react"
import { Loader2 } from "lucide-react"
import { forgotPasswordAction } from "../actions"
import { EMPTY_FORGOT_PASSWORD_STATE } from "../state"

const inputClass =
  "w-full rounded-xl border border-input bg-muted/50 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:bg-background"

/**
 * Pesan sukses generik, sama alasannya dengan ResendVerificationForm:
 * server action ini SELALU membalas sukses apa pun kondisinya (anti
 * enumerasi email), form ini cuma mengikuti.
 */
export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, EMPTY_FORGOT_PASSWORD_STATE)

  if (state.ok) {
    return (
      <p className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        Kalau email itu terdaftar, kami sudah kirim tautan reset password ke sana.
      </p>
    )
  }

  return (
    <form action={action} className="space-y-3 text-left">
      <div>
        <label className="mb-1 block text-xs font-semibold" htmlFor="forgot-email">
          Email
        </label>
        <input id="forgot-email" name="email" type="email" required autoFocus className={inputClass} />
      </div>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Kirim Tautan Reset
      </button>
    </form>
  )
}
