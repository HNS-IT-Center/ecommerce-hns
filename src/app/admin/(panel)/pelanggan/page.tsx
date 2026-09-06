import type { Metadata } from "next"
import Link from "next/link"
import { Search } from "lucide-react"

import { requirePageView } from "@/lib/auth"
import { isDatabaseConfigured } from "@/lib/prisma/client"
import { listCustomers } from "@/lib/api/customers"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

import { CustomerList } from "./customer-list"

export const metadata: Metadata = {
  title: "Akun Pelanggan — Admin HNS IT Center",
  robots: { index: false, follow: false },
}

export default async function AdminPelangganPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  // Halaman ini butuh tahu ROLE-nya, bukan sekadar bahwa seseorang sudah masuk:
  // tombol hapus cuma pantas tampil untuk owner. Penegakan sesungguhnya tetap
  // di server action (`requireOwner`), yang ini soal apa yang ditampilkan.
  // `requirePageView` juga menolak yang tak boleh melihat halaman pelanggan.
  const { user } = await requirePageView("pelanggan")

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

  const { rows, total, pageCount } = await listCustomers({ query, page })

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
          canDelete={user.role === "owner"}
          roleOptions={[]}
          canManageRole={false}
          customers={rows.map((c) => ({
            ...c,
            // Date tidak bisa menyeberang ke Client Component apa adanya —
            // diubah ke ISO di sini, diformat ulang ke bahasa Indonesia di sana.
            emailVerifiedAt: c.emailVerifiedAt?.toISOString() ?? null,
            createdAt: c.createdAt.toISOString(),
            roleId: null,
            roleName: null,
          }))}
        />
      </div>

      {pageCount > 1 && (
        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Halaman {page} dari {pageCount}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={
                  <Link
                    href={`/admin/pelanggan?${new URLSearchParams({ ...(query && { q: query }), page: String(page - 1) })}`}
                  />
                }
              >
                Sebelumnya
              </Button>
            )}
            {page < pageCount && (
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={
                  <Link
                    href={`/admin/pelanggan?${new URLSearchParams({ ...(query && { q: query }), page: String(page + 1) })}`}
                  />
                }
              >
                Berikutnya
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
