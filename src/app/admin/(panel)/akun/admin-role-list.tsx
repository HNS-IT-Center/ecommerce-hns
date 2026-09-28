"use client"

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Info, ShieldCheck, X, Check, UserMinus, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { AdminPagination } from "@/components/admin/admin-pagination"
import { RoleTag, kelasAksenPeran } from "@/components/admin/role-tag"
import { ADMIN_ROLE_DESCRIPTIONS, ADMIN_ROLE_LABELS, type AdminRole } from "@/lib/auth/roles"

import { updateAdminRole, updateAdminRoleId, demoteAdminToCustomer } from "./role-actions"
import { EMPTY_ROLE_STATE } from "./role-state"

/** Posisi & sasaran menu klik-kanan. */
type CtxMenu = { x: number; y: number; adminId: string; currentRoleId: string | null; role: AdminRole } | null

type AdminItem = {
  id: string
  name: string
  username: string
  email: string
  role: AdminRole
  /** Peran RBAC dinamis yang tertaut (null = pakai role lama). */
  roleId: string | null
}

/** Peran dinamis yang bisa dipilih (dibuat di Manajemen User). */
type RoleOption = { id: string; name: string }

type Props = {
  admins: AdminItem[]
  currentUserId: string
  /** Peran dinamis yang tersedia untuk ditautkan. */
  roleOptions: RoleOption[]
  /**
   * Hanya owner yang boleh mengubah role. Staff tetap MELIHAT kolomnya —
   * menyembunyikan seluruh bagian ini akan membuat staff mengira fiturnya tidak
   * ada, lalu bertanya-tanya kenapa ia tidak bisa menghapus akun pelanggan.
   * Yang terlihat tapi terkunci menjelaskan dirinya sendiri.
   */
  canManage: boolean
  /**
   * Tampilkan baris pencarian & filter peran di atas daftar.
   *
   * Mati secara bawaan. Komponen ini dirender di DUA tempat: tab Admin di
   * Manajemen User (daftar seluruh tim — di situlah mencari orang masuk akal)
   * dan kartu "Role Admin" di /admin/akun, yang isinya sama tapi hadir sebagai
   * keterangan singkat. Menyalakannya di mana-mana berarti menaruh kotak
   * pencarian di atas daftar yang orangnya tidak datang untuk dicari.
   */
  showFilter?: boolean
}

/** Nilai filter peran yang bukan id peran — sentinel, supaya tidak bentrok. */
const PERAN_SEMUA = "semua"
const PERAN_TANPA = "tanpa"

/**
 * Kartu admin per halaman. Kelipatan 12 supaya barisnya penuh di ketiga lebar
 * grid: 1 kolom di ponsel, 2 di `sm`, 3 di `xl` — tidak ada baris terakhir yang
 * menggantung dengan satu kartu sendirian.
 */
const ADMIN_PER_HALAMAN = 12

function RoleBadge({ role }: { role: AdminRole }) {
  return (
    <span
      className={
        role === "owner"
          ? "inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary"
          : "inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground"
      }
    >
      {role === "owner" && <ShieldCheck className="h-3 w-3" />}
      {ADMIN_ROLE_LABELS[role]}
    </span>
  )
}

/**
 * Inisial untuk lingkaran di pojok kartu. Maksimal dua huruf — tiga ke atas
 * mulai terbaca sebagai singkatan, bukan sebagai penanda orang.
 */
function inisial(nama: string): string {
  const kata = nama.trim().split(/\s+/).filter(Boolean)
  if (kata.length === 0) return "?"
  if (kata.length === 1) return kata[0].slice(0, 2).toUpperCase()
  return (kata[0][0] + kata[kata.length - 1][0]).toUpperCase()
}

export function AdminRoleList({
  admins,
  currentUserId,
  roleOptions,
  canManage,
  showFilter = false,
}: Props) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(updateAdminRole, EMPTY_ROLE_STATE)
  const [roleIdState, roleIdAction, roleIdPending] = useActionState(updateAdminRoleId, EMPTY_ROLE_STATE)
  const [turunState, turunAction, turunPending] = useActionState(
    demoteAdminToCustomer,
    EMPTY_ROLE_STATE,
  )
  /** Akun yang sedang ditanyakan penurunannya (null = dialog tertutup). */
  const [akanDiturunkan, setAkanDiturunkan] = useState<AdminItem | null>(null)

  /**
   * Keterangan hasil, disesuaikan saat render alih-alih lewat `useEffect` —
   * aturan lint `set-state-in-effect` berlaku di repo ini, dan pola efek
   * membuat pesannya baru muncul satu render setelah datanya ada.
   *
   * `dismissed` menyimpan pesan yang sudah ditutup staff, bukan boolean:
   * dengan boolean, pengubahan role BERIKUTNYA tidak akan memunculkan
   * keterangan baru karena penandanya masih menyala dari yang sebelumnya.
   */
  const [dismissed, setDismissed] = useState<string | null>(null)
  const sukses = turunState.success ?? roleIdState.success ?? state.success
  const notice = sukses && sukses !== dismissed ? sukses : null
  const errorPesan = state.error ?? roleIdState.error ?? turunState.error
  const sedangProses = pending || roleIdPending || turunPending

  // Dihitung dari daftar PENUH, bukan hasil saringan. Penjaga "owner terakhir"
  // di bawah memakai angka ini; kalau ia ikut menyusut saat staff mengetik di
  // kotak pencarian, satu-satunya owner yang kebetulan tersaring keluar akan
  // terlihat boleh diturunkan — tombol yang pasti ditolak server.
  const ownerCount = admins.filter((a) => a.role === "owner").length
  const namaPeran = new Map(roleOptions.map((r) => [r.id, r.name]))

  /** Kata kunci pencarian (nama & email) dan peran yang sedang disaring. */
  const [cari, setCari] = useState("")
  const [filterPeran, setFilterPeran] = useState<string>(PERAN_SEMUA)

  const adminTampil = useMemo(() => {
    if (!showFilter) return admins
    const kunci = cari.trim().toLowerCase()
    return admins.filter((a) => {
      const cocokKunci =
        kunci === "" ||
        a.name.toLowerCase().includes(kunci) ||
        a.email.toLowerCase().includes(kunci)
      const cocokPeran =
        filterPeran === PERAN_SEMUA ||
        (filterPeran === PERAN_TANPA ? a.roleId === null : a.roleId === filterPeran)
      return cocokKunci && cocokPeran
    })
  }, [admins, cari, filterPeran, showFilter])

  const adaFilterAktif = cari.trim() !== "" || filterPeran !== PERAN_SEMUA

  /**
   * Halaman yang sedang dibuka.
   *
   * Dijepit saat render (`halamanAktif`), BUKAN di-reset lewat `useEffect` saat
   * filternya berubah. Efek baru berjalan setelah render pertama, jadi selama
   * satu frame daftarnya kosong — orang yang mengetik di kotak cari akan
   * melihatnya berkedip kosong sebelum hasilnya muncul. Menjepitnya di sini
   * membuat penyaringan yang memangkas daftar sampai tinggal satu halaman
   * langsung menarik tampilan kembali ke halaman yang memang ada.
   */
  const [halaman, setHalaman] = useState(1)
  const jumlahHalaman = Math.max(1, Math.ceil(adminTampil.length / ADMIN_PER_HALAMAN))
  const halamanAktif = Math.min(halaman, jumlahHalaman)
  const adminHalamanIni = adminTampil.slice(
    (halamanAktif - 1) * ADMIN_PER_HALAMAN,
    halamanAktif * ADMIN_PER_HALAMAN,
  )

  /**
   * Peran yang baru dipilih staff, ditahan sampai data server menyusul.
   *
   * INI BUKAN SEKADAR PENGHALUS TAMPILAN. `revalidatePath` di dalam server
   * action tidak bisa diandalkan untuk menyegarkan halaman yang sedang dilihat
   * DENGAN query string — dan tab Admin selalu dibuka sebagai
   * `/admin/manajemen-user?tab=admin`. Akibatnya, begitu permintaannya selesai,
   * prop `admins` masih berisi peran yang LAMA: dropdown terkendali dengan
   * patuh menggambar ulang peran lama itu, dan yang terlihat adalah pilihan
   * yang "membatalkan dirinya sendiri" — padahal di database peran barunya
   * sudah tersimpan, seperti yang terbukti begitu halamannya dimuat ulang.
   *
   * Dua hal yang menutup itu: penahan ini, dan `router.refresh()` di bawah yang
   * memang mengambil ulang alamat yang sedang dibuka apa adanya, query string
   * dan semuanya.
   *
   * Dilepas begitu action-nya GAGAL, supaya dropdown tidak terus memamerkan
   * pilihan yang tidak pernah tersimpan — dalam keadaan itu yang benar justru
   * angka dari server.
   */
  const [sedangDipilih, setSedangDipilih] = useState<{ adminId: string; roleId: string } | null>(null)
  // `&& !roleIdPending`: kalau percobaan SEBELUMNYA gagal, pesan errornya masih
  // tersimpan saat percobaan berikutnya berjalan. Tanpa syarat itu, percobaan
  // kedua akan kehilangan penahannya dan dropdown berkedip ke peran lama lagi.
  const penahan = roleIdState.error && !roleIdPending ? null : sedangDipilih
  function peranTerpilih(admin: AdminItem): string {
    const nilaiServer = admin.roleId ?? ""
    if (penahan?.adminId === admin.id && penahan.roleId !== nilaiServer) return penahan.roleId
    return nilaiServer
  }

  /**
   * Ambil ulang data server sekali setiap kali sebuah perubahan berhasil.
   *
   * Penandanya sengaja di-reset saat ada permintaan BERJALAN, bukan dibandingkan
   * dengan isi pesan suksesnya: dua perubahan peran berturut-turut menghasilkan
   * pesan yang sama persis ("Peran berhasil ditautkan."), jadi membandingkan
   * pesan berarti perubahan kedua tidak akan pernah menyegarkan apa pun.
   */
  const sudahSegarkanRef = useRef(false)
  useEffect(() => {
    if (pending || roleIdPending || turunPending) {
      sudahSegarkanRef.current = false
      return
    }
    const adaSukses = roleIdState.success ?? state.success ?? turunState.success
    if (adaSukses && !sudahSegarkanRef.current) {
      sudahSegarkanRef.current = true
      router.refresh()
    }
  }, [
    pending,
    roleIdPending,
    turunPending,
    roleIdState.success,
    state.success,
    turunState.success,
    router,
  ])

  // Menu klik-kanan untuk ubah peran langsung.
  const [ctx, setCtx] = useState<CtxMenu>(null)
  // Tutup menu saat klik di mana saja / tekan Escape / scroll.
  useEffect(() => {
    if (!ctx) return
    const tutup = () => setCtx(null)
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setCtx(null)
    window.addEventListener("click", tutup)
    window.addEventListener("scroll", tutup, true)
    window.addEventListener("keydown", esc)
    return () => {
      window.removeEventListener("click", tutup)
      window.removeEventListener("scroll", tutup, true)
      window.removeEventListener("keydown", esc)
    }
  }, [ctx])

  /**
   * Menu klik-kanan memanggil action-nya sendiri, tidak lewat `<form action>`
   * seperti formulir lain di panel — dan fungsi dari `useActionState` HARUS
   * dijalankan di dalam transition.
   *
   * Tanpa itu React memperingatkan di konsol dan `isPending` tidak pernah
   * menyala, jadi tombolnya tidak terkunci selama permintaan berjalan: klik
   * kedua di detik yang sama mengirim perubahan peran dua kali. Formulir lain
   * tidak kena karena mengoper action ke atribut `action`, yang sudah
   * dibungkus transition oleh React sendiri.
   */
  const [, startTransition] = useTransition()

  /** Ubah peran dinamis (roleId) lewat menu — submit programatik ke action. */
  function pilihPeran(adminId: string, roleId: string) {
    const fd = new FormData()
    fd.set("userId", adminId)
    fd.set("roleId", roleId) // "" = lepas → kembali ke owner/staff
    setSedangDipilih({ adminId, roleId })
    startTransition(() => roleIdAction(fd))
    setCtx(null)
  }

  /**
   * Akun yang sedang diklik-kanan, beserta alasan kalau ia tidak boleh
   * diturunkan. Penjaga sebenarnya ada di server (owner terakhir di
   * `setCustomerRole`, penurunan diri sendiri di `demoteAdminToCustomer`) —
   * yang di sini supaya menunya tidak menawarkan sesuatu yang pasti ditolak,
   * dan bisa menyebut alasannya di tempat.
   */
  const sasaranCtx = ctx ? (admins.find((a) => a.id === ctx.adminId) ?? null) : null
  const alasanTakBisaTurun =
    ctx && sasaranCtx
      ? ctx.adminId === currentUserId
        ? "Tidak bisa menurunkan akun sendiri"
        : sasaranCtx.role === "owner" && ownerCount <= 1
          ? "Ini satu-satunya owner"
          : null
      : null

  function mintaTurunkan(adminId: string) {
    const admin = admins.find((a) => a.id === adminId)
    if (admin) setAkanDiturunkan(admin)
    setCtx(null)
  }

  function jalankanPenurunan() {
    if (!akanDiturunkan) return
    const fd = new FormData()
    fd.set("userId", akanDiturunkan.id)
    // Di dalam transition dengan alasan yang sama seperti `pilihPeran` di atas.
    startTransition(() => turunAction(fd))
    setAkanDiturunkan(null)
  }

  return (
    <div>
      {notice && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-success/30 bg-success/10 p-3 text-sm">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          <p className="flex-1">{notice}</p>
          <button
            type="button"
            onClick={() => setDismissed(notice)}
            aria-label="Tutup keterangan"
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {errorPesan && (
        <p className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {errorPesan}
        </p>
      )}

      {/*
        Grid kartu: SATU kolom di ponsel, dua di tablet, tiga di layar lebar.

        Ponsel sengaja tidak dua kolom. Satu kartu memuat nama, @username,
        email, tag peran, dan dua kendali — di layar 360px satu kolom cuma
        kebagian ~165px, cukup untuk memenggal email seperti
        "developer.hns@gmail.com" di tengah dan membuat dropdown perannya tidak
        bisa dipakai. Pelajaran yang sama sudah dibayar sekali di tabel
        Pelanggan, yang batasnya juga harus digeser naik setelah dilihat di
        lebar sebenarnya.

        `items-stretch` + `h-full` di kartunya: tanpa itu tinggi kartu mengikuti
        isi masing-masing, dan deretan tombol di bawahnya tidak lagi sebaris —
        mata harus mencari tombolnya satu per satu.
      */}
      {/*
        Pencarian & filter peran. Disaring di KLIEN, bukan lewat query string:
        `listAdminUsers()` memang sudah memuat seluruh admin sekaligus (tanpa
        pagination, karena jumlahnya segelintir), jadi menyaringnya di sini
        instan dan tidak memuat ulang halaman — sekaligus tidak menabrak
        `?tab=admin` yang dipakai Manajemen User.

        Bertumpuk di ponsel, sebaris mulai `sm`: kotak cari dan dropdown peran
        berdampingan di 360px menyisakan ruang yang terlalu sempit untuk
        dua-duanya.
      */}
      {showFilter && (
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="search"
              value={cari}
              onChange={(e) => {
                setCari(e.target.value)
                setHalaman(1)
              }}
              placeholder="Cari nama atau email"
              aria-label="Cari admin berdasarkan nama atau email"
              className="w-full rounded-md border border-input bg-background py-2 pr-3 pl-9 text-sm"
            />
          </div>
          <select
            value={filterPeran}
            onChange={(e) => {
              setFilterPeran(e.target.value)
              setHalaman(1)
            }}
            aria-label="Saring admin berdasarkan peran"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm sm:w-56"
          >
            <option value={PERAN_SEMUA}>Semua peran</option>
            <option value={PERAN_TANPA}>Tanpa peran</option>
            {roleOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {showFilter && adaFilterAktif && (
        <p className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>
            Menampilkan {adminTampil.length} dari {admins.length} admin.
          </span>
          <button
            type="button"
            onClick={() => {
              setCari("")
              setFilterPeran(PERAN_SEMUA)
              setHalaman(1)
            }}
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Reset filter
          </button>
        </p>
      )}

      <ul className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {adminHalamanIni.map((admin) => {
          const isSelf = admin.id === currentUserId
          // Owner terakhir tidak boleh diturunkan — penjaga sebenarnya ada di
          // server (lib/api/admin-users.ts). Di sini cuma supaya tombolnya tidak
          // menawarkan sesuatu yang pasti ditolak.
          const isLastOwner = admin.role === "owner" && ownerCount <= 1
          const lockedReason = isLastOwner
            ? "Ini satu-satunya owner. Angkat admin lain jadi owner dulu."
            : isSelf && admin.role === "owner"
              ? "Anda tidak bisa menurunkan role akun sendiri."
              : null
          const roleIdTampil = peranTerpilih(admin) || null
          const namaPeranTampil = roleIdTampil ? (namaPeran.get(roleIdTampil) ?? "Peran terhapus") : null

          return (
            <li
              key={admin.id}
              onContextMenu={
                canManage
                  ? (e) => {
                      e.preventDefault()
                      setCtx({ x: e.clientX, y: e.clientY, adminId: admin.id, currentRoleId: admin.roleId, role: admin.role })
                    }
                  : undefined
              }
              className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-background"
            >
              {/* Garis aksen sewarna tag perannya — penanda yang bisa dipindai
                  mata dari jauh, sebelum satu nama pun dibaca. */}
              <span
                aria-hidden="true"
                className={`block h-1 w-full shrink-0 ${kelasAksenPeran(roleIdTampil)}`}
              />

              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground"
                  >
                    {inisial(admin.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold break-words">{admin.name}</span>
                      {isSelf && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                          Anda
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs break-all text-muted-foreground">@{admin.username}</p>
                    <p className="text-xs break-all text-muted-foreground">{admin.email}</p>
                  </div>
                </div>

                {/* Peran yang BERLAKU sekarang — dua-duanya, karena dua-duanya
                    memang berlaku bersamaan: owner/staff menentukan hak dasar,
                    peran dinamis menentukan halaman mana yang terbuka. */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <RoleBadge role={admin.role} />
                  <RoleTag roleId={roleIdTampil}>{namaPeranTampil ?? "Tanpa peran"}</RoleTag>
                </div>

                <p className="text-xs leading-relaxed text-muted-foreground">
                  {ADMIN_ROLE_DESCRIPTIONS[admin.role]}
                </p>

                {canManage && (
                  <div className="mt-auto flex flex-col gap-2 border-t border-border pt-3">
                    {/* Peran RBAC dinamis — izin per halaman. Terpisah dari
                        owner/staff: yang ini menentukan halaman apa yang boleh
                        diakses, submit langsung saat pilihan berubah. */}
                    <form action={roleIdAction} className="flex items-center gap-2">
                      <input type="hidden" name="userId" value={admin.id} />
                      <label htmlFor={`peran-${admin.id}`} className="text-xs text-muted-foreground">
                        Peran:
                      </label>
                      {/*
                        TERKENDALI (`value`), bukan `defaultValue`. Dengan
                        `defaultValue`, isi dropdown ditentukan sekali saat
                        elemennya lahir lalu berjalan sendiri — kalau peran yang
                        sama diubah dari tempat lain (menu klik-kanan, atau
                        jendela lain), dropdown ini tidak ikut berubah dan
                        memperlihatkan peran yang sudah tidak berlaku.
                      */}
                      <select
                        id={`peran-${admin.id}`}
                        name="roleId"
                        value={peranTerpilih(admin)}
                        disabled={sedangProses}
                        onChange={(e) => {
                          setSedangDipilih({ adminId: admin.id, roleId: e.currentTarget.value })
                          e.currentTarget.form?.requestSubmit()
                        }}
                        className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs"
                      >
                        <option value="">— (owner/staff)</option>
                        {roleOptions.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </form>

                    <form action={formAction}>
                      <input type="hidden" name="userId" value={admin.id} />
                      <input
                        type="hidden"
                        name="role"
                        value={admin.role === "owner" ? "staff" : "owner"}
                      />
                      <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        disabled={sedangProses || lockedReason !== null}
                        title={lockedReason ?? undefined}
                        className="w-full"
                      >
                        {admin.role === "owner" ? "Turunkan ke Staff" : "Angkat jadi Owner"}
                      </Button>
                    </form>
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {showFilter && adminTampil.length === 0 && (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Tidak ada admin yang cocok dengan pencarian atau filter ini.
        </p>
      )}

      {/* Hanya muncul saat memang ada halaman kedua. Daftar tim yang isinya
          empat orang tidak perlu navigasi halaman di bawahnya. */}
      {jumlahHalaman > 1 && (
        <AdminPagination
          page={halamanAktif}
          pageCount={jumlahHalaman}
          total={adminTampil.length}
          pageSize={ADMIN_PER_HALAMAN}
          labelBaris="admin"
          onPageChange={setHalaman}
        />
      )}

      {canManage && (
        <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          Tip: <strong>klik kanan</strong> pada kartu admin untuk mengubah perannya langsung.
        </p>
      )}

      {!canManage && (
        <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          Hanya akun <strong>owner</strong> yang bisa mengubah role. Hubungi owner kalau akses Anda
          perlu diubah.
        </p>
      )}

      {/* Menu klik-kanan: daftar peran, klik = langsung ubah. Diposisikan di
          koordinat kursor; menutup sendiri saat klik/scroll/Escape. */}
      {ctx && (
        <div
          role="menu"
          onClick={(e) => e.stopPropagation()}
          style={{ top: ctx.y, left: ctx.x }}
          className="fixed z-50 min-w-52 overflow-hidden rounded-lg border border-border bg-background py-1 shadow-lg"
        >
          <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">Ubah peran</div>
          {/* Opsi "lepas" — kembali ke owner/staff lama. */}
          <button
            type="button"
            role="menuitem"
            disabled={sedangProses}
            onClick={() => pilihPeran(ctx.adminId, "")}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-50"
          >
            <span className="w-4">{ctx.currentRoleId === null && <Check className="h-4 w-4 text-primary" />}</span>
            — (owner/staff)
          </button>
          {roleOptions.map((r) => (
            <button
              key={r.id}
              type="button"
              role="menuitem"
              disabled={sedangProses}
              onClick={() => pilihPeran(ctx.adminId, r.id)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-50"
            >
              <span className="w-4">{ctx.currentRoleId === r.id && <Check className="h-4 w-4 text-primary" />}</span>
              {r.name}
            </button>
          ))}
          {roleOptions.length === 0 && (
            <div className="px-3 py-1.5 text-xs text-muted-foreground">
              Belum ada peran. Buat di tab Peran dulu.
            </div>
          )}

          {/*
            Mencabut akses panel, bukan sekadar mengganti peran — karena itu
            dipisah garis dan berwarna destruktif, supaya tidak terpilih saat
            seseorang bermaksud mengganti peran biasa. Melepas peran di atas
            ("— owner/staff") TIDAK mencabut akses apa pun.
          */}
          <div className="my-1 border-t border-border" />
          {alasanTakBisaTurun ? (
            <div className="px-3 py-1.5 text-xs text-muted-foreground">
              {alasanTakBisaTurun} — tidak bisa diturunkan
            </div>
          ) : (
            <button
              type="button"
              role="menuitem"
              disabled={sedangProses}
              onClick={() => mintaTurunkan(ctx.adminId)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              <UserMinus className="h-4 w-4 shrink-0" />
              Turunkan jadi pelanggan
            </button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={akanDiturunkan !== null}
        onOpenChange={(open) => {
          if (!open) setAkanDiturunkan(null)
        }}
        destructive
        confirmLabel="Turunkan"
        title={`Turunkan ${akanDiturunkan?.name ?? "akun ini"} jadi pelanggan?`}
        description={
          <>
            Akses ke panel admin dicabut — akun ini kembali menjadi pelanggan biasa dan hanya bisa
            membuka halaman toko. Akunnya sendiri tidak dihapus, dan bisa dinaikkan lagi kapan saja
            lewat klik-kanan di tab Pelanggan.
          </>
        }
        onConfirm={jalankanPenurunan}
      />
    </div>
  )
}
