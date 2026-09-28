"use server"

import { revalidatePath } from "next/cache"

import { requirePermission, ForbiddenError, UnauthorizedError } from "@/lib/auth"
import {
  createRole,
  updateRole,
  deleteRole,
  RoleNameTakenError,
  type RolePermissionRow,
} from "@/lib/api/roles"
import { ADMIN_PAGES, type AdminPage, type AccessLevel } from "@/lib/auth/permissions"
import { setSalesDisplayName } from "@/lib/api/admin-users"
import { MAX_SALES_DISPLAY_NAME } from "@/features/quotation/lib/sales-name"

/**
 * Server actions manajemen peran RBAC.
 *
 * Setiap action MEMANGGIL `requirePermission("manajemen-user", "edit")` di
 * dalamnya — bukan mengandalkan halaman yang tersembunyi. Mengatur siapa boleh
 * apa adalah kuasa paling sensitif di panel; ia harus dijaga di server, per
 * action, sama seperti `requireOwner` untuk penghapusan pelanggan.
 */

type ActionResult = { ok: true; id?: string } | { ok: false; error: string }

/** Validasi & normalkan matriks izin dari klien. Buang yang tak dikenal. */
function bersihkanIzin(raw: unknown): RolePermissionRow[] {
  if (!Array.isArray(raw)) return []
  const out: RolePermissionRow[] = []
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue
    const page = (item as { page?: unknown }).page
    const access = (item as { access?: unknown }).access
    if (typeof page !== "string" || !(page in ADMIN_PAGES)) continue
    if (access !== "none" && access !== "view" && access !== "edit") continue
    out.push({ page: page as AdminPage, access: access as AccessLevel })
  }
  return out
}

function validasiNama(name: unknown): string | null {
  if (typeof name !== "string") return null
  const t = name.trim()
  if (t.length < 2 || t.length > 64) return null
  return t
}

export async function createRoleAction(input: {
  name: string
  description: string
  permissions: unknown
}): Promise<ActionResult> {
  try {
    await requirePermission("manajemen-user", "edit")
    const name = validasiNama(input.name)
    if (!name) return { ok: false, error: "Nama peran harus 2–64 karakter." }
    const id = await createRole({
      name,
      description: input.description.trim() || null,
      permissions: bersihkanIzin(input.permissions),
    })
    revalidatePath("/admin/manajemen-user")
    return { ok: true, id }
  } catch (e) {
    return { ok: false, error: pesanError(e) }
  }
}

export async function updateRoleAction(
  id: string,
  input: { name: string; description: string; permissions: unknown },
): Promise<ActionResult> {
  try {
    await requirePermission("manajemen-user", "edit")
    const name = validasiNama(input.name)
    if (!name) return { ok: false, error: "Nama peran harus 2–64 karakter." }
    await updateRole(id, {
      name,
      description: input.description.trim() || null,
      permissions: bersihkanIzin(input.permissions),
    })
    revalidatePath("/admin/manajemen-user")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: pesanError(e) }
  }
}

export async function deleteRoleAction(id: string): Promise<ActionResult> {
  try {
    await requirePermission("manajemen-user", "edit")
    await deleteRole(id)
    revalidatePath("/admin/manajemen-user")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: pesanError(e) }
  }
}

function pesanError(e: unknown): string {
  if (e instanceof RoleNameTakenError) return e.message
  if (e instanceof ForbiddenError) return "Anda tidak punya izin mengelola peran."
  if (e instanceof UnauthorizedError) return e.message
  if (e instanceof Error) return e.message
  return "Terjadi kesalahan."
}

/**
 * Setel nama tampilan sales milik user lain.
 *
 * Batas panjangnya disamakan dengan yang dipakai sales sendiri di /admin/akun —
 * diimpor, bukan diketik ulang, supaya tidak ada dua ambang berbeda untuk satu
 * kolom database.
 */
export async function setSalesDisplayNameAction(input: {
  userId: string
  displayName: string
}): Promise<ActionResult> {
  try {
    await requirePermission("manajemen-user", "edit")
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof UnauthorizedError) {
      return { ok: false, error: error.message }
    }
    throw error
  }

  if (typeof input?.userId !== "string" || input.userId.length === 0) {
    return { ok: false, error: "User tidak dikenali." }
  }

  const trimmed = String(input.displayName ?? "").trim()
  if (trimmed.length > MAX_SALES_DISPLAY_NAME) {
    return { ok: false, error: `Nama tampilan maksimal ${MAX_SALES_DISPLAY_NAME} karakter.` }
  }

  // Kosong disimpan NULL, bukan string kosong — lihat catatan di
  // `updateSalesDisplayNameAction` (/admin/akun).
  const berhasil = await setSalesDisplayName(input.userId, trimmed.length > 0 ? trimmed : null)
  if (!berhasil) return { ok: false, error: "User tidak ditemukan." }

  revalidatePath("/admin/manajemen-user")
  revalidatePath("/admin/akun")
  return { ok: true }
}
