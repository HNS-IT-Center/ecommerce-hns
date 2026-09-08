/**
 * Pengganti paket `server-only` untuk skrip verifikasi.
 *
 * Paket aslinya TIDAK ada di `node_modules` — Next.js menyelesaikannya sendiri
 * di bundler, jadi `import "server-only"` cuma bisa dimuat di dalam build Next.
 * Akibatnya skrip Node biasa tidak bisa mengimpor modul layanan mana pun yang
 * memakainya, dan verifikasi terpaksa menguji SALINAN kodenya — persis jenis uji
 * yang lolos padahal kode aslinya rusak.
 *
 * Stub ini hanya dipasang lewat `scripts/tsconfig.uji.json`, yang cuma dipakai
 * saat menjalankan skrip uji. Build Next dan `npm run typecheck` tidak
 * menyentuhnya, jadi penjaga "jangan impor ini dari Client Component" tetap
 * berlaku penuh di kode produksi.
 */
export {}
