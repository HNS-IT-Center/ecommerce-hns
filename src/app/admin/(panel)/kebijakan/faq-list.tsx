"use client"

import { useState } from "react"
import Link from "next/link"
import { Pencil, TriangleAlert } from "lucide-react"
import { deleteFaqItem } from "./actions"

/**
 * Daftar FAQ dengan konfirmasi hapus. Pola dan alasannya sama seperti
 * `toko/store-list.tsx` — panel inline, mengikuti modul Kategori.
 */
type FaqRow = {
  id: string
  question: string
  answer: string
}

export function FaqList({ items }: { items: FaqRow[] }) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Belum ada FAQ.</p>
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const isConfirming = confirmingId === item.id

        return (
          <div key={item.id} className="rounded-xl border border-border bg-background p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="font-semibold">{item.question}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.answer}</p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/admin/kebijakan/faq/${item.id}`}
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label={`Edit FAQ: ${item.question}`}
                >
                  <Pencil className="h-4 w-4" />
                </Link>

                <button
                  type="button"
                  onClick={() => setConfirmingId(isConfirming ? null : item.id)}
                  aria-expanded={isConfirming}
                  aria-controls={`konfirmasi-hapus-faq-${item.id}`}
                  className="rounded-lg px-3 py-1.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
                >
                  Hapus
                </button>
              </div>
            </div>

            {isConfirming && (
              <div
                id={`konfirmasi-hapus-faq-${item.id}`}
                className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5"
              >
                {/*
                  Pertanyaannya diulang di sini, bukan sekadar "Anda yakin?".
                  Daftar FAQ bisa panjang dan barisnya mirip satu sama lain;
                  konfirmasi yang tidak menyebut isinya tidak membantu siapa pun
                  memastikan ia menekan baris yang benar.
                */}
                <p className="flex items-start gap-2 text-xs text-destructive">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Hapus FAQ <strong className="font-bold">&ldquo;{item.question}&rdquo;</strong>? Ia
                  akan hilang dari halaman /faq. Datanya tetap tersimpan dan bisa dipulihkan lewat
                  database.
                </p>

                <form action={deleteFaqItem} className="mt-2 flex flex-wrap gap-2">
                  <input type="hidden" name="id" value={item.id} />
                  <button
                    type="submit"
                    className="rounded-lg bg-destructive px-3 py-1 text-xs font-bold text-white transition-opacity hover:opacity-90"
                  >
                    Ya, hapus
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingId(null)}
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
