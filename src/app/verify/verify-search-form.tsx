"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2, Search, AlertTriangle } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

/** Sama dengan yang dipakai server saat memvalidasi kode. */
const QUOTE_CODE_PATTERN = /^HNSPC-\d{6}-[A-Z0-9]{4}$/

/**
 * Form pencarian quotation. Hasilnya TIDAK dirender di sini — begitu kodenya
 * valid, pengguna diarahkan ke `/verify/[code]`.
 *
 * Alasannya: hasil verifikasi perlu punya URL sendiri supaya bisa disalin,
 * dibagikan ke CS, di-bookmark, dan dibuka ulang lewat tombol Back. Kalau
 * hasilnya cuma state di halaman ini, URL-nya tidak pernah berubah dan semua
 * itu hilang. Halaman `/verify/[code]` juga sudah menangani perbandingan harga,
 * jadi merendernya di dua tempat berarti dua salinan logika yang sama.
 *
 * Format kode diperiksa di sini hanya supaya salah ketik langsung dapat umpan
 * balik tanpa perlu memuat halaman. Keberadaan kodenya tetap divalidasi server.
 */
export function VerifySearchForm() {
  const router = useRouter()
  const [code, setCode] = React.useState("")
  const [isPending, setIsPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = code.trim().toUpperCase()

    if (!trimmed) {
      setError("Masukkan kode quotation terlebih dahulu.")
      return
    }

    if (!QUOTE_CODE_PATTERN.test(trimmed)) {
      setError("Format kode tidak sesuai. Contoh yang benar: HNSPC-260804-VVGT")
      return
    }

    setError(null)
    // Dibiarkan menyala sampai navigasinya selesai — halaman tujuan yang akan
    // menggantikan tampilan ini.
    setIsPending(true)
    router.push(`/verify/${trimmed}`)
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">
          Cek Rincian Rakitan PC
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Masukkan kode quotation yang tertera pada dokumen untuk melihat rincian harga
          per komponen saat dokumen itu dicetak.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase())
              if (error) setError(null)
            }}
            placeholder="Masukkan kode yang berawalan HNSPC-..."
            className="h-11 pl-9 font-mono uppercase"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <Button
          type="submit"
          disabled={isPending}
          className="h-11 cursor-pointer px-6 font-bold sm:w-auto"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cek"}
        </Button>
      </form>

      {error && (
        <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  )
}
