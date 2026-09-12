import "server-only"

import { headers } from "next/headers"

import { env } from "@/config/env"
import { isTrustedHnsHostname } from "./trusted-host"

/**
 * Base URL untuk tautan yang keluar dari aplikasi — QR code produk, QR
 * verifikasi quotation, dan sejenisnya.
 *
 * Diambil dari host request yang sedang berjalan, supaya tautan otomatis ikut
 * lingkungan: dibuka dari localhost menghasilkan tautan localhost (enak untuk
 * pengujian), dibuka dari domain production menghasilkan tautan production —
 * tanpa perlu mengubah env setiap ganti lingkungan.
 *
 * TAPI header `Host` dikirim oleh klien dan bisa dipalsukan. Kalau dipakai
 * mentah-mentah, penyerang bisa meminta halaman cetak dengan
 * `Host: situs-palsu.com` lalu memperoleh PDF resmi yang QR-nya menunjuk situs
 * mereka — persis membatalkan gunanya QR sebagai penanda keaslian. Karena itu
 * host hanya dipakai kalau lolos daftar izin di bawah; selain itu jatuh ke
 * NEXT_PUBLIC_SITE_URL.
 */
function isTrustedHost(hostname: string): boolean {
  // Host dari konfigurasi selalu tepercaya.
  try {
    if (hostname === new URL(env.NEXT_PUBLIC_SITE_URL).hostname) return true
  } catch {
    // NEXT_PUBLIC_SITE_URL tidak valid — jatuh ke pemeriksaan berikutnya.
  }

  // Daftar domain resminya tinggal di modul terpisah supaya pemindai QR di
  // browser memakai daftar yang sama persis — lihat trusted-host.ts.
  return isTrustedHnsHostname(hostname)
}

/** Base URL tanpa garis miring di akhir, mis. `https://store.hnsitcenter.id`. */
export async function resolveSiteUrl(): Promise<string> {
  const fallback = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")

  try {
    const headerList = await headers()
    // `x-forwarded-host` dipakai lebih dulu karena di balik proxy/CDN
    // (Hostinger, Vercel) `host` berisi host internal, bukan domain publik.
    const rawHost = headerList.get("x-forwarded-host") ?? headerList.get("host")
    if (!rawHost) return fallback

    // Bisa berisi daftar ("a.com, b.com") kalau melewati beberapa proxy.
    const host = rawHost.split(",")[0].trim()
    if (!host) return fallback

    const hostname = host.replace(/:\d+$/, "")
    if (!isTrustedHost(hostname)) return fallback

    const proto =
      headerList.get("x-forwarded-proto")?.split(",")[0].trim() ??
      (hostname === "localhost" || hostname === "127.0.0.1" ? "http" : "https")

    return `${proto}://${host}`
  } catch {
    // headers() tidak tersedia (mis. dipanggil saat build statis).
    return fallback
  }
}
