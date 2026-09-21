"use client"

import { useState } from "react"
import Link from "next/link"
import { Lock, Pencil, TriangleAlert } from "lucide-react"
import { deletePolicyPage } from "./actions"

/**
 * Daftar halaman kebijakan dengan konfirmasi hapus. Pola dan alasannya sama
 * seperti `faq-list.tsx` di sebelahnya — panel inline, mengikuti modul Kategori.
 */
type PolicyRow = {
  slug: string
  title: string
  description: string
  isSystem: boolean
}

export function PolicyList({ items }: { items: PolicyRow[] }) {
  const [confirmingSlug, setConfirmingSlug] = useState<string | null>(null)

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Belum ada halaman kebijakan.</p>
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const isConfirming = confirmingSlug === item.slug

        return (
          <div key={item.slug} className="rounded-xl border border-border bg-background p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="font-bold">{item.title}</h2>
                <p className="text-xs text-muted-foreground">/kebijakan/{item.slug}</p>
                {item.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {item.description}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                <Link
                  href={`/admin/kebijakan/${item.slug}`}
                  className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Pencil className="h-4 w-4" />
                  <span className="hidden sm:inline">Edit</span>
                </Link>

                {/*
                  Kebijakan bawaan tidak punya tombol Hapus sama sekali — bukan
                  tombol mati yang menolak saat ditekan. Alamatnya ditaut dari
                  kode (footer, halaman produk, dan dari dalam isi kebijakan
                  lain), jadi menghapusnya membuat tautan-tautan itu 404 tanpa
                  ada yang memberi tahu. Penjaga yang sebenarnya ada di lapisan
                  data; ikon ini hanya menjelaskan kenapa pilihannya tidak ada.
                */}
                {item.isSystem ? (
                  <span
                    title="Kebijakan bawaan — bisa disunting, tidak bisa dihapus"
                    className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground"
                  >
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="hidden sm:inline">Bawaan</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingSlug(isConfirming ? null : item.slug)}
                    aria-expanded={isConfirming}
                    aria-controls={`konfirmasi-hapus-kebijakan-${item.slug}`}
                    className="rounded-lg px-3 py-1.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
                  >
                    Hapus
                  </button>
                )}
              </div>
            </div>

            {isConfirming && (
              <div
                id={`konfirmasi-hapus-kebijakan-${item.slug}`}
                className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5"
              >
                <p className="flex items-start gap-2 text-xs text-destructive">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Hapus <strong className="font-bold">&ldquo;{item.title}&rdquo;</strong>? Alamat{" "}
                    <code>/kebijakan/{item.slug}</code> akan menjadi 404 bagi siapa pun yang sudah
                    menyimpan tautannya. Datanya tetap tersimpan dan halaman ini bisa dibuat ulang
                    dengan slug yang sama.
                  </span>
                </p>

                <form action={deletePolicyPage} className="mt-2 flex flex-wrap gap-2">
                  <input type="hidden" name="slug" value={item.slug} />
                  <button
                    type="submit"
                    className="rounded-lg bg-destructive px-3 py-1 text-xs font-bold text-white transition-opacity hover:opacity-90"
                  >
                    Ya, hapus
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingSlug(null)}
                    className="rounded-lg px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
                  >
                    Batal
                  </button>
                </form>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
