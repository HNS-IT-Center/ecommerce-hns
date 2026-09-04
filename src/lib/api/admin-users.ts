/**
 * Akses data akun admin (`users`) — khususnya pengaturan role.
 *
 * Dikumpulkan di sini, bukan disebar sebagai `getPrisma()` di server action,
 * mengikuti CLAUDE.md §2.5. Yang dijaga berkas ini bukan cuma bentuk query:
 * penjaga "owner terakhir" hanya berguna kalau SETIAP jalur perubahan role
 * lewat sini.
 */
import { getPrisma } from "@/lib/prisma/client"
import { parseAdminRole, type AdminRole } from "@/lib/auth/roles"

export type AdminUserRow = {
  id: string
  email: string
  name: string
  username: string
  role: AdminRole
  /** Peran RBAC dinamis yang tertaut (null = pakai `role` lama). */
  roleId: string | null
  createdAt: Date
}

/** Dilempar saat tindakan akan menyisakan database tanpa satu pun owner. */
export class LastOwnerError extends Error {
  constructor(
    message = "Ini satu-satunya akun owner. Angkat admin lain jadi owner dulu sebelum mengubah atau menghapus akun ini.",
  ) {
    super(message)
    this.name = "LastOwnerError"
  }
}

export async function listAdminUsers(): Promise<AdminUserRow[]> {
  const rows = await getPrisma().user.findMany({
    select: { id: true, email: true, name: true, username: true, role: true, roleId: true, createdAt: true },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  })
  return rows.map((r) => ({ ...r, role: parseAdminRole(r.role) }))
}

export async function countOwners(): Promise<number> {
  return getPrisma().user.count({ where: { role: "owner" } })
}

/**
 * Ubah role satu admin.
 *
 * Menolak kalau tindakannya akan menyisakan nol owner. Pemeriksaannya di sini,
 * BUKAN cuma di server action: kalau ia hidup di action saja, jalur kedua yang
 * ditambahkan orang lain nanti (skrip, route handler, action baru) melewatinya
 * tanpa ada yang sadar.
 *
 * `updateMany` dengan syarat `role: "owner"`, bukan `update` biasa. Dua owner
 * yang menurunkan diri bersamaan sama-sama lolos hitungan "owner > 1", lalu
 * dua-duanya turun dan panel terkunci. Dengan syarat itu ikut di WHERE,
 * pemenang keduanya menyentuh baris yang rolenya sudah berubah, `count`-nya 0,
 * dan pemanggil tahu tindakannya tidak jadi.
 *
 * Ini tidak menutup semua celah tanpa transaksi serialisable, tapi menutup yang
 * realistis untuk panel dengan segelintir pengguna.
 */
export async function setAdminUserRole(id: string, role: AdminRole): Promise<void> {
  if (role === "owner") {
    await getPrisma().user.update({ where: { id }, data: { role } })
    return
  }

  const target = await getPrisma().user.findUnique({ where: { id }, select: { role: true } })
  if (!target) return

  // Menurunkan yang memang sudah staff tidak mengubah apa pun, dan tidak boleh
  // ikut kena penjaga owner terakhir.
  if (parseAdminRole(target.role) !== "owner") {
    return
  }

  if ((await countOwners()) <= 1) throw new LastOwnerError()

  const { count } = await getPrisma().user.updateMany({
    where: { id, role: "owner" },
    data: { role: "staff" },
  })
  if (count === 0) throw new LastOwnerError()
}

/**
 * Tautkan (atau lepaskan) peran RBAC dinamis ke satu admin.
 *
 * `roleId` null = lepas peran → admin kembali ke perilaku `role` lama
 * (owner/staff). Tidak menyentuh kolom `role` lama sama sekali: keduanya hidup
 * berdampingan — `role` menentukan hak owner-only (hapus pelanggan), `roleId`
 * menentukan izin per-halaman. Validasi bahwa `roleId` benar-benar ada
 * dilakukan di sini supaya foreign key tidak gagal dengan pesan kasar.
 */
export async function setAdminUserRoleId(id: string, roleId: string | null): Promise<void> {
  if (roleId !== null) {
    const ada = await getPrisma().role.findUnique({ where: { id: roleId }, select: { id: true } })
    if (!ada) throw new Error("Peran tidak ditemukan.")
  }
  await getPrisma().user.update({ where: { id }, data: { roleId } })
}

/**
 * Pastikan `id` bukan owner terakhir sebelum akunnya dihapus.
 *
 * Dipisah dari `setAdminUserRole` karena penghapusan akun admin belum ada di
 * panel ini — fungsinya disediakan supaya jalur itu, kapan pun dibuat, punya
 * penjaga yang sama. Menghapus owner terakhir mengunci panel persis seperti
 * menurunkannya.
 */
export async function assertNotLastOwner(id: string): Promise<void> {
  const target = await getPrisma().user.findUnique({ where: { id }, select: { role: true } })
  if (!target) return
  if (parseAdminRole(target.role) !== "owner") return
  if ((await countOwners()) <= 1) throw new LastOwnerError()
}
