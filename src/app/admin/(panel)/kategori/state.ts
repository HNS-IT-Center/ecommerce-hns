/**
 * Bentuk state layar kelola kategori, beserta nilai awalnya.
 *
 * Terpisah dari `actions.ts` karena berkas 'use server' hanya boleh
 * mengekspor fungsi async — lihat penjelasan lengkapnya di
 * `src/app/admin/login/state.ts`.
 */

// `import type`, bukan impor biasa. Berkas ini ikut terbaca dari komponen klien,
// dan modul kategori menarik Prisma di baliknya; impor nilai akan menyeret
// seluruh lapisan database ke dalam bundel peramban. Bentuk `import type`
// dihapus sepenuhnya saat kompilasi, jadi yang tersisa hanya tipenya.
import type { MergeCategoryPreview } from "@/lib/api/woocommerce/categories"

export type CategoryActionState = { error: string | null; ok: string | null }

export const EMPTY_STATE: CategoryActionState = { error: null, ok: null }

export type MergePreviewState = { error: string | null; preview: MergeCategoryPreview | null }

export const EMPTY_MERGE_PREVIEW: MergePreviewState = { error: null, preview: null }
