import { env } from "@/config/env";

export type FetchOptions = RequestInit & {
  next?: { revalidate?: number; tags?: string[] };
};

const auth = Buffer.from(
  `${env.WOOCOMMERCE_CONSUMER_KEY}:${env.WOOCOMMERCE_CONSUMER_SECRET}`
).toString("base64");

export class WooApiError extends Error {
  status: number;
  statusText: string;
  path: string;
  
  constructor(args: { status: number; statusText: string; path: string }) {
    super(`WooCommerce ${args.status} on ${args.path}: ${args.statusText}`);
    this.status = args.status;
    this.statusText = args.statusText;
    this.path = args.path;
  }
}

export async function wooFetch<T>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { data } = await wooFetchWithMeta<T>(path, options);
  return data;
}

export type WooListMeta = {
  total: number;
  totalPages: number;
};

export async function wooFetchWithMeta<T>(
  path: string,
  options: FetchOptions = {}
): Promise<{ data: T; meta: WooListMeta }> {
  const url = `${env.WOOCOMMERCE_URL}/wp-json/wc/v3${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    throw new WooApiError({
      status: res.status,
      statusText: res.statusText,
      path,
    });
  }

  const data = (await res.json()) as T;
  const meta: WooListMeta = {
    total: Number(res.headers.get("x-wp-total") ?? 0),
    totalPages: Number(res.headers.get("x-wp-totalpages") ?? 0),
  };

  return { data, meta };
}
