"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface SearchBarProps {
  className?: string
}

export function SearchBar({ className }: SearchBarProps = {}) {
  const [query, setQuery] = useState("")
  const router = useRouter()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/shop?q=${encodeURIComponent(query.trim())}`)
    }
  }

  return (
    <form onSubmit={handleSearch} className={cn("relative w-full max-w-sm hidden sm:flex", className)}>
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cari laptop, komponen PC, gaming gear..."
        className="w-full bg-muted shadow-none appearance-none pl-8 md:w-2/3 lg:w-full rounded-full border-none focus-visible:ring-1"
      />
    </form>
  )
}
