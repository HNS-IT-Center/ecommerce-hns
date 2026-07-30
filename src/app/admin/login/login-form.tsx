"use client"

import { useActionState } from "react"
import { Loader2, TriangleAlert } from "lucide-react"
import { loginAction } from "./actions"
import { EMPTY_LOGIN_STATE } from "./state"

const inputClass =
  "w-full rounded-xl border border-input bg-muted/50 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:bg-background"

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, action, pending] = useActionState(loginAction, EMPTY_LOGIN_STATE)

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <p className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {state.error}
        </p>
      )}

      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      <div>
        <label className="mb-1 block text-sm font-semibold" htmlFor="identifier">
          Email atau Username
        </label>
        {/*
          `type="text"`, BUKAN `type="email"`. Dengan `type="email"` peramban
          menolak sendiri apa pun yang tidak mengandung '@' — jadi username
          seperti `admin` tidak akan pernah sampai ke server, dan orangnya hanya
          melihat gelembung "masukkan alamat email" tanpa tahu apa yang salah.

          `autoComplete="username"` tetap dipakai apa adanya: itu memang nilai
          standar untuk kolom identitas di formulir masuk, terlepas dari
          isinya email atau bukan, dan pengelola password bergantung padanya
          untuk memasangkan kolom ini dengan kolom password di bawah.
        */}
        <input
          id="identifier"
          name="identifier"
          type="text"
          autoComplete="username"
          required
          autoFocus
          className={inputClass}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold" htmlFor="password">
          Password
        </label>
        <input
          id="password"
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
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Masuk
      </button>
    </form>
  )
}
