"use client"

import { useEffect, useState } from "react"
import { searchProducts } from "@/features/search/services/search-service"
import type { Product } from "@/components/ui/product-card"

const MIN_QUERY_LENGTH = 2
const DEBOUNCE_MS = 300

// Reference stabil — mencegah array [] baru di tiap render (bisa memicu
// infinite loop kalau dipakai sebagai dependency perbandingan referensi).
const EMPTY_RESULTS: Product[] = []

export type LiveSearchStatus = "idle" | "loading" | "success" | "error"

type CompletedSearch = {
  query: string
  results: Product[]
  hasError: boolean
}

export function useLiveSearch(query: string) {
  const [completed, setCompleted] = useState<CompletedSearch | null>(null)

  const trimmedQuery = query.trim()
  const isQueryTooShort = trimmedQuery.length < MIN_QUERY_LENGTH

  useEffect(() => {
    if (isQueryTooShort) return

    let isStale = false

    const timer = setTimeout(() => {
      searchProducts(trimmedQuery)
        .then((products) => {
          if (isStale) return
          setCompleted({ query: trimmedQuery, results: products, hasError: false })
        })
        .catch(() => {
          if (isStale) return
          setCompleted({ query: trimmedQuery, results: [], hasError: true })
        })
    }, DEBOUNCE_MS)

    return () => {
      isStale = true
      clearTimeout(timer)
    }
  }, [trimmedQuery, isQueryTooShort])

  if (isQueryTooShort) {
    return { results: EMPTY_RESULTS, status: "idle" as LiveSearchStatus }
  }

  // "loading" adalah nilai turunan: query saat ini belum punya hasil yang
  // cocok tersimpan di `completed` — bukan setState di badan effect.
  if (!completed || completed.query !== trimmedQuery) {
    return { results: EMPTY_RESULTS, status: "loading" as LiveSearchStatus }
  }

  if (completed.hasError) {
    return { results: EMPTY_RESULTS, status: "error" as LiveSearchStatus }
  }

  return { results: completed.results, status: "success" as LiveSearchStatus }
}
