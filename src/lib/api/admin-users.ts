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
import { capIzin, isMaster } from "@/lib/auth/permissions"

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
  // Sejak Satu Login, tabel `users` juga memuat PELANGGAN. Daftar admin hanya
  // yang berperan admin (bukan "pelanggan"), jadi panel akun tak menampilkan
  // ribuan pelanggan. Admin selalu punya username (dijaga saat pembuatan akun),
  // jadi `?? ""` di sini hanya menutup tipe nullable — praktis tak pernah kena.
  const rows = await getPrisma().user.findMany({
    where: { role: { not: "pelanggan" } },
    select: { id: true, email: true, name: true, username: true, role: true, roleId: true, createdAt: true },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  })
  return rows.map((r) => ({ ...r, username: r.username ?? "", role: parseAdminRole(r.role) }))
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
 * Beri peran ke seorang PELANGGAN — menaikkannya jadi bagian tim, atau
 * mengembalikannya jadi pelanggan biasa. Sejak Satu Login pelanggan adalah baris
 * di `users`, jadi ini update `role` + `roleId` sekaligus.
 *
 * - `roleId` = sebuah peran dinamis → `role` = "staff" (jadi admin non-owner)
 *   dengan izin sesuai peran itu.
 * - `roleId` = null → `role` = "pelanggan", kembali jadi pelanggan biasa.
 *
 * TIDAK pernah menetapkan `role` = "owner" lewat jalur ini: menaikkan seseorang
 * jadi owner (kuasa penuh) tidak pantas dilakukan dari daftar pelanggan.
 */
export async function setCustomerRole(userId: string, roleId: string | null): Promise<void> {
  if (roleId !== null) {
    const ada = await getPrisma().role.findUnique({ where: { id: roleId }, select: { id: true } })
    if (!ada) throw new Error("Peran tidak ditemukan.")
  }

  const target = await getPrisma().user.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  if (!target) throw new Error("Akun tidak ditemukan.")

  /**
   * Owner ikut kena penjaga yang sama seperti `setAdminUserRole`.
   *
   * Fungsi ini menulis `role` menjadi "pelanggan" atau "staff", jadi
   * menjalankannya pada satu-satunya owner akan menyisakan database tanpa owner
   * — persis keadaan yang dijaga berkas ini, lewat jalur yang melewatinya.
   * Catatan di kepala berkas sudah menyebut bahayanya: penjaganya hanya berguna
   * kalau SETIAP jalur perubahan role lewat sini.
   *
   * Selama ini tidak terjadi hanya karena kebetulan — pemanggilnya adalah
   * daftar pelanggan, dan akun owner tidak punya baris `customers` sehingga tak
   * pernah muncul di sana. Itu bukan penjaga, itu keberuntungan yang bergantung
   * pada bentuk data yang bisa berubah kapan saja.
   *
   * `updateMany` bersyarat `role: "owner"` dengan alasan yang sama seperti di
   * `setAdminUserRole`: dua penurunan bersamaan tidak boleh lolos berdua.
   */
  if (parseAdminRole(target.role) === "owner") {
    if ((await countOwners()) <= 1) throw new LastOwnerError()

    const { count } = await getPrisma().user.updateMany({
      where: { id: userId, role: "owner" },
      data: { role: roleId === null ? "pelanggan" : "staff", roleId },
    })
    if (count === 0) throw new LastOwnerError()
    return
  }

  await getPrisma().user.update({
    where: { id: userId },
    data: { role: roleId === null ? "pelanggan" : "staff", roleId },
  })
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

/**
 * Nama tampilan sales milik satu user, untuk mengisi formulir di /admin/akun.
 *
 * `null` berarti belum diatur — pemanggilnya jatuh ke `users.name`. Fungsi
 * sekecil ini tetap tinggal di lapisan `lib/api` dan bukan di halaman, karena
 * komponen (Server maupun Client) tidak boleh memanggil `getPrisma()` langsung
 * (CLAUDE.md §2.5).
 */
export async function getSalesDisplayName(userId: string): Promise<string | null> {
  const row = await getPrisma().user.findUnique({
    where: { id: userId },
    select: { salesDisplayName: true },
  })
  return row?.salesDisplayName ?? null
}

/**
 * User yang boleh menjadi TUJUAN operan CS — yaitu yang perannya memuat
 * `quotation-sales: edit`.
 *
 * Disaring dari `role_permissions`, bukan dari nama peran. Nama peran adalah
 * data yang diketik staff di panel ("Sales", "sales", "Sales Toko"); menjadikan
 * daftar ini bergantung padanya berarti mengganti nama peran diam-diam
 * mengosongkan daftar operan CS.
 *
 * Yang sengaja DIKELUARKAN:
 * - `excludeUserId` — CS tidak bisa "mengoper" ke dirinya sendiri; untuk itu ada
 *   pilihan "Tidak oper" yang menyimpan atas namanya tanpa mencetak nama Sales.
 * - master — akun developer, bukan orang yang melayani pelanggan di toko.
 *
 * Master dikenali lewat env (`MASTER_ADMIN_EMAIL`), sama seperti `isMaster`:
 * ia sengaja bukan baris data, jadi tidak bisa disaring lewat kueri.
 */
export async function listQuotationSalesUsers(
  excludeUserId?: string
): Promise<{ id: string; displayName: string }[]> {
  const rows = await getPrisma().user.findMany({
    where: {
      role: { not: "pelanggan" },
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      roleRef: {
        permissions: { some: { page: "quotation-sales", access: "edit" } },
      },
    },
    select: { id: true, name: true, email: true, salesDisplayName: true },
    orderBy: { name: "asc" },
  })

  return rows
    .filter((r) => !isMaster(r))
    .map((r) => ({ id: r.id, displayName: r.salesDisplayName ?? r.name }))
}

/**
 * Semua user berperan Sales beserta nama tampilannya — untuk panel admin.
 *
 * Bedanya dengan `listQuotationSalesUsers`: yang itu menjawab "siapa yang boleh
 * jadi TUJUAN operan" (master & diri sendiri dibuang), yang ini menjawab "siapa
 * saja yang namanya tercetak di quotation" — jadi tidak ada yang dibuang, dan
 * nama akun ikut dibawa supaya panel bisa menunjukkan nama apa yang dipakai
 * saat kolomnya dikosongkan.
 */
export async function listSalesUsersWithDisplayName(): Promise<
  { id: string; name: string; email: string; salesDisplayName: string | null }[]
> {
  return getPrisma().user.findMany({
    where: {
      role: { not: "pelanggan" },
      roleRef: { permissions: { some: { page: "quotation-sales", access: "edit" } } },
    },
    select: { id: true, name: true, email: true, salesDisplayName: true },
    orderBy: { name: "asc" },
  })
}

/**
 * Setel nama tampilan sales milik user LAIN (dari Manajemen User).
 *
 * `role: { not: "pelanggan" }` ikut di WHERE, bukan cuma diperiksa lebih dulu:
 * id yang dikirim klien tidak boleh bisa menunjuk baris pelanggan, dan syarat
 * yang hidup di dalam kueri tidak bisa dilewati oleh jalur kedua yang
 * ditambahkan orang lain nanti.
 */
export async function setSalesDisplayName(
  userId: string,
  displayName: string | null
): Promise<boolean> {
  const { count } = await getPrisma().user.updateMany({
    where: { id: userId, role: { not: "pelanggan" } },
    data: { salesDisplayName: displayName },
  })
  return count > 0
}

/**
 * "Cap" izin satu akun — satu string yang berubah setiap kali hak akses orang
 * itu berubah, apa pun bentuk perubahannya.
 *
 * Dipakai `PermissionWatcher` di panel: klien menyimpan cap yang berlaku saat
 * halamannya dimuat, lalu menanyakannya lagi secara berkala. Begitu capnya
 * berbeda, artinya ada yang mengubah aksesnya dan tampilan yang sedang dilihat
 * sudah tidak sesuai dengan yang sebenarnya berlaku di server.
 *
 * Tiga bagian, masing-masing menangkap perubahan yang tidak tertangkap yang
 * lain:
 *
 *   1. `role` — owner↔staff, dan penurunan menjadi "pelanggan" (akses panel
 *      dicabut sama sekali).
 *   2. `roleId` — peran dinamis ditautkan atau dilepas. Bagian ini juga yang
 *      menangkap PENGHAPUSAN sebuah peran: kolomnya dikosongkan oleh database
 *      lewat `onDelete: SetNull`, tanpa Prisma pernah menulis baris user itu.
 *   3. `updatedAt` peran — izin per halaman peran itu disunting. `updateRole`
 *      ikut menulis baris `roles` di transaksi yang sama, jadi capnya bergerak
 *      walau yang berubah hanya matriks izinnya.
 *
 * `users.updatedAt` sengaja TIDAK ikut, walau sekilas terlihat seperti penanda
 * paling lengkap. Kolom itu bergerak untuk SETIAP penulisan ke baris user —
 * termasuk staff yang mengubah nama tampilan sales miliknya sendiri. Kalau ia
 * ikut, orang itu akan melihat toast "Peran diperbarui" dan halamannya dimuat
 * ulang padahal tidak satu pun izinnya berubah. Cap yang berbohong sesekali
 * akan diabaikan, dan sesudah itu ia tidak lagi berguna saat benar-benar
 * penting. Ketiga bagian di atas sudah mencakup semua jalur yang benar-benar
 * mengubah akses.
 *
 * `null` berarti akunnya sudah tidak ada — dan itu juga perubahan yang perlu
 * disampaikan, bukan kesalahan yang perlu didiamkan.
 *
 * SATU query, kunci primer + join kunci primer. Dipanggil berkala oleh tiap
 * panel yang terbuka, jadi ia memang harus semurah ini.
 */
export async function getPermissionVersion(userId: string): Promise<string | null> {
  const row = await getPrisma().user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      roleId: true,
      roleRef: { select: { updatedAt: true } },
    },
  })
  if (!row) return null

  // Rumusnya di `lib/auth/permissions.ts` — dipakai bersama halaman di luar
  // panel (lihat `capIzin`), supaya "berubah" berarti hal yang sama di
  // kedua tempat.
  return capIzin({
    role: row.role,
    roleId: row.roleId,
    roleUpdatedAt: row.roleRef?.updatedAt,
  })
}
