/**
 * Nilai `action` tambahan untuk `ProductLog`, dipakai jalur sinkronisasi.
 *
 * Tidak ada perubahan schema: kolomnya `VarChar(100)` dan bebas diisi. Dibuat
 * sebagai konstanta supaya tidak ada string rakitan yang berbeda-beda antar
 * pemanggil — masalah yang pernah terjadi pada `fieldAffected: "price"` di
 * updateProductPriceAction.
 *
 * `ProductLog` sengaja dipakai ulang, bukan membuat tabel audit tersendiri.
 * Dua tempat berbeda untuk menjawab "siapa mengubah harga ini" berarti salah
 * satunya akan tertinggal.
 */
export const PRODUCT_LOG_ACTION = {
  SYNC_PUSHED: "SYNC_PUSHED",
  SYNC_FAILED: "SYNC_FAILED",
} as const;

export type ProductLogSyncAction =
  (typeof PRODUCT_LOG_ACTION)[keyof typeof PRODUCT_LOG_ACTION];
