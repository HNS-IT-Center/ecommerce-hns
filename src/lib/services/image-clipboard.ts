/**
 * Penyalinan gambar ke clipboard sistem, dipakai tombol "Salin" di galeri
 * produk. Berjalan di peramban — jangan diimpor dari kode server.
 */

/**
 * Clipboard gambar tidak ada di semua peramban (Firefox lama, sebagian besar
 * peramban dalam aplikasi, dan konteks non-HTTPS). Tombol salinnya disembunyikan
 * bila `false`, bukan ditampilkan lalu gagal saat ditekan.
 */
export function canCopyImageToClipboard(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof ClipboardItem !== "undefined" &&
    typeof navigator.clipboard?.write === "function"
  )
}

export async function copyImageToClipboard(url: string): Promise<void> {
  if (!canCopyImageToClipboard()) {
    throw new Error("Peramban ini tidak mendukung salin gambar")
  }

  /*
   * `ClipboardItem` sengaja dibangun dari PROMISE yang belum selesai, dan
   * pembangunannya terjadi sebelum `await` mana pun di fungsi ini.
   *
   * Safari hanya mengizinkan penulisan clipboard selama gestur pengguna yang
   * sama; kalau kita menunggu gambarnya selesai diunduh dulu, gesturnya sudah
   * kedaluwarsa dan penulisannya ditolak. Bentuk promise membuat izinnya
   * diambil sekarang, isinya menyusul.
   */
  const pngBlob = fetchAsPng(url)
  await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })])
}

/**
 * Clipboard gambar praktis hanya menerima PNG — WebP dan AVIF (format yang
 * justru paling banyak dipakai katalog) ditolak diam-diam oleh sebagian
 * peramban, jadi apa pun yang bukan PNG digambar ulang ke kanvas.
 */
async function fetchAsPng(url: string): Promise<Blob> {
  const response = await fetch(url, { credentials: "same-origin" })
  if (!response.ok) throw new Error("Gambar gagal diambil")

  const blob = await response.blob()
  if (blob.type === "image/png") return blob

  const bitmap = await createImageBitmap(blob)
  try {
    const canvas = document.createElement("canvas")
    canvas.width = bitmap.width
    canvas.height = bitmap.height

    const context = canvas.getContext("2d")
    if (!context) throw new Error("Kanvas tidak tersedia")
    context.drawImage(bitmap, 0, 0)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (converted) =>
          converted ? resolve(converted) : reject(new Error("Gambar gagal diubah")),
        "image/png",
      )
    })
  } finally {
    bitmap.close()
  }
}
