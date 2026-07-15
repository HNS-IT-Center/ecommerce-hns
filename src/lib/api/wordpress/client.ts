import { env } from "@/config/env"
import type { FetchOptions, WooListMeta } from "@/lib/api/woocommerce/client"

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
): Promise<{ data: T; meta: WooListMeta }> {
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
  const meta: WooListMeta = {
    total: Number(res.headers.get("x-wp-total") ?? 0),
    totalPages: Number(res.headers.get("x-wp-totalpages") ?? 0),
  }

  return { data, meta }
}
