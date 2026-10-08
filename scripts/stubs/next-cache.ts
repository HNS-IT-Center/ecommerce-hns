/**
 * Pengganti `next/cache` untuk skrip verifikasi yang menyentuh modul ber-cache.
 *
 * `unstable_cache` melempar "incrementalCache missing" di luar Next, dan
 * `revalidateTag` melempar "static generation store missing" — sehingga fungsi
 * seperti `getPcPrebuildConfig()` atau `createProduct()` tidak bisa diuji apa
 * adanya dari Node. Di sini cache diteruskan langsung (selalu membaca database)
 * dan invalidasi tidak melakukan apa pun: yang diuji isi database, bukan cache.
 *
 * Hanya dipasang lewat `scripts/tsconfig.uji-next.json`. Build Next,
 * `npm run typecheck`, dan `scripts/tsconfig.uji.json` tidak menyentuhnya.
 */
export function unstable_cache<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  return fn
}

export function revalidateTag(): void {}

export function revalidatePath(): void {}
