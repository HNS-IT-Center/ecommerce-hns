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
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type StoreHours = {
  dayOfWeek: DayOfWeek
  isClosed: boolean
  /** "09:00", 24 jam. */
  opensAt: string
  /** "21:00", 24 jam. */
  closesAt: string
}

export const DAYS: readonly DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6]

/** Nama untuk pelanggan. Indeksnya sengaja sama dengan `dayOfWeek`. */
export const DAY_NAMES: readonly string[] = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
]

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
]

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value)
}

export function isDayOfWeek(value: number): value is DayOfWeek {
  return Number.isInteger(value) && value >= 0 && value <= 6
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
  const urutan = (d: DayOfWeek) => (d === 0 ? 7 : d)
  return [...hours].sort((a, b) => urutan(a.dayOfWeek) - urutan(b.dayOfWeek))
}

type Blok = { days: DayOfWeek[]; isClosed: boolean; opensAt: string; closesAt: string }

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
  const urut = sortForDisplay(hours)
  const blok: Blok[] = []

  for (const jam of urut) {
    const terakhir = blok[blok.length - 1]
    const sambung =
      terakhir &&
      terakhir.isClosed === jam.isClosed &&
      terakhir.opensAt === jam.opensAt &&
      terakhir.closesAt === jam.closesAt &&
      bersebelahan(terakhir.days[terakhir.days.length - 1], jam.dayOfWeek)

    if (sambung) terakhir.days.push(jam.dayOfWeek)
    else
      blok.push({
        days: [jam.dayOfWeek],
        isClosed: jam.isClosed,
        opensAt: jam.opensAt,
        closesAt: jam.closesAt,
      })
  }

  return blok
}

/** Bersebelahan menurut urutan tampil (Senin…Minggu), jadi Sabtu→Minggu tersambung. */
function bersebelahan(sebelum: DayOfWeek, sesudah: DayOfWeek): boolean {
  const urutan = (d: DayOfWeek) => (d === 0 ? 7 : d)
  return urutan(sesudah) - urutan(sebelum) === 1
}

function labelHari(days: DayOfWeek[]): string {
  if (days.length === 1) return DAY_NAMES[days[0]]
  return `${DAY_NAMES[days[0]]}–${DAY_NAMES[days[days.length - 1]]}`
}

/**
 * Teks untuk pelanggan, mis. "Senin–Sabtu 09.00–21.00 · Minggu 10.00–21.00".
 * Titik dipakai sebagai pemisah jam mengikuti kebiasaan penulisan Indonesia.
 */
export function formatOpeningHours(hours: readonly StoreHours[]): string {
  if (hours.length === 0) return "Jam buka belum diisi"

  return groupConsecutive(hours)
    .map((b) => {
      const hari = labelHari(b.days)
      if (b.isClosed) return `${hari} tutup`
      return `${hari} ${b.opensAt.replace(":", ".")}–${b.closesAt.replace(":", ".")}`
    })
    .join(" · ")
}

export type OpeningHoursSpecification = {
  "@type": "OpeningHoursSpecification"
  dayOfWeek: string[]
  opens: string
  closes: string
}

/**
 * Bentuk `openingHoursSpecification` untuk JSON-LD. Hari tutup TIDAK disertakan:
 * schema.org menyatakan tutup dengan ketiadaan entri, dan mengirim
 * `opens: "00:00", closes: "00:00"` justru terbaca sebagai buka tengah malam.
 */
export function toOpeningHoursSpecification(
  hours: readonly StoreHours[]
): OpeningHoursSpecification[] {
  return groupConsecutive(hours)
    .filter((b) => !b.isClosed)
    .map((b) => ({
      "@type": "OpeningHoursSpecification" as const,
      dayOfWeek: b.days.map((d) => SCHEMA_DAY_NAMES[d]),
      opens: b.opensAt,
      closes: b.closesAt,
    }))
}
