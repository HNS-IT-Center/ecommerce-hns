/**
 * Pemeriksaan berkas unggahan sebelum ia sampai ke Cloudflare R2.
 *
 * Kenapa berkas ini ada: `accept="image/*"` pada `<input type="file">` hanya
 * menyaring dialog pemilih berkas — ia bukan pengamanan. Permintaan yang dibuat
 * langsung (mis. `curl` dengan cookie admin) melewatinya begitu saja, dan
 * sebelum berkas ini ada `POST /api/admin/media` menerima apa pun lalu
 * meneruskan `file.type` kiriman klien apa adanya sebagai `ContentType` objek
 * R2. Artinya pengunggah ikut menentukan header yang dikirim R2 ke browser:
 * sebuah .html yang diunggah akan benar-benar dieksekusi browser saat dibuka
 * dari media.hnsitcenter.com — permanen, di domain yang melayani seluruh gambar
 * produk.
 *
 * Karena itu tipe berkas di sini ditentukan dari ISI berkas (magic bytes),
 * bukan dari nama atau `type` yang dikirim klien. Keduanya milik pengunggah,
 * jadi keduanya tidak bisa dipercaya.
 */

export type MediaKind = "image" | "video"

export type DetectedMedia = {
  /** MIME hasil pembacaan isi berkas. Nilai INI yang dipakai sebagai `ContentType` R2. */
  mime: string
  /** Ekstensi kanonik untuk nama objek — ekstensi kiriman klien diabaikan. */
  extension: string
  kind: MediaKind
}

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024

/**
 * Video dibatasi lebih ketat daripada gambar karena berkasnya melewati request
 * body serverless, yang di Vercel dibatasi sekitar 4,5 MB. Batas 4 MB membuat
 * berkas yang terlalu besar ditolak dengan pesan yang bisa dibaca staff, bukan
 * putus di tengah jalan tanpa keterangan. Video yang lebih besar dipasang lewat
 * tab "Link" di `video-uploader.tsx` (YouTube), bukan diunggah ke R2.
 */
export const MAX_VIDEO_BYTES = 4 * 1024 * 1024

/**
 * Gerbang pertama, diperiksa terhadap `file.size` SEBELUM isi berkas ditarik ke
 * memori. Nilainya batas terlonggar di antara keduanya; batas per jenis
 * ditegakkan lagi setelah jenis berkasnya diketahui.
 */
export const MAX_UPLOAD_BYTES = Math.max(MAX_IMAGE_BYTES, MAX_VIDEO_BYTES)

/**
 * Nilai atribut `accept` untuk `<input type="file">`. Sengaja diambil dari
 * berkas yang sama dengan penegakan di server, supaya daftar yang ditawarkan ke
 * staff dan daftar yang benar-benar diterima tidak pernah berbeda. Perlu
 * diingat atribut ini kenyamanan, bukan pengaman — `validateUpload` yang
 * menahan.
 */
export const IMAGE_ACCEPT_ATTRIBUTE = "image/jpeg,image/png,image/webp,image/avif,image/gif"
export const VIDEO_ACCEPT_ATTRIBUTE = "video/mp4,video/webm"

/**
 * Berkas ditolak karena isinya, bukan karena sistem gagal. `status` dibawa
 * bersama pesannya supaya route tidak perlu menebak kode HTTP-nya.
 */
export class UploadRejectedError extends Error {
  readonly status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = "UploadRejectedError"
    this.status = status
  }
}

function matchesSignature(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false
  return signature.every((byte, index) => bytes[offset + index] === byte)
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  const slice = bytes.subarray(offset, offset + length)
  let out = ""
  for (let i = 0; i < slice.length; i += 1) out += String.fromCharCode(slice[i])
  return out
}

/**
 * MP4 dan AVIF sama-sama wadah ISO-BMFF: keduanya punya "ftyp" di offset 4, dan
 * yang membedakannya hanya daftar brand di dalam kotak itu. Brand utama ada di
 * offset 8, sisanya ("compatible brands") berderet mulai offset 16 — perlu ikut
 * dibaca karena banyak AVIF menulis brand utama "mif1" dan menaruh "avif" di
 * daftar itu.
 */
function isoBrands(bytes: Uint8Array): string[] {
  if (ascii(bytes, 4, 4) !== "ftyp") return []

  const boxSize = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0
  const limit = Math.min(bytes.length, boxSize > 0 ? boxSize : bytes.length, 256)

  const brands = [ascii(bytes, 8, 4)]
  for (let offset = 16; offset + 4 <= limit; offset += 4) {
    brands.push(ascii(bytes, offset, 4))
  }
  return brands
}

const AVIF_BRANDS = ["avif", "avis"]
const MP4_BRANDS = ["isom", "iso2", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "mmp4", "dash", "M4V "]

function isWebm(bytes: Uint8Array): boolean {
  // Magic EBML. Matroska (.mkv) memakai magic yang sama, jadi magic saja tidak
  // cukup — pembedanya DocType, yang berada di awal header.
  if (!matchesSignature(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return false
  return ascii(bytes, 0, Math.min(bytes.length, 64)).indexOf("webm") !== -1
}

/**
 * SVG diperiksa terpisah supaya penolakannya bisa menjelaskan alasannya. Ia
 * satu-satunya "gambar" yang lolos saringan `image/*` di browser tapi bisa
 * memuat skrip yang ikut berjalan saat berkasnya dibuka langsung.
 */
function looksLikeSvg(bytes: Uint8Array): boolean {
  const head = ascii(bytes, 0, Math.min(bytes.length, 256)).toLowerCase()
  return head.indexOf("<svg") !== -1 || (head.indexOf("<?xml") !== -1 && head.indexOf("svg") !== -1)
}

function detectMediaType(bytes: Uint8Array): DetectedMedia | null {
  if (matchesSignature(bytes, [0xff, 0xd8, 0xff])) {
    return { mime: "image/jpeg", extension: ".jpg", kind: "image" }
  }
  if (matchesSignature(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mime: "image/png", extension: ".png", kind: "image" }
  }

  const gifHeader = ascii(bytes, 0, 6)
  if (gifHeader === "GIF87a" || gifHeader === "GIF89a") {
    return { mime: "image/gif", extension: ".gif", kind: "image" }
  }
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return { mime: "image/webp", extension: ".webp", kind: "image" }
  }

  const brands = isoBrands(bytes)
  if (brands.some((brand) => AVIF_BRANDS.indexOf(brand) !== -1)) {
    return { mime: "image/avif", extension: ".avif", kind: "image" }
  }
  if (brands.some((brand) => MP4_BRANDS.indexOf(brand) !== -1)) {
    return { mime: "video/mp4", extension: ".mp4", kind: "video" }
  }

  if (isWebm(bytes)) {
    return { mime: "video/webm", extension: ".webm", kind: "video" }
  }

  return null
}

function formatMegabytes(bytes: number): string {
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`
}

/**
 * Gerbang ukuran yang dijalankan terhadap `file.size`, sebelum `arrayBuffer()`
 * menarik seluruh isi berkas ke memori proses. Tanpa ini, unggahan 2 GB tetap
 * dibaca utuh lebih dulu baru kemudian ditolak.
 */
export function assertUploadSizeAllowed(size: number): void {
  if (size > MAX_UPLOAD_BYTES) {
    throw new UploadRejectedError(
      `Berkas terlalu besar (${formatMegabytes(size)}). Batas unggahan ${formatMegabytes(MAX_UPLOAD_BYTES)}.`,
      413,
    )
  }
}

/**
 * Menentukan jenis berkas dari isinya, atau menolaknya. Nilai baliknya adalah
 * satu-satunya sumber `ContentType` dan ekstensi objek R2.
 */
export function validateUpload(bytes: Uint8Array): DetectedMedia {
  if (bytes.length === 0) {
    throw new UploadRejectedError("Berkas kosong, tidak ada yang bisa diunggah.")
  }

  if (looksLikeSvg(bytes)) {
    throw new UploadRejectedError(
      "SVG tidak bisa diunggah karena formatnya boleh memuat skrip yang ikut berjalan di browser. Simpan gambarnya sebagai PNG atau WebP lalu unggah ulang.",
    )
  }

  const detected = detectMediaType(bytes)
  if (!detected) {
    throw new UploadRejectedError(
      "Jenis berkas ini tidak diterima. Yang bisa diunggah hanya gambar (JPG, PNG, WebP, AVIF, GIF) dan video (MP4, WebM).",
    )
  }

  const limit = detected.kind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
  if (bytes.length > limit) {
    const label = detected.kind === "video" ? "Video" : "Gambar"
    throw new UploadRejectedError(
      `${label} maksimal ${formatMegabytes(limit)}, sedangkan berkas ini ${formatMegabytes(bytes.length)}.`,
      413,
    )
  }

  return detected
}

/**
 * Menyusun nama objek dari nama kiriman klien.
 *
 * Titik dibuang seluruhnya dari bagian nama, lalu ekstensi hasil deteksi
 * dipasang sendiri — sehingga `foto.php.jpg` menjadi `fotophp.jpg` dan tidak ada
 * berkas di bucket yang punya ekstensi ganda. Nama yang habis tersaring (mis.
 * seluruhnya aksara non-Latin) jatuh ke "media" supaya key-nya tidak berakhir
 * dengan tanda hubung menggantung.
 */
export function buildSafeObjectName(originalName: string, extension: string): string {
  const withoutExtension = originalName.replace(/\.[^.]+$/, "")
  const base = withoutExtension.replace(/[^a-zA-Z0-9\-_]/g, "").toLowerCase().slice(0, 80)
  return `${base || "media"}${extension}`
}
