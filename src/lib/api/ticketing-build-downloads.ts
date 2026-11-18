import "server-only"

import { createHash } from "node:crypto"

import { QUOTE_CODE_PATTERN } from "@/app/verify/format"
import { imageFileExtension } from "@/lib/utils/media-download"
import { slugify } from "@/lib/utils/slug"
import { createZipStream, type ZipEntry } from "@/lib/utils/zip-store"
import { MediaFetchError, fetchImageFromUrl, readImageBytes } from "./media-file"
import { getBuildDocumentation, groupBuildPhotos, type BuildDocumentation, type BuildPhoto } from "./ticketing-builds"

/**
 * Unduhan foto Dokumentasi Rakitan — per foto dan ZIP (docs/17 §21).
 *
 * Kenapa lewat server: foto tinggal di storage Ticketing (domain lain), dan
 * peramban mengabaikan `<a download>` untuk alamat lintas domain — tombolnya
 * hanya akan membuka foto di tab baru. Sama alasannya dengan
 * `/api/media/download` untuk foto produk.
 *
 * Klien TIDAK PERNAH mengirim URL foto, hanya nomor urut + sidik foto. Server
 * mengambil ulang jawaban Ticketing (terautentikasi token) dan memilih fotonya
 * sendiri, jadi endpoint ini tidak bisa disuruh mengambil alamat sembarangan.
 * Karena itu pula daftar izin host `media-file.ts` tidak dipakai di sini:
 * sumber kepercayaannya adalah jawaban Ticketing, bukan masukan klien.
 *
 * URL foto tidak pernah ditulis ke log (permintaan Ticketing, 17 Nov 2026).
 */

export type NumberedBuildPhoto = BuildPhoto & {
  /** Nomor urut 1.. sesuai urutan TAMPIL (per kelompok), bukan urutan mentah dari Ticketing. */
  number: number
  /**
   * Sidik pendek URL foto. Dikirim bersama nomor supaya kalau isi tiket
   * berubah di antara halaman dibuka dan tombol diklik (foto baru menggeser
   * nomor), server menolak — bukan diam-diam mengirim foto lain.
   */
  key: string
  /** `03-bukti-selesai` — tanpa ekstensi; ekstensinya dari `Content-Type` saat diunduh. */
  fileBase: string
}

export type NumberedPhotoGroup = { key: string; label: string; photos: NumberedBuildPhoto[] }

export type DownloadError = { kind: "error"; status: number; message: string }

export function photoKey(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 12)
}

/** Kode dari segmen URL → bentuk baku, atau `null` kalau bukan kode quotation. */
export function normalizeQuoteCodeParam(raw: string): string | null {
  let decoded: string
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    return null
  }
  const code = decoded.trim().toUpperCase()
  return QUOTE_CODE_PATTERN.test(code) ? code : null
}

/**
 * Kelompokkan + beri nomor. Dipakai halaman (tombol) dan route (pencarian
 * foto), jadi nomor di tombol dan nomor yang dicari server selalu dihitung
 * dengan cara yang sama.
 */
export function numberBuildPhotos(photos: BuildPhoto[]): NumberedPhotoGroup[] {
  const groups = groupBuildPhotos(photos)
  const width = Math.max(2, String(photos.length).length)
  let number = 0
  return groups.map((group) => {
    const slug = slugify(group.label).slice(0, 40).replace(/-+$/, "") || "foto"
    return {
      ...group,
      photos: group.photos.map((photo) => {
        number += 1
        return { ...photo, number, key: photoKey(photo.url), fileBase: `${String(number).padStart(width, "0")}-${slug}` }
      }),
    }
  })
}

async function loadNumberedPhotos(
  code: string,
): Promise<{ kind: "ok"; doc: BuildDocumentation; photos: NumberedBuildPhoto[] } | DownloadError> {
  const result = await getBuildDocumentation(code)
  if (result.kind === "no-ticket") {
    return { kind: "error", status: 404, message: "Belum ada tiket rakitan untuk quotation ini di Ticketing." }
  }
  if (result.kind === "invalid-code") {
    return { kind: "error", status: 400, message: "Ticketing tidak mengenali kode quotation ini." }
  }
  if (result.kind === "unavailable") {
    return { kind: "error", status: 502, message: "Dokumentasi tidak bisa dimuat dari Ticketing. Coba lagi sebentar." }
  }
  const photos = numberBuildPhotos(result.doc.photos).flatMap((group) => group.photos)
  return { kind: "ok", doc: result.doc, photos }
}

export type PhotoDownload = {
  kind: "ok"
  body: ReadableStream<Uint8Array>
  contentType: string
  contentLength: string | null
  fileName: string
}

export async function getBuildPhotoDownload(code: string, number: number, key: string): Promise<PhotoDownload | DownloadError> {
  const loaded = await loadNumberedPhotos(code)
  if (loaded.kind === "error") return loaded

  const photo = loaded.photos.find((p) => p.number === number)
  if (!photo) {
    return { kind: "error", status: 404, message: "Foto tidak ditemukan. Muat ulang halaman Dokumentasi Rakitan." }
  }
  if (photo.key !== key) {
    return {
      kind: "error",
      status: 409,
      message: "Foto di Ticketing sudah berubah sejak halaman dibuka. Muat ulang halaman lalu coba lagi.",
    }
  }

  try {
    const image = await fetchImageFromUrl(new URL(photo.url))
    return {
      kind: "ok",
      body: image.body,
      contentType: image.contentType,
      contentLength: image.contentLength,
      fileName: `${code}-${photo.fileBase}.${imageFileExtension(image.contentType, photo.url)}`,
    }
  } catch (error) {
    const status = error instanceof MediaFetchError ? error.status : 502
    console.error(`[dokumentasi-rakitan] ${code}: foto #${number} gagal diambil (${status})`)
    return { kind: "error", status: 502, message: "Foto gagal diambil dari storage Ticketing. Coba lagi sebentar." }
  }
}

export type ZipDownload = { kind: "ok"; stream: ReadableStream<Uint8Array>; fileName: string }

/**
 * ZIP datar: `01-bukti-selesai.jpg`, `02-saat-tiket-dibuat.jpg`, … (pilihan
 * user 18 Nov 2026 — lebih mudah dibuka di HP daripada folder per kelompok).
 *
 * Foto yang gagal diambil TIDAK dilewati diam-diam: namanya dicatat di
 * `FOTO-GAGAL-DIUNDUH.txt` di dalam ZIP yang sama. Tanpa itu, ZIP berisi 6
 * dari 7 foto terlihat lengkap bagi kasir.
 */
export async function getBuildDocumentationZip(code: string): Promise<ZipDownload | DownloadError> {
  const loaded = await loadNumberedPhotos(code)
  if (loaded.kind === "error") return loaded
  if (loaded.photos.length === 0) {
    return { kind: "error", status: 404, message: "Tiket ini belum punya foto di Ticketing." }
  }

  const { photos } = loaded
  async function* entries(): AsyncGenerator<ZipEntry> {
    const failed: string[] = []
    for (const photo of photos) {
      try {
        const image = await fetchImageFromUrl(new URL(photo.url))
        const data = await readImageBytes(image.body)
        yield { name: `${photo.fileBase}.${imageFileExtension(image.contentType, photo.url)}`, data }
      } catch (error) {
        const status = error instanceof MediaFetchError ? error.status : 502
        console.error(`[dokumentasi-rakitan] ${code}: foto #${photo.number} gagal masuk ZIP (${status})`)
        failed.push(photo.fileBase)
      }
    }
    if (failed.length > 0) {
      const text = [
        `${failed.length} dari ${photos.length} foto quotation ${code} TIDAK ikut di ZIP ini karena gagal diambil dari Ticketing:`,
        "",
        ...failed.map((name) => `- ${name}`),
        "",
        "Unduh ulang ZIP-nya, atau unduh foto tersebut satu per satu dari halaman Dokumentasi Rakitan.",
        "",
      ].join("\r\n")
      yield { name: "FOTO-GAGAL-DIUNDUH.txt", data: new TextEncoder().encode(text) }
    }
  }

  return { kind: "ok", stream: createZipStream(entries()), fileName: `${code}-dokumentasi.zip` }
}
