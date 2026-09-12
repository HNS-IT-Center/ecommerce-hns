import {
  toOpeningHoursSpecification,
  type StoreHours,
} from "@/lib/utils/opening-hours";
import { normalizePhone } from "./maps";

/**
 * `LocalBusiness` per toko untuk hasil pencarian Google.
 *
 * Dipisah dari komponen supaya bentuknya bisa diperiksa tanpa merender halaman,
 * dan supaya satu-satunya tempat yang menerjemahkan data toko ke schema.org ada
 * di sini — bukan tersebar sebagai objek literal di dalam JSX.
 */

type StoreForSeo = {
  id: string;
  name: string;
  address: string;
  phone: string;
  latitude: number | null;
  longitude: number | null;
  hours: StoreHours[];
};

/**
 * `@id` organisasi induk. Harus sama persis dengan yang dipasang di root layout,
 * karena inilah yang menyambungkan tiap cabang ke satu badan usaha di mata
 * Google — tanpa itu, dua toko terbaca sebagai dua bisnis yang tidak berhubungan.
 */
export function organizationId(siteUrl: string): string {
  return `${siteUrl}/#organization`;
}

/**
 * Alamat dipecah seadanya: yang tersimpan satu kolom teks bebas, sedangkan
 * `PostalAddress` menuntut bagian-bagian terpisah. Yang bisa dipastikan hanya
 * kota, provinsi, dan negara — sisanya masuk `streetAddress` apa adanya.
 *
 * Menebak nama jalan dan kode pos dari teks bebas justru berbahaya: alamat yang
 * salah pecah lebih buruk daripada alamat yang utuh di satu medan, karena Google
 * memakainya untuk mencocokkan lokasi.
 */
function toPostalAddress(address: string) {
  return {
    "@type": "PostalAddress" as const,
    streetAddress: address,
    addressLocality: "Batam",
    addressRegion: "Kepulauan Riau",
    addressCountry: "ID",
  };
}

export function buildStoreJsonLd(
  store: StoreForSeo,
  siteUrl: string,
): Record<string, unknown> {
  const punyaKoordinat = store.latitude !== null && store.longitude !== null;

  return {
    "@context": "https://schema.org",
    // Tipe paling sempit yang masih benar. Google memakainya untuk memahami jenis
    // usaha, dan "toko komputer" jauh lebih berguna bagi orang yang mencari
    // "toko komputer Batam" daripada "bisnis lokal" — atau bahkan "toko
    // elektronik", yang juga mencakup kulkas dan mesin cuci.
    //
    // TIDAK ada `aggregateRating` maupun `review` di sini, dan jangan
    // ditambahkan: ulasan yang dikumpulkan dari platform lain melanggar pedoman
    // structured data Google, dan sanksinya menimpa seluruh markup halaman.
    "@type": "ComputerStore",
    "@id": `${siteUrl}/stores#${store.id}`,
    name: store.name,
    url: `${siteUrl}/stores`,
    address: toPostalAddress(store.address),
    telephone: normalizePhone(store.phone),
    ...(punyaKoordinat && {
      geo: {
        "@type": "GeoCoordinates",
        // Angka, bukan objek Decimal — konversinya sudah terjadi di lapisan data
        // (`withHours` di lib/api/stores.ts). Decimal.js akan diserialisasi jadi
        // objek berisi properti internal dan ditolak Google.
        latitude: store.latitude,
        longitude: store.longitude,
      },
    }),
    // Hari tutup tidak muncul sama sekali: schema.org menyatakan tutup lewat
    // ketiadaan entri, dan menulisnya dengan jam kosong justru terbaca sebagai
    // buka tengah malam.
    ...(store.hours.length > 0 && {
      openingHoursSpecification: toOpeningHoursSpecification(store.hours),
    }),
    parentOrganization: { "@id": organizationId(siteUrl) },
  };
}
