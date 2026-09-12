/**
 * Pembangun URL untuk halaman toko: peta, petunjuk arah, dan WhatsApp.
 *
 * Fungsi murni tanpa efek samping, dikumpulkan di satu berkas supaya tidak ada
 * dua komponen yang menyusun URL peta dengan aturan berbeda. Sebelum ini, URL
 * dibangun langsung di halaman, dan itulah kenapa kedua kartu toko sempat
 * menampilkan lokasi yang salah tanpa ada satu tempat pun untuk membetulkannya.
 */

type StoreLike = {
  name: string;
  address: string;
  phone: string;
  googlePlaceId: string | null;
};

/**
 * Kunci Maps Embed API. Boleh kosong.
 *
 * `NEXT_PUBLIC_` memang disengaja: kunci ini tampil di HTML sebagai bagian `src`
 * iframe — begitulah Embed API dirancang. Keamanannya bersandar pada pembatasan
 * HTTP referrer di Cloud Console, bukan pada kerahasiaan nilainya. Jangan
 * memindahkannya ke sisi server; iframe tidak akan bisa memuatnya.
 *
 * Dibaca langsung dari `process.env`, bukan lewat `config/env.ts`, karena berkas
 * ini ikut terbawa ke bundel peramban dan skema Zod di sana menarik seluruh
 * konfigurasi server bersamanya.
 */
const EMBED_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY ?? "";

/**
 * Peta untuk kartu toko.
 *
 * Tiga tingkat, menurun sesuai ketersediaan:
 *
 * 1. Ada kunci + Place ID → Embed API mode `place`. Ini satu-satunya jalur yang
 *    menampilkan pin terverifikasi Google lengkap dengan nama bisnisnya.
 * 2. Tanpa kunci → jalur keyless `output=embed`. Hasilnya pencarian teks yang
 *    fuzzy, tapi situs tetap hidup — lingkungan dev tanpa kunci tidak boleh
 *    menampilkan kotak kosong, dan kunci yang bermasalah di produksi tidak boleh
 *    mematikan halaman.
 * 3. Tanpa Place ID → jatuh ke nama + alamat.
 *
 * Yang TIDAK pernah dipakai di sini: `mapsUrl` (tautan maps.app.goo.gl). Google
 * menolak halaman di balik tautan itu dibingkai, jadi memasangnya sebagai `src`
 * menghasilkan iframe kosong. Ia hanya sah untuk tautan yang dibuka di tab baru.
 */
export function getStoreEmbedUrl(store: StoreLike): string {
  const placeId = store.googlePlaceId?.trim();

  if (EMBED_KEY && placeId) {
    return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(EMBED_KEY)}&q=place_id:${encodeURIComponent(placeId)}`;
  }

  if (EMBED_KEY) {
    const q = encodeURIComponent(`${store.name}, ${store.address}`);
    return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(EMBED_KEY)}&q=${q}`;
  }

  const q = placeId ? `place_id:${placeId}` : `${store.name}, ${store.address}`;
  return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=16&output=embed`;
}

/**
 * Petunjuk arah, dibuka di aplikasi Google Maps.
 *
 * `destination_place_id` disertakan kalau ada: tanpa itu Maps mencari tujuan
 * dari teks dan bisa mendarat di tempat lain bernama mirip — persis masalah yang
 * membuat peta sempat menunjuk kelenteng dan Pizza Hut. `destination` tetap
 * dikirim karena Google mensyaratkannya walau `place_id` ada.
 */
export function getDirectionsUrl(store: StoreLike): string {
  const params = new URLSearchParams({ api: "1", destination: store.name });
  const placeId = store.googlePlaceId?.trim();
  if (placeId) params.set("destination_place_id", placeId);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * Nomor dinormalisasi ke bentuk internasional tanpa tanda baca, karena wa.me
 * menolak spasi, tanda hubung, dan tanda plus. "0821-8559-8887" jadi
 * "6282185598887"; nomor yang sudah diawali 62 atau +62 dibiarkan.
 *
 * Yang tersimpan di database tetap apa adanya seperti diketik staff — angka yang
 * mereka lihat di panel harus sama dengan yang mereka kenal, bukan bentuk mesin.
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits;
}

export function getWhatsAppUrl(store: StoreLike, message?: string): string {
  const teks =
    message ?? `Halo ${store.name}, saya ingin bertanya tentang produk Anda.`;
  return `https://wa.me/${normalizePhone(store.phone)}?text=${encodeURIComponent(teks)}`;
}
