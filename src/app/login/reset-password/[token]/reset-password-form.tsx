"use client"

import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2, TriangleAlert } from "lucide-react"
import { resetPasswordAction } from "../../actions"
import { EMPTY_RESET_PASSWORD_STATE } from "../../state"

const inputClass =
  "w-full rounded-xl border border-input bg-muted/50 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:bg-background"

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter()
  // `.bind(null, token)` — pola resmi Next.js untuk mengoper argumen tetap
  // ke server action yang dipakai `useActionState` (yang selalu memanggil
  // action dengan `(prevState, formData)` saja).
  const boundAction = resetPasswordAction.bind(null, token)
  const [state, action, pending] = useActionState(boundAction, EMPTY_RESET_PASSWORD_STATE)

  useEffect(() => {
    if (state.ok) {
      const timer = setTimeout(() => router.push("/login"), 2000)
      return () => clearTimeout(timer)
    }
  }, [state.ok, router])

  if (state.ok) {
    return (
      <p className="rounded-xl border border-brand-green/30 bg-brand-green/10 px-4 py-3 text-sm text-brand-green">
        Password berhasil diganti. Mengarahkan ke halaman masuk…
      </p>
    )
  }

  return (
    <form action={action} className="space-y-4 text-left">
      {state.error && (
        <p className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {state.error}
        </p>
      )}

      <div>
        <label className="mb-1 block text-sm font-semibold" htmlFor="new-password">
          Password Baru
        </label>
        <input
          id="new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          autoFocus
          className={inputClass}
        />
        <p className="mt-1 text-xs text-muted-foreground">Minimal 10 karakter.</p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold" htmlFor="confirm-password">
          Konfirmasi Password Baru
        </label>
        <input
          id="confirm-password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Ganti Password
      </button>
    </form>
  )
}
