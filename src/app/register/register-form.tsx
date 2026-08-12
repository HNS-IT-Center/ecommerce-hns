"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, TriangleAlert, Eye, EyeOff } from "lucide-react"
import { registerAction } from "./actions"
import { EMPTY_REGISTER_STATE } from "./state"

const inputClass =
  "w-full rounded-xl border border-input bg-muted/50 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:bg-background"

/**
 * Field password dengan tombol lihat/sembunyikan.
 *
 * `pr-10` menyisakan ruang untuk tombolnya supaya teks yang diketik tidak
 * tertindih ikon saat password-nya panjang.
 */
function PasswordField({
  id,
  name,
  label,
  value,
  onChange,
  autoComplete,
  hint,
}: {
  id: string
  name: string
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete: string
  hint?: string
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div>
      <label className="mb-1 block text-sm font-semibold" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          minLength={10}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass} pr-10`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Sembunyikan password" : "Lihat password"}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function RegisterForm() {
  const router = useRouter()
  const [state, action, pending] = useActionState(registerAction, EMPTY_REGISTER_STATE)

  // Form dikendalikan penuh (controlled) supaya SEMUA input tetap terisi
  // setelah submit yang gagal — bawaan `useActionState` (form tidak
  // dikendalikan) mengosongkan seluruh field begitu request selesai,
  // termasuk nama/email/dll yang sudah benar. Pengguna yang cuma salah ketik
  // konfirmasi password tidak seharusnya mengulang dari nol.
  const [name, setName] = useState("")
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  // Dicek di klien SEBELUM submit ke server — supaya "password tidak sama"
  // tidak perlu bolak-balik ke server dulu, dan supaya pesannya tidak
  // tertimpa render ulang `state.error` dari percobaan sebelumnya kalau
  // submit ini malah divalidasi gagal karena hal lain.
  const [localError, setLocalError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    setLocalError(null)
    if (password !== confirmPassword) {
      e.preventDefault()
      setLocalError("Konfirmasi password tidak sama.")
    }
  }

  // Redirect ke halaman "cek email" HANYA setelah sukses — bukan di dalam
  // action itu sendiri (server action tidak boleh redirect ke halaman lain
  // sambil masih membawa pesan sukses ke klien; di sini kita justru
  // butuh klien yang menavigasi supaya pesannya konsisten dengan alur
  // resend-verification yang juga mendarat di halaman yang sama).
  useEffect(() => {
    if (state.ok) router.push("/register/cek-email")
  }, [state.ok, router])

  const errorToShow = localError ?? state.error

  return (
    <form action={action} onSubmit={handleSubmit} className="space-y-4">
      {errorToShow && (
        <p className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {errorToShow}
        </p>
      )}

      <div>
        <label className="mb-1 block text-sm font-semibold" htmlFor="name">
          Nama
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
      </div>

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
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className={inputClass}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Huruf kecil, angka, titik, garis bawah, dan tanda hubung. Dipakai untuk masuk juga.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
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
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          className={inputClass}
        />
      </div>

      <PasswordField
        id="password"
        name="password"
        label="Password"
        autoComplete="new-password"
        value={password}
        onChange={setPassword}
        hint="Minimal 10 karakter."
      />

      <PasswordField
        id="confirmPassword"
        name="confirmPassword"
        label="Konfirmasi Password"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={setConfirmPassword}
      />

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
