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
 * Level akses user untuk satu halaman.
 *
 * Fase 1 (tanpa tabel Role): dihitung dari master + role lama.
 * - master            → edit semua
 * - owner             → edit semua (perilaku lama dipertahankan)
 * - staff             → edit semua KECUALI halaman khusus-owner (pelanggan),
 *                       yang jadi view — mencerminkan aturan lama "staff tak
 *                       boleh kelola akun". Tidak lebih ketat dari sebelumnya.
 *
 * Saat tabel RolePermission ada, fungsi ini yang diubah untuk membacanya;
 * pemanggilnya (`bisaAkses`) tidak perlu berubah.
 */
export function levelAksesHalaman(
  user: Pick<AdminUser, "email" | "role">,
  page: AdminPage,
): AccessLevel {
  if (PAGES_SELALU_BOLEH.has(page)) return "edit"
  if (isMaster(user)) return "edit"
  if (user.role === "owner") return "edit"
  // staff: sama seperti sebelumnya — bisa semua, kecuali kelola user hanya lihat.
  if (page === "pelanggan") return "view"
  return "edit"
}

/**
 * Apakah user boleh mengakses `page` pada `minimal` level tertentu.
 * `bisaAkses(user, "harga-accurate", "edit")` → boleh menerapkan harga?
 */
export function bisaAkses(
  user: Pick<AdminUser, "email" | "role">,
  page: AdminPage,
  minimal: AccessLevel = "view",
): boolean {
  return ACCESS_ORDER[levelAksesHalaman(user, page)] >= ACCESS_ORDER[minimal]
}

/** Semua halaman yang boleh user LIHAT — dipakai menyaring menu sidebar. */
export function halamanTerlihat(
  user: Pick<AdminUser, "email" | "role">,
): Set<AdminPage> {
  const out = new Set<AdminPage>()
  for (const page of Object.keys(ADMIN_PAGES) as AdminPage[]) {
    if (bisaAkses(user, page, "view")) out.add(page)
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
