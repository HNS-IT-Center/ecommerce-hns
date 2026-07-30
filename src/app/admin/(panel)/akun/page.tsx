import type { Metadata } from "next"
import { requireAuth } from "@/lib/auth"
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password"
import { ChangePasswordForm } from "./change-password-form"

export const metadata: Metadata = {
  title: "Akun Saya — Admin HNS IT Center",
  robots: { index: false, follow: false },
}

export default async function AdminAkunPage() {
  // Layout panel sudah menolak pengunjung tanpa sesi, tapi halaman ini
  // menampilkan email akun — jadi ia butuh datanya sendiri, bukan sekadar
  // kepastian bahwa seseorang sudah masuk.
  const user = await requireAuth()

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold">Akun Saya</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Ganti password akun <strong className="font-semibold">{user.email}</strong>.
      </p>

      <div className="mt-6 rounded-2xl border border-border bg-background p-5">
        <h2 className="font-bold">Ganti Password</h2>
        <p className="mt-1 mb-5 text-sm text-muted-foreground">
          Setelah diganti, sesi di semua perangkat lain akan diputus dan harus masuk ulang. Sesi di
          perangkat ini tetap berjalan.
        </p>

        <ChangePasswordForm minLength={MIN_PASSWORD_LENGTH} />
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Lupa password saat ini? Belum ada pemulihan mandiri — hubungi pengelola sistem agar
        passwordnya disetel ulang lewat script.
      </p>
    </div>
  )
}
