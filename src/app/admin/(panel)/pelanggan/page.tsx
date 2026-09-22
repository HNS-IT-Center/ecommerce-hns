import type { Metadata } from "next"
import { Search } from "lucide-react"

import { requirePageView } from "@/lib/auth"
import { bisaAkses } from "@/lib/auth/permissions"
import { isDatabaseConfigured } from "@/lib/prisma/client"
import {
  CUSTOMER_PAGE_SIZE,
  isCustomerSortField,
  isSortDirection,
  listCustomers,
} from "@/lib/api/customers"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { AdminPagination } from "@/components/admin/admin-pagination"

import { CustomerList } from "./customer-list"

export const metadata: Metadata = {
  title: "Akun Pelanggan — Admin",
  robots: { index: false, follow: false },
}

export default async function AdminPelangganPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; sort?: string; dir?: string }>
}) {
  // Tombol hapus hanya pantas tampil untuk yang izinnya `pelanggan: edit`.
  // Penegakan sesungguhnya tetap di server action (`requirePermission`); yang
  // ini soal apa yang ditampilkan. `requirePageView` sendiri sudah menolak yang
  // tak boleh melihat halaman pelanggan sama sekali.
  const { izin } = await requirePageView("pelanggan")

  if (!isDatabaseConfigured()) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-warning/30 bg-warning/10 p-6 text-sm text-warning">
        Database belum dikonfigurasi — isi <code>DATABASE_URL</code> di <code>.env.local</code> lalu
        jalankan <code>npx prisma migrate deploy</code>.
      </div>
    )
  }

  const params = await searchParams
  const query = params.q?.trim() ?? ""
  const page = Number(params.page ?? 1) || 1
  // Divalidasi karena datang dari URL — nilai karangan jatuh ke urutan bawaan.
  const sort = isCustomerSortField(params.sort) ? params.sort : undefined
  const dir = isSortDirection(params.dir) ? params.dir : undefined

  const { rows, total, pageCount } = await listCustomers({ query, page, sort, dir })

  return (
    <div className="mx-auto max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Akun Pelanggan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {total} akun terdaftar. Dipakai untuk mencocokkan permintaan yang masuk lewat CS —
          isi rakitan pelanggan tidak ditampilkan di sini, hanya jumlahnya.
        </p>
      </div>

      {/*
        Formulir GET biasa, bukan pencarian langsung ala ketik-sambil-cari.
        Tiap ketukan tombol berarti satu query ke database, dan halaman ini
        jarang dibuka — dipakai saat ada permintaan dari CS, bukan ditongkrongi.
      */}
      <form method="GET" className="mt-6 flex gap-2">
        {/* Urutan yang sedang dipilih ikut dibawa saat mencari — formulir GET
            menulis ulang seluruh query string. */}
        {sort && <input type="hidden" name="sort" value={sort} />}
        {dir && <input type="hidden" name="dir" value={dir} />}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Cari email, nama, atau username"
            className="pl-9"
            aria-label="Cari akun pelanggan"
          />
        </div>
        <Button type="submit" variant="secondary">
          Cari
        </Button>
      </form>

      <div className="mt-6">
        {/* Halaman /admin/pelanggan lama (tanpa menu sidebar sejak pindah ke
            tab Manajemen User). Pemberian peran lewat klik-kanan hidup di tab
            itu, bukan di sini — jadi roleOptions kosong & canManageRole false. */}
        <CustomerList
          canDelete={bisaAkses(izin, "pelanggan", "edit")}
          roleOptions={[]}
          canManageRole={false}
          sort={sort}
          dir={dir}
          customers={rows.map((c) => ({
            ...c,
            // Date tidak bisa menyeberang ke Client Component apa adanya —
            // diubah ke ISO di sini, diformat ulang ke bahasa Indonesia di sana.
            emailVerifiedAt: c.emailVerifiedAt?.toISOString() ?? null,
            createdAt: c.createdAt.toISOString(),
          }))}
        />
      </div>

      <AdminPagination
        page={page}
        pageCount={pageCount}
        total={total}
        pageSize={CUSTOMER_PAGE_SIZE}
        labelBaris="akun"
      />
    </div>
  )
}
