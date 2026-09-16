/**
 * Alamat untuk mengunduh/menyalin sebuah gambar produk.
 *
 * Gambar yang tampil di halaman dilayani `next/image` (`/_next/image?url=...`),
 * jadi yang tersimpan saat "Save image as" adalah hasil optimizer: format WebP
 * dengan nama berkas berisi seluruh query. Untuk tombol unduh kita mau berkas
 * ASLI dengan nama yang terbaca manusia, maka permintaannya dibelokkan ke
 * `/api/media/download` yang menyalurkan berkas dari host gambar apa adanya.
 *
 * Berkas ini sengaja TANPA dependensi server: dipakai dari dua sisi — komponen
 * klien (membangun URL tombol) dan route handler (memeriksa host yang diminta),
 * supaya daftar izinnya cuma satu dan tidak bisa berbeda antar sisi.
 */
import { slugify } from "./slug"
import { isTrustedHnsHostname } from "./trusted-host"

export const MEDIA_DOWNLOAD_ENDPOINT = "/api/media/download"

/**
 * Host di luar domain HNS yang tetap boleh disalurkan. Isinya menyusul
 * `remotePatterns` di `next.config.ts`: Unsplash dipakai data contoh saat
 * pengembangan, jadi tanpa entri ini tombolnya hilang di lingkungan lokal.
 * Thumbnail YouTube sengaja TIDAK masuk — itu poster video, bukan foto produk,
 * dan tombolnya memang tidak dilukis di slide video.
 */
const EXTRA_ALLOWED_HOSTNAMES = new Set(["images.unsplash.com"])

export function isAllowedImageHost(hostname: string): boolean {
  return isTrustedHnsHostname(hostname) || EXTRA_ALLOWED_HOSTNAMES.has(hostname)
}

/**
 * URL yang bisa dipakai tombol unduh (`<a download>`) maupun penyalinan ke
 * clipboard (`fetch`) — dua-duanya same-origin, jadi tidak bergantung pada
 * header CORS host gambar.
 *
 * `null` berarti sumbernya tidak boleh disalurkan (host di luar daftar, atau
 * bukan http/https sama sekali); pemanggil menyembunyikan tombolnya.
 *
 * @param baseName Nama produk, dipakai sebagai nama berkas. Di-slug di sini
 *   supaya yang dikirim ke server sudah aman, dan diperiksa ulang di sana.
 */
export function resolveImageFileUrl(
  src: string | null | undefined,
  baseName?: string | null,
): string | null {
  if (!src) return null

  // Berkas milik sendiri (mis. `/images/...`) sudah same-origin — peramban bisa
  // mengunduhnya langsung, tidak ada gunanya melewati proxy.
  if (src.startsWith("/")) return src

  let parsed: URL
  try {
    parsed = new URL(src)
  } catch {
    return null
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null
  if (!isAllowedImageHost(parsed.hostname)) return null

  const params = new URLSearchParams({ src: parsed.toString() })
  const name = baseName ? slugify(baseName) : ""
  if (name) params.set("name", name)

  return `${MEDIA_DOWNLOAD_ENDPOINT}?${params.toString()}`
}

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
  "image/svg+xml": "svg",
}

/**
 * Ekstensi untuk nama berkas unduhan. `Content-Type` dari host gambar yang
 * dipercaya lebih dulu — sebagian URL di katalog tidak berekstensi sama sekali,
 * dan sebagian lain berekstensi `.jpg` padahal isinya PNG.
 */
export function imageFileExtension(contentType: string | null, url: string): string {
  const normalized = contentType?.split(";")[0]?.trim().toLowerCase()
  if (normalized && EXTENSION_BY_CONTENT_TYPE[normalized]) {
    return EXTENSION_BY_CONTENT_TYPE[normalized]
  }

  const fromPath = url.split("?")[0].split("#")[0].split(".").pop()?.toLowerCase()
  if (fromPath && /^[a-z0-9]{2,5}$/.test(fromPath)) return fromPath

  return "jpg"
}
