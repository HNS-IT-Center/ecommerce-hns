import { ShieldCheck } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Tag peran berwarna, dipakai di seluruh Manajemen User: kartu admin (tab
 * Admin), daftar peran (tab Peran), dan tabel pelanggan (tab Pelanggan).
 *
 * WARNANYA DITURUNKAN DARI `id` PERAN, bukan disimpan sebagai kolom.
 *
 * Peran itu data buatan staff dan jumlahnya bebas, jadi warnanya tidak bisa
 * dipatok satu per satu di kode seperti owner/staff. Dua jalan yang mungkin:
 * menambah kolom `color` di tabel `roles` (butuh migrasi + pemilih warna di
 * UI), atau menurunkannya dari id yang sudah ada. Yang kedua dipilih: id peran
 * tidak pernah berubah selama peran itu hidup, sehingga satu peran memegang
 * warna yang sama sejak dibuat, di semua layar dan semua perangkat, tanpa satu
 * pun kolom baru.
 *
 * Konsekuensi yang perlu diketahui: warna tidak bisa dipilih staff, dan dua
 * peran BISA kebagian warna yang sama kalau jumlahnya melewati panjang palet.
 * Itu ditoleransi — warnanya alat bantu pindai mata, bukan penanda identitas;
 * nama perannya tetap tertulis di dalam tag.
 */

/**
 * Palet tag. Tiap entri menyebut warna latar dan garis tepinya sendiri untuk
 * mode terang DAN gelap — kelas Tailwind harus utuh di sumber, tidak boleh
 * dirangkai dari potongan string, karena pemindai Tailwind v4 membaca berkas ini
 * sebagai teks dan tidak menjalankan kodenya.
 *
 * TEKSNYA ABU-ABU GELAP (`gray-900`), sama untuk semua warna — bukan versi tua
 * dari rona latarnya (`text-sky-700`, `text-amber-700`, dan seterusnya). Bentuk
 * pertama itu terlihat rapi di palet, tapi di layar jadinya pudar: teks kecil
 * setebal 12px dengan warna beralfa di atas latar yang juga beralfa kehilangan
 * kontras, dan yang paling parah justru yang paling terang — amber dan lime
 * nyaris hilang di mode terang. Warna perannya tetap terbaca dari latar dan
 * garis tepinya; yang harus dibaca huruf demi huruf adalah namanya, dan itu
 * butuh kontras, bukan rona.
 *
 * Sempat `slate-800`, lalu diturunkan ke `gray-900`: slate membawa rona biru
 * yang ikut terbaca sebagai warna tag, dan di atas latar sebiru sky atau cyan ia
 * malah menyatu — persis kebalikan dari maksudnya.
 *
 * TIDAK ADA varian `dark:` di sini, dan itu disengaja.
 *
 * Project ini tidak pernah mendeklarasikan `@custom-variant dark` di
 * `globals.css`, jadi `dark:` masih berarti bawaan Tailwind v4:
 * `@media (prefers-color-scheme: dark)` — SETELAN SISTEM OPERASI pembaca.
 * Sementara tema gelap aplikasinya sendiri digerakkan kelas `.dark`. Keduanya
 * tidak nyambung, sehingga `dark:text-gray-100` menyala di laptop yang Windows-
 * nya disetel gelap WALAU panelnya sedang menggambar dirinya terang — dan
 * teksnya jadi putih di atas tag yang pucat, persis yang terlihat di layar.
 *
 * Karena panel ini selalu digambar dengan permukaan terang, satu nilai gelap
 * saja yang benar. Kalau suatu hari `.dark` benar-benar dipakai, yang harus
 * diperbaiki adalah deklarasi variannya di `globals.css` — satu baris untuk
 * seluruh codebase — bukan menambahkan `dark:` di sini yang akan mengulang
 * kesalahan yang sama.
 *
 * Alfa latarnya dinaikkan ke /20 seiring itu: dengan teks netral, latarlah yang
 * memikul seluruh beban membedakan satu peran dari yang lain.
 */
const ROLE_TAG_PALETTE = [
  "bg-sky-500/20 border-sky-500/35 text-gray-900",
  "bg-violet-500/20 border-violet-500/35 text-gray-900",
  "bg-emerald-500/20 border-emerald-500/35 text-gray-900",
  "bg-amber-500/25 border-amber-500/40 text-gray-900",
  "bg-rose-500/20 border-rose-500/35 text-gray-900",
  "bg-cyan-500/20 border-cyan-500/35 text-gray-900",
  "bg-fuchsia-500/20 border-fuchsia-500/35 text-gray-900",
  "bg-lime-500/25 border-lime-500/40 text-gray-900",
] as const

/**
 * Warna untuk yang TANPA peran dinamis — "owner/staff" lama. Sengaja abu-abu
 * netral dan bukan salah satu warna palet: ketiadaan peran bukan sebuah peran,
 * dan memberinya warna sendiri membuatnya terbaca seperti satu. Teksnya juga
 * tetap `muted`, bukan abu-abu gelap, supaya ia memang terbaca lebih ringan
 * daripada peran yang sungguhan ada.
 */
const ROLE_TAG_NEUTRAL = "bg-muted text-muted-foreground border-border"

/**
 * Indeks palet dari sebuah id. FNV-1a 32-bit — sederhana, tanpa dependensi, dan
 * yang penting: hasilnya sama di server dan di klien, sehingga tidak ada
 * ketidakcocokan hidrasi.
 */
function indeksWarna(id: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash % ROLE_TAG_PALETTE.length
}

/** Kelas warna satu peran. `null` = belum punya peran dinamis. */
export function kelasWarnaPeran(roleId: string | null): string {
  return roleId === null ? ROLE_TAG_NEUTRAL : ROLE_TAG_PALETTE[indeksWarna(roleId)]
}

type RoleTagProps = {
  /** Id peran — penentu warnanya. `null` untuk "belum ada peran". */
  roleId: string | null
  /** Nama peran yang tertulis di dalam tag. */
  children: React.ReactNode
  /** Ikon perisai di depan nama — dipakai untuk menandai owner. */
  withShield?: boolean
  className?: string
}

export function RoleTag({ roleId, children, withShield = false, className }: RoleTagProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold",
        kelasWarnaPeran(roleId),
        className,
      )}
    >
      {withShield && <ShieldCheck className="h-3 w-3 shrink-0" aria-hidden="true" />}
      <span className="truncate">{children}</span>
    </span>
  )
}

/**
 * Titik warna kecil tanpa teks — untuk tempat sempit (mis. di depan nama di
 * daftar peran) di mana tag utuh akan berebut ruang dengan nama itu sendiri.
 */
export function RoleDot({ roleId, className }: { roleId: string | null; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full border", kelasWarnaPeran(roleId), className)}
    />
  )
}

/**
 * Warna pekat untuk garis aksen di tepi kartu — indeksnya SEJAJAR dengan
 * `ROLE_TAG_PALETTE`, jadi satu peran memakai rona yang sama di tag maupun di
 * garisnya. Dipisah karena tag butuh latar tipis agar teksnya terbaca,
 * sedangkan garis setebal 3px justru hilang kalau alfanya serendah itu.
 *
 * Tanpa varian `dark:` dengan alasan yang sama seperti palet di atas — di
 * project ini `dark:` mengikuti setelan sistem operasi, bukan tema aplikasi.
 */
const ROLE_ACCENT_PALETTE = [
  "bg-sky-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-fuchsia-500",
  "bg-lime-500",
] as const

/** Kelas garis aksen satu peran. `null` = belum punya peran dinamis. */
export function kelasAksenPeran(roleId: string | null): string {
  return roleId === null ? "bg-border" : ROLE_ACCENT_PALETTE[indeksWarna(roleId)]
}
