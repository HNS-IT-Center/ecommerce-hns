"use client"

import { useEffect, useState } from "react"

import type { AttributeRequirementGroup } from "@/lib/pc-builder/compatibility"
import type { PrebuildPickerProduct, PrebuildSortMode } from "@/lib/pc-prebuild/products"

import { searchPrebuildProductsAction } from "../actions"
import type { AttributeFilterValue } from "./attribute-filter-dialog"

/**
 * Pencarian produk untuk satu langkah — kata kunci, urutan, filter atribut,
 * dan paginasinya.
 *
 * Dipakai DUA tempat: grid utama penyusun komponen, dan grid di dalam dialog
 * pilihan tukar. Keduanya mencari di kategori dan di bawah syarat
 * kompatibilitas yang sama persis; kalau logikanya disalin, cepat atau lambat
 * salah satunya akan menyaring berbeda dan staff menemukan produk yang "ada di
 * satu layar tapi tidak ada di layar lain".
 *
 * `enabled` ada untuk pemakai di dalam dialog: hook-nya ikut hidup selama
 * dialognya ter-mount (dan ia memang harus tetap ter-mount, lihat
 * `builder-quick-view-dialog.tsx`), tapi tidak boleh menembak server untuk
 * dialog yang belum pernah dibuka.
 */
export type ProductSearch = ReturnType<typeof useProductSearch>

export function useProductSearch({
  categoryIds,
  requiredAttributeValueGroups,
  onLearn,
  limit = 24,
  enabled = true,
}: {
  categoryIds: number[]
  requiredAttributeValueGroups: AttributeRequirementGroup[]
  onLearn: (products: PrebuildPickerProduct[]) => void
  limit?: number
  enabled?: boolean
}) {
  const [query, setQuery] = useState("")
  const [kataKunci, setKataKunci] = useState("")
  const [sort, setSort] = useState<PrebuildSortMode>("default")
  const [filter, setFilter] = useState<AttributeFilterValue>({})

  const [hasil, setHasil] = useState<PrebuildPickerProduct[]>([])
  const [halaman, setHalaman] = useState(1)
  const [adaLagi, setAdaLagi] = useState(false)
  const [memuat, setMemuat] = useState(true)
  const [memuatLagi, setMemuatLagi] = useState(false)

  /**
   * Dibandingkan sebagai STRING, bukan sebagai array.
   *
   * Array-nya dibuat ulang tiap render di pemanggil walau isinya sama, dan
   * memasukkannya langsung ke daftar ketergantungan efek membuat pencarian
   * berjalan tanpa henti. `|` memisahkan kelompok supaya dua susunan berbeda
   * tidak menghasilkan kunci yang sama.
   */
  const syaratKunci = requiredAttributeValueGroups.map((g) => g.join(",")).join("|")
  const kategoriKunci = categoryIds.join(",")
  const filterKunci = Object.entries(filter)
    .map(([attrId, ids]) => `${attrId}:${[...ids].sort((a, b) => a - b).join(",")}`)
    .sort()
    .join("|")

  const jumlahFilter = Object.values(filter).reduce((n, ids) => n + ids.length, 0)

  useEffect(() => {
    const timer = setTimeout(() => setKataKunci(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  /**
   * Kata kunci, urutan, dan filter mengubah SELURUH daftar, jadi halamannya
   * kembali ke satu. Tanpa ini "Muat lebih banyak" di halaman 3 akan menyambung
   * hasil pencarian baru ke ekor hasil pencarian lama.
   *
   * Disetel saat RENDER, bukan lewat `useEffect`: efek yang memanggil
   * `setState` di badannya membuat panel tergambar sekali dengan nomor halaman
   * lama — satu permintaan ke server untuk halaman 3 yang hasilnya langsung
   * dibuang, setiap kali staff mengetik satu huruf.
   */
  const kunciDaftar = `${kategoriKunci}::${kataKunci}::${sort}::${filterKunci}::${syaratKunci}`
  const [kunciSebelumnya, setKunciSebelumnya] = useState(kunciDaftar)
  if (kunciDaftar !== kunciSebelumnya) {
    setKunciSebelumnya(kunciDaftar)
    setHalaman(1)
  }

  useEffect(() => {
    if (!enabled) return

    let batal = false

    const timer = setTimeout(async () => {
      // Penanda muat dinyalakan SETELAH jeda ketik, bukan sebelumnya: kalau
      // dinyalakan lebih dulu, tiap huruf yang diketik mengosongkan grid jadi
      // spinner selama 300 ms walau daftarnya belum tentu berubah.
      if (batal) return
      if (halaman === 1) setMemuat(true)
      else setMemuatLagi(true)

      try {
        const { products, hasMore } = await searchPrebuildProductsAction({
          categoryIds: kategoriKunci ? kategoriKunci.split(",").map(Number) : [],
          requiredAttributeValueGroups: syaratKunci
            ? syaratKunci.split("|").map((g) => g.split(",").map(Number))
            : [],
          attributeValueGroups: filterKunci
            ? filterKunci.split("|").map((g) => g.split(":")[1].split(",").map(Number))
            : [],
          searchQuery: kataKunci,
          sort,
          limit,
          page: halaman,
        })
        if (batal) return
        setHasil((lama) => (halaman === 1 ? products : [...lama, ...products]))
        setAdaLagi(hasMore)
        onLearn(products)
      } finally {
        if (!batal) {
          setMemuat(false)
          setMemuatLagi(false)
        }
      }
    }, halaman === 1 ? 300 : 0)

    return () => {
      batal = true
      clearTimeout(timer)
    }
    // `onLearn` sengaja tidak masuk daftar — ia dibuat ulang tiap render di
    // pemanggil, dan memasukkannya berarti pencarian berjalan tanpa henti.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, kategoriKunci, syaratKunci, filterKunci, kataKunci, sort, halaman, limit])

  return {
    query,
    setQuery,
    sort,
    setSort,
    filter,
    setFilter,
    jumlahFilter,
    hasil,
    memuat,
    memuatLagi,
    adaLagi,
    muatLagi: () => setHalaman((h) => h + 1),
  }
}
