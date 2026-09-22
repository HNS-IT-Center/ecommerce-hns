import type { Metadata } from "next"
import { requireAuth } from "@/lib/auth"
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password"
import { getSalesDisplayName, listAdminUsers } from "@/lib/api/admin-users"
import { listRoles } from "@/lib/api/roles"
import { ADMIN_ROLE_LABELS } from "@/lib/auth/roles"
import { bisaAkses, muatIzinUser } from "@/lib/auth/permissions"
import { ChangePasswordForm } from "./change-password-form"
import { SalesDisplayNameForm } from "./sales-display-name-form"
import { AdminRoleList } from "./admin-role-list"

export const metadata: Metadata = {
  title: "Akun Saya — Admin",
  robots: { index: false, follow: false },
}

export default async function AdminAkunPage() {
  // Layout panel sudah menolak pengunjung tanpa sesi, tapi halaman ini
  // menampilkan email akun — jadi ia butuh datanya sendiri, bukan sekadar
  // kepastian bahwa seseorang sudah masuk.
  const user = await requireAuth()
  const izin = await muatIzinUser(user)

  /**
   * Daftar seluruh akun admin hanya untuk OWNER.
   *
   * Sebelumnya bagian "Role Admin" tampil untuk siapa pun yang membuka halaman
   * ini — dan halaman ini `PAGES_SELALU_BOLEH`, terbuka untuk setiap admin dan
   * tidak bisa dicabut lewat peran mana pun. Akibatnya seorang Sales yang cuma
   * mau mengganti passwordnya ikut mendapat direktori seisi kantor: nama,
   * username, email, dan peran setiap rekannya. Itu bukan "Akun Saya".
   *
   * Pengelolaan tim punya tempatnya sendiri di Manajemen User → tab Admin, yang
   * memang dijaga izin. Yang di sini dihapus, bukan dikunci: kotak terkunci
   * masuk akal saat orangnya memang berurusan dengan fiturnya (seperti di tab
   * Admin, lihat catatan `canManage` di `admin-role-list.tsx`), sedangkan di
   * halaman akun pribadi ia cuma perabot yang tidak pernah relevan.
   *
   * Datanya pun tidak dibaca sama sekali kalau bukan owner — bukan sekadar
   * tidak dirender. Daftar yang tidak pernah dikirim tidak bisa terbaca dari
   * payload RSC.
   */
  const bolehLihatDaftarAdmin = user.role === "owner" || izin.isMaster
  const daftarTim = bolehLihatDaftarAdmin
    ? await Promise.all([listAdminUsers(), listRoles()])
    : null

  // Kartu nama tampilan hanya untuk yang memang berperan Sales — bagi yang lain
  // ia kolom tanpa akibat, dan kolom tanpa akibat di panel selalu berakhir
  // sebagai pertanyaan ke pengelola.
  const isSales = bisaAkses(izin, "quotation-sales", "edit")
  const salesDisplayName = isSales ? await getSalesDisplayName(user.id) : null

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

      {isSales && (
        <div className="mt-6 rounded-2xl border border-border bg-background p-5">
          <h2 className="font-bold">Nama Sales di Quotation</h2>
          <p className="mt-1 mb-5 text-sm text-muted-foreground">
            Nama ini yang tercetak sebagai <strong>Sales</strong> di PDF quotation yang Anda
            terbitkan. Mengubahnya <strong>tidak</strong> mengubah dokumen yang sudah dicetak
            sebelumnya.
          </p>

          <SalesDisplayNameForm current={salesDisplayName} accountName={user.name} />
        </div>
      )}

      {daftarTim && (
        <div className="mt-6 rounded-2xl border border-border bg-background p-5">
          <h2 className="font-bold">Role Admin</h2>
          <p className="mt-1 mb-5 text-sm text-muted-foreground">
            <strong>Owner</strong> bisa menghapus akun pelanggan dan mengatur role admin lain.{" "}
            <strong>Staff</strong> mengelola produk, kategori, toko, dan konten.
          </p>

          <AdminRoleList
            admins={daftarTim[0].map((a) => ({
              id: a.id,
              name: a.name,
              username: a.username,
              email: a.email,
              role: a.role,
              roleId: a.roleId,
            }))}
            currentUserId={user.id}
            roleOptions={daftarTim[1].map((r) => ({ id: r.id, name: r.name }))}
            canManage
          />
        </div>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        Lupa password saat ini? Belum ada pemulihan mandiri — hubungi pengelola sistem agar
        passwordnya disetel ulang lewat script.
      </p>
    </div>
  )
}
