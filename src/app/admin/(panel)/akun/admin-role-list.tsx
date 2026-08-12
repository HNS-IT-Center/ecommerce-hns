"use client"

import { useActionState, useState } from "react"
import { CheckCircle2, Info, ShieldCheck, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ADMIN_ROLE_DESCRIPTIONS, ADMIN_ROLE_LABELS, type AdminRole } from "@/lib/auth/roles"

import { updateAdminRole } from "./role-actions"
import { EMPTY_ROLE_STATE } from "./role-state"

type AdminItem = {
  id: string
  name: string
  username: string
  email: string
  role: AdminRole
}

type Props = {
  admins: AdminItem[]
  currentUserId: string
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

export function AdminRoleList({ admins, currentUserId, canManage }: Props) {
  const [state, formAction, pending] = useActionState(updateAdminRole, EMPTY_ROLE_STATE)

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
  const notice = state.success && state.success !== dismissed ? state.success : null

  const ownerCount = admins.filter((a) => a.role === "owner").length

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

      {state.error && (
        <p className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {state.error}
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
                <form action={formAction} className="shrink-0">
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
                    disabled={pending || lockedReason !== null}
                    title={lockedReason ?? undefined}
                    className="w-full sm:w-auto"
                  >
                    {admin.role === "owner" ? "Turunkan ke Staff" : "Angkat jadi Owner"}
                  </Button>
                </form>
              )}
            </li>
          )
        })}
      </ul>

      {!canManage && (
        <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          Hanya akun <strong>owner</strong> yang bisa mengubah role. Hubungi owner kalau akses Anda
          perlu diubah.
        </p>
      )}
    </div>
  )
}
