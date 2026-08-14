"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

interface LiveSearchProps {
  /** Route tujuan saat kata kunci berubah. Default `/shop`. */
  basePath?: string
  /** Nama query param kata kunci — `search` di `/shop`, `q` di `/search`. */
  paramName?: string
}

export function LiveSearch({ basePath = "/shop", paramName = "search" }: LiveSearchProps = {}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialSearch = searchParams.get(paramName) || ""
  const [searchTerm, setSearchTerm] = useState(initialSearch)
  const isMounted = useRef(false)

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true
      return
    }

    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (searchTerm) {
        params.set(paramName, searchTerm)
      } else {
        params.delete(paramName)
      }
      params.delete("page")
      router.push(`${basePath}?${params.toString()}`, { scroll: false })
    }, 500)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]) // Only trigger on searchTerm change

  // Sync state if URL changes externally
  useEffect(() => {
    const currentSearch = searchParams.get(paramName) || ""
    if (currentSearch !== searchTerm) {
      setSearchTerm(currentSearch)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  return (
    <div className="relative w-full md:max-w-sm">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        placeholder="Cari produk..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="pl-9 bg-background"
      />
    </div>
  )
}
