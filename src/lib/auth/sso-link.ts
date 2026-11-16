/**
 * Siapa orang dari SSO ini di tabel `users`? — docs/19-sso-staff.md §3.
 *
 * Urutan:
 *   1. Cari lewat `sso_sub`. Inilah jalur normal sesudah login pertama.
 *   2. Belum ada → cari lewat email, HANYA akun staff yang `sso_sub`-nya masih
 *      kosong, lalu tautkan.
 *   3. Selain itu DITOLAK. Tidak ada akun yang dibuat otomatis.
 *
 * Kenapa tidak dibuat otomatis (berbeda dari saran bawaan panduan SSO): kolom
 * `users.role` ber-default "owner" (schema.prisma), dan izin staff di sini
 * diatur per halaman. Akun yang lahir sendiri dari login SSO adalah akun yang
 * perannya tidak pernah diputuskan siapa pun. Owner menyiapkan akunnya dulu di
 * Manajemen User — email + peran — dan login SSO pertama menautkannya.
 *
 * Nama dan email lokal TIDAK disegarkan dari klaim SSO. Nama bisa sudah
 * dirapikan di panel (alasan yang sama dengan callback Google), dan menyalin
 * email baru dari SSO bisa bertabrakan dengan unique index `users.email`
 * milik baris lain. Keduanya keputusan tahap berikutnya, bukan efek samping
 * diam-diam dari login.
 */
import { Prisma } from "@prisma/client"
import { getPrisma } from "@/lib/prisma/client"
import { isMaster } from "./permissions"
import type { SsoIdentity } from "./sso"

export type SsoStaff = {
  id: string
  email: string
  role: string
  roleId: string | null
}

export type SsoLinkResult =
  | { ok: true; user: SsoStaff; linkedNow: boolean }
  | {
      ok: false
      /**
       * - `sso_not_provisioned`: belum ada akun staff dengan email ini.
       * - `sso_customer_account`: emailnya milik akun PELANGGAN.
       * - `sso_sub_conflict`: email ini sudah tertaut ke orang SSO lain —
       *   persis kasus "alamat email berpindah tangan".
       */
      reason: "sso_not_provisioned" | "sso_customer_account" | "sso_sub_conflict"
    }

const SELECT = { id: true, email: true, role: true, roleId: true, ssoSub: true } as const

/**
 * Akun berperan "pelanggan" bukan staff — kecuali MASTER, dengan alasan yang
 * sama seperti di `getCurrentUser`: alamat developer biasanya berperan
 * pelanggan karena ikut belanja, dan ia pagar terakhir kalau owner mengunci
 * dirinya sendiri.
 */
function isStaffAccount(user: { email: string; role: string }): boolean {
  return user.role !== "pelanggan" || isMaster({ email: user.email })
}

function toStaff(user: { id: string; email: string; role: string; roleId: string | null }): SsoStaff {
  return { id: user.id, email: user.email, role: user.role, roleId: user.roleId }
}

export async function resolveStaffForSso(identity: SsoIdentity): Promise<SsoLinkResult> {
  const prisma = getPrisma()

  // 1. Sudah pernah tertaut.
  const bySub = await prisma.user.findUnique({ where: { ssoSub: identity.sub }, select: SELECT })
  if (bySub) {
    // Hanya bisa terjadi kalau akunnya DITURUNKAN jadi pelanggan sesudah
    // tertaut. `getCurrentUser` akan menolak sesinya juga, tapi lebih jujur
    // menolak di sini dengan pesan yang tepat daripada menerbitkan cookie mati.
    if (!isStaffAccount(bySub)) return { ok: false, reason: "sso_customer_account" }
    return { ok: true, user: toStaff(bySub), linkedNow: false }
  }

  // 2. Penautan pertama lewat email.
  const byEmail = await prisma.user.findUnique({ where: { email: identity.email }, select: SELECT })
  if (!byEmail) return { ok: false, reason: "sso_not_provisioned" }
  if (!isStaffAccount(byEmail)) return { ok: false, reason: "sso_customer_account" }
  if (byEmail.ssoSub && byEmail.ssoSub !== identity.sub) return { ok: false, reason: "sso_sub_conflict" }

  try {
    // `updateMany` bersyarat `ssoSub: null`, bukan `update` biasa: dua login
    // pertama yang bersamaan dari dua orang SSO berbeda tidak boleh saling
    // menimpa. Yang kalah membaca ulang dan menerima jawaban jujur.
    const { count } = await prisma.user.updateMany({
      where: { id: byEmail.id, ssoSub: null },
      data: { ssoSub: identity.sub },
    })
    if (count === 0) {
      const fresh = await prisma.user.findUnique({ where: { id: byEmail.id }, select: SELECT })
      if (fresh?.ssoSub === identity.sub && isStaffAccount(fresh)) {
        return { ok: true, user: toStaff(fresh), linkedNow: false }
      }
      return { ok: false, reason: "sso_sub_conflict" }
    }
  } catch (error) {
    // P2002 = `sub` ini sudah dipakai baris lain yang tertaut di antara
    // langkah 1 dan 2. Bukan kegagalan teknis — orangnya sudah punya akun.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, reason: "sso_sub_conflict" }
    }
    throw error
  }

  return { ok: true, user: toStaff(byEmail), linkedNow: true }
}
