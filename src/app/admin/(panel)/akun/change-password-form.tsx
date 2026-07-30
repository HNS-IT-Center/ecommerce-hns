"use client"

import { useActionState, useEffect, useRef } from "react"
import { CircleCheck, Loader2, TriangleAlert } from "lucide-react"
import { changePasswordAction } from "./actions"
import { EMPTY_ACCOUNT_STATE } from "./state"

const inputClass =
  "w-full rounded-xl border border-input bg-muted/50 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:bg-background"

/**
 * `minLength` diterima sebagai prop, TIDAK diimpor dari `lib/auth/password`.
 * Modul itu menarik `node:crypto`, dan mengimpornya dari komponen klien akan
 * menyeretnya ke dalam bundel peramban. Halaman induk yang berjalan di server
 * mengambil angkanya lalu menurunkannya ke sini.
 *
 * Angka ini hanya membantu pengguna lebih cepat sadar; ambang yang sebenarnya
 * berlaku tetap diperiksa ulang di server action, karena atribut di HTML bisa
 * dihapus siapa saja dari perambannya sendiri.
 */
export function ChangePasswordForm({ minLength }: { minLength: number }) {
  const [state, action, pending] = useActionState(changePasswordAction, EMPTY_ACCOUNT_STATE)
  const formRef = useRef<HTMLFormElement>(null)

  // Kosongkan kolom setelah berhasil. Membiarkan password lama dan baru tetap
  // terisi di halaman yang sudah selesai tidak ada gunanya, dan halaman panel
  // sering ditinggal terbuka di layar bersama.
  useEffect(() => {
    if (state.ok) formRef.current?.reset()
  }, [state.ok])

  return (
    <form ref={formRef} action={action} className="space-y-4">
      {state.error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {state.error}
        </p>
      )}

      {state.ok && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-xl border border-brand-green/30 bg-brand-green/10 px-4 py-3 text-sm text-brand-green"
        >
          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" />
          {state.ok}
        </p>
      )}

      <div>
        <label className="mb-1 block text-sm font-semibold" htmlFor="currentPassword">
          Password saat ini
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold" htmlFor="newPassword">
          Password baru
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={minLength}
          aria-describedby="newPasswordHint"
          className={inputClass}
        />
        <p id="newPasswordHint" className="mt-1 text-xs text-muted-foreground">
          Minimal {minLength} karakter.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold" htmlFor="confirmPassword">
          Ulangi password baru
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={minLength}
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60 sm:w-auto"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Ganti Password
      </button>
    </form>
  )
}
