import { env } from "@/config/env"

/**
 * Tipe ini dulu tinggal di `lib/api/woocommerce/client.ts` dan diimpor dari
 * sini. Klien itu sudah dihapus bersama fitur sinkronisasi — ia satu-satunya
 * pemakai `WOOCOMMERCE_CONSUMER_KEY/SECRET` — jadi tipenya pindah ke tempat
 * yang benar-benar memakainya.
 */
export type FetchOptions = RequestInit & {
  next?: { revalidate?: number; tags?: string[] }
}

/** Jumlah total & halaman, dibaca dari header `x-wp-total`/`x-wp-totalpages`. */
export type ListMeta = {
  total: number
  totalPages: number
}

export class WordPressApiError extends Error {
  status: number
  statusText: string
  path: string

  constructor(args: { status: number; statusText: string; path: string }) {
    super(`WordPress ${args.status} on ${args.path}: ${args.statusText}`)
    this.status = args.status
    this.statusText = args.statusText
    this.path = args.path
  }
}

export async function wpFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { data } = await wpFetchWithMeta<T>(path, options)
  return data
}

export async function wpFetchWithMeta<T>(
  path: string,
  options: FetchOptions = {}
): Promise<{ data: T; meta: ListMeta }> {
  // WordPress & WooCommerce satu host yang sama (WooCommerce = plugin di atas WordPress).
  const url = `${env.WOOCOMMERCE_URL}/wp-json/wp/v2${path}`

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  })

  if (!res.ok) {
    throw new WordPressApiError({ status: res.status, statusText: res.statusText, path })
  }

  const data = (await res.json()) as T
  const meta: ListMeta = {
    total: Number(res.headers.get("x-wp-total") ?? 0),
    totalPages: Number(res.headers.get("x-wp-totalpages") ?? 0),
  }

  return { data, meta }
}
