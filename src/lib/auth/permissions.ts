import "server-only"

import { env } from "@/config/env"
import type { AdminUser } from "@/lib/auth"
import {
  ACCESS_ORDER,
  levelSahUntukMode,
  levelTertinggiUntukMode,
  type AccessLevel,
  type LevelMode,
} from "./permission-levels"

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

export type { AccessLevel, LevelMode }

/**
 * Halaman admin yang izinnya diatur. Kunci = segmen path setelah `/admin/`.
 * Didaftar eksplisit (bukan diturunkan dari folder) supaya menambah halaman
 * adalah keputusan sadar — halaman baru TIDAK otomatis terbuka untuk peran mana
 * pun sampai didaftarkan di sini.
 */
export const ADMIN_PAGES = {
  /**
   * Dasbor `/admin` — kartu ringkasan katalog.
   *
   * Kuncinya TIDAK pernah dikembalikan `pageFromPathname()`, karena halamannya
   * adalah `/admin` itu sendiri dan pola itu menuntut segmen sesudahnya.
   * Penjagaannya ada di `admin/(panel)/page.tsx`.
   *
   * Sengaja BUKAN opt-in: akun lama (owner/staff tanpa peran) harus tetap
   * melihat dasbornya seperti kemarin. Yang berubah cuma satu — sekarang ia
   * bisa dicabut, untuk peran yang memang tidak punya urusan di beranda panel.
   */
  overview: "Overview",
  produk: "Produk",
  kategori: "Kategori",
  "atribut-brand": "Atribut & Brand",
  "harga-accurate": "Update Harga",
  /**
   * BUKAN halaman — saklar izin untuk satu KOLOM: harga modal (CP) di tabel
   * Update Harga.
   *
   * Modal adalah angka yang kita bayar ke pemasok. Kasir dan staff toko perlu
   * membuka halaman Update Harga untuk mengisi harga dealer, tapi tidak
   * seharusnya ikut melihat margin setiap barang — dan izin per-halaman yang
   * ada tidak bisa membedakan keduanya karena keduanya satu halaman.
   *
   * Ditumpangkan ke daftar ini supaya bisa diatur di tempat yang sudah dikenal
   * (Manajemen User → Peran) tanpa membangun konsep izin kedua. Aman karena
   * daftar ini hanya dibaca editor peran; sidebar punya daftar menunya sendiri
   * dan menyaringnya, jadi kunci tanpa menu tidak memunculkan apa-apa.
   */
  "harga-modal": "Harga Modal (CP)",
  "pc-builder": "PC Builder",
  "pc-prebuild": "PC Prebuild",
  banner: "Banner Promo",
  toko: "Toko & Lokasi",
  pelanggan: "Pelanggan",
  "manajemen-user": "Manajemen User",
  theme: "Tema",
  colors: "Warna",
  kebijakan: "Kebijakan",
  logs: "Logs",
  /**
   * BUKAN halaman di bawah `/admin` — izin untuk `/verify` dan `/verify/[code]`,
   * alat cek quotation untuk kasir.
   *
   * Halamannya sengaja tinggal di luar panel: kasir hanya berurusan dengan
   * verifikasi, dan panel admin (sidebar, dashboard) tidak ada gunanya bagi
   * mereka. Kuncinya tetap didaftarkan di sini supaya aksesnya diatur di tempat
   * yang sama dengan halaman lain (Manajemen User → Peran). `pageFromPathname`
   * tidak akan pernah mengembalikannya karena path-nya bukan `/admin/verify`;
   * penjagaannya ada di halaman `/verify` sendiri dan di `src/proxy.ts`.
   */
  verify: "Verifikasi Rakitan (/verify)",
  /**
   * Halaman sungguhan: `/admin/quotation` — pengawasan quotation lintas sales,
   * rekap penjualan, dan PEMBATALAN status Closing (`edit`).
   *
   * Kuncinya wajib bernama persis segmen URL-nya, karena `pageFromPathname`
   * menurunkan kunci dari situ. Itulah sebabnya izin milik Sales/CS di bawah
   * TIDAK boleh memakai nama ini: kalau `quotation` dipakai untuk halaman
   * profil, setiap Sales yang boleh melihat riwayatnya sendiri ikut lolos
   * penjaga `/admin/quotation` dan melihat capaian seluruh tim.
   */
  quotation: "Quotation & Penjualan",
  /**
   * BUKAN halaman — penanda bahwa user boleh MENERBITKAN quotation bernama
   * (mengisi identitas pelanggan) dan punya riwayatnya sendiri di
   * `/profile/quotation`. Dimiliki Sales maupun CS.
   *
   * Penjagaannya ada di halaman `/profile/quotation` itu sendiri, bukan di
   * `pageFromPathname` — pola yang sama dengan `verify`.
   */
  "quotation-terbit": "Terbitkan Quotation",
  /**
   * BUKAN halaman — penanda peran SALES. Dua akibatnya:
   * 1. namanya muncul di daftar operan yang dilihat CS;
   * 2. nama tampilannya ikut tercetak di PDF sebagai "Sales:".
   *
   * Dipisah dari `quotation-terbit` supaya CS bisa menerbitkan tanpa ikut
   * menjadi tujuan operan — kalau digabung, CS akan mengoper ke dirinya sendiri.
   */
  "quotation-sales": "Tercantum sebagai Sales",
  /**
   * BUKAN halaman — kemampuan MENGOPER quotation ke sales lain.
   *
   * Sebelumnya kemampuan ini tidak punya kunci: ia tersirat dari "boleh terbit
   * TAPI bukan sales" di `resolveOwner()`. Aturan sediam itu tidak pernah
   * terlihat oleh yang menyusun peran, dan ia juga mengunci satu hal yang wajar
   * di toko kecil — sales yang sesekali merangkap CS tidak bisa mengoper sama
   * sekali, karena satu-satunya cara "boleh mengoper" adalah dengan berhenti
   * menjadi sales.
   *
   * Dipisah dari `quotation-terbit`: menerbitkan atas nama pelanggan dan
   * melempar pekerjaan ke orang lain adalah dua kewenangan berbeda.
   */
  "quotation-oper": "Mengoper Quotation ke Sales",
  akun: "Akun",
} as const

export type AdminPage = keyof typeof ADMIN_PAGES

/**
 * Penjelasan tiap izin, untuk tooltip di editor peran (Manajemen User → Peran).
 *
 * Ditulis untuk orang yang sedang MENYUSUN peran dan belum tentu tahu apa isi
 * tiap halaman. Karena itu tiap keterangan menjawab dua hal: halaman/kemampuan
 * apa yang dibuka, dan apa bedanya "Lihat" dari "Edit" — bukan sekadar
 * mengulang labelnya dengan kata lain.
 *
 * Di mana perbedaannya berbahaya (harga modal, pembatalan penjualan, izin
 * peran), keterangannya menyebutkan akibatnya, bukan cuma mekanismenya. Orang
 * yang memberi izin perlu tahu apa yang sedang ia serahkan.
 *
 * `Record<AdminPage, string>` — bukan `Partial`. Menambah kunci baru di
 * `ADMIN_PAGES` tanpa menuliskan keterangannya akan GAGAL typecheck, jadi tidak
 * ada izin yang bisa diam-diam muncul di panel tanpa penjelasan.
 */
export const ADMIN_PAGE_DESCRIPTIONS: Record<AdminPage, string> = {
  overview:
    "Beranda panel: kartu ringkasan katalog, produk terbaru, dan aktivitas terakhir. Tiap kartu tetap disaring izinnya sendiri, jadi izin ini membuka halamannya, bukan isinya. Hanya untuk dibaca.",
  produk:
    "Katalog produk: harga jual, stok, gambar, dan status tayang. Lihat = membuka daftar & detail. Edit = menambah, mengubah, dan menarik produk dari etalase.",
  kategori:
    "Struktur kategori toko dan produk apa masuk ke mana. Edit = membuat, mengganti nama, memindah, dan menghapus kategori.",
  "atribut-brand":
    "Atribut produk beserta nilainya (mis. Kapasitas: 1TB) dan daftar brand. Edit = menambah dan mengubah keduanya.",
  "harga-accurate":
    "Halaman Update Harga: menautkan produk ke kode Accurate dan menerapkan harga. Edit = mengubah harga yang berlaku di toko.",
  "harga-modal":
    "Kolom harga modal (CP) di halaman Update Harga — angka yang kita bayar ke pemasok. Tanpa izin ini, halamannya tetap bisa dibuka tapi kolom modalnya tersembunyi, sehingga marginnya tidak ikut terlihat.",
  "pc-builder":
    "Konfigurasi wizard Rakit PC: langkah apa saja, urutannya, dan mana yang wajib. Edit = mengubah susunan yang dipakai pelanggan.",
  "pc-prebuild":
    "Paket rakitan siap pakai beserta potongan harganya. Edit = membuat paket, menukar komponennya, dan mengatur potongan nominalnya.",
  banner: "Slide promo di paling atas beranda. Edit = menambah, mengganti, dan menjadwalkannya.",
  toko: "Data cabang: alamat, peta, jam buka, dan nomor WhatsApp. Edit = mengubahnya.",
  pelanggan:
    "Akun pelanggan yang mendaftar di toko. Lihat = mencocokkan permintaan yang masuk lewat CS. Edit = menyunting datanya.",
  "manajemen-user":
    "Peran dan izinnya, serta peran mana yang ditempelkan ke tiap akun admin. Edit = mengubah siapa boleh apa di seluruh panel — termasuk izin ini sendiri. Berikan hanya kepada yang memang mengelola tim.",
  theme: "Nuansa musiman halaman toko. Panel admin tidak ikut berubah.",
  colors: "Halaman rujukan palet warna. Untuk pengembang; tidak mengubah apa pun.",
  kebijakan:
    "Isi halaman kebijakan (pengiriman, pengembalian, dan lainnya) yang dibaca pelanggan. Edit = menyuntingnya.",
  logs: "Catatan aktivitas katalog: perubahan produk dan perubahan harga. Hanya untuk dibaca. Quotation rakitan TIDAK ada di sini — tempatnya di halaman Quotation & Penjualan, dengan izinnya sendiri.",
  verify:
    "Halaman /verify di luar panel — alat kasir untuk mencocokkan quotation yang dibawa pelanggan. Lihat = membuka dan mencari quotation. Edit = menandai quotation sebagai TERJUAL (Closing).",
  quotation:
    "Halaman /admin/quotation: seluruh quotation lintas sales dan rekap penjualan per orang. Edit = MEMBATALKAN status terjual, yang mengurangi angka penjualan seorang sales. Setiap pembatalan tercatat beserta alasannya.",
  "quotation-terbit":
    "Boleh menerbitkan quotation atas nama pelanggan (mengisi nama, nomor HP, catatan) dan punya riwayatnya sendiri di /profile/quotation. Dimiliki Sales maupun Customer Service.",
  "quotation-sales":
    "Menandai akun ini sebagai SALES. Dua akibatnya: namanya muncul di daftar operan yang dilihat CS, dan nama tampilannya ikut tercetak di PDF quotation. CS tidak diberi izin ini — kalau diberi, ia akan mengoper ke dirinya sendiri.",
  "quotation-oper":
    "Boleh MENGOPER quotation ke sales lain: saat menerbitkan, muncul pilihan Sales tujuan, dan quotation-nya masuk ke riwayat orang itu. Tanpa izin ini, quotation selalu menjadi milik yang menerbitkannya. Dimiliki Customer Service.",
  akun: "Halaman Akun Saya. Selalu terbuka untuk setiap admin dan tidak bisa dicabut.",
}

/**
 * Pekerjaan yang biasanya memegang tiap halaman — tampil sebagai "Cocok untuk
 * …" di samping namanya saat menyusun peran.
 *
 * Penjelasan di `ADMIN_PAGE_DESCRIPTIONS` menjawab "izin ini membuka apa", dan
 * itu ternyata belum cukup: yang ditanyakan orang saat membuat peran bernama
 * "Sales" bukan apa isi tiap halaman, melainkan HALAMAN INI URUSAN SIAPA.
 * Tanpa jawaban itu, menyusun peran berarti membaca dua puluhan penjelasan satu
 * per satu lalu menebak sendiri mana yang relevan.
 *
 * INI SARAN, BUKAN ATURAN. Tidak ada satu pun kode yang membaca peta ini untuk
 * memutuskan akses — ia murni kalimat bantu di layar penyusunan peran, dan
 * peran tetap bisa diberi halaman apa pun. Nama pekerjaannya juga sengaja nama
 * JABATAN sehari-hari di HNS ("Kasir", "Sales"), bukan nama baris di tabel
 * `roles` — peran bisa dinamai apa saja oleh staff, dan mengikat kalimat ini ke
 * nama peran akan membuatnya salah begitu ada peran bernama lain.
 *
 * Silakan disunting kalau pembagian kerjanya berubah: satu tempat, dan tidak
 * ada yang rusak karenanya.
 */
export const ADMIN_PAGE_AUDIENCE: Record<AdminPage, string> = {
  overview: "Semua admin",
  produk: "Admin Katalog",
  kategori: "Admin Katalog",
  "atribut-brand": "Admin Katalog",
  "harga-accurate": "Admin Harga",
  "harga-modal": "Owner & Admin Harga",
  "pc-builder": "Admin Katalog",
  "pc-prebuild": "Owner & Admin Katalog",
  banner: "Marketing",
  toko: "Owner",
  pelanggan: "Customer Service",
  "manajemen-user": "Owner",
  theme: "Marketing",
  colors: "Developer",
  kebijakan: "Owner & Marketing",
  logs: "Owner",
  verify: "Kasir",
  quotation: "Owner",
  "quotation-terbit": "Sales & Customer Service",
  "quotation-sales": "Sales",
  "quotation-oper": "Customer Service",
  akun: "Semua admin",
}

/** Halaman yang tidak pernah dibatasi role: setiap admin yang masuk boleh. */
const PAGES_SELALU_BOLEH: ReadonlySet<string> = new Set<AdminPage>(["akun"])

/**
 * Kunci di `ADMIN_PAGES` yang BUKAN halaman di dalam panel `/admin`.
 *
 * Daftar `ADMIN_PAGES` memang menampung beberapa kunci yang bukan halaman,
 * karena ia sekaligus jadi tempat mengatur izin apa pun dari satu layar yang
 * sudah dikenal (Manajemen User → Peran). Yang ikut ke sini:
 *
 * - `verify` — halamannya di `/verify`, sengaja di luar panel untuk kasir.
 * - `harga-modal` — saklar satu KOLOM di halaman Update Harga, bukan halaman.
 * - `quotation-terbit` — kemampuan menerbitkan + riwayat di `/profile/quotation`.
 * - `quotation-sales` — penanda "akun ini Sales", bukan halaman.
 *
 * Dipisahkan supaya `halamanPanelPertama()` di bawah bisa menjawab pertanyaan
 * yang benar: bukan "punya izin apa saja", melainkan "halaman mana di DALAM
 * panel yang benar-benar bisa dibuka".
 */
const PAGES_BUKAN_PANEL: ReadonlySet<string> = new Set<AdminPage>([
  "verify",
  "harga-modal",
  "quotation-terbit",
  "quotation-sales",
  "quotation-oper",
])

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
 * "Cap izin": satu string yang berubah persis ketika akses seseorang berubah.
 *
 * Bukan izinnya sendiri, dan tidak bisa dipakai memutuskan apa pun — ia hanya
 * untuk DIBANDINGKAN dengan cap sebelumnya. Klien yang melihat capnya berbeda
 * tahu tampilannya sudah basi dan harus meminta ulang ke server; keputusan
 * "boleh atau tidak" tetap sepenuhnya di server, tiap permintaan.
 *
 * Rumusnya tinggal di sini, bukan di pemanggil, karena sekarang ada DUA yang
 * memakainya: `getPermissionVersion()` untuk panel admin, dan
 * `getCurrentCustomer()` untuk seluruh halaman di luar panel. Dua salinan
 * rumus berarti dua definisi "berubah" yang pelan-pelan berbeda — dan yang
 * satu akan berhenti mendeteksi hal yang masih dideteksi yang lain, tanpa
 * gejala apa pun sampai ada staff yang mengeluh aksesnya belum berubah.
 *
 * Alasan tiap bagian (dan alasan `users.updatedAt` TIDAK ikut) ada di
 * `getPermissionVersion()` di `lib/api/admin-users.ts`.
 */
export function capIzin(row: {
  role: string
  roleId: string | null
  roleUpdatedAt: Date | null | undefined
}): string {
  return [row.role, row.roleId ?? "-", row.roleUpdatedAt?.getTime() ?? "-"].join("|")
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
 * 4. Role bernama lain (mis. "pelanggan", atau nilai rusak) → NOL izin.
 *
 * `import` Prisma dinamis: berkas ini juga dipakai di konteks yang tak boleh
 * menyeret klien DB kalau tak perlu (mis. saat cuma cek master).
 */
export async function muatIzinUser(
  user: Pick<AdminUser, "id" | "email"> & { role: string; roleId?: string | null },
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

  /**
   * 3. Fallback role lama — HANYA untuk role yang benar-benar bernama "owner"
   * atau "staff".
   *
   * `role` sengaja diterima sebagai `string`, bukan `AdminRole`. Tipe itu
   * berbohong tentang isi database: kolomnya VARCHAR biasa, dan
   * `parseAdminRole()` memetakan apa pun yang bukan "owner" menjadi "staff" —
   * termasuk "pelanggan". Fallback di bawah memberi `edit` atas hampir semua
   * halaman, dan kemurahan sebesar itu tidak boleh menetes ke nilai role yang
   * tidak kita kenali.
   *
   * Aman-tertutup: yang tak dikenal pulang dengan nol izin — hanya halaman
   * selalu-boleh ("akun") yang tersisa. Ini lapisan KEDUA; yang pertama ada di
   * `getCurrentUser()`, yang sudah menolak akun "pelanggan" lebih dulu.
   */
  if (user.role !== "owner" && user.role !== "staff") {
    return { isMaster: false, levels }
  }

  for (const p of Object.keys(ADMIN_PAGES) as AdminPage[]) {
    if (levels[p] !== undefined) continue // sudah diset (halaman selalu-boleh)
    if (OPT_IN_SELALU.has(p)) {
      // Harus DIBERIKAN eksplisit lewat peran, tidak pernah lewat fallback —
      // bahkan untuk owner.
      levels[p] = "none"
      continue
    }
    if (user.role === "owner") {
      levels[p] = "edit"
      continue
    }
    // staff
    if (OPT_IN_STAFF.has(p)) {
      levels[p] = "none"
      continue
    }
    levels[p] = p === "pelanggan" ? "view" : "edit"
  }
  return { isMaster: false, levels }
}

/**
 * Kunci yang tidak pernah diberikan lewat fallback KEPADA SIAPA PUN, termasuk
 * owner.
 *
 * Ketiganya bukan "halaman yang boleh dibuka" melainkan PERAN yang melekat ke
 * orangnya, dan memberikannya diam-diam mengubah apa yang dilihat orang lain:
 *
 * - `quotation-sales` — pemiliknya muncul di daftar operan yang dilihat CS, dan
 *   namanya ikut tercetak di PDF yang dipegang pelanggan. Owner yang otomatis
 *   jadi "Sales" berarti nama pemilik toko muncul sebagai sales di kuitansi
 *   orang lain.
 * - `quotation-terbit` — menerbitkan quotation atas nama pelanggan.
 * - `quotation-oper` — melempar pekerjaan ke riwayat sales lain.
 *
 * Aman-tertutup: kunci baru yang ragu-ragu sebaiknya masuk sini.
 */
const OPT_IN_SELALU: ReadonlySet<AdminPage> = new Set<AdminPage>([
  "quotation-terbit",
  "quotation-sales",
  "quotation-oper",
])

/**
 * Kunci yang tidak diberikan lewat fallback kepada STAFF, tapi diberikan kepada
 * OWNER.
 *
 * Keduanya memang pekerjaan pemilik, dan menahannya dari owner tidak melindungi
 * siapa-siapa — ia cuma menyembunyikan angka bisnisnya sendiri dari yang punya:
 *
 * - `harga-modal` — margin tiap barang. Ditahan dari staff (kasir tidak
 *   seharusnya ikut melihat margin saat mengisi harga dealer), tapi owner yang
 *   tidak boleh melihat modalnya sendiri tidak masuk akal.
 * - `quotation` — halaman `/admin/quotation`: rekap penjualan lintas sales dan
 *   pembatalan status terjual. Seluruh keterangannya menyebut audiensnya
 *   "Owner"; menahannya dari owner membuat menu "Quotation & Penjualan" tidak
 *   pernah muncul di sidebar akun owner lama, tanpa satu pun petunjuk kenapa.
 *
 * Staff tetap harus DIBERI eksplisit lewat peran.
 */
const OPT_IN_STAFF: ReadonlySet<AdminPage> = new Set<AdminPage>(["harga-modal", "quotation"])

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

/**
 * Ke mana user diarahkan sesudah login.
 *
 * `/admin` bukan tujuan yang masuk akal untuk semua orang. Kasir hanya berurusan
 * dengan `/verify`, dan Sales/CS dengan riwayat quotation-nya — keduanya di luar
 * panel. Mengantar mereka ke dashboard berarti halaman pertama yang mereka lihat
 * setiap hari adalah halaman yang sidebar-nya kosong.
 *
 * Urutannya disengaja: dasbor dulu (kalau ia memang boleh dibuka), lalu halaman
 * panel pertama yang boleh, baru quotation, baru verify.
 *
 * Langkah kedua itu yang menahan PUTARAN. Sejak `overview` bisa dicabut,
 * mengembalikan `/admin` untuk setiap orang yang punya urusan di panel berarti
 * mengantar orang tanpa izin dasbor ke halaman yang akan menolaknya — dan
 * penolakan itu memanggil fungsi ini lagi. Maka begitu dasbornya tertutup,
 * jawabannya harus halaman lain yang benar-benar terbuka untuknya.
 */
export function landingPathFor(izin: PermissionSet): string {
  if (bisaAkses(izin, "overview", "view")) return "/admin"

  const halaman = halamanPanelPertama(izin)
  if (halaman) return halaman

  if (bisaAkses(izin, "quotation-terbit", "edit")) return "/profile/quotation"
  if (bisaAkses(izin, "verify", "view")) return "/verify"

  /**
   * Tidak punya apa-apa di mana pun. Dulu dikembalikan `/admin`, yang berarti
   * halaman pertama yang dilihat adalah dasbor kosong; sejak dasbor menolak
   * akun tanpa urusan di panel, jawaban itu cuma menambah satu pantulan sebelum
   * berakhir di tempat yang sama. Toko lebih jujur sebagai tujuan — dan
   * `/admin/akun` tetap bisa dibuka kalau passwordnya perlu diganti.
   */
  return "/"
}

/**
 * Halaman panel PERTAMA yang boleh dilihat user, sebagai path — atau null.
 *
 * Urutannya mengikuti `ADMIN_PERMISSION_TREE`, yaitu urutan menu di sidebar:
 * orang yang izinnya cuma "Banner Promo" mendarat di Banner Promo, dan yang
 * izinnya banyak mendarat di yang paling atas. Memakai urutan `ADMIN_PAGES`
 * akan memberi hasil yang benar tapi terasa acak, karena daftar itu tersusun
 * menurut sejarah penambahan kunci.
 *
 * Yang dilewati:
 * - `PAGES_BUKAN_PANEL` — halamannya bukan `/admin/<kunci>`.
 * - `PAGES_SELALU_BOLEH` (`akun`) — dimiliki semua orang, jadi kalau ikut
 *   dihitung ia akan selalu jadi jawabannya dan tidak ada yang pernah mendarat
 *   di halaman kerjanya sendiri.
 * - `overview` — halamannya `/admin`, bukan `/admin/overview`; ia sudah
 *   dijawab lebih dulu di `landingPathFor`.
 */
function halamanPanelPertama(izin: PermissionSet): string | null {
  for (const page of daunPohonIzin()) {
    if (page === "overview") continue
    if (PAGES_BUKAN_PANEL.has(page) || PAGES_SELALU_BOLEH.has(page)) continue
    if (bisaAkses(izin, page, "view")) return `/admin/${page}`
  }
  return null
}

/** Ambil segmen halaman dari pathname `/admin/<page>/...`. Null kalau bukan sub-halaman. */
export function pageFromPathname(pathname: string): AdminPage | null {
  const m = pathname.match(/^\/admin\/([^/?#]+)/)
  if (!m) return null
  const seg = m[1]
  return seg in ADMIN_PAGES ? (seg as AdminPage) : null
}

/**
 * Tingkat yang BERARTI untuk satu izin.
 *
 * Daftar `none`/`view`/`edit` berlaku untuk halaman yang memang bisa dibuka
 * lalu disunting. Sebagian kunci di `ADMIN_PAGES` bukan halaman seperti itu:
 *
 * - `quotation-sales` hanya pernah ditanyakan di level `edit` (enam tempat),
 *   tidak sekali pun di `view`. Menyetelnya ke "Lihat" berakibat PERSIS sama
 *   dengan "Tak ada" — tombolnya menyala seolah izin sudah diberikan, padahal
 *   tidak terjadi apa pun. Tombol yang berbohong.
 * - `logs` dan `colors` sebaliknya: tidak ada yang bisa disunting di sana, jadi
 *   "Edit" cuma nama lain dari "Lihat".
 *
 * Dipakai editor peran untuk memutuskan menampilkan tiga tombol atau satu
 * centang. Penyimpanannya TIDAK berubah — yang boolean tetap disimpan sebagai
 * `edit`/`view`/`none` seperti sebelumnya, jadi tidak ada baris
 * `role_permissions` maupun penjaga server yang perlu tahu soal ini.
 *
 * `Record<AdminPage, …>` — kunci baru tanpa keterangan akan gagal typecheck.
 */
export const ADMIN_PAGE_LEVEL_MODE: Record<AdminPage, LevelMode> = {
  overview: "view-only",
  produk: "view-edit",
  kategori: "view-edit",
  "atribut-brand": "view-edit",
  "harga-accurate": "view-edit",
  // `view` = kolom modal terlihat, `edit` = angkanya boleh diubah. Dua-duanya
  // benar-benar dipakai — lihat `harga-accurate/page.tsx` dan `actions.ts`.
  "harga-modal": "view-edit",
  "pc-builder": "view-edit",
  "pc-prebuild": "view-edit",
  banner: "view-edit",
  toko: "view-edit",
  pelanggan: "view-edit",
  "manajemen-user": "view-edit",
  theme: "view-edit",
  colors: "view-only",
  kebijakan: "view-edit",
  logs: "view-only",
  verify: "view-edit",
  quotation: "view-edit",
  "quotation-terbit": "edit-only",
  "quotation-sales": "edit-only",
  "quotation-oper": "edit-only",
  akun: "view-edit",
}

/** Level tertinggi yang berarti untuk sebuah izin. */
export function levelTertinggi(page: AdminPage): AccessLevel {
  return levelTertinggiUntukMode(ADMIN_PAGE_LEVEL_MODE[page])
}

/**
 * Level yang sah untuk sebuah izin, dari level apa pun yang diminta.
 *
 * Dipakai kontrol massal di editor peran: menekan "Lihat" pada induk berarti
 * "beri tingkat terkecil yang masih berarti" bagi tiap anak — dan untuk anak
 * yang cuma ya-tidak, "Lihat" tidak berarti apa-apa, jadi jawabannya "Tak ada".
 * Tanpa penyesuaian ini, satu tekan pada induk menanam level yang tidak pernah
 * dibaca siapa pun ke dalam `role_permissions`.
 */
export function levelSahUntuk(page: AdminPage, diminta: AccessLevel): AccessLevel {
  return levelSahUntukMode(ADMIN_PAGE_LEVEL_MODE[page], diminta)
}

/**
 * Susunan izin seperti yang DILIHAT orang saat menyusun peran.
 *
 * Murni tampilan. `ADMIN_PAGES` tetap satu-satunya sumber kebenaran soal kunci
 * apa yang ada, `role_permissions` tetap datar, dan `bisaAkses()` tidak tahu
 * pohon ini ada. Induk BUKAN izin: ia tidak punya baris di database dan tidak
 * pernah diperiksa server — statusnya semata cerminan anak-anaknya.
 *
 * Itu disengaja. Kalau induk punya izinnya sendiri, akan ada keadaan "induk
 * mati tapi anak hidup" dan dua sumber kebenaran untuk satu pertanyaan; yang
 * kalah adalah orang yang bingung kenapa izin yang sudah dicentang tidak jalan.
 *
 * Urutannya mengikuti urutan menu, bukan abjad — orang mencari izin dengan
 * mengingat letak menunya.
 */
export type PermissionNode = {
  /** Kunci izin. Kosong = grup murni, label saja. */
  key?: AdminPage
  /** Nama yang tampil. Untuk daun boleh berbeda dari label di `ADMIN_PAGES`
   *  (mis. "Semua Produk" di bawah grup "Produk"). */
  label: string
  children?: PermissionNode[]
}

export const ADMIN_PERMISSION_TREE: readonly PermissionNode[] = [
  { key: "overview", label: "Overview" },
  {
    label: "Produk",
    children: [
      { key: "produk", label: "Semua Produk" },
      { key: "kategori", label: "Kategori" },
      { key: "atribut-brand", label: "Atribut & Brand" },
      {
        key: "harga-accurate",
        label: "Update Harga",
        // Bukan halaman sendiri — satu KOLOM di halaman Update Harga. Ditaruh
        // sebagai anaknya supaya hubungan itu terlihat: tanpa izin induknya,
        // izin ini tidak membuka apa pun.
        children: [{ key: "harga-modal", label: "Harga Modal (CP)" }],
      },
    ],
  },
  { key: "pc-builder", label: "PC Builder" },
  { key: "pc-prebuild", label: "PC Prebuild" },
  { key: "banner", label: "Banner Promo" },
  { key: "toko", label: "Toko & Lokasi" },
  {
    label: "Quotation & Penjualan",
    children: [
      { key: "quotation", label: "Rekap & Pengawasan Penjualan" },
      { key: "verify", label: "Verify" },
      { key: "quotation-terbit", label: "Membuat Quotation" },
      { key: "quotation-sales", label: "Tercantum sebagai Sales" },
      { key: "quotation-oper", label: "Mengoper ke Sales" },
    ],
  },
  {
    label: "Manajemen User",
    children: [
      { key: "manajemen-user", label: "Konfigurasi Akses User" },
      { key: "pelanggan", label: "Daftar Pelanggan" },
    ],
  },
  { key: "kebijakan", label: "Kebijakan" },
  {
    label: "Tema",
    children: [
      { key: "theme", label: "Nuansa Musiman" },
      { key: "colors", label: "Rujukan Warna" },
    ],
  },
  { key: "logs", label: "Logs" },
]

/**
 * Kunci yang sengaja TIDAK muncul di pohon: `akun`.
 *
 * Ia diberikan ke setiap admin oleh `muatIzinUser()` tanpa kecuali, jadi
 * menampilkannya sebagai pilihan berarti menawarkan saklar yang tidak
 * tersambung ke apa pun.
 */
const TIDAK_DI_POHON: ReadonlySet<AdminPage> = new Set<AdminPage>(["akun"])

/** Semua kunci izin di dalam pohon, terurut sesuai tampilannya. */
export function daunPohonIzin(
  nodes: readonly PermissionNode[] = ADMIN_PERMISSION_TREE,
): AdminPage[] {
  const out: AdminPage[] = []
  for (const n of nodes) {
    if (n.key) out.push(n.key)
    if (n.children) out.push(...daunPohonIzin(n.children))
  }
  return out
}

/**
 * Pagar supaya izin baru tidak bisa diam-diam hilang dari layar penyusunan peran.
 *
 * `ADMIN_PAGES` sudah memaksa tiap kunci baru punya keterangan (lewat
 * `Record<AdminPage, string>`), tapi tidak ada tipe yang bisa memaksanya muncul
 * di sebuah POHON. Tanpa pemeriksaan ini, menambah kunci lalu lupa
 * mendaftarkannya menghasilkan izin yang hidup di server tapi tidak pernah bisa
 * diberikan lewat panel — dan gejalanya bukan galat, melainkan kotak centang
 * yang tidak pernah ada.
 *
 * Dijalankan sekali saat modul dimuat, dan MELEMPAR, bukan mencatat: ini salah
 * tulis kode yang harus ketahuan di pengembangan, bukan diam-diam lolos.
 */
{
  const daun = daunPohonIzin()
  const kembar = daun.filter((k, i) => daun.indexOf(k) !== i)
  if (kembar.length > 0) {
    throw new Error(`ADMIN_PERMISSION_TREE: kunci kembar — ${kembar.join(", ")}`)
  }
  const hilang = (Object.keys(ADMIN_PAGES) as AdminPage[]).filter(
    (k) => !TIDAK_DI_POHON.has(k) && !daun.includes(k),
  )
  if (hilang.length > 0) {
    throw new Error(`ADMIN_PERMISSION_TREE: kunci belum didaftarkan — ${hilang.join(", ")}`)
  }
}

/**
 * Apakah izin ini membuka sesuatu di LUAR panel `/admin`?
 *
 * Dipakai editor peran untuk menandai barisnya, supaya yang menyusun peran tahu
 * bahwa mencentang ini tidak membuat siapa pun bisa masuk panel. Sebelumnya
 * pengetahuan itu hanya hidup sebagai `PAGES_BUKAN_PANEL` di berkas ini dan tak
 * pernah sampai ke layar — jadi peran "Kasir" bisa disusun tanpa satu pun
 * petunjuk bahwa orangnya tidak akan pernah melihat panel.
 */
export function adalahIzinLuarPanel(page: AdminPage): boolean {
  return PAGES_BUKAN_PANEL.has(page)
}
