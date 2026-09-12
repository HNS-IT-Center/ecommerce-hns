type SearchParams = { [key: string]: string | string[] | undefined }

function countValues(value: string | string[] | undefined): number {
  if (Array.isArray(value)) return value.length
  return value ? 1 : 0
}

/**
 * Menghitung berapa penyaring yang sedang aktif, untuk badge pada gelembung
 * filter mobile.
 *
 * **Kata kunci sengaja TIDAK dihitung.** `clearFilters` di `ShopSidebar` juga
 * sengaja tidak membuangnya, dengan alasan yang sama: kata kunci adalah
 * konteks halaman yang sedang dilihat pembeli, bukan salah satu penyaring.
 * Menghitungnya di sini akan membuat `/search?q=ssd` menampilkan badge "1"
 * padahal pembeli belum menyentuh filter apa pun — dan angka itu tidak akan
 * pernah bisa dinolkan lewat "Hapus Filter".
 *
 * Rentang harga dihitung SATU meski `minPrice` dan `maxPrice` dua parameter:
 * di antarmuka keduanya satu blok "Harga", jadi mengisi dua-duanya bukan dua
 * penyaring.
 */
export function countActiveShopFilters(params: SearchParams): number {
  return (
    countValues(params.category) +
    countValues(params.brand) +
    (params.onSale === "true" ? 1 : 0) +
    (params.minPrice || params.maxPrice ? 1 : 0)
  )
}
