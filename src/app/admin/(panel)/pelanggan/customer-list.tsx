"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  Cpu,
  Mail,
  Phone,
  ShieldAlert,
  Trash2,
  X,
  Check,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { RoleTag } from "@/components/admin/role-tag"
import type { CustomerSortField, SortDirection } from "@/lib/api/customers"

import { DeleteCustomerDialog } from "./delete-customer-dialog"
import { setCustomerRoleAction } from "./actions"

type CustomerItem = {
  id: string
  email: string
  name: string
  username: string | null
  phoneNumber: string | null
  emailVerifiedAt: string | null
  createdAt: string
  savedBuildCount: number
  /** Peran dinamis yang tertaut (null = pelanggan biasa). */
  roleId: string | null
  /** Nama peran untuk ditampilkan (null = pelanggan biasa). */
  roleName: string | null
}

/** Peran dinamis yang bisa diberikan (dibuat di tab Peran). */
type RoleOption = { id: string; name: string }

type Props = {
  customers: CustomerItem[]
  /**
   * Kemampuan menghapus datang dari server (role akun yang sedang masuk), bukan
   * dari tebakan di klien. Kalaupun nilainya dipalsukan lewat devtools, server
   * action tetap memanggil `requireOwner()` sendiri — yang ini cuma mengatur
   * apa yang pantas ditampilkan.
   */
  canDelete: boolean
  /** Peran yang bisa diberikan lewat klik-kanan. */
  roleOptions: RoleOption[]
  /** Boleh mengubah peran pelanggan (owner-only). Klik-kanan hanya aktif bila true. */
  canManageRole: boolean
  /** Kolom yang sedang dipakai mengurutkan, dari URL. */
  sort?: CustomerSortField
  /** Arah urutan yang sedang berlaku, dari URL. */
  dir?: SortDirection
}

/** Menu klik-kanan: posisi + sasaran pelanggan. */
type CtxMenu = { x: number; y: number; userId: string; currentRoleId: string | null } | null

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function CustomerList({ customers, canDelete, roleOptions, canManageRole, sort, dir }: Props) {
  const router = useRouter()

  /**
   * Urutan yang BENAR-BENAR berlaku, bukan sekadar yang tertulis di URL.
   *
   * Tanpa parameter apa pun, `listCustomers` mengurutkan pendaftar terbaru di
   * atas — jadi "Terdaftar, menurun" memang sedang aktif. Kalau header tetap
   * digambar netral dalam keadaan itu, tabelnya terlihat tidak terurut sama
   * sekali, dan tekanan pertama pada "Terdaftar" akan terasa tidak mengubah apa
   * pun (karena memang tidak) — seolah tombolnya rusak.
   */
  const urutAktif: CustomerSortField = sort ?? "createdAt"
  const arahAktif: SortDirection = dir ?? (sort === undefined ? "desc" : "asc")
  const [target, setTarget] = useState<CustomerItem | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Menu klik-kanan untuk memberi peran (owner-only).
  const [ctx, setCtx] = useState<CtxMenu>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

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

  function pilihPeran(userId: string, roleId: string) {
    setCtx(null)
    setError(null)
    startTransition(async () => {
      const res = await setCustomerRoleAction({ userId, roleId })
      if (!res.ok) {
        setError(res.error)
        return
      }
      // Action-nya sudah `revalidatePath`; cukup ambil ulang pohon RSC-nya.
      // Muat ulang penuh akan membuang tab, kata pencarian, dan posisi gulir.
      router.refresh()
    })
  }

  if (customers.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Tidak ada akun pelanggan yang cocok.
      </p>
    )
  }

  return (
    <>
      {/*
        Keterangan hasil penghapusan. Sengaja TIDAK hilang sendiri setelah
        beberapa detik dan harus ditutup manual: staff biasanya beralih ke
        WhatsApp untuk membalas CS begitu tombolnya ditekan, dan pesan yang
        menguap sebelum ia kembali membuat seluruh gunanya hilang.
      */}
      {notice && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-success/30 bg-success/10 p-4 text-sm">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
          <p className="flex-1 text-foreground">{notice}</p>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-background hover:text-foreground"
            aria-label="Tutup keterangan"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/*
        Kartu sampai <lg, tabel baru di >=lg. Bukan tabel yang digulir ke
        samping: baris pelanggan punya enam medan, dan membaca satu baris utuh
        sambil menggulir horizontal justru berbahaya persis saat staff sedang
        memastikan tidak salah orang.

        Batasnya `lg` (1024px), BUKAN `md` (768px). Sempat `md`, dan di 768px
        tabelnya terpotong: sidebar panel memakan ~256px, jadi isi halaman cuma
        kebagian ~500px — kolom "Terdaftar" terpenggal dan kolom "Aksi" (tombol
        Hapus) hilang sama sekali di luar layar. Ketahuan dari screenshot 768px,
        bukan dari membaca kelas Tailwind-nya.
      */}
      <ul className="space-y-3 lg:hidden">
        {customers.map((c) => (
          <li key={c.id} className="rounded-2xl border border-border bg-background p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold break-words">{c.name}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-sm break-all text-muted-foreground">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  {c.email}
                </p>
                {c.roleName && (
                  <RoleTag roleId={c.roleId} className="mt-1.5">
                    {c.roleName}
                  </RoleTag>
                )}
              </div>
              {!c.emailVerifiedAt && (
                <span className="shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
                  Belum verifikasi
                </span>
              )}
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>
                <dt className="sr-only">Username</dt>
                <dd>{c.username ? `@${c.username}` : "—"}</dd>
              </div>
              <div>
                <dt className="sr-only">Nomor HP</dt>
                <dd className="flex items-center gap-1">
                  <Phone className="h-3 w-3 shrink-0" />
                  {c.phoneNumber ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="sr-only">Rakitan tersimpan</dt>
                <dd className="flex items-center gap-1">
                  <Cpu className="h-3 w-3 shrink-0" />
                  {c.savedBuildCount} rakitan
                </dd>
              </div>
              <div>
                <dt className="sr-only">Terdaftar</dt>
                <dd>Sejak {formatDate(c.createdAt)}</dd>
              </div>
            </dl>

            {canDelete && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4 w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setTarget(c)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Hapus akun
              </Button>
            )}
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-2xl border border-border bg-background lg:block">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-left">
            <tr>
              <HeaderUrut kolom="name" label="Nama" sort={urutAktif} dir={arahAktif} />
              <HeaderUrut kolom="email" label="Email" sort={urutAktif} dir={arahAktif} />
              <HeaderUrut kolom="role" label="Peran" sort={urutAktif} dir={arahAktif} />
              <th className="px-4 py-3 font-semibold">Nomor HP</th>
              {/*
                "Rakitan" tidak bisa diurutkan, dan itu keputusan sadar — bukan
                yang terlupa. Angkanya dihitung di aplikasi untuk satu halaman
                saja (lihat `listCustomers`), jadi mengurutkannya cuma akan
                menyusun ulang 25 baris yang kebetulan terbuka sambil TERLIHAT
                seperti menyusun seluruh pelanggan. Header yang diam lebih jujur
                daripada urutan yang salah.
              */}
              <th className="px-4 py-3 text-center font-semibold">Rakitan</th>
              <HeaderUrut kolom="createdAt" label="Terdaftar" sort={urutAktif} dir={arahAktif} />
              {canDelete && <th className="px-4 py-3 text-right font-semibold">Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr
                key={c.id}
                onContextMenu={
                  canManageRole
                    ? (e) => {
                        e.preventDefault()
                        setCtx({ x: e.clientX, y: e.clientY, userId: c.id, currentRoleId: c.roleId })
                      }
                    : undefined
                }
                className="border-b border-border last:border-0"
              >
                <td className="px-4 py-3">
                  <span className="font-medium">{c.name}</span>
                  {c.username && (
                    <span className="block text-xs text-muted-foreground">@{c.username}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="break-all">{c.email}</span>
                  {!c.emailVerifiedAt && (
                    <span className="mt-0.5 block text-xs text-warning">Belum verifikasi</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {c.roleName ? (
                    <RoleTag roleId={c.roleId}>{c.roleName}</RoleTag>
                  ) : (
                    <span className="text-xs text-muted-foreground">Pelanggan</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{c.phoneNumber ?? "—"}</td>
                <td className="px-4 py-3 text-center tabular-nums">{c.savedBuildCount}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(c.createdAt)}</td>
                {canDelete && (
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setTarget(c)}
                    >
                      <Trash2 className="mr-1.5 h-4 w-4" />
                      Hapus
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!canDelete && (
        <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          Penghapusan akun pelanggan hanya bisa dilakukan akun <strong>owner</strong>.
        </p>
      )}

      {target && (
        <DeleteCustomerDialog
          customer={target}
          open={target !== null}
          onOpenChange={(open) => !open && setTarget(null)}
          onDeleted={(message) => setNotice(message)}
        />
      )}

      {error && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive shadow-lg">
          {error}
        </div>
      )}

      {/* Menu klik-kanan: beri/ubah peran pelanggan (owner-only). Klik peran =
          langsung terapkan. Peran aktif ber-centang. */}
      {ctx && (
        <div
          role="menu"
          onClick={(e) => e.stopPropagation()}
          style={{ top: ctx.y, left: ctx.x }}
          className="fixed z-50 min-w-56 overflow-hidden rounded-lg border border-border bg-background py-1 shadow-lg"
        >
          <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">Beri peran</div>
          <button
            type="button"
            role="menuitem"
            disabled={pending}
            onClick={() => pilihPeran(ctx.userId, "")}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-50"
          >
            <span className="w-4">{ctx.currentRoleId === null && <Check className="h-4 w-4 text-primary" />}</span>
            Pelanggan (biasa)
          </button>
          {roleOptions.map((r) => (
            <button
              key={r.id}
              type="button"
              role="menuitem"
              disabled={pending}
              onClick={() => pilihPeran(ctx.userId, r.id)}
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
        </div>
      )}
    </>
  )
}

/**
 * Header tabel yang bisa ditekan untuk mengurutkan.
 *
 * Pengurutannya dikerjakan SERVER lewat parameter URL, bukan di klien. Menyusun
 * ulang di klien hanya menyentuh 25 baris yang sedang terbuka, sehingga
 * "urutkan nama A→Z" akan menampilkan nama yang diawali huruf S di baris
 * pertama hanya karena kebetulan itu isi halaman ini. Lewat URL, urutannya juga
 * ikut saat alamatnya ditempel ke rekan.
 *
 * Menekan kolom yang sedang aktif membalik arahnya; kolom lain selalu mulai
 * dari `asc`. `page` dibuang setiap kali, karena "halaman 7" dari urutan lama
 * tidak menunjuk apa pun setelah urutannya berganti.
 */
function HeaderUrut({
  kolom,
  label,
  sort,
  dir,
}: {
  kolom: CustomerSortField
  label: string
  sort?: CustomerSortField
  dir: SortDirection
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const aktif = sort === kolom
  const arahBerikut: SortDirection = aktif && dir === "asc" ? "desc" : "asc"

  const sp = new URLSearchParams(searchParams.toString())
  sp.set("sort", kolom)
  sp.set("dir", arahBerikut)
  sp.delete("page")

  const Ikon = !aktif ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown

  return (
    <th
      scope="col"
      aria-sort={aktif ? (dir === "asc" ? "ascending" : "descending") : "none"}
      className="px-4 py-3 font-semibold"
    >
      <Link
        href={`${pathname}?${sp.toString()}`}
        scroll={false}
        className={`inline-flex items-center gap-1.5 rounded transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          aktif ? "text-primary" : ""
        }`}
      >
        {label}
        <Ikon className={`h-3.5 w-3.5 ${aktif ? "" : "opacity-40"}`} aria-hidden="true" />
        <span className="sr-only">
          {aktif
            ? `— sedang diurutkan ${dir === "asc" ? "menaik" : "menurun"}, tekan untuk membalik`
            : "— tekan untuk mengurutkan"}
        </span>
      </Link>
    </th>
  )
}
