/**
 * Kompresi gambar di sisi browser sebelum diunggah ke R2.
 *
 * "Visually lossless": ukuran maksimum dibatasi dan hasilnya dikodekan ulang ke
 * WebP kualitas tinggi. Foto dari kamera/HP biasanya 3-8 MB dengan sisi 4000px —
 * padahal galeri produk tidak pernah menampilkannya lebih besar dari ~1600px.
 * Mengecilkannya di sini memangkas 70-90% ukuran tanpa perbedaan yang terlihat,
 * dan yang dihemat bukan cuma penyimpanan R2 tapi juga waktu muat halaman
 * produk bagi pembeli.
 *
 * Berjalan di browser (butuh `document`/`Image`), jadi hanya boleh dipanggil
 * dari Client Component.
 */

const MAX_DIMENSION = 1600
const WEBP_QUALITY = 0.9

export type CompressedImage = {
  file: File
  /** Object URL untuk pratinjau. Wajib di-revoke saat tidak dipakai lagi. */
  previewUrl: string
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("Gambar tidak bisa dibaca"))
    image.src = src
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Kompresi gambar gagal"))),
      type,
      quality
    )
  })
}

function withExtension(fileName: string, extension: string): string {
  return `${fileName.replace(/\.[^.]+$/, "")}.${extension}`
}

export async function compressImage(file: File): Promise<CompressedImage> {
  // GIF bisa beranimasi, dan menggambarnya ke canvas cuma menyisakan frame
  // pertama — diam-diam merusak gambarnya. Lewatkan apa adanya.
  if (file.type === "image/gif") {
    return { file, previewUrl: URL.createObjectURL(file) }
  }

  const sourceUrl = URL.createObjectURL(file)

  try {
    const image = await loadImage(sourceUrl)

    const scale = Math.min(1, MAX_DIMENSION / Math.max(image.width, image.height))
    const width = Math.round(image.width * scale)
    const height = Math.round(image.height * scale)

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext("2d")
    if (!context) throw new Error("Canvas tidak tersedia di browser ini")
    context.drawImage(image, 0, 0, width, height)

    const blob = await canvasToBlob(canvas, "image/webp", WEBP_QUALITY)

    // Kalau hasil "kompresi" justru lebih besar (sering terjadi pada gambar
    // kecil yang sudah teroptimasi), pakai berkas aslinya. Mengunggah versi
    // yang lebih besar demi konsistensi format bukan pertukaran yang masuk akal.
    if (blob.size >= file.size && scale === 1) {
      return { file, previewUrl: sourceUrl }
    }

    const compressed = new File([blob], withExtension(file.name, "webp"), {
      type: "image/webp",
      lastModified: Date.now(),
    })

    URL.revokeObjectURL(sourceUrl)
    return { file: compressed, previewUrl: URL.createObjectURL(compressed) }
  } catch {
    // Kompresi gagal bukan alasan untuk menggagalkan unggahan — kirim aslinya.
    return { file, previewUrl: sourceUrl }
  }
}
