import { env } from "@/config/env"
import { WordPressApiError } from "./client"

export class WordPressAuthNotConfiguredError extends Error {
  constructor() {
    super(
      "WordPress Application Password belum dikonfigurasi — isi WORDPRESS_APP_USER dan WORDPRESS_APP_PASSWORD di .env.local"
    )
    this.name = "WordPressAuthNotConfiguredError"
  }
}

export type UploadedMedia = {
  id: number
  source_url: string
}

/**
 * Upload gambar ke WordPress Media Library (dipakai admin panel untuk gambar
 * produk). BEDA kredensial dari WOOCOMMERCE_CONSUMER_KEY/SECRET — endpoint ini
 * (/wp-json/wp/v2/media) cuma menerima WordPress Application Password.
 */
export async function uploadMedia(file: File): Promise<UploadedMedia> {
  if (!env.WORDPRESS_APP_USER || !env.WORDPRESS_APP_PASSWORD) {
    throw new WordPressAuthNotConfiguredError()
  }

  const auth = Buffer.from(`${env.WORDPRESS_APP_USER}:${env.WORDPRESS_APP_PASSWORD}`).toString(
    "base64"
  )
  const formData = new FormData()
  formData.append("file", file)

  const res = await fetch(`${env.WOOCOMMERCE_URL}/wp-json/wp/v2/media`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      // JANGAN set Content-Type manual — fetch otomatis isi header multipart
      // dengan boundary yang benar berdasarkan FormData.
    },
    body: formData,
  })

  if (!res.ok) {
    throw new WordPressApiError({ status: res.status, statusText: res.statusText, path: "/media" })
  }

  return res.json() as Promise<UploadedMedia>
}

export function isWordPressMediaConfigured(): boolean {
  return Boolean(env.WORDPRESS_APP_USER && env.WORDPRESS_APP_PASSWORD)
}
