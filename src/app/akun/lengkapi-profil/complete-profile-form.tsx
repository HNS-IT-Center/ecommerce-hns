"use client"

import { useActionState } from "react"
import { Loader2, TriangleAlert } from "lucide-react"
import { completeProfileAction } from "./actions"
import { EMPTY_COMPLETE_PROFILE_STATE } from "./state"

const inputClass =
  "w-full rounded-xl border border-input bg-muted/50 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:bg-background"

export function CompleteProfileForm({ nextPath }: { nextPath: string }) {
  const [state, action, pending] = useActionState(completeProfileAction, EMPTY_COMPLETE_PROFILE_STATE)

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <p className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {state.error}
        </p>
      )}

      <input type="hidden" name="next" value={nextPath} />

      <div>
        <label className="mb-1 block text-sm font-semibold" htmlFor="username">
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          required
          minLength={3}
          maxLength={32}
          pattern="[a-z0-9._\-]+"
          title="Huruf kecil, angka, titik, garis bawah, dan tanda hubung saja."
          autoFocus
          className={inputClass}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Huruf kecil, angka, titik, garis bawah, dan tanda hubung. Dipakai untuk masuk juga.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold" htmlFor="phoneNumber">
          Nomor HP
        </label>
        <input
          id="phoneNumber"
          name="phoneNumber"
          type="tel"
          autoComplete="tel"
          required
          placeholder="08xxxxxxxxxx"
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Simpan & Lanjut
      </button>
    </form>
  )
}
