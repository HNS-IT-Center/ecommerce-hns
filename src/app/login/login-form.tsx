"use client"

import Link from "next/link"
import { useActionState } from "react"
import { Loader2, TriangleAlert } from "lucide-react"
import { loginAction } from "./actions"
import { EMPTY_LOGIN_STATE } from "./state"

const inputClass =
  "w-full rounded-xl border border-input bg-muted/50 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:bg-background"

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [state, action, pending] = useActionState(loginAction, EMPTY_LOGIN_STATE)

  return (
    <form action={action} className="space-y-3 text-left">
      {state.error && (
        <p className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {state.error}
        </p>
      )}

      <input type="hidden" name="next" value={nextPath} />

      <div>
        <label className="mb-1 block text-xs font-semibold" htmlFor="login-email">
          Email
        </label>
        <input id="login-email" name="email" type="email" autoComplete="email" required className={inputClass} />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="block text-xs font-semibold" htmlFor="login-password">
            Password
          </label>
          <Link href="/login/lupa-password" className="text-xs font-semibold text-muted-foreground hover:text-foreground">
            Lupa password?
          </Link>
        </div>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Masuk
      </button>
    </form>
  )
}
