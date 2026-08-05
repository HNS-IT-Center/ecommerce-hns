/**
 * Jam buka toko: bentuk, pemeriksaan, dan dua cara menampilkannya.
 *
 * Satu berkas supaya aturan "hari apa saja yang sah" dan "bagaimana menuliskan
 * Senin–Sabtu" tidak tersebar. Halaman toko, halaman kontak, daftar admin, dan
 * structured data untuk Google semuanya membaca data yang sama; kalau masing-
 * masing memformat sendiri, cepat atau lambat salah satunya menyimpang tanpa
 * ada yang menyadarinya.
 */

/** 0 Minggu … 6 Sabtu — mengikuti `Date.getDay()`. */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type StoreHours = {
  dayOfWeek: DayOfWeek;
  isClosed: boolean;
  /** "09:00", 24 jam. */
  opensAt: string;
  /** "21:00", 24 jam. */
  closesAt: string;
};

export const DAYS: readonly DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6];

/** Nama untuk pelanggan. Indeksnya sengaja sama dengan `dayOfWeek`. */
export const DAY_NAMES: readonly string[] = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

/**
 * Nama hari versi schema.org. Google menolak singkatan maupun bahasa Indonesia
 * di `dayOfWeek`, jadi pemetaannya harus eksplisit — bukan hasil kapitalisasi
 * nama lokal.
 */
const SCHEMA_DAY_NAMES: readonly string[] = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

export function isDayOfWeek(value: number): value is DayOfWeek {
  return Number.isInteger(value) && value >= 0 && value <= 6;
}

/**
 * Urutan tampil dimulai dari Senin, bukan Minggu.
 *
 * Penyimpanannya memang 0 = Minggu supaya cocok dengan `Date.getDay()`, tapi
 * pembaca Indonesia membaca minggu kerja mulai Senin — menampilkan Minggu di
 * baris teratas membuat "Senin–Sabtu" terpecah jadi dua potongan yang terlihat
 * seperti kesalahan.
 */
export function sortForDisplay(hours: readonly StoreHours[]): StoreHours[] {
  const urutan = (d: DayOfWeek) => (d === 0 ? 7 : d);
  return [...hours].sort((a, b) => urutan(a.dayOfWeek) - urutan(b.dayOfWeek));
}

type Blok = {
  days: DayOfWeek[];
  isClosed: boolean;
  opensAt: string;
  closesAt: string;
};

/**
 * Gabungkan hari-hari BERURUTAN yang jamnya sama persis menjadi satu blok.
 *
 * Tujuh baris "Senin 09:00–21:00" yang identik benar secara data tapi melelahkan
 * dibaca, dan di structured data ia membuat Google menerima tujuh entri untuk
 * satu aturan yang sama. Penggabungan hanya berlaku untuk hari yang bersebelahan
 * supaya hasilnya tetap jujur: "Senin–Sabtu" berarti benar-benar berurutan,
 * bukan kumpulan hari acak yang kebetulan berjam sama.
 */
export function groupConsecutive(hours: readonly StoreHours[]): Blok[] {
  const urut = sortForDisplay(hours);
  const blok: Blok[] = [];

  for (const jam of urut) {
    const terakhir = blok[blok.length - 1];
    const sambung =
      terakhir &&
      terakhir.isClosed === jam.isClosed &&
      terakhir.opensAt === jam.opensAt &&
      terakhir.closesAt === jam.closesAt &&
      bersebelahan(terakhir.days[terakhir.days.length - 1], jam.dayOfWeek);

    if (sambung) terakhir.days.push(jam.dayOfWeek);
    else
      blok.push({
        days: [jam.dayOfWeek],
        isClosed: jam.isClosed,
        opensAt: jam.opensAt,
        closesAt: jam.closesAt,
      });
  }

  return blok;
}

/** Bersebelahan menurut urutan tampil (Senin…Minggu), jadi Sabtu→Minggu tersambung. */
function bersebelahan(sebelum: DayOfWeek, sesudah: DayOfWeek): boolean {
  const urutan = (d: DayOfWeek) => (d === 0 ? 7 : d);
  return urutan(sesudah) - urutan(sebelum) === 1;
}

function labelHari(days: DayOfWeek[]): string {
  if (days.length === 1) return DAY_NAMES[days[0]];
  return `${DAY_NAMES[days[0]]}–${DAY_NAMES[days[days.length - 1]]}`;
}

/**
 * Teks untuk pelanggan, mis. "Senin–Sabtu 09.00–21.00 · Minggu 10.00–21.00".
 * Titik dipakai sebagai pemisah jam mengikuti kebiasaan penulisan Indonesia.
 */
export function formatOpeningHours(hours: readonly StoreHours[]): string {
  if (hours.length === 0) return "Jam buka belum diisi";

  return groupConsecutive(hours)
    .map((b) => {
      const hari = labelHari(b.days);
      if (b.isClosed) return `${hari} tutup`;
      return `${hari} ${b.opensAt.replace(":", ".")}–${b.closesAt.replace(":", ".")}`;
    })
    .join(" · ");
}

// ------------------------------------------------------------- buka / tutup

export type OpenState = "open" | "closed" | "unknown";

export type OpenStatus = {
  state: OpenState;
  /** Siap tampil apa adanya, mis. "Buka sampai 21.00" atau "Buka lagi Senin 09.00". */
  label: string;
};

const JAKARTA_TIME_ZONE = "Asia/Jakarta";

/** "Sun"…"Sat" seperti yang dikeluarkan Intl, dipetakan ke `Date.getDay()`. */
const INTL_WEEKDAY: Record<string, DayOfWeek> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":");
  return Number(h) * 60 + Number(m);
}

function toLabel(hhmm: string): string {
  return hhmm.replace(":", ".");
}

/**
 * Hari dan menit menurut jam dinding Batam, bukan jam mesin yang menjalankan kode.
 *
 * Ini bukan kehati-hatian berlebihan: container produksi berjalan di UTC, tujuh jam
 * di belakang WIB. Tanpa penerjemahan ini, toko akan dinyatakan tutup pada pukul
 * 15.00 waktu setempat — dan yang paling merepotkan, hanya pada sebagian jam,
 * sehingga bug-nya terlihat seperti gangguan acak.
 *
 * `Intl` dipakai alih-alih menambahkan tujuh jam secara manual karena ia membaca
 * basis data zona waktu sistem; kalau suatu saat aturannya berubah, kode ini ikut
 * benar tanpa disentuh.
 */
function nowInJakarta(now: Date): { day: DayOfWeek; minutes: number } | null {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: JAKARTA_TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const weekday = parts.find((p) => p.type === "weekday")?.value;
  const hour = parts.find((p) => p.type === "hour")?.value;
  const minute = parts.find((p) => p.type === "minute")?.value;
  if (!weekday || !hour || !minute) return null;

  const day = INTL_WEEKDAY[weekday];
  if (day === undefined) return null;

  // Sebagian mesin menuliskan tengah malam sebagai "24" dengan hour12:false.
  const jam = Number(hour) % 24;
  return { day, minutes: jam * 60 + Number(minute) };
}

/** Hari buka berikutnya setelah `from`, ditelusuri paling jauh satu putaran minggu. */
function nextOpenDay(
  hours: readonly StoreHours[],
  from: DayOfWeek,
): StoreHours | null {
  for (let langkah = 1; langkah <= 7; langkah++) {
    const hari = ((from + langkah) % 7) as DayOfWeek;
    const jam = hours.find((h) => h.dayOfWeek === hari && !h.isClosed);
    if (jam) return jam;
  }
  return null;
}

/**
 * Status buka/tutup toko saat ini.
 *
 * WAJIB dipanggil di klien, bukan saat render server — hasilnya bergantung pada
 * "sekarang", dan HTML yang dibuat server akan berbeda dari yang dihitung ulang
 * peramban beberapa detik kemudian. Pakai `useOpenStatus` di `hooks/`, yang
 * menghitungnya setelah hidrasi.
 *
 * `now` bisa disuntikkan supaya perilakunya bisa diuji tanpa menunggu jam dinding.
 */
export function getOpenStatus(
  hours: readonly StoreHours[],
  now: Date = new Date(),
): OpenStatus {
  if (hours.length === 0) {
    return { state: "unknown", label: "Jam buka belum diisi" };
  }

  const sekarang = nowInJakarta(now);
  if (!sekarang) return { state: "unknown", label: "Jam buka belum diisi" };

  const hariIni = hours.find((h) => h.dayOfWeek === sekarang.day);

  // Hari yang tidak tercatat berbeda dari hari libur: yang satu berarti staff
  // belum mengisinya, yang lain keputusan toko. Menyamakan keduanya membuat
  // halaman berani menyatakan "tutup" atas data yang tidak pernah ada.
  if (!hariIni) return { state: "unknown", label: "Jam buka belum diisi" };

  const berikutnya = () => {
    const lain = nextOpenDay(hours, sekarang.day);
    return lain
      ? `Buka lagi ${DAY_NAMES[lain.dayOfWeek]} ${toLabel(lain.opensAt)}`
      : "Sedang tutup";
  };

  if (hariIni.isClosed) return { state: "closed", label: berikutnya() };

  const buka = toMinutes(hariIni.opensAt);
  const tutup = toMinutes(hariIni.closesAt);

  if (sekarang.minutes < buka) {
    return { state: "closed", label: `Buka pukul ${toLabel(hariIni.opensAt)}` };
  }
  if (sekarang.minutes < tutup) {
    return { state: "open", label: `Buka sampai ${toLabel(hariIni.closesAt)}` };
  }
  return { state: "closed", label: berikutnya() };
}

export type OpeningHoursSpecification = {
  "@type": "OpeningHoursSpecification";
  dayOfWeek: string[];
  opens: string;
  closes: string;
};

/**
 * Bentuk `openingHoursSpecification` untuk JSON-LD. Hari tutup TIDAK disertakan:
 * schema.org menyatakan tutup dengan ketiadaan entri, dan mengirim
 * `opens: "00:00", closes: "00:00"` justru terbaca sebagai buka tengah malam.
 */
export function toOpeningHoursSpecification(
  hours: readonly StoreHours[],
): OpeningHoursSpecification[] {
  return groupConsecutive(hours)
    .filter((b) => !b.isClosed)
    .map((b) => ({
      "@type": "OpeningHoursSpecification" as const,
      dayOfWeek: b.days.map((d) => SCHEMA_DAY_NAMES[d]),
      opens: b.opensAt,
      closes: b.closesAt,
    }));
}
