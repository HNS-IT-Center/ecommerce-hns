/**
 * Akses data peran RBAC (`roles` + `role_permissions`).
 *
 * Dikumpulkan di sini, bukan `getPrisma()` di server action, mengikuti §2.5.
 * Daftar halaman & level yang sah dipegang `permissions.ts` — berkas ini hanya
 * menyimpan/membaca, validasinya di server action pemanggil.
 */
import { getPrisma } from "@/lib/prisma/client"
import type { AccessLevel, AdminPage } from "@/lib/auth/permissions"

export type RolePermissionRow = { page: AdminPage; access: AccessLevel }

export type RoleRow = {
  id: string
  name: string
  description: string | null
  /** Jumlah admin yang memakai peran ini — untuk peringatan saat menghapus. */
  jumlahUser: number
  permissions: RolePermissionRow[]
  createdAt: Date
}

/** Dilempar saat nama peran bentrok dengan yang sudah ada. */
export class RoleNameTakenError extends Error {
  constructor(name: string) {
    super(`Sudah ada peran bernama "${name}". Pakai nama lain.`)
    this.name = "RoleNameTakenError"
  }
}

/** Semua peran + izin + jumlah pemakainya. */
export async function listRoles(): Promise<RoleRow[]> {
  const rows = await getPrisma().role.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      permissions: { select: { page: true, access: true } },
      _count: { select: { users: true } },
    },
    orderBy: { name: "asc" },
  })
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    jumlahUser: r._count.users,
    permissions: r.permissions as RolePermissionRow[],
    createdAt: r.createdAt,
  }))
}

/** Satu peran dengan izinnya, atau null. */
export async function getRole(id: string): Promise<RoleRow | null> {
  const r = await getPrisma().role.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      permissions: { select: { page: true, access: true } },
      _count: { select: { users: true } },
    },
  })
  if (!r) return null
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    jumlahUser: r._count.users,
    permissions: r.permissions as RolePermissionRow[],
    createdAt: r.createdAt,
  }
}

/** Buat peran baru dengan izinnya. Lempar `RoleNameTakenError` kalau nama dipakai. */
export async function createRole(input: {
  name: string
  description: string | null
  permissions: RolePermissionRow[]
}): Promise<string> {
  const prisma = getPrisma()
  const ada = await prisma.role.findUnique({ where: { name: input.name }, select: { id: true } })
  if (ada) throw new RoleNameTakenError(input.name)

  const role = await prisma.role.create({
    data: {
      name: input.name,
      description: input.description,
      // Hanya simpan yang bukan "none": ketiadaan baris SUDAH berarti "none"
      // (aman-tertutup di muatIzinUser), jadi menyimpan "none" cuma baris mubazir.
      permissions: {
        create: input.permissions
          .filter((p) => p.access !== "none")
          .map((p) => ({ page: p.page, access: p.access })),
      },
    },
    select: { id: true },
  })
  return role.id
}

/**
 * Perbarui peran: nama, deskripsi, dan SELURUH izinnya (ganti total).
 *
 * Izin ditulis ulang dengan hapus-lalu-buat dalam satu transaksi, bukan
 * di-diff: matriks izin dikirim utuh dari UI, jadi mengganti seluruhnya lebih
 * sederhana dan tidak meninggalkan baris basi.
 */
export async function updateRole(
  id: string,
  input: { name: string; description: string | null; permissions: RolePermissionRow[] },
): Promise<void> {
  const prisma = getPrisma()
  const bentrok = await prisma.role.findFirst({
    where: { name: input.name, id: { not: id } },
    select: { id: true },
  })
  if (bentrok) throw new RoleNameTakenError(input.name)

  await prisma.$transaction([
    prisma.role.update({
      where: { id },
      data: { name: input.name, description: input.description },
    }),
    prisma.rolePermission.deleteMany({ where: { roleId: id } }),
    prisma.rolePermission.createMany({
      data: input.permissions
        .filter((p) => p.access !== "none")
        .map((p) => ({ roleId: id, page: p.page, access: p.access })),
    }),
  ])
}

/**
 * Hapus peran. Admin yang memakainya otomatis kembali ke perilaku owner/staff
 * lama (foreign key `onDelete: SetNull`), dan izinnya ikut terhapus (cascade).
 */
export async function deleteRole(id: string): Promise<void> {
  await getPrisma().role.delete({ where: { id } })
}
