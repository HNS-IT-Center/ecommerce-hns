import { createHash, timingSafeEqual } from "node:crypto"
import { NextResponse, type NextRequest } from "next/server"
import { revalidatePath, revalidateTag } from "next/cache"
import { z } from "zod"
import { env } from "@/config/env"

/**
 * Pembersih cache on-demand.
 *
 * Data produk & kategori dibaca lewat `unstable_cache` dengan umur 300–3600
 * detik. Selama perubahan datang dari admin panel itu tidak masalah — jalur
 * tulis di `lib/api/woocommerce/products.ts` memanggil `revalidateTag` sendiri.
 * Yang tidak tertangani adalah perubahan dari LUAR app: script migrasi di
 * `scripts/` menulis langsung ke MariaDB, jadi Next tidak tahu apa-apa dan
 * tetap menyajikan data lama sampai umur cache habis.
 *
 * `REVALIDATE_SECRET` sudah lama diwajibkan di `config/env.ts` tapi belum
 * pernah dipakai di satu file pun — di sinilah tempatnya.
 *
 * Contoh setelah menjalankan script migrasi:
 *
 *   curl -X POST "$SITE/api/revalidate" \
 *     -H "x-revalidate-secret: $REVALIDATE_SECRET" \
 *     -H "content-type: application/json" \
 *     -d '{"tags":["categories","products","all-products"]}'
 *
 * CATATAN soal dev. Endpoint ini menyasar cache DATA (`unstable_cache`), yang
 * di production memang menahan hasil selama 300–3600 detik. Di `next dev`
 * dengan Turbopack, cache data itu praktis tidak aktif — perubahan DB langsung
 * terlihat tanpa dipanggilnya endpoint ini. Kemacetan yang muncul saat
 * verifikasi task #3, ketika kategori yang sudah dihapus masih tampil, berasal
 * dari cache RENDER persisten milik Turbopack, bukan dari `unstable_cache`:
 * restart server tidak menolong dan menghapus `.next/cache` juga tidak, hanya
 * membuang seluruh direktori `.next` yang berhasil. `revalidateTag` tidak
 * menjangkau cache itu. Jadi di dev, gejala serupa tetap ditangani dengan
 * menghapus `.next`.
 */

/** Tag yang dipakai layer data. Dipakai untuk memvalidasi input, sekaligus jadi dokumentasi. */
const KNOWN_TAGS = [
  "categories",
  "products",
  "all-products",
  "product-attributes",
  "blog",
  "site-theme",
  "pc-builder-config",
] as const

/**
 * Sebagian tag dibentuk dari id/slug (`product-123`, `category-45`), jadi tidak
 * bisa didaftar satu per satu. Pola ini membatasi bentuknya supaya isian bebas
 * tidak dipakai untuk membanjiri cache dengan tag karangan.
 */
const DYNAMIC_TAG = /^(product|category|attribute)-[a-z0-9-]+$/i

const BodySchema = z
  .object({
    tags: z.array(z.string().min(1).max(120)).max(50).optional(),
    paths: z.array(z.string().startsWith("/").max(200)).max(50).optional(),
  })
  .refine((b) => (b.tags?.length ?? 0) + (b.paths?.length ?? 0) > 0, {
    message: "Sertakan minimal satu tag atau path",
  })

function isAuthorized(provided: string | null): boolean {
  if (!provided) return false

  // Di-hash dulu supaya perbandingan selalu atas dua buffer berukuran sama —
  // timingSafeEqual melempar kalau panjangnya beda, dan itu sendiri membocorkan
  // panjang secret yang benar.
  const a = createHash("sha256").update(provided).digest()
  const b = createHash("sha256").update(env.REVALIDATE_SECRET).digest()
  return timingSafeEqual(a, b)
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request.headers.get("x-revalidate-secret"))) {
    return NextResponse.json({ error: "Secret tidak valid" }, { status: 401 })
  }

  let parsed: z.infer<typeof BodySchema>
  try {
    parsed = BodySchema.parse(await request.json())
  } catch (error) {
    const message =
      error instanceof z.ZodError ? error.issues.map((i) => i.message).join("; ") : "Body tidak valid"
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const tags = parsed.tags ?? []
  const unknown = tags.filter(
    (t) => !KNOWN_TAGS.includes(t as (typeof KNOWN_TAGS)[number]) && !DYNAMIC_TAG.test(t)
  )
  if (unknown.length > 0) {
    return NextResponse.json(
      { error: `Tag tidak dikenal: ${unknown.join(", ")}`, knownTags: KNOWN_TAGS },
      { status: 400 }
    )
  }

  const paths = parsed.paths ?? []

  // Next 16 mewajibkan argumen profil: revalidateTag(tag, profile). "max"
  // menyapu entri sampai umur terpanjang, dan itu pula yang dipakai jalur tulis
  // admin di lib/api/woocommerce/products.ts — disamakan supaya pembersihan
  // lewat endpoint ini dan lewat admin panel berperilaku identik.
  for (const tag of tags) revalidateTag(tag, "max")
  for (const path of paths) revalidatePath(path)

  return NextResponse.json({ revalidated: { tags, paths }, at: new Date().toISOString() })
}
