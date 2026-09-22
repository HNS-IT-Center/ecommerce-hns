/**
 * Zona waktu toko, dan cara membaca "tanggal hari ini menurut HNS".
 *
 * Satu berkas supaya tidak ada dua definisi yang beredar. Container produksi
 * berjalan di UTC, tujuh jam di belakang WIB — jadi `new Date().getDate()` di
 * server BUKAN tanggal yang dilihat orang di Batam. Selisih itu hanya terlihat
 * pada sebagian jam (00.00–07.00 WIB), sehingga bug yang ditimbulkannya selalu
 * tampak seperti gangguan acak, bukan kesalahan yang bisa ditebak.
 *
 * `Intl` dipakai alih-alih menambahkan tujuh jam secara manual karena ia
 * membaca basis data zona waktu sistem; kalau suatu hari aturannya berubah,
 * kode ini ikut benar tanpa disentuh.
 */

export const JAKARTA_TIME_ZONE = "Asia/Jakarta";

/** Bagian tanggal, sudah diterjemahkan ke WIB. Semua berupa angka. */
export type JakartaDateParts = {
  /** 2026 */
  year: number;
  /** 1–12 (BUKAN 0-11 seperti `Date.getMonth()`). */
  month: number;
  /** 1–31 */
  day: number;
};

const DATE_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: JAKARTA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Tanggal `value` menurut WIB.
 *
 * Locale `en-CA` dipilih karena ia memformat sebagai `YYYY-MM-DD` — urutan yang
 * bisa dipotong tanpa menebak-nebak posisi bagiannya. `formatToParts` tetap
 * dipakai supaya kode ini tidak bergantung pada pemisah yang dipilih ICU.
 */
export function jakartaDateParts(value: Date): JakartaDateParts {
  const parts = DATE_PARTS.formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes): number => {
    const found = parts.find((part) => part.type === type);
    return found ? Number(found.value) : Number.NaN;
  };

  return { year: get("year"), month: get("month"), day: get("day") };
}

/**
 * `"202609"` — periode bulanan untuk penomoran quotation.
 *
 * Inilah yang membuat nomor urut me-reset di pergantian bulan WIB, bukan di
 * pergantian bulan UTC: tanpa ini, quotation yang dicetak 1 Oktober pukul 00.30
 * WIB masuk periode September dan mengambil nomor lanjutan bulan lalu.
 */
export function jakartaPeriod(value: Date): string {
  const { year, month } = jakartaDateParts(value);
  return `${year}${String(month).padStart(2, "0")}`;
}

/** `"20260921"` — bagian tanggal pada kode quotation. */
export function jakartaYyyymmdd(value: Date): string {
  const { year, month, day } = jakartaDateParts(value);
  return `${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
}

/**
 * Selisih WIB terhadap UTC, sebagai teks offset ISO.
 *
 * Dipatok, tidak dibaca dari `Intl` — dan itu disengaja untuk kasus di bawah.
 * `Intl` dipakai saat MEMBACA sebuah instant menjadi tanggal lokal (di atas),
 * tapi untuk MEMBENTUK instant dari tanggal lokal, offset eksplisit jauh lebih
 * jujur daripada merangkai string lalu berharap peramban/Node menafsirkannya
 * di zona yang kita maksud.
 *
 * Aman karena WIB tidak pernah punya daylight saving dan sudah tetap di UTC+7
 * sejak 1964. Kalau Indonesia suatu hari mengubahnya, baris inilah yang berubah
 * — dan gagalnya akan kelihatan di satu tempat, bukan tersebar.
 */
const WIB_OFFSET = "+07:00";

/**
 * Rentang satu periode "YYYYMM" sebagai instant UTC: `[mulai, sesudah)`.
 *
 * Setengah terbuka, bukan `[mulai, selesai]`. Batas akhir yang ikut terhitung
 * memaksa penulisnya memilih "23:59:59" atau "23:59:59.999", dan keduanya
 * membuang transaksi yang jatuh di celah setelahnya — satu baris yang hilang
 * dari rekap bulanan tanpa jejak.
 */
export function jakartaMonthRange(period: string): { mulai: Date; sesudah: Date } {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(4, 6));

  const mulai = new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00${WIB_OFFSET}`);

  const tahunBerikut = month === 12 ? year + 1 : year;
  const bulanBerikut = month === 12 ? 1 : month + 1;
  const sesudah = new Date(
    `${tahunBerikut}-${String(bulanBerikut).padStart(2, "0")}-01T00:00:00${WIB_OFFSET}`,
  );

  return { mulai, sesudah };
}

/** `"202609"` → `"September 2026"`, untuk judul rekap. */
export function formatJakartaPeriod(period: string): string {
  const { mulai } = jakartaMonthRange(period);
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: JAKARTA_TIME_ZONE,
  }).format(mulai);
}
