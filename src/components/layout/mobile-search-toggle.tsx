"use client"

import { useState } from "react"
import { Search, X } from "lucide-react"

import { SearchBar } from "./search-bar"

export function MobileSearchToggle() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="md:hidden">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={isOpen ? "Tutup pencarian" : "Buka pencarian"}
        aria-expanded={isOpen}
        className="flex h-9 w-9 items-center justify-center rounded-md text-foreground hover:bg-muted"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
      </button>
      {isOpen && (
        <div className="absolute inset-x-0 top-16 z-40 border-b bg-background p-4 shadow-sm">
          <SearchBar className="flex w-full max-w-none" />
        </div>
      )}
    </div>
  )
}
