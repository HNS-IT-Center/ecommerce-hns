"use client"

import { useActionState, useEffect, useState } from "react"
import { CheckCircle2, Info, ShieldCheck, X, Check } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ADMIN_ROLE_DESCRIPTIONS, ADMIN_ROLE_LABELS, type AdminRole } from "@/lib/auth/roles"

import { updateAdminRole, updateAdminRoleId } from "./role-actions"
import { EMPTY_ROLE_STATE } from "./role-state"

/** Posisi & sasaran menu klik-kanan. */
type CtxMenu = { x: number; y: number; adminId: string; currentRoleId: string | null; role: AdminRole } | null

type AdminItem = {
  id: string
  name: string
  username: string
  email: string
  role: AdminRole
  /** Peran RBAC dinamis yang tertaut (null = pakai role lama). */
  roleId: string | null
}

/** Peran dinamis yang bisa dipilih (dibuat di Manajemen User). */
type RoleOption = { id: string; name: string }

type Props = {
  admins: AdminItem[]
  currentUserId: string
  /** Peran dinamis yang tersedia untuk ditautkan. */
  roleOptions: RoleOption[]
  /**
   * Hanya owner yang boleh mengubah role. Staff tetap MELIHAT kolomnya —
   * menyembunyikan seluruh bagian ini akan membuat staff mengira fiturnya tidak
   * ada, lalu bertanya-tanya kenapa ia tidak bisa menghapus akun pelanggan.
   * Yang terlihat tapi terkunci menjelaskan dirinya sendiri.
   */
  canManage: boolean
}

function RoleBadge({ role }: { role: AdminRole }) {
  return (
    <span
      className={
        role === "owner"
          ? "inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary"
          : "inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground"
      }
    >
      {role === "owner" && <ShieldCheck className="h-3 w-3" />}
      {ADMIN_ROLE_LABELS[role]}
    </span>
  )
}

export function AdminRoleList({ admins, currentUserId, roleOptions, canManage }: Props) {
  const [state, formAction, pending] = useActionState(updateAdminRole, EMPTY_ROLE_STATE)
  const [roleIdState, roleIdAction, roleIdPending] = useActionState(updateAdminRoleId, EMPTY_ROLE_STATE)

  /**
   * Keterangan hasil, disesuaikan saat render alih-alih lewat `useEffect` —
   * aturan lint `set-state-in-effect` berlaku di repo ini, dan pola efek
   * membuat pesannya baru muncul satu render setelah datanya ada.
   *
   * `dismissed` menyimpan pesan yang sudah ditutup staff, bukan boolean:
   * dengan boolean, pengubahan role BERIKUTNYA tidak akan memunculkan
   * keterangan baru karena penandanya masih menyala dari yang sebelumnya.
   */
  const [dismissed, setDismissed] = useState<string | null>(null)
  const sukses = roleIdState.success ?? state.success
  const notice = sukses && sukses !== dismissed ? sukses : null
  const errorPesan = state.error ?? roleIdState.error
  const sedangProses = pending || roleIdPending

  const ownerCount = admins.filter((a) => a.role === "owner").length

  // Menu klik-kanan untuk ubah peran langsung.
  const [ctx, setCtx] = useState<CtxMenu>(null)
  // Tutup menu saat klik di mana saja / tekan Escape / scroll.
  useEffect(() => {
    if (!ctx) return
    const tutup = () => setCtx(null)
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setCtx(null)
    window.addEventListener("click", tutup)
    window.addEventListener("scroll", tutup, true)
    window.addEventListener("keydown", esc)
    return () => {
      window.removeEventListener("click", tutup)
      window.removeEventListener("scroll", tutup, true)
      window.removeEventListener("keydown", esc)
    }
  }, [ctx])

  /** Ubah peran dinamis (roleId) lewat menu — submit programatik ke action. */
  function pilihPeran(adminId: string, roleId: string) {
    const fd = new FormData()
    fd.set("userId", adminId)
    fd.set("roleId", roleId) // "" = lepas → kembali ke owner/staff
    roleIdAction(fd)
    setCtx(null)
  }

  return (
    <div>
      {notice && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-success/30 bg-success/10 p-3 text-sm">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          <p className="flex-1">{notice}</p>
          <button
            type="button"
            onClick={() => setDismissed(notice)}
            aria-label="Tutup keterangan"
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {errorPesan && (
        <p className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {errorPesan}
        </p>
      )}

      <ul className="space-y-3">
        {admins.map((admin) => {
          const isSelf = admin.id === currentUserId
          // Owner terakhir tidak boleh diturunkan — penjaga sebenarnya ada di
          // server (lib/api/admin-users.ts). Di sini cuma supaya tombolnya tidak
          // menawarkan sesuatu yang pasti ditolak.
          const isLastOwner = admin.role === "owner" && ownerCount <= 1
          const lockedReason = isLastOwner
            ? "Ini satu-satunya owner. Angkat admin lain jadi owner dulu."
            : isSelf && admin.role === "owner"
              ? "Anda tidak bisa menurunkan role akun sendiri."
              : null

          return (
            <li
              key={admin.id}
              onContextMenu={
                canManage
                  ? (e) => {
                      e.preventDefault()
                      setCtx({ x: e.clientX, y: e.clientY, adminId: admin.id, currentRoleId: admin.roleId, role: admin.role })
                    }
                  : undefined
              }
              className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold break-words">{admin.name}</span>
                  {isSelf && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      Anda
                    </span>
                  )}
                  <RoleBadge role={admin.role} />
                </div>
                <p className="mt-0.5 text-sm break-all text-muted-foreground">
                  @{admin.username} · {admin.email}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {ADMIN_ROLE_DESCRIPTIONS[admin.role]}
                </p>
              </div>

              {canManage && (
                <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                  <form action={formAction}>
                    <input type="hidden" name="userId" value={admin.id} />
                    <input
                      type="hidden"
                      name="role"
                      value={admin.role === "owner" ? "staff" : "owner"}
                    />
                    <Button
                      type="submit"
                      variant="outline"
                      size="sm"
                      disabled={sedangProses || lockedReason !== null}
                      title={lockedReason ?? undefined}
                      className="w-full sm:w-auto"
                    >
                      {admin.role === "owner" ? "Turunkan ke Staff" : "Angkat jadi Owner"}
                    </Button>
                  </form>

                  {/* Peran RBAC dinamis — izin per halaman. Terpisah dari
                      owner/staff: yang ini menentukan halaman apa yang boleh
                      diakses, submit langsung saat pilihan berubah. */}
                  <form action={roleIdAction} className="flex items-center gap-1.5">
                    <input type="hidden" name="userId" value={admin.id} />
                    <label className="text-xs text-muted-foreground">Peran:</label>
                    <select
                      name="roleId"
                      defaultValue={admin.roleId ?? ""}
                      disabled={sedangProses}
                      onChange={(e) => e.currentTarget.form?.requestSubmit()}
                      className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                    >
                      <option value="">— (owner/staff)</option>
                      {roleOptions.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </form>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {canManage && (
        <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          Tip: <strong>klik kanan</strong> pada baris admin untuk mengubah perannya langsung.
        </p>
      )}

      {!canManage && (
        <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          Hanya akun <strong>owner</strong> yang bisa mengubah role. Hubungi owner kalau akses Anda
          perlu diubah.
        </p>
      )}

      {/* Menu klik-kanan: daftar peran, klik = langsung ubah. Diposisikan di
          koordinat kursor; menutup sendiri saat klik/scroll/Escape. */}
      {ctx && (
        <div
          role="menu"
          onClick={(e) => e.stopPropagation()}
          style={{ top: ctx.y, left: ctx.x }}
          className="fixed z-50 min-w-52 overflow-hidden rounded-lg border border-border bg-background py-1 shadow-lg"
        >
          <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">Ubah peran</div>
          {/* Opsi "lepas" — kembali ke owner/staff lama. */}
          <button
            type="button"
            role="menuitem"
            disabled={sedangProses}
            onClick={() => pilihPeran(ctx.adminId, "")}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-50"
          >
            <span className="w-4">{ctx.currentRoleId === null && <Check className="h-4 w-4 text-primary" />}</span>
            — (owner/staff)
          </button>
          {roleOptions.map((r) => (
            <button
              key={r.id}
              type="button"
              role="menuitem"
              disabled={sedangProses}
              onClick={() => pilihPeran(ctx.adminId, r.id)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-50"
            >
              <span className="w-4">{ctx.currentRoleId === r.id && <Check className="h-4 w-4 text-primary" />}</span>
              {r.name}
            </button>
          ))}
          {roleOptions.length === 0 && (
            <div className="px-3 py-1.5 text-xs text-muted-foreground">
              Belum ada peran. Buat di tab Peran dulu.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
