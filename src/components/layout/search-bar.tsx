"use client"

import { useId, useRef, useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { Search, ArrowLeft } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useLiveSearch } from "@/features/search/hooks/use-live-search"
import { SearchResultsDropdown } from "@/features/search/components/search-results-dropdown"

const MIN_QUERY_LENGTH = 2

interface SearchBarProps {
  className?: string
}

export function SearchBar({ className }: SearchBarProps = {}) {
  const [query, setQuery] = useState("")
  const [isFocused, setIsFocused] = useState(false)
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [isMobile, setIsMobile] = useState(false)
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const listboxId = useId()

  /**
   * Menandai bahwa overlay menaruh satu entry history miliknya sendiri, supaya
   * tombol Back menutup overlay alih-alih meninggalkan halaman.
   *
   * Ref, bukan state: nilainya dibaca di dalam listener `popstate` dan di
   * `closeDropdown`, dan keduanya tidak boleh memicu render ulang.
   */
  const historyEntryRef = useRef(false)

  useEffect(() => {
    setIsMobile(window.innerWidth < 768)
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const isOpen = (isFocused || isMobileSearchOpen) && query.trim().length >= MIN_QUERY_LENGTH

  useEffect(() => {
    if (isMobileSearchOpen || isOpen) {
      document.body.style.overflow = 'hidden'
      document.documentElement.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }

    if (isMobileSearchOpen) {
      // Delay focus slightly to ensure portal is rendered and transition has started
      setTimeout(() => inputRef.current?.focus(), 50)
    } else if (isMobile && inputRef.current) {
      inputRef.current.blur()
    }

    return () => {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
  }, [isMobileSearchOpen, isOpen, isMobile])

  /**
   * Tombol Back menutup overlay, bukan meninggalkan halaman.
   *
   * Saat overlay dibuka, satu entry history disisipkan. Tekan Back akan
   * mem-pop entry itu — `popstate` menutup overlay dan halaman di baliknya
   * tetap utuh. Tanpa ini pembeli yang menekan Back saat sedang mengetik
   * langsung terlempar ke halaman sebelumnya, dan pencariannya hilang.
   *
   * Overlay hanya menutup diri di sini; entry-nya sudah lepas oleh pop itu
   * sendiri, jadi `historyEntryRef` dinolkan tanpa memanggil `history.back()`
   * lagi (itulah alasan `closeDropdown` tidak dipakai di listener ini).
   */
  useEffect(() => {
    if (!isMobileSearchOpen) return

    window.history.pushState({ hnsSearchOverlay: true }, "")
    historyEntryRef.current = true

    const handlePopState = () => {
      historyEntryRef.current = false
      setIsFocused(false)
      setIsMobileSearchOpen(false)
      setHighlightedIndex(-1)
      inputRef.current?.blur()
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [isMobileSearchOpen])

  const { results, status } = useLiveSearch(query)

  // Reset highlight saat query berubah — adjust state selama render (bukan
  // useEffect) supaya tidak menambah instance baru bug setState-in-effect.
  // Dikunci ke `query` (primitif stabil), BUKAN `results` (array baru
  // setiap render saat idle/loading/error — pernah menyebabkan infinite
  // re-render loop sebelum diperbaiki).
  const [prevQuery, setPrevQuery] = useState(query)
  if (query !== prevQuery) {
    setPrevQuery(query)
    setHighlightedIndex(-1)
  }

  const getOptionId = (index: number) => `${listboxId}-option-${index}`

  /**
   * Menutup overlay dari dalam aplikasi: tombol kembali di overlay, Escape,
   * klik backdrop, klik hasil, maupun submit pencarian.
   *
   * Kalau overlay sempat menaruh entry history sendiri, entry itu dilepas
   * lewat `history.back()` — tanpa ini pembeli yang menutup overlay secara
   * manual meninggalkan satu entry yatim, dan tekan Back berikutnya hanya
   * "memakan" entry itu tanpa berpindah halaman.
   *
   * Pelepasan itu terjadi di sini, SEBELUM pemanggil sempat berpindah halaman.
   * Urutan tersebut kritis: `history.back()` yang menyusul sebuah `router.push`
   * (atau push dari `<Link>`) akan membatalkannya — pembeli sekilas melihat
   * halaman tujuan lalu terlempar kembali ke halaman asalnya. Semua pemanggil
   * yang ikut bernavigasi memanggil fungsi ini lebih dulu, baru push.
   *
   * Penandanya dimatikan sebelum `history.back()` supaya listener `popstate`
   * yang ikut terpanggil tahu pop ini sudah ditangani dan tidak menutup ulang.
   */
  const closeDropdown = () => {
    setIsFocused(false)
    setIsMobileSearchOpen(false)
    setHighlightedIndex(-1)
    inputRef.current?.blur()

    if (historyEntryRef.current) {
      historyEntryRef.current = false
      window.history.back()
    }
  }

  const handleFocus = () => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current)
    setIsFocused(true)
    if (isMobile) setIsMobileSearchOpen(true)
  }

  const handleBlur = () => {
    // Delay agar klik pada hasil dropdown sempat terdaftar sebelum ditutup
    blurTimeoutRef.current = setTimeout(() => setIsFocused(false), 150)
  }

  /**
   * Menekan Enter SELALU menutup overlay.
   *
   * Sebelumnya overlay hanya tertutup sebagai efek samping: berpindah halaman
   * mem-remount komponen ini. Begitu pembeli sudah berada di `/search`,
   * mencari lagi cuma mengganti query param — tidak ada remount, dan overlay
   * menggantung menutupi hasil yang baru saja diminta.
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const highlighted =
      isOpen && highlightedIndex >= 0 ? results[highlightedIndex] : undefined
    const target = highlighted
      ? `/product/${highlighted.slug}`
      : query.trim()
        ? `/search?q=${encodeURIComponent(query.trim())}`
        : null

    if (!target) return

    // Tutup dulu, baru berpindah — lihat `closeDropdown` soal urutannya.
    closeDropdown()
    router.push(target)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || status !== "success" || results.length === 0) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightedIndex((prev) => Math.min(prev + 1, results.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightedIndex((prev) => Math.max(prev - 1, -1))
    } else if (e.key === "Escape") {
      closeDropdown()
    }
  }

  const renderForm = () => (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "w-full transition-all duration-200",
        isMobileSearchOpen
          ? "flex flex-col bg-background p-4 min-h-[100dvh]"
          : "relative"
      )}
    >
      <div className="relative flex items-center gap-2">
        {isMobileSearchOpen && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              closeDropdown()
            }}
            className="p-2 -ml-2 text-muted-foreground hover:text-foreground shrink-0"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
        )}
        <div className="relative flex-1">
          <Search className={cn(
            "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4",
            isMobileSearchOpen ? "text-muted-foreground/60" : "text-muted-foreground"
          )} />
          <Input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-expanded={isOpen}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={highlightedIndex >= 0 ? getOptionId(highlightedIndex) : undefined}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="Cari laptop, komponen PC..."
            className={cn(
              "w-full shadow-sm appearance-none pl-9 focus-visible:ring-1 focus-visible:ring-primary transition-all duration-200",
              "bg-background border border-border rounded-lg text-sm",
              isMobileSearchOpen ? "h-11 text-base" : "h-10"
            )}
          />
        </div>
      </div>
      
      {(isOpen || isMobileSearchOpen) && (
        <div className={cn(
          isMobileSearchOpen ? "flex-1 mt-4 relative" : "relative"
        )}>
          {query.trim().length >= MIN_QUERY_LENGTH ? (
            <SearchResultsDropdown
              id={listboxId}
              status={status}
              results={results}
              query={query}
              highlightedIndex={highlightedIndex}
              onHoverIndex={setHighlightedIndex}
              onSelect={closeDropdown}
              getOptionId={getOptionId}
              className={isMobileSearchOpen ? "static shadow-none border-none mt-0 max-h-none overflow-visible rounded-none" : undefined}
            />
          ) : (
            isMobileSearchOpen && (
              <div className="flex flex-col gap-3 pt-2">
                <p className="text-xs font-semibold text-muted-foreground">Pencarian Populer</p>
                <div className="flex flex-col">
                  {['Laptop Gaming', 'SSD 1TB', 'Mouse Wireless', 'Monitor 144Hz'].map((term, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setQuery(term)
                        inputRef.current?.focus()
                      }}
                      className="flex items-center gap-3 py-3 text-sm text-foreground hover:bg-muted/50 rounded-md px-2 -mx-2 transition-colors text-left"
                    >
                      <Search className="h-4 w-4 text-muted-foreground" />
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </form>
  )

  return (
    <>
      {isOpen && !isMobileSearchOpen && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed top-16 inset-x-0 bottom-0 z-40 bg-black/60 backdrop-blur-sm" 
          onClick={closeDropdown}
        />,
        document.body
      )}
      <div className={cn("relative w-full z-50", className)}>
        {isMobileSearchOpen ? (
          createPortal(
            <div className="fixed inset-0 z-[100] bg-background overflow-y-auto h-[100dvh] overscroll-none">
              {renderForm()}
            </div>,
            document.body
          )
        ) : (
          renderForm()
        )}
      </div>
    </>
  )
}
