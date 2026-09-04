"use server"

import { revalidatePath } from "next/cache"
import { ForbiddenError, UnauthorizedError, requireOwner } from "@/lib/auth"
import { LastOwnerError, setAdminUserRole, setAdminUserRoleId } from "@/lib/api/admin-users"
import { isAdminRole } from "@/lib/auth/roles"
import type { RoleActionState } from "./role-state"

/**
 * Ubah role satu akun admin.
 *
 * `requireOwner()` dipanggil di dalam action ini sendiri — lihat catatan yang
 * sama di `pelanggan/actions.ts`. Hanya owner yang boleh mengatur role; kalau
 * staff bisa menaikkan dirinya sendiri jadi owner, pemisahan rolenya tidak
 * berarti apa-apa.
 *
 * Penjaga "owner terakhir" ada DUA LAPIS dan itu disengaja:
 *
 *   1. Di sini, untuk kasus yang paling sering: owner menurunkan DIRINYA
 *      SENDIRI. Dijawab lebih awal supaya pesannya bisa spesifik.
 *   2. Di `setAdminUserRole` (lib/api/admin-users.ts), yang berlaku untuk
 *      SIAPA pun yang diturunkan lewat jalur mana pun — termasuk jalur baru
 *      yang ditambahkan orang lain nanti dan lupa memeriksa apa pun.
 *
 * Lapis kedua yang sebenarnya menjaga. Lapis pertama cuma memberi pesan yang
 * lebih enak dibaca.
 */
export async function updateAdminRole(
  _prev: RoleActionState,
  formData: FormData,
): Promise<RoleActionState> {
  try {
    const actor = await requireOwner()

    const userId = String(formData.get("userId") ?? "").trim()
    const role = String(formData.get("role") ?? "").trim()

    if (!userId) return { error: "Akun tidak dikenali.", success: null }
    if (!isAdminRole(role)) return { error: "Role tidak dikenali.", success: null }

    if (userId === actor.id && role === "staff") {
      return {
        error:
          "Anda tidak bisa menurunkan role akun Anda sendiri. Minta owner lain yang melakukannya.",
        success: null,
      }
    }

    await setAdminUserRole(userId, role)
    revalidatePath("/admin/akun")

    return { error: null, success: "Role berhasil diperbarui." }
  } catch (error) {
    if (
      error instanceof UnauthorizedError ||
      error instanceof ForbiddenError ||
      error instanceof LastOwnerError
    ) {
      return { error: error.message, success: null }
    }
    throw error
  }
}

/**
 * Tautkan peran RBAC dinamis ke satu admin (atau lepas dengan roleId kosong).
 * Hanya owner — sama seperti `updateAdminRole`: mengatur izin orang lain adalah
 * kuasa owner. `roleId` kosong string berarti "lepas" (kembali ke owner/staff).
 */
export async function updateAdminRoleId(
  _prev: RoleActionState,
  formData: FormData,
): Promise<RoleActionState> {
  try {
    await requireOwner()

    const userId = String(formData.get("userId") ?? "").trim()
    const roleIdRaw = String(formData.get("roleId") ?? "").trim()
    if (!userId) return { error: "Akun tidak dikenali.", success: null }

    await setAdminUserRoleId(userId, roleIdRaw === "" ? null : roleIdRaw)
    revalidatePath("/admin/akun")

    return {
      error: null,
      success: roleIdRaw === "" ? "Peran dilepas." : "Peran berhasil ditautkan.",
    }
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      return { error: error.message, success: null }
    }
    if (error instanceof Error) return { error: error.message, success: null }
    throw error
  }
}
