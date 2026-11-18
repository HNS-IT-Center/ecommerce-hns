import "server-only"

import {
  imageFileExtension,
  isAllowedImageHost,
} from "@/lib/utils/media-download"
import { slugify } from "@/lib/utils/slug"

/**
 * Pengambilan berkas gambar dari host media untuk disalurkan ke pembeli
 * (tombol unduh & salin di galeri produk).
 *
 * Seluruh pemeriksaan keamanannya ada di sini, bukan di route handler, supaya
 * satu tempat saja yang harus dibaca saat menilainya:
 *
 * 1. Host wajib lolos daftar izin — tanpa itu endpoint ini jadi open proxy:
 *    siapa pun bisa menyuruh server kita menembak alamat mana pun, termasuk
 *    alamat internal yang tidak terjangkau dari luar (SSRF).
 * 2. Jawaban yang bukan `image/*` ditolak, jadi endpoint ini tidak bisa dipakai
 *    menyalurkan HTML atau berkas lain dari host yang diizinkan.
 * 3. Ukurannya dibatasi, dan permintaannya punya batas waktu.
 */

const MAX_BYTES = 25 * 1024 * 1024
const TIMEOUT_MS = 15_000

export class MediaFetchError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = "MediaFetchError"
  }
}

export type RemoteImage = {
  body: ReadableStream<Uint8Array>
  contentType: string
  /** Nama berkas lengkap dengan ekstensi, mis. `asus-rog-strix-g16.jpg`. */
  fileName: string
  contentLength: string | null
}

export async function fetchRemoteImage(
  rawSrc: string,
  rawName: string | null,
): Promise<RemoteImage> {
  let parsed: URL
  try {
    parsed = new URL(rawSrc)
  } catch {
    throw new MediaFetchError("Alamat gambar tidak valid", 400)
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new MediaFetchError("Alamat gambar tidak valid", 400)
  }

  if (!isAllowedImageHost(parsed.hostname)) {
    throw new MediaFetchError("Host gambar tidak diizinkan", 403)
  }

  const image = await fetchImageFromUrl(parsed)

  return {
    ...image,
    fileName: buildFileName(rawName, parsed.pathname, image.contentType),
  }
}

/**
 * Ambil satu gambar dari alamat yang SUDAH diputuskan boleh diambil, lalu
 * periksa jawabannya (harus `image/*`, ukuran dibatasi, tanpa redirect).
 *
 * Pemeriksaan host TIDAK ada di sini — itu tugas pemanggil, karena sumber
 * kepercayaannya berbeda: `fetchRemoteImage` menerima alamat dari klien
 * (wajib daftar izin), sedangkan unduhan dokumentasi rakitan memakai alamat
 * dari jawaban Ticketing yang sudah diautentikasi token (docs/17 §21), dan
 * klien hanya mengirim nomor foto.
 */
export async function fetchImageFromUrl(
  parsed: URL,
): Promise<Omit<RemoteImage, "fileName">> {
  let upstream: Response
  try {
    upstream = await fetch(parsed.toString(), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // Redirect ke host lain akan melewati pemeriksaan host pemanggil, jadi
      // ia tidak diikuti sama sekali.
      redirect: "manual",
      /*
       * Sengaja TIDAK memakai `next: { revalidate }`. Data cache Next menolak
       * isi di atas 2MB — dan foto produk beresolusi penuh sering melewatinya,
       * jadi yang didapat cuma peringatan di log. Lebih buruk lagi, untuk bisa
       * menyimpannya Next harus menampung seluruh berkas di memori lebih dulu,
       * sehingga alirannya ke pembeli tidak lagi mengalir. Cache-nya ditangani
       * header `Cache-Control` di jawaban kita (peramban + CDN).
       */
      cache: "no-store",
    })
  } catch {
    throw new MediaFetchError("Gambar gagal diambil dari server media", 502)
  }

  if (!upstream.ok || !upstream.body) {
    throw new MediaFetchError("Gambar tidak ditemukan di server media", 404)
  }

  const contentType = upstream.headers.get("content-type")
  if (!contentType?.toLowerCase().startsWith("image/")) {
    throw new MediaFetchError("Alamat itu bukan gambar", 415)
  }

  const contentLength = upstream.headers.get("content-length")
  if (contentLength && Number(contentLength) > MAX_BYTES) {
    throw new MediaFetchError("Ukuran gambar melebihi batas", 413)
  }

  return { body: upstream.body, contentType, contentLength }
}

/** Baca seluruh isi gambar ke memori, dengan batas yang sama (`MAX_BYTES`). */
export async function readImageBytes(body: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_BYTES) {
      await reader.cancel()
      throw new MediaFetchError("Ukuran gambar melebihi batas", 413)
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

/**
 * Nama yang dikirim klien di-slug ulang di sini. Nilai itu masuk ke header
 * `Content-Disposition`, dan nama yang memuat kutip atau baris baru bisa
 * menyisipkan header lain — slug hanya menyisakan huruf, angka, dan `-`.
 */
function buildFileName(
  rawName: string | null,
  pathname: string,
  contentType: string,
): string {
  const fromClient = rawName ? shorten(slugify(rawName)) : ""
  const fromPath = shorten(
    slugify(decodeURIComponent(pathname.split("/").pop() ?? "").replace(/\.[a-z0-9]+$/i, "")),
  )

  const base = fromClient || fromPath || "gambar-produk"
  return `${base}.${imageFileExtension(contentType, pathname)}`
}

/**
 * Nama produk di katalog ini bisa sepanjang satu kalimat penuh ("ASUS VIVOBOOK
 * 14 A1407QA VIPSP151M ... + OHM 2024 + M365"), dan sebagian sistem berkas
 * menolak nama di atas 255 karakter. Dipangkas di 80, lalu `-` di ujungnya
 * dibuang supaya tidak jadi `...-512gb-.webp`.
 */
function shorten(slug: string): string {
  return slug.slice(0, 80).replace(/-+$/, "")
}
