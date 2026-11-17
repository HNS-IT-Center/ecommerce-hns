import "server-only"

import { z } from "zod"
import { env } from "@/config/env"

/**
 * Dokumentasi rakitan dari aplikasi Ticketing HNS — docs/17 §21.
 *
 * Arah kebalikan dari `ticketing-quotes.ts`: di sana Ticketing membaca
 * quotation dari kita, di sini kita membaca foto rakitan dari Ticketing.
 * Keduanya memakai `TICKETING_INTEGRATION_TOKEN` yang sama (permintaan pihak
 * Ticketing, 17 Nov 2026).
 *
 * Diambil SETIAP kali halaman dibuka (`no-store`): tahap rakitan dan fotonya
 * terus bertambah selama tiket berjalan, dan URL foto berasal dari storage
 * Ticketing — tidak pernah disalin ke storage ecommerce.
 *
 * Token hanya hidup di server. Fungsi ini tidak pernah dipanggil dari
 * komponen klien, dan hasilnya tidak membawa token apa pun.
 */

const TIMEOUT_MS = 8_000

/** Urutan & label kelompok foto. Urutan dari Ticketing sudah benar; peta ini hanya untuk judul. */
export const BUILD_PHOTO_GROUP_LABELS: Record<string, string> = {
  first_build: "Rakitan jadi",
  revision: "Revisi rakitan",
  work_proof: "Bukti selesai",
  intake: "Saat tiket dibuat",
  components: "Komponen saat masuk",
}

/**
 * Hanya http(s). URL foto ditaruh di `src` dan `href`; skema lain
 * (`javascript:`, `data:`) dari sistem lain tidak boleh sampai ke sana.
 */
const httpUrl = z
  .string()
  .trim()
  .refine((value) => {
    try {
      const { protocol } = new URL(value)
      return protocol === "https:" || protocol === "http:"
    } catch {
      return false
    }
  })

const nullableText = z.string().trim().nullish().transform((v) => (v ? v : null))

const PhotoSchema = z.object({
  group: z.string().trim().min(1),
  title: nullableText,
  fileName: nullableText,
  url: httpUrl,
})

const ResponseSchema = z.object({
  quoteCode: z.string().trim().min(1),
  ticket: z.object({
    code: z.string().trim().min(1),
    status: nullableText,
    stage: nullableText,
    stageLabel: nullableText,
    store: nullableText,
    technician: nullableText,
    finishedAt: nullableText,
  }),
  // Satu foto cacat tidak menggagalkan halaman: dibuang di `parseBuildDocumentation`.
  photos: z.array(z.unknown()).default([]),
})

export type BuildPhoto = z.infer<typeof PhotoSchema>

export type BuildDocumentation = {
  quoteCode: string
  ticket: z.infer<typeof ResponseSchema>["ticket"]
  photos: BuildPhoto[]
  /** Jumlah foto yang dibuang karena bentuknya tidak sah. Ditampilkan, tidak disembunyikan. */
  skippedPhotos: number
}

export type BuildDocumentationResult =
  | { kind: "ok"; doc: BuildDocumentation }
  /** 404 — quotation ini belum dibuatkan tiket rakitan. */
  | { kind: "no-ticket" }
  /** 400 — Ticketing tidak mengenali bentuk kodenya. */
  | { kind: "invalid-code" }
  /** Semua kegagalan lain. `reason` untuk log, bukan untuk pengunjung. */
  | { kind: "unavailable"; reason: "not-configured" | "unauthorized" | "upstream-not-configured" | "timeout" | "bad-response" | "network" }

/** Murni — diuji tanpa jaringan. Mengembalikan `null` kalau bentuk jawaban tidak sah. */
export function parseBuildDocumentation(body: unknown): BuildDocumentation | null {
  const parsed = ResponseSchema.safeParse(body)
  if (!parsed.success) return null

  const photos: BuildPhoto[] = []
  let skippedPhotos = 0
  for (const raw of parsed.data.photos) {
    const photo = PhotoSchema.safeParse(raw)
    if (photo.success) photos.push(photo.data)
    else skippedPhotos += 1
  }

  return { quoteCode: parsed.data.quoteCode, ticket: parsed.data.ticket, photos, skippedPhotos }
}

/**
 * Kelompokkan foto berurutan per `group`, mempertahankan urutan dari Ticketing.
 * Judul kelompok dari peta label; kelompok yang belum dikenal memakai judul
 * foto pertamanya, supaya kelompok baru di Ticketing tetap tampil.
 */
export function groupBuildPhotos(photos: BuildPhoto[]): { key: string; label: string; photos: BuildPhoto[] }[] {
  const groups: { key: string; label: string; photos: BuildPhoto[] }[] = []
  const byKey = new Map<string, (typeof groups)[number]>()
  for (const photo of photos) {
    let group = byKey.get(photo.group)
    if (!group) {
      group = { key: photo.group, label: BUILD_PHOTO_GROUP_LABELS[photo.group] ?? photo.title ?? photo.group, photos: [] }
      byKey.set(photo.group, group)
      groups.push(group)
    }
    group.photos.push(photo)
  }
  return groups
}

export async function getBuildDocumentation(code: string): Promise<BuildDocumentationResult> {
  const baseUrl = env.HNS_TICKETING_URL?.replace(/\/+$/, "")
  const token = env.TICKETING_INTEGRATION_TOKEN
  if (!baseUrl || !token) return { kind: "unavailable", reason: "not-configured" }

  let response: Response
  try {
    response = await fetch(`${baseUrl}/api/integrations/ecommerce/pc-builds/${encodeURIComponent(code)}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (error) {
    const timeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
    console.error(`[dokumentasi-rakitan] ${code}: ${timeout ? "timeout" : "gagal terhubung"}`, timeout ? "" : error)
    return { kind: "unavailable", reason: timeout ? "timeout" : "network" }
  }

  if (response.status === 404) return { kind: "no-ticket" }
  if (response.status === 400) return { kind: "invalid-code" }
  if (response.status === 401) {
    console.error(`[dokumentasi-rakitan] ${code}: token ditolak Ticketing (401)`)
    return { kind: "unavailable", reason: "unauthorized" }
  }
  if (response.status === 503) {
    console.error(`[dokumentasi-rakitan] ${code}: token belum diatur di Ticketing (503)`)
    return { kind: "unavailable", reason: "upstream-not-configured" }
  }
  if (!response.ok) {
    console.error(`[dokumentasi-rakitan] ${code}: Ticketing membalas ${response.status}`)
    return { kind: "unavailable", reason: "bad-response" }
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    console.error(`[dokumentasi-rakitan] ${code}: jawaban Ticketing bukan JSON`)
    return { kind: "unavailable", reason: "bad-response" }
  }

  const doc = parseBuildDocumentation(body)
  if (!doc) {
    console.error(`[dokumentasi-rakitan] ${code}: bentuk jawaban Ticketing tidak sah`)
    return { kind: "unavailable", reason: "bad-response" }
  }
  // Jawaban untuk quotation lain tidak pernah ditampilkan di bawah kode ini.
  if (doc.quoteCode.toUpperCase() !== code.toUpperCase()) {
    console.error(`[dokumentasi-rakitan] ${code}: Ticketing menjawab untuk ${doc.quoteCode}`)
    return { kind: "unavailable", reason: "bad-response" }
  }
  return { kind: "ok", doc }
}
