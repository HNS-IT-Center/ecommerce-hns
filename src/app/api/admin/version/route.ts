import { NextResponse } from "next/server"

import { UnauthorizedError, requireAuth } from "@/lib/auth"
import { resolveSiteUrl } from "@/lib/utils/site-url"
import { env } from "@/config/env"

/**
 * "Versi mana yang sedang berjalan di sini?"
 *
 * Pertanyaan itu sudah dua kali harus dijawab dengan menebak — sekali saat
 * memastikan perbaikan tautan email sudah ter-deploy atau belum, sekali lagi
 * saat menelusuri sitemap `localhost`. Dua-duanya berakhir dengan menyimpulkan
 * dari gejala (isi robots.txt, jumlah URL sitemap) alih-alih bertanya langsung.
 *
 * DI BALIK AUTH ADMIN, bukan publik. Commit hash memberi tahu penyerang persis
 * versi kode mana yang berjalan, termasuk kerentanan yang sudah diperbaiki di
 * commit setelahnya. `requireAuth()` dipanggil di dalam handler ini sendiri,
 * bukan diandalkan dari proxy: alamat ini ada di /api, di luar jangkauan
 * `src/proxy.ts` yang cuma menjaga /admin dan /akun.
 *
 * `NEXT_PUBLIC_SITE_URL` ikut ditampilkan (bukan rahasia — namanya
 * `NEXT_PUBLIC_`, nilainya sudah ter-bundle ke browser) karena justru env itu
 * yang paling sering salah, dan membandingkannya dengan `resolvedSiteUrl` di
 * baris berikutnya langsung memperlihatkan apakah host request bekerja di
 * lingkungan ini. Di Hostinger, keduanya berbeda — itu gejala yang dicari.
 *
 * Nilai commit datang dari env yang diisi saat build. Kalau proses build tidak
 * mengisinya, isinya "(tidak diset)" — itu sendiri keterangan yang berguna:
 * berarti build-nya tidak lewat jalur yang kita kira.
 */
export async function GET() {
  try {
    await requireAuth()

    // Beberapa nama yang lazim dipakai penyedia hosting berbeda. Diperiksa
    // berurutan supaya endpoint ini tetap berguna tanpa perlu tahu lebih dulu
    // env mana yang diisi Hostinger.
    const commit =
      process.env.GIT_COMMIT_SHA ??
      process.env.VERCEL_GIT_COMMIT_SHA ??
      process.env.SOURCE_VERSION ??
      process.env.RENDER_GIT_COMMIT ??
      "(tidak diset)"

    return NextResponse.json({
      commit,
      builtAt: process.env.BUILD_TIME ?? "(tidak diset)",
      nodeEnv: process.env.NODE_ENV,
      // Yang dikonfigurasi vs yang benar-benar terlihat aplikasi saat
      // permintaan ini berjalan. Kalau keduanya berbeda, resolusi host bekerja;
      // kalau `resolvedSiteUrl` ikut localhost, ia jatuh ke fallback.
      configuredSiteUrl: env.NEXT_PUBLIC_SITE_URL,
      resolvedSiteUrl: await resolveSiteUrl(),
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    console.error("Gagal membaca info versi:", error)
    return NextResponse.json({ error: "Gagal membaca info versi." }, { status: 500 })
  }
}
