/**
 * Lapisan data untuk tabel `banner_batches` — kampanye yang menaungi beberapa
 * banner sekaligus.
 *
 * Mengikuti konvensi `lib/api/banners.ts`: `revalidateTag`/`revalidatePath`
 * TIDAK dipanggil dari sini, melainkan dari lapisan action.
 *
 * Tidak ada `unstable_cache` di berkas ini. Gerbang tayang milik kampanye
 * dibaca lewat relasi di `getActiveBanners()` — satu query, satu entri cache.
 * Menaruh cache kedua di sini hanya menambah tempat yang bisa basi sendiri.
 */
import { getPrisma } from "@/lib/prisma/client"
import type { BannerBatch } from "@prisma/client"
import { bannerLiveState } from "@/lib/utils/banner"

export type BatchInput = {
  name: string
  isActive: boolean
  startsAt: Date | null
  endsAt: Date | null
}

/**
 * Bentuk kampanye yang dipakai UI — dipilih kolomnya, bukan `BannerBatch`
 * utuh. Tipe ini ikut menyeberang ke Client Component lewat `import type`,
 * jadi isinya sengaja hanya yang benar-benar ditampilkan.
 */
export type BatchOption = Pick<BannerBatch, "id" | "name" | "isActive" | "startsAt" | "endsAt">

const OPTION_SELECT = {
  id: true,
  name: true,
  isActive: true,
  startsAt: true,
  endsAt: true,
} as const

export type BatchRow = BatchOption & {
  /** Jumlah banner anggotanya. */
  bannerCount: number
  /**
   * Banner yang setelannya sendiri sudah layak tayang tapi tertahan kampanye
   * ini. Dipakai dialog hapus untuk menyebut akibatnya di muka — lihat
   * `softDeleteBatch`.
   */
  heldBannerCount: number
}

/** Semua kampanye yang belum dihapus — untuk panel admin. */
export async function getAllBatches(now = Date.now()): Promise<BatchRow[]> {
  const batches = await getPrisma().bannerBatch.findMany({
    where: { deletedAt: null },
    orderBy: [{ createdAt: "desc" }],
    select: {
      ...OPTION_SELECT,
      banners: { select: { isActive: true, startsAt: true, endsAt: true } },
    },
  })

  return batches.map((batch) => {
    const batchIsLive = bannerLiveState(batch, now) === "live"

    return {
      id: batch.id,
      name: batch.name,
      isActive: batch.isActive,
      startsAt: batch.startsAt,
      endsAt: batch.endsAt,
      bannerCount: batch.banners.length,
      heldBannerCount: batchIsLive
        ? 0
        : batch.banners.filter((banner) => bannerLiveState(banner, now) === "live").length,
    }
  })
}

/** Daftar untuk dropdown "Kampanye" di form banner. */
export async function getBatchOptions(): Promise<BatchOption[]> {
  return getPrisma().bannerBatch.findMany({
    where: { deletedAt: null },
    orderBy: [{ createdAt: "desc" }],
    select: OPTION_SELECT,
  })
}

export async function createBatch(input: BatchInput): Promise<BatchOption> {
  return getPrisma().bannerBatch.create({ data: input, select: OPTION_SELECT })
}

export async function updateBatch(id: string, input: BatchInput): Promise<BatchOption> {
  return getPrisma().bannerBatch.update({
    where: { id },
    data: input,
    select: OPTION_SELECT,
  })
}

/**
 * Soft delete — CLAUDE.md §2.8, dengan alasan tambahan yang ditulis di
 * `BannerBatch.deletedAt`: menghapus barisnya sungguhan memicu `onDelete:
 * SetNull` pada seluruh anggotanya, sehingga keterangan "banner ini bagian
 * dari Promo Agustus 2026" lenyap dari tiap-tiap banner. Yang hilang persis
 * catatan yang mau disimpan.
 *
 * Setelah dihapus, kampanye BERHENTI menahan tayang anggotanya: ia tinggal
 * label arsip, bukan gerbang (lihat penyaringan di `getActiveBanners`).
 * Akibatnya menghapus kampanye yang sedang mematikan banner bisa membuat
 * banner itu langsung tayang di beranda — jumlahnya disebut di dialog
 * konfirmasi lewat `heldBannerCount`, supaya staff tahu sebelum menekan Hapus
 * dan bukan sesudah melihatnya di beranda.
 */
export async function softDeleteBatch(id: string): Promise<void> {
  await getPrisma().bannerBatch.update({
    where: { id },
    data: { deletedAt: new Date() },
  })
}
