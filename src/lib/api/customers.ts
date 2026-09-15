/**
 * Akses data akun pelanggan untuk panel admin.
 *
 * Lewat sini, bukan `getPrisma()` di komponen atau server action (CLAUDE.md
 * §2.5). Yang dikumpulkan berkas ini bukan cuma query, tapi juga aturan bahwa
 * penghapusan akun pelanggan SELALU disertai jejak audit — kalau penghapusan
 * bisa dilakukan lewat jalur lain, jejaknya menjadi opsional dan dengan begitu
 * tidak bisa dipercaya.
 */
import { getPrisma } from "@/lib/prisma/client"

/**
 * Semua query di berkas ini membaca `users` dengan syarat peran pelanggan.
 *
 * Sejak Satu Login akun admin juga hidup di `users`, dan penghapusan di sini
 * adalah HARD DELETE. Syarat ini yang mencegah halaman "Pelanggan" menampilkan
 * — apalagi menghapus permanen — akun panel. Jangan dilepas dari query mana pun.
 */
const CUSTOMER_ROLE = { role: "pelanggan" } as const

/**
 * Data pelanggan yang tampil di panel.
 *
 * Sengaja SEMPIT. Staff butuh email dan nama untuk mencocokkan permintaan yang
 * datang dari CS ("tolong hapus akun budi@..."), dan jumlah rakitan untuk tahu
 * apa yang ikut hilang. Mereka TIDAK butuh melihat isi rakitannya — komponen
 * apa saja yang dipilih pelanggan, dengan harga berapa, adalah urusan pelanggan
 * itu sendiri, bukan bahan pertimbangan menghapus akun.
 *
 * `passwordHash`, `googleSub`, dan token verifikasi juga tidak pernah keluar
 * dari berkas ini.
 */
export type CustomerRow = {
  id: string
  email: string
  name: string
  username: string | null
  phoneNumber: string | null
  emailVerifiedAt: Date | null
  createdAt: Date
  savedBuildCount: number
}

const CUSTOMER_PAGE_SIZE = 25

export type CustomerListResult = {
  rows: CustomerRow[]
  total: number
  page: number
  pageCount: number
}

/**
 * Daftar pelanggan, dengan pencarian opsional.
 *
 * Pencarian dibatasi ke email, nama, dan username — tiga hal yang dipakai CS
 * untuk menunjuk satu akun. Nomor HP sengaja tidak ikut dicari supaya panel ini
 * tidak berubah jadi alat penelusuran nomor telepon.
 */
export async function listCustomers(options: {
  query?: string
  page?: number
} = {}): Promise<CustomerListResult> {
  const page = Math.max(1, options.page ?? 1)
  const q = options.query?.trim()

  const where = q
    ? {
        ...CUSTOMER_ROLE,
        OR: [
          { email: { contains: q } },
          { name: { contains: q } },
          { username: { contains: q } },
        ],
      }
    : CUSTOMER_ROLE

  const prisma = getPrisma()
  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        phoneNumber: true,
        emailVerifiedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * CUSTOMER_PAGE_SIZE,
      take: CUSTOMER_PAGE_SIZE,
    }),
  ])

  // Jumlah rakitan tersimpan dihitung terpisah lewat groupBy, satu query untuk
  // satu halaman — `saved_pc_builds.customer_id` menunjuk `users.id`.
  const ids = rows.map((r) => r.id)
  const counts = ids.length
    ? await prisma.savedPcBuild.groupBy({
        by: ["customerId"],
        where: { customerId: { in: ids } },
        _count: { _all: true },
      })
    : []
  const countById = new Map(counts.map((c) => [c.customerId, c._count._all]))

  return {
    rows: rows.map((r) => ({ ...r, savedBuildCount: countById.get(r.id) ?? 0 })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / CUSTOMER_PAGE_SIZE)),
  }
}

export async function getCustomerForDeletion(id: string): Promise<CustomerRow | null> {
  const prisma = getPrisma()
  const row = await prisma.user.findFirst({
    where: { id, ...CUSTOMER_ROLE },
    select: {
      id: true,
      email: true,
      name: true,
      username: true,
      phoneNumber: true,
      emailVerifiedAt: true,
      createdAt: true,
    },
  })
  if (!row) return null
  const savedBuildCount = await prisma.savedPcBuild.count({ where: { customerId: id } })
  return { ...row, savedBuildCount }
}

export class CustomerNotFoundError extends Error {
  constructor(message = "Akun pelanggan tidak ditemukan — mungkin sudah dihapus.") {
    super(message)
    this.name = "CustomerNotFoundError"
  }
}

/**
 * Hapus akun pelanggan PERMANEN, beserta jejak auditnya.
 *
 * Hard delete, bukan soft delete — CLAUDE.md §2.8. Menyimpan baris yang
 * "disembunyikan" berarti kita tetap memegang email dan nama orang yang secara
 * eksplisit meminta datanya dihapus, yang justru kebalikan dari permintaannya.
 *
 * Tiga hal terjadi dalam SATU transaksi, dan urutannya penting:
 *
 *   1. `sessionsRevokedAt` diisi. Wajib, dan wajib DULUAN. Token sesi pelanggan
 *      bersifat stateless — tidak ada baris sesi yang ikut terhapus — jadi
 *      tanpa penanda ini, cookie yang sudah beredar tetap sah sampai
 *      kedaluwarsa dan pemiliknya "masih login" ke akun yang sudah tidak ada.
 *   2. Log audit ditulis, memakai hitungan rakitan yang diambil SEBELUM
 *      penghapusan. Sesudahnya angka itu tidak bisa direkonstruksi dari mana
 *      pun, karena barisnya sudah lenyap lewat cascade.
 *   3. Baris `users`-nya dihapus. `saved_pc_builds` dan
 *      `customer_verification_tokens` ikut lewat `onDelete: Cascade`. Salinan
 *      lama di tabel `customers` (sisa masa sebelum Satu Login) ikut dihapus
 *      juga — ia memuat email, nama, dan nomor HP yang sama, dan membiarkannya
 *      berarti permintaan hapus hanya terpenuhi separuh.
 *
 * Satu transaksi supaya tidak pernah ada keadaan setengah jadi: akun terhapus
 * tanpa log (tidak bisa dipertanggungjawabkan) atau log tertulis tanpa akun
 * terhapus (mencatat sesuatu yang tidak terjadi).
 */
export async function deleteCustomerPermanently(params: {
  customerId: string
  deletedByUserId: string
  reason: string
}): Promise<{ savedBuildCount: number }> {
  const prisma = getPrisma()

  return prisma.$transaction(async (tx) => {
    const target = await tx.user.findFirst({
      where: { id: params.customerId, ...CUSTOMER_ROLE },
      select: { id: true },
    })
    if (!target) throw new CustomerNotFoundError()

    const savedBuildCount = await tx.savedPcBuild.count({
      where: { customerId: params.customerId },
    })

    await tx.user.update({
      where: { id: params.customerId },
      data: { sessionsRevokedAt: new Date() },
    })

    await tx.customerDeletionLog.create({
      data: {
        deletedCustomerId: params.customerId,
        deletedByUserId: params.deletedByUserId,
        savedBuildCount,
        reason: params.reason,
      },
    })

    await tx.user.delete({ where: { id: params.customerId } })
    // `deleteMany`, bukan `delete`: pelanggan yang mendaftar sesudah Fase B
    // tidak pernah punya baris di `customers`.
    await tx.customer.deleteMany({ where: { id: params.customerId } })

    return { savedBuildCount }
  })
}

export type DeletionLogRow = {
  id: string
  deletedCustomerId: string
  deletedByUserId: string
  deletedByName: string | null
  savedBuildCount: number
  reason: string
  createdAt: Date
}

/**
 * Riwayat penghapusan.
 *
 * Nama admin penghapus dilihat terpisah lewat tabel `users`, bukan lewat join —
 * `customer_deletion_logs` sengaja tidak punya foreign key ke sana (admin bisa
 * dihapus belakangan, dan log harus tetap utuh). Yang tidak ditemukan lagi
 * tampil sebagai `null`, dan antarmuka menampilkannya apa adanya.
 */
export async function listDeletionLogs(limit = 50): Promise<DeletionLogRow[]> {
  const prisma = getPrisma()
  const logs = await prisma.customerDeletionLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  })
  if (logs.length === 0) return []

  const actors = await prisma.user.findMany({
    where: { id: { in: [...new Set(logs.map((l) => l.deletedByUserId))] } },
    select: { id: true, name: true },
  })
  const nameById = new Map(actors.map((a) => [a.id, a.name]))

  return logs.map((l) => ({
    id: l.id,
    deletedCustomerId: l.deletedCustomerId,
    deletedByUserId: l.deletedByUserId,
    deletedByName: nameById.get(l.deletedByUserId) ?? null,
    savedBuildCount: l.savedBuildCount,
    reason: l.reason,
    createdAt: l.createdAt,
  }))
}
