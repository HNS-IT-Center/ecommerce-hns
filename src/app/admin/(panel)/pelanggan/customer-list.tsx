"use client"

import { useState } from "react"
import { CheckCircle2, Cpu, Mail, Phone, ShieldAlert, Trash2, X } from "lucide-react"

import { Button } from "@/components/ui/button"

import { DeleteCustomerDialog } from "./delete-customer-dialog"

type CustomerItem = {
  id: string
  email: string
  name: string
  username: string | null
  phoneNumber: string | null
  emailVerifiedAt: string | null
  createdAt: string
  savedBuildCount: number
}

type Props = {
  customers: CustomerItem[]
  /**
   * Kemampuan menghapus datang dari server (role akun yang sedang masuk), bukan
   * dari tebakan di klien. Kalaupun nilainya dipalsukan lewat devtools, server
   * action tetap memanggil `requireOwner()` sendiri — yang ini cuma mengatur
   * apa yang pantas ditampilkan.
   */
  canDelete: boolean
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function CustomerList({ customers, canDelete }: Props) {
  const [target, setTarget] = useState<CustomerItem | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

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
              <th className="px-4 py-3 font-semibold">Nama</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Nomor HP</th>
              <th className="px-4 py-3 text-center font-semibold">Rakitan</th>
              <th className="px-4 py-3 font-semibold">Terdaftar</th>
              {canDelete && <th className="px-4 py-3 text-right font-semibold">Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0">
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
    </>
  )
}
