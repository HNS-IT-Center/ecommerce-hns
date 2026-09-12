/**
 * Daftar host resmi HNS — dipakai bersama oleh sisi server dan sisi klien.
 *
 * Daftar ini dulu hidup di dalam `site-url.ts`, yang memasang
 * `import "server-only"` dan karena itu tidak bisa disentuh pemindai QR di
 * browser. Menyalinnya ke sisi klien berarti ada dua daftar izin yang harus
 * diingat untuk diperbarui bersamaan — dan yang seperti itu selalu berakhir
 * dengan satu yang tertinggal saat domain bertambah.
 *
 * Fungsi ini sengaja TIDAK menyentuh `@/config/env`: berkas itu memvalidasi
 * secret server (kunci WooCommerce, R2, dll), jadi mengimpornya dari komponen
 * klien akan gagal saat runtime. Pemeriksaan terhadap `NEXT_PUBLIC_SITE_URL`
 * tetap tinggal di `site-url.ts`, di sisi server, sebagai lapis tambahan.
 */
export function isTrustedHnsHostname(hostname: string): boolean {
  // Pengembangan lokal.
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]") {
    return true
  }

  // Domain resmi berikut subdomainnya (mis. store.hnsitcenter.id).
  return (
    hostname === "hnsitcenter.id" ||
    hostname.endsWith(".hnsitcenter.id") ||
    hostname === "hnsitcenter.com" ||
    hostname.endsWith(".hnsitcenter.com")
  )
}
