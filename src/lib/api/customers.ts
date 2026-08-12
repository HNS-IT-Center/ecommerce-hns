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
        OR: [
          { email: { contains: q } },
          { name: { contains: q } },
          { username: { contains: q } },
        ],
      }
    : {}

  const prisma = getPrisma()
  const [total, rows] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        phoneNumber: true,
        emailVerifiedAt: true,
        createdAt: true,
        // Hanya JUMLAHNYA, bukan isinya — lihat catatan di `CustomerRow`.
        _count: { select: { savedBuilds: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * CUSTOMER_PAGE_SIZE,
      take: CUSTOMER_PAGE_SIZE,
    }),
  ])

  return {
    rows: rows.map(({ _count, ...r }) => ({ ...r, savedBuildCount: _count.savedBuilds })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / CUSTOMER_PAGE_SIZE)),
  }
}

export async function getCustomerForDeletion(id: string): Promise<CustomerRow | null> {
  const row = await getPrisma().customer.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      username: true,
      phoneNumber: true,
      emailVerifiedAt: true,
      createdAt: true,
      _count: { select: { savedBuilds: true } },
    },
  })
  if (!row) return null
  const { _count, ...rest } = row
  return { ...rest, savedBuildCount: _count.savedBuilds }
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
 *   3. Barisnya dihapus. `saved_pc_builds` dan `customer_verification_tokens`
 *      ikut lewat `onDelete: Cascade`.
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
    const target = await tx.customer.findUnique({
      where: { id: params.customerId },
      select: { id: true, _count: { select: { savedBuilds: true } } },
    })
    if (!target) throw new CustomerNotFoundError()

    const savedBuildCount = target._count.savedBuilds

    await tx.customer.update({
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

    await tx.customer.delete({ where: { id: params.customerId } })

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
