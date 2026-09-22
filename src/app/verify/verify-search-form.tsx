"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Loader2, Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { cn, formatRupiah } from "@/lib/utils"
import type { QuoteSummary } from "@/lib/api/pc-build-quotes"
import { QUOTE_CODE_PATTERN, formatQuoteDateTime } from "./format"

const MIN_CHARS = 2
const DEBOUNCE_MS = 250
const LISTBOX_ID = "verify-quote-suggestions"

/**
 * Jawaban server TERAKHIR, beserta ketikan yang ditanyakan. "Sedang memuat"
 * tidak disimpan sebagai state — ia diturunkan: kalau jawaban yang ada bukan
 * untuk ketikan saat ini, berarti jawaban yang benar belum datang.
 */
type SearchResponse =
  | { term: string; results: QuoteSummary[] }
  | { term: string; error: string }

/** Tebalkan bagian kode yang cocok dengan ketikan, supaya kasir langsung melihat kenapa baris itu muncul. */
function HighlightedCode({ code, term }: { code: string; term: string }) {
  const index = term ? code.indexOf(term) : -1
  if (index < 0) return <>{code}</>
  return (
    <>
      {code.slice(0, index)}
      <mark className="rounded-sm bg-primary/15 px-0.5 text-foreground">
        {code.slice(index, index + term.length)}
      </mark>
      {code.slice(index + term.length)}
    </>
  )
}

/**
 * Pencarian quotation dengan saran. Kasir cukup mengetik sebagian kode — mis.
 * `VVGT` atau `260804` — lalu memilih dari dropdown.
 *
 * Hasilnya TIDAK dirender di sini: memilih saran mengarahkan ke
 * `/verify/[code]`, supaya rincian quotation punya URL sendiri (bisa dibuka
 * ulang, dibagikan ke sesama staff, dan dituju langsung dari tautan di PDF).
 *
 * Tidak memakai `components/ui/combobox.tsx`: opsi di sana hanya berupa label
 * teks, sedangkan baris di sini perlu kode, total, dan tanggal sekaligus —
 * dan memilih di sini berarti navigasi, bukan mengisi nilai input.
 *
 * Saran diambil dari server (bukan menyaring 15 kartu di halaman), supaya
 * quotation lama yang sudah tidak ada di grid tetap bisa ditemukan.
 */
export function VerifySearchForm() {
  const router = useRouter()
  const [query, setQuery] = React.useState("")
  const [response, setResponse] = React.useState<SearchResponse | null>(null)
  const [open, setOpen] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(-1)
  const [navigatingTo, setNavigatingTo] = React.useState<string | null>(null)

  const term = query.replace(/[^A-Z0-9-]/g, "")
  const searchable = term.length >= MIN_CHARS
  const current = response?.term === term ? response : null
  const results = current && "results" in current ? current.results : []
  const errorMessage = current && "error" in current ? current.error : null
  const isLoading = searchable && !current

  React.useEffect(() => {
    if (term.length < MIN_CHARS) return

    // Permintaan lama dibatalkan saat kasir terus mengetik — tanpa ini, jawaban
    // untuk "VV" yang datang terlambat bisa menimpa jawaban untuk "VVGT".
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/pc-build-quotes/search?q=${encodeURIComponent(term)}`,
          { signal: controller.signal }
        )
        const data: unknown = await res.json()
        if (!res.ok) {
          const message =
            typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
              ? data.error
              : "Gagal mencari quotation."
          setResponse({ term, error: message })
          return
        }
        const list =
          typeof data === "object" && data !== null && "results" in data && Array.isArray(data.results)
            ? (data.results as QuoteSummary[])
            : []
        setResponse({ term, results: list })
        setActiveIndex(list.length > 0 ? 0 : -1)
      } catch (error) {
        if (controller.signal.aborted) return
        console.error("[verify] pencarian gagal:", error)
        setResponse({ term, error: "Gagal mencari quotation. Periksa koneksi Anda." })
      }
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [term])

  const goTo = (code: string) => {
    setOpen(false)
    setNavigatingTo(code)
    router.push(`/verify/${code}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setOpen(true)
      if (results.length > 0) setActiveIndex((i) => (i + 1) % results.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      if (results.length > 0) setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1))
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const active = open ? results[activeIndex] : undefined
    if (active) {
      goTo(active.code)
      return
    }
    // Kode lengkap boleh langsung dituju tanpa menunggu saran — mis. kasir
    // yang menempel kode dari chat WhatsApp lalu langsung menekan Enter.
    if (QUOTE_CODE_PATTERN.test(term)) {
      goTo(term)
      return
    }
    setOpen(true)
  }

  const showDropdown = open && searchable
  const activeId = showDropdown && results[activeIndex] ? `${LISTBOX_ID}-${activeIndex}` : undefined

  return (
    <form onSubmit={handleSubmit} className="relative max-w-2xl">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value.toUpperCase())
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
          placeholder="Ketik kode, mis. VVGT atau 260804"
          className="h-12 bg-background pl-9 pr-10 font-mono text-base uppercase md:text-base"
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={LISTBOX_ID}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-label="Kode quotation"
        />
        {(isLoading || navigatingTo) && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {showDropdown && (
        <div
          // `preventDefault` di mousedown menjaga fokus tetap di input, jadi
          // `onBlur` tidak menutup dropdown sebelum klik pada saran terjadi.
          onMouseDown={(e) => e.preventDefault()}
          className="absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-xl border border-border bg-popover shadow-lg"
        >
          {errorMessage ? (
            <div className="flex items-start gap-2 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {errorMessage}
            </div>
          ) : isLoading ? (
            <p className="p-3 text-sm text-muted-foreground">Mencari…</p>
          ) : results.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">
              Tidak ada kode yang mengandung{" "}
              <span className="font-mono font-semibold text-foreground">{term}</span>. Huruf O dan
              angka 0 mudah tertukar.
            </p>
          ) : (
            <ul id={LISTBOX_ID} role="listbox" className="max-h-80 overflow-y-auto py-1">
              {results.map((quote, index) => (
                <li
                  key={quote.code}
                  id={`${LISTBOX_ID}-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => goTo(quote.code)}
                  className={cn(
                    "flex cursor-pointer flex-col gap-0.5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4",
                    index === activeIndex && "bg-muted"
                  )}
                >
                  <span className="flex min-w-0 items-center gap-1.5 font-mono text-sm font-bold">
                    <HighlightedCode code={quote.code} term={term} />
                    {quote.status === "closing" && (
                      <span className="shrink-0 rounded-full bg-brand-green/15 px-1.5 py-0.5 font-sans text-[10px] font-bold text-brand-green">
                        TERJUAL
                      </span>
                    )}
                    {quote.customerName && (
                      <span className="truncate font-sans text-xs font-normal text-muted-foreground">
                        {quote.customerName}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-3 text-xs">
                    <span className="font-bold tabular-nums text-sale-red">
                      {formatRupiah(quote.total)}
                    </span>
                    <span className="text-muted-foreground">{formatQuoteDateTime(quote.updatedAt)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  )
}
