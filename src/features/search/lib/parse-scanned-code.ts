import { isTrustedHnsHostname } from "@/lib/utils/trusted-host"

/**
 * Hasil pembacaan satu kode (QR maupun barcode) menjadi maksud yang bisa
 * ditindaklanjuti.
 *
 * Bentuknya union bertanda supaya pemanggil WAJIB menangani setiap
 * kemungkinan — termasuk yang tidak menyenangkan seperti `foreign-url`.
 * Kalau fungsi ini hanya mengembalikan `string | null`, kode asing dan kode
 * yang tidak terbaca jadi tidak bisa dibedakan, dan keduanya butuh pesan yang
 * berbeda di layar.
 */
export type ScannedCode =
  | { kind: "product-id"; id: number }
  | { kind: "product-slug"; slug: string }
  | { kind: "sku"; sku: string }
  | { kind: "foreign-url"; hostname: string }
  | { kind: "unknown" }

/** Sama dengan `sku String? @db.VarChar(100)` di schema.prisma. */
const MAX_SKU_LENGTH = 100

function tryParseUrl(text: string): URL | null {
  try {
    return new URL(text)
  } catch {
    return null
  }
}

/**
 * Membaca teks hasil pindaian sebagai URL http/https, kalau memang URL.
 *
 * Mengembalikan `"skema-lain"` untuk teks yang sah sebagai URL tapi bukan
 * http/https — `new URL()` dengan senang hati menerima `mailto:`, `tel:`,
 * `javascript:`, bahkan `data:`. Bedanya dengan `null` penting: teks semacam
 * itu TIDAK boleh dianggap SKU. Tidak ada SKU yang berbentuk `javascript:...`,
 * dan membiarkannya lolos ke cabang SKU berarti teks pilihan penempel stiker
 * ikut terbawa ke halaman pencarian sebagai query.
 */
function toHttpUrl(text: string): URL | "skema-lain" | null {
  const direct = tryParseUrl(text)
  if (direct) {
    return direct.protocol === "http:" || direct.protocol === "https:"
      ? direct
      : "skema-lain"
  }

  // Sebagian pencetak QR lama menuliskan alamat tanpa skema
  // ("hnsitcenter.id/p/34394"). Teks seperti itu gagal di `new URL()`, dan
  // tanpa penanganan ini akan disangka SKU.
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+\//i.test(text)) {
    return tryParseUrl(`https://${text}`)
  }

  return null
}

function safeDecode(segment: string): string | null {
  try {
    const decoded = decodeURIComponent(segment).trim()
    return decoded.length > 0 ? decoded : null
  } catch {
    // Persen-encoding cacat (mis. "%zz") — biarkan gagal, jangan tebak.
    return null
  }
}

/**
 * Menerjemahkan teks mentah dari kamera menjadi maksud navigasi.
 *
 * **Kode dari domain asing WAJIB ditolak.** Hasil pindaian adalah teks yang
 * ditentukan siapa pun yang bisa menempelkan stiker di area display. Kalau
 * URL-nya ditelan mentah, siapa pun bisa membuat situs HNS melempar
 * pelanggannya ke alamat pilihan mereka — kamera berubah jadi open redirect
 * yang tidak kelihatan sebagai open redirect.
 *
 * Lapis pertahanannya ada dua, dan yang kedua justru yang menentukan:
 *
 *  1. host-nya harus lolos daftar izin, DAN
 *  2. yang diambil dari URL hanyalah *identitas produk* (id atau slug) — tidak
 *     pernah URL-nya sendiri. Pemanggil menyusun ulang path relatif dari
 *     identitas itu, jadi bahkan seandainya daftar izin suatu hari bocor,
 *     tujuan navigasinya tetap tidak bisa keluar dari origin yang sedang
 *     dibuka. Jangan "sederhanakan" ini menjadi meneruskan `url.href`.
 *
 * `currentHostname` diikutkan supaya lingkungan pratinjau/staging (mis. domain
 * Vercel) tetap bekerja tanpa harus menambah entri ke daftar izin permanen.
 */
export function parseScannedCode(raw: string, currentHostname?: string): ScannedCode {
  const text = raw.trim()
  if (!text) return { kind: "unknown" }

  const url = toHttpUrl(text)

  if (url === "skema-lain") return { kind: "unknown" }

  if (url) {
    const isTrusted =
      isTrustedHnsHostname(url.hostname) ||
      (currentHostname !== undefined && url.hostname === currentHostname)

    if (!isTrusted) return { kind: "foreign-url", hostname: url.hostname }

    // Tautan pendek QR produk: `/p/34394` (lihat src/app/p/[id]/route.ts).
    const shortLink = url.pathname.match(/^\/p\/(\d+)\/?$/)
    if (shortLink) {
      const id = Number(shortLink[1])
      if (Number.isSafeInteger(id) && id > 0) return { kind: "product-id", id }
    }

    // URL kanonik halaman produk: `/product/<slug>`.
    const productLink = url.pathname.match(/^\/product\/([^/]+)\/?$/)
    if (productLink) {
      const slug = safeDecode(productLink[1])
      if (slug) return { kind: "product-slug", slug }
    }

    // Domain kita, tapi bukan halaman produk (mis. QR verifikasi quotation).
    return { kind: "unknown" }
  }

  // Bukan URL — perlakukan sebagai SKU. Spasi dan karakter kontrol ditolak
  // karena tidak ada SKU yang memuatnya, dan teks bebas hasil salah pindai
  // sebaiknya berhenti di sini daripada jadi query pencarian yang membingungkan.
  if (text.length <= MAX_SKU_LENGTH && !/[\s\u0000-\u001f\u007f]/.test(text)) {
    return { kind: "sku", sku: text }
  }

  return { kind: "unknown" }
}
