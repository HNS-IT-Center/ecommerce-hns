import "server-only"

import { env } from "@/config/env"
import type { AdminUser } from "@/lib/auth"

/**
 * Lapisan izin RBAC — Fase 1 (fondasi, tanpa tabel Role).
 *
 * Rancangan lengkap ada di dokumen RBAC. Fase ini sengaja BELUM menyentuh
 * database: ia menetapkan daftar halaman, tingkat akses, siapa master, dan satu
 * helper `bisaAkses()`. Tabel `Role`/`RolePermission` menyusul di fase berikut;
 * sampai itu ada, izin dihitung dari role lama (`owner`/`staff`) — jadi perilaku
 * hari ini TIDAK berubah (mundur-kompatibel).
 *
 * Aturan yang tak bisa ditawar (dari rancangan): izin ditegakkan di SERVER.
 * Helper ini dipanggil di proxy (penjaga halaman) DAN di dalam server action
 * sensitif — menyembunyikan menu di sidebar bukan pengamanan.
 */

/** Level akses satu halaman untuk satu peran. Urutan menaik: none < view < edit. */
export type AccessLevel = "none" | "view" | "edit"

const ACCESS_ORDER: Record<AccessLevel, number> = { none: 0, view: 1, edit: 2 }

/**
 * Halaman admin yang izinnya diatur. Kunci = segmen path setelah `/admin/`.
 * Didaftar eksplisit (bukan diturunkan dari folder) supaya menambah halaman
 * adalah keputusan sadar — halaman baru TIDAK otomatis terbuka untuk peran mana
 * pun sampai didaftarkan di sini.
 */
export const ADMIN_PAGES = {
  produk: "Produk",
  kategori: "Kategori",
  "atribut-brand": "Atribut & Brand",
  sinkronisasi: "Sinkronisasi",
  "harga-accurate": "Update Harga",
  "pc-builder": "PC Builder",
  "pc-prebuild": "PC Prebuild",
  banner: "Banner Promo",
  toko: "Toko & Lokasi",
  pelanggan: "Manajemen User",
  theme: "Tema",
  colors: "Warna",
  kebijakan: "Kebijakan",
  logs: "Logs",
  akun: "Akun",
} as const

export type AdminPage = keyof typeof ADMIN_PAGES

/** Halaman yang tidak pernah dibatasi role: setiap admin yang masuk boleh. */
const PAGES_SELALU_BOLEH: ReadonlySet<string> = new Set<AdminPage>(["akun"])

/**
 * Apakah user ini MASTER — developer, dipatok ke email di env.
 *
 * Dicek dari email, BUKAN dari role di database, dan diperiksa SEBELUM role apa
 * pun. Ini pagar utama: master tidak bisa dihapus atau diturunkan lewat UI
 * karena ia bukan baris data yang bisa disunting — ia string di konfigurasi.
 * Kalau `MASTER_ADMIN_EMAIL` kosong, tidak ada master (aman-tertutup).
 */
export function isMaster(user: Pick<AdminUser, "email">): boolean {
  const master = env.MASTER_ADMIN_EMAIL?.trim().toLowerCase()
  if (!master) return false
  return user.email.trim().toLowerCase() === master
}

/**
 * Kumpulan izin satu user, sudah dihitung — peta halaman → level.
 *
 * Sengaja dimuat SEKALI (satu query) lalu dicek berkali-kali secara sinkron,
 * bukan satu query per halaman. Dibuat lewat `muatIzinUser()` (async, baca DB),
 * lalu `bisaAkses`/`halamanTerlihat` bekerja di atasnya tanpa await.
 */
export type PermissionSet = {
  isMaster: boolean
  /** Level per halaman. Halaman yang tak tercantum → "none". */
  levels: Partial<Record<AdminPage, AccessLevel>>
}

/**
 * Muat izin user dari sumber yang berlaku:
 *
 * 1. Master (email) → edit semua. Dicek pertama, tak menyentuh DB.
 * 2. Punya `roleId` → baca `role_permissions`. Halaman tanpa baris = "none"
 *    (aman-tertutup): peran hanya bisa apa yang diberikan eksplisit.
 * 3. Tanpa `roleId` (baris lama) → fallback role owner/staff, PERSIS perilaku
 *    sebelum RBAC ada. Owner=edit semua; staff=edit semua kecuali "pelanggan"
 *    yang view. Ini yang menjaga akun lama tak terkunci.
 *
 * `import` Prisma dinamis: berkas ini juga dipakai di konteks yang tak boleh
 * menyeret klien DB kalau tak perlu (mis. saat cuma cek master).
 */
export async function muatIzinUser(
  user: Pick<AdminUser, "id" | "email" | "role"> & { roleId?: string | null },
): Promise<PermissionSet> {
  // 1. Master — jalan pintas, tanpa query.
  if (isMaster(user)) {
    const semua: Partial<Record<AdminPage, AccessLevel>> = {}
    for (const p of Object.keys(ADMIN_PAGES) as AdminPage[]) semua[p] = "edit"
    return { isMaster: true, levels: semua }
  }

  const levels: Partial<Record<AdminPage, AccessLevel>> = {}
  // Halaman yang selalu boleh (mis. "akun") — edit untuk siapa pun yang masuk.
  for (const p of PAGES_SELALU_BOLEH) levels[p as AdminPage] = "edit"

  // 2. Peran dinamis dari tabel.
  if (user.roleId) {
    const { getPrisma } = await import("@/lib/prisma/client")
    const rows = await getPrisma().rolePermission.findMany({
      where: { roleId: user.roleId },
      select: { page: true, access: true },
    })
    for (const r of rows) {
      if (r.page in ADMIN_PAGES && isAccessLevel(r.access)) {
        levels[r.page as AdminPage] = r.access
      }
    }
    return { isMaster: false, levels }
  }

  // 3. Fallback role lama — perilaku sebelum RBAC.
  for (const p of Object.keys(ADMIN_PAGES) as AdminPage[]) {
    if (levels[p] !== undefined) continue // sudah diset (halaman selalu-boleh)
    if (user.role === "owner") levels[p] = "edit"
    else levels[p] = p === "pelanggan" ? "view" : "edit" // staff
  }
  return { isMaster: false, levels }
}

function isAccessLevel(v: string): v is AccessLevel {
  return v === "none" || v === "view" || v === "edit"
}

/** Level user atas satu halaman, dari izin yang sudah dimuat. */
export function levelAksesHalaman(izin: PermissionSet, page: AdminPage): AccessLevel {
  return izin.levels[page] ?? "none"
}

/**
 * Apakah izin yang dimuat mencukupi untuk `page` pada `minimal` level.
 * `bisaAkses(izin, "harga-accurate", "edit")` → boleh menerapkan harga?
 */
export function bisaAkses(
  izin: PermissionSet,
  page: AdminPage,
  minimal: AccessLevel = "view",
): boolean {
  return ACCESS_ORDER[levelAksesHalaman(izin, page)] >= ACCESS_ORDER[minimal]
}

/** Semua halaman yang boleh user LIHAT — dipakai menyaring menu sidebar. */
export function halamanTerlihat(izin: PermissionSet): Set<AdminPage> {
  const out = new Set<AdminPage>()
  for (const page of Object.keys(ADMIN_PAGES) as AdminPage[]) {
    if (bisaAkses(izin, page, "view")) out.add(page)
  }
  return out
}

/** Ambil segmen halaman dari pathname `/admin/<page>/...`. Null kalau bukan sub-halaman. */
export function pageFromPathname(pathname: string): AdminPage | null {
  const m = pathname.match(/^\/admin\/([^/?#]+)/)
  if (!m) return null
  const seg = m[1]
  return seg in ADMIN_PAGES ? (seg as AdminPage) : null
}
