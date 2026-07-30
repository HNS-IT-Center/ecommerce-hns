/**
 * Bentuk state penetapan kategori massal, beserta nilai awalnya.
 *
 * Terpisah dari `actions.ts` karena berkas 'use server' hanya boleh
 * mengekspor fungsi async — lihat penjelasan lengkapnya di
 * `src/app/admin/login/state.ts`.
 */

// `import type`, bukan impor biasa — alasannya sama seperti di
// `kategori/state.ts`: berkas ini terbaca dari komponen klien, dan modul produk
// menarik Prisma di baliknya.
import type { BulkAssignPreview } from "@/lib/api/woocommerce/products"

export type BulkPreviewState = { error: string | null; preview: BulkAssignPreview | null }
export type BulkApplyState = { error: string | null; ok: string | null }

export const EMPTY_BULK_PREVIEW: BulkPreviewState = { error: null, preview: null }
export const EMPTY_BULK_APPLY: BulkApplyState = { error: null, ok: null }
