"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import type { RoleRow } from "@/lib/api/roles"
import type { AccessLevel } from "@/lib/auth/permissions"
import { createRoleAction, updateRoleAction, deleteRoleAction } from "./actions"

type PageDef = { key: string; label: string }
const LEVELS: AccessLevel[] = ["none", "view", "edit"]
const LEVEL_LABEL: Record<AccessLevel, string> = { none: "Tak ada", view: "Lihat", edit: "Edit" }

type DraftForm = {
  id: string | null // null = buat baru
  name: string
  description: string
  levels: Record<string, AccessLevel>
}

/**
 * Kelola peran RBAC: daftar peran, buat/edit dengan matriks izin per halaman,
 * hapus. Halaman "manajemen-user" itu sendiri sengaja bisa diatur seperti yang
 * lain — tapi server tetap menjaga tiap perubahan (requirePermission), jadi
 * melepas izinnya di UI tidak membuka pintu apa pun di server.
 */
export function ManajemenUserView({
  roles,
  pages,
  bolehEdit,
}: {
  roles: RoleRow[]
  pages: PageDef[]
  bolehEdit: boolean
}) {
  const [draft, setDraft] = React.useState<DraftForm | null>(null)
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)

  function mulaiBuat() {
    setError(null)
    const levels: Record<string, AccessLevel> = {}
    for (const p of pages) levels[p.key] = "none"
    setDraft({ id: null, name: "", description: "", levels })
  }

  function mulaiEdit(role: RoleRow) {
    setError(null)
    const levels: Record<string, AccessLevel> = {}
    for (const p of pages) levels[p.key] = "none"
    for (const perm of role.permissions) levels[perm.page] = perm.access
    setDraft({ id: role.id, name: role.name, description: role.description ?? "", levels })
  }

  function simpan() {
    if (!draft) return
    setError(null)
    const permissions = Object.entries(draft.levels).map(([page, access]) => ({ page, access }))
    startTransition(async () => {
      const res = draft.id
        ? await updateRoleAction(draft.id, { name: draft.name, description: draft.description, permissions })
        : await createRoleAction({ name: draft.name, description: draft.description, permissions })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setDraft(null)
      // Server sudah revalidatePath; muat ulang agar daftar tercermin.
      window.location.reload()
    })
  }

  function hapus(role: RoleRow) {
    if (!confirm(`Hapus peran "${role.name}"? ${role.jumlahUser} admin yang memakainya akan kembali ke perilaku owner/staff lama.`)) return
    setError(null)
    startTransition(async () => {
      const res = await deleteRoleAction(role.id)
      if (!res.ok) {
        setError(res.error)
        return
      }
      window.location.reload()
    })
  }

  return (
    <div className="space-y-5">
      {bolehEdit && !draft && (
        <Button size="sm" onClick={mulaiBuat}>
          + Peran Baru
        </Button>
      )}

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Editor peran */}
      {draft && (
        <div className="rounded-2xl border border-border bg-background p-5 space-y-4">
          <h2 className="font-bold">{draft.id ? "Edit Peran" : "Peran Baru"}</h2>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium">Nama peran</span>
              <input
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="mis. Editor Harga"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                disabled={pending}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Deskripsi (opsional)</span>
              <input
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="mis. Hanya kelola harga"
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                disabled={pending}
              />
            </label>
          </div>

          {/* Matriks izin */}
          <div>
            <span className="text-sm font-medium">Izin per halaman</span>
            <div className="mt-2 overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-2 text-left font-medium">Halaman</th>
                    <th className="p-2 text-center font-medium">Akses</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.map((p) => (
                    <tr key={p.key} className="border-t">
                      <td className="p-2">{p.label}</td>
                      <td className="p-2">
                        <div className="flex justify-center gap-1">
                          {LEVELS.map((lv) => {
                            const aktif = draft.levels[p.key] === lv
                            return (
                              <button
                                key={lv}
                                type="button"
                                disabled={pending}
                                onClick={() => setDraft({ ...draft, levels: { ...draft.levels, [p.key]: lv } })}
                                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                                  aktif
                                    ? lv === "edit"
                                      ? "bg-green-600 text-white"
                                      : lv === "view"
                                        ? "bg-amber-500 text-white"
                                        : "bg-muted-foreground/70 text-background"
                                    : "bg-muted text-muted-foreground hover:bg-muted-foreground/20"
                                }`}
                              >
                                {LEVEL_LABEL[lv]}
                              </button>
                            )
                          })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={simpan} disabled={pending || draft.name.trim().length < 2}>
              {pending ? "Menyimpan…" : "Simpan"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDraft(null)} disabled={pending}>
              Batal
            </Button>
          </div>
        </div>
      )}

      {/* Daftar peran */}
      <div className="rounded-2xl border border-border bg-background overflow-hidden">
        {roles.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Belum ada peran. {bolehEdit && "Buat peran pertama dengan tombol di atas."}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {roles.map((role) => (
              <li key={role.id} className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="font-semibold">{role.name}</div>
                  {role.description && (
                    <div className="text-sm text-muted-foreground">{role.description}</div>
                  )}
                  <div className="mt-1 text-xs text-muted-foreground">
                    {role.jumlahUser} admin · {role.permissions.length} halaman berizin
                  </div>
                </div>
                {bolehEdit && (
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="outline" onClick={() => mulaiEdit(role)} disabled={pending}>
                      Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => hapus(role)} disabled={pending}>
                      Hapus
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
