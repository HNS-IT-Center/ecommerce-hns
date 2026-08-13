"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

export function LiveSearch() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialSearch = searchParams.get("search") || ""
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
        params.set("search", searchTerm)
      } else {
        params.delete("search")
      }
      params.delete("page")
      router.push(`/shop?${params.toString()}`, { scroll: false })
    }, 500)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]) // Only trigger on searchTerm change

  /**
   * Menyelaraskan isi kotak saat URL berubah dari LUAR — tombol Back, klik
   * kategori di sidebar, atau tautan yang membawa `?search=`.
   *
   * Pola "sesuaikan state saat render", BUKAN `useEffect` + `setState`. Versi
   * efek melanggar `react-hooks/set-state-in-effect` dan punya cacat yang
   * terlihat: kotaknya masih menampilkan kata lama untuk satu render penuh
   * setelah URL berganti, baru kemudian dikoreksi. Menekan Back sempat
   * memperlihatkan kata pencarian yang salah.
   *
   * `urlSearch` dibandingkan dengan penanda terakhir yang kita catat, bukan
   * dengan `searchTerm` itu sendiri. Kalau dibandingkan dengan `searchTerm`,
   * setiap ketikan pengguna akan langsung ditimpa kembali oleh nilai URL yang
   * belum sempat diperbarui debounce — kotaknya jadi tidak bisa diketik.
   */
  const urlSearch = searchParams.get("search") || ""
  const [lastUrlSearch, setLastUrlSearch] = useState(urlSearch)
  if (urlSearch !== lastUrlSearch) {
    setLastUrlSearch(urlSearch)
    setSearchTerm(urlSearch)
  }

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
