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

  useEffect(() => {
    setIsMobile(window.innerWidth < 768)
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (isMobileSearchOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobileSearchOpen])

  const { results, status } = useLiveSearch(query)
  const isOpen = (isFocused || isMobileSearchOpen) && query.trim().length >= MIN_QUERY_LENGTH

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

  const closeDropdown = () => {
    setIsFocused(false)
    setIsMobileSearchOpen(false)
    setHighlightedIndex(-1)
    if (inputRef.current) inputRef.current.blur()
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

  const goToSearchResults = () => {
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isOpen && highlightedIndex >= 0 && results[highlightedIndex]) {
      router.push(`/product/${results[highlightedIndex].slug}`)
      closeDropdown()
      return
    }
    goToSearchResults()
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
    <div className={cn("relative w-full max-w-sm", className)}>
      {isMobileSearchOpen ? (
        createPortal(
          <div className="fixed inset-0 z-[100] bg-background overflow-y-auto h-[100dvh]">
            {renderForm()}
          </div>,
          document.body
        )
      ) : (
        renderForm()
      )}
    </div>
  )
}
