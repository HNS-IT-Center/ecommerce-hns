"use client"

import Link from "next/link"
import { useState } from "react"
import { BookmarkPlus, Check } from "lucide-react"

import { saveBuildAction } from "@/features/builder/actions-save"

/**
 * Sengaja dideklarasikan ulang, BUKAN diimpor dari `actions-save.ts`.
 *
 * Berkas itu bertanda `"use server"`, dan Turbopack memperlakukan setiap export
 * di dalamnya sebagai server action — termasuk `export type`. Build produksi
 * gagal karenanya, dan `tsc --noEmit` tidak menangkapnya. Pelajaran yang sama
 * sudah ditulis di `pc-builder/actions.ts`.
 */
type ItemSimpan = {
  productId: number
  quantity: number
  stepId: string
  stepName: string
}

/**
 * "Simpan rakitan ini" untuk paket PC Prebuild.
 *
 * Menyimpan lewat `saveBuildAction` yang SAMA dengan tombol simpan di wizard —
 * bukan jalur baru. Konsekuensinya penting: begitu tersimpan, paket ini masuk
 * ke mesin yang sudah ada di `/profile/rakitan/[id]`, yang membandingkan harga
 * acuan saat disimpan dengan harga katalog terkini dan memberi tahu pelanggan
 * **"Harga telah berubah sejak terakhir disimpan"** beserta rinciannya per
 * komponen.
 *
 * Itulah alasan tombol ini ada. Halaman paket sendiri tidak punya apa pun untuk
 * dibandingkan — harganya selalu dibaca segar, jadi tidak ada "harga lama" yang
 * bisa berubah. Perbandingan baru punya arti setelah pelanggan menyimpannya.
 *
 * Klien hanya mengirim id, kuantitas, dan label langkah. Harga acuannya diisi
 * server dari katalog (CLAUDE.md §2.7).
 */
export function PrebuildSaveButton({
  nama,
  items,
  kembaliKe,
}: {
  nama: string
  items: ItemSimpan[]
  /** Dipakai `?next=` kalau pelanggan belum masuk. */
  kembaliKe: string
}) {
  const [pending, setPending] = useState(false)
  const [tersimpanId, setTersimpanId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function simpan() {
    setError(null)
    setPending(true)
    try {
      const hasil = await saveBuildAction(nama, items)
      if (hasil.ok) setTersimpanId(hasil.id)
      else setError(hasil.error)
    } catch {
      setError("Gagal menyimpan rakitan. Coba lagi.")
    } finally {
      setPending(false)
    }
  }

  if (tersimpanId) {
    return (
      <Link
        href={`/profile/rakitan/${tersimpanId}`}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-brand-green bg-brand-green/10 px-6 py-3 text-sm font-bold text-brand-green"
      >
        <Check className="h-4 w-4" />
        Tersimpan — lihat rakitanmu
      </Link>
    )
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={simpan}
        disabled={pending || items.length === 0}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-input px-6 py-3 text-sm font-bold transition-colors hover:bg-muted disabled:opacity-60"
      >
        <BookmarkPlus className="h-4 w-4" />
        {pending ? "Menyimpan…" : "Simpan rakitan ini"}
      </button>

      {error && (
        <p className="text-xs text-muted-foreground">
          {error}{" "}
          <Link
            href={`/login?next=${encodeURIComponent(kembaliKe)}`}
            className="font-semibold text-brand-green underline"
          >
            Masuk
          </Link>
        </p>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Setelah disimpan, kamu diberi tahu kalau ada komponennya yang berubah harga.
      </p>
    </div>
  )
}
