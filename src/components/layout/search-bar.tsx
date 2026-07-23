"use client"

import { useId, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
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
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()
  const listboxId = useId()

  const { results, status } = useLiveSearch(query)
  const isOpen = isFocused && query.trim().length >= MIN_QUERY_LENGTH

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
    setHighlightedIndex(-1)
  }

  const handleFocus = () => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current)
    setIsFocused(true)
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

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("relative w-full max-w-sm hidden sm:flex", className)}
    >
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
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
        placeholder="Cari laptop, komponen PC, gaming gear..."
        className="w-full bg-muted shadow-none appearance-none pl-8 md:w-2/3 lg:w-full rounded-full border-none focus-visible:ring-1"
      />
      {isOpen && (
        <SearchResultsDropdown
          id={listboxId}
          status={status}
          results={results}
          query={query}
          highlightedIndex={highlightedIndex}
          onHoverIndex={setHighlightedIndex}
          onSelect={closeDropdown}
          getOptionId={getOptionId}
        />
      )}
    </form>
  )
}
