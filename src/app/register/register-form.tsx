"use client"

import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2, TriangleAlert } from "lucide-react"
import { registerAction } from "./actions"
import { EMPTY_REGISTER_STATE } from "./state"

const inputClass =
  "w-full rounded-xl border border-input bg-muted/50 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:bg-background"

export function RegisterForm() {
  const router = useRouter()
  const [state, action, pending] = useActionState(registerAction, EMPTY_REGISTER_STATE)

  // Redirect ke halaman "cek email" HANYA setelah sukses — bukan di dalam
  // action itu sendiri (server action tidak boleh redirect ke halaman lain
  // sambil masih membawa pesan sukses ke klien; di sini kita justru
  // butuh klien yang menavigasi supaya pesannya konsisten dengan alur
  // resend-verification yang juga mendarat di halaman yang sama).
  useEffect(() => {
    if (state.ok) router.push("/register/cek-email")
  }, [state.ok, router])

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <p className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {state.error}
        </p>
      )}

      <div>
        <label className="mb-1 block text-sm font-semibold" htmlFor="name">
          Nama
        </label>
        <input id="name" name="name" type="text" autoComplete="name" required autoFocus className={inputClass} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold" htmlFor="email">
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          className={inputClass}
        />
        <p className="mt-1 text-xs text-muted-foreground">Minimal 10 karakter.</p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Daftar
      </button>
    </form>
  )
}
