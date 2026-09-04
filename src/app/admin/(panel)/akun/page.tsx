import type { Metadata } from "next"
import { requireAuth } from "@/lib/auth"
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password"
import { listAdminUsers } from "@/lib/api/admin-users"
import { listRoles } from "@/lib/api/roles"
import { ADMIN_ROLE_LABELS } from "@/lib/auth/roles"
import { ChangePasswordForm } from "./change-password-form"
import { AdminRoleList } from "./admin-role-list"

export const metadata: Metadata = {
  title: "Akun Saya — Admin HNS IT Center",
  robots: { index: false, follow: false },
}

export default async function AdminAkunPage() {
  // Layout panel sudah menolak pengunjung tanpa sesi, tapi halaman ini
  // menampilkan email akun — jadi ia butuh datanya sendiri, bukan sekadar
  // kepastian bahwa seseorang sudah masuk.
  const user = await requireAuth()
  const [admins, roles] = await Promise.all([listAdminUsers(), listRoles()])

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">Akun Saya</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Ganti password akun <strong className="font-semibold">{user.email}</strong>. Role Anda:{" "}
        <strong className="font-semibold">{ADMIN_ROLE_LABELS[user.role]}</strong>.
      </p>

      <div className="mt-6 rounded-2xl border border-border bg-background p-5">
        <h2 className="font-bold">Ganti Password</h2>
        <p className="mt-1 mb-5 text-sm text-muted-foreground">
          Setelah diganti, sesi di semua perangkat lain akan diputus dan harus masuk ulang. Sesi di
          perangkat ini tetap berjalan.
        </p>

        <ChangePasswordForm minLength={MIN_PASSWORD_LENGTH} />
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-background p-5">
        <h2 className="font-bold">Role Admin</h2>
        <p className="mt-1 mb-5 text-sm text-muted-foreground">
          <strong>Owner</strong> bisa menghapus akun pelanggan dan mengatur role admin lain.{" "}
          <strong>Staff</strong> mengelola produk, kategori, toko, dan konten.
        </p>

        <AdminRoleList
          admins={admins.map((a) => ({
            id: a.id,
            name: a.name,
            username: a.username,
            email: a.email,
            role: a.role,
            roleId: a.roleId,
          }))}
          currentUserId={user.id}
          roleOptions={roles.map((r) => ({ id: r.id, name: r.name }))}
          canManage={user.role === "owner"}
        />
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Lupa password saat ini? Belum ada pemulihan mandiri — hubungi pengelola sistem agar
        passwordnya disetel ulang lewat script.
      </p>
    </div>
  )
}
