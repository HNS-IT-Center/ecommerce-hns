/**
 * Potongan harga untuk SATU PAKET PC Prebuild, ditetapkan staff di panel admin.
 *
 * ## Kenapa ini sah menurut CLAUDE.md §2.7
 *
 * Aturannya melarang harga yang DIKARANG kode — perkalian persen, "harga
 * member". Potongan paket bukan itu: angkanya ditulis staff sebagai data di
 * `PC_PREBUILD_CONFIG`, sama kedudukannya dengan `salePrice` produk. Kode hanya
 * mengurangkan angka katalog dengan angka yang ditetapkan staff, dan
 * pengurangan itu dikerjakan di SATU rumus (`applyPrebuildDiscount`) yang dipakai
 * halaman paket, keranjang, dan server checkout sekaligus.
 *
 * ## Nominal, bukan harga jadi
 *
 * Yang disimpan besar potongannya (Rp 500.000), bukan harga akhirnya
 * (Rp 14.500.000). Keputusan PIC, 17 September 2026: harga komponen di katalog
 * naik-turun, dan potongan nominal ikut bergerak bersamanya. Harga jadi yang
 * dibekukan akan membuat HNS rugi diam-diam saat komponen naik, atau menjual
 * paket LEBIH MAHAL dari harga normalnya saat komponen turun.
 *
 * Potongan yang sama berlaku untuk kombinasi pilihan tukar mana pun.
 *
 * ## Satu penjaga
 *
 * Potongan yang menyamai atau melebihi total normal TIDAK diberlakukan sama
 * sekali — bukan dijepit ke nol. Paket seharga Rp 0 bukan harga yang bisa
 * dipenuhi CS; yang terjadi di sana hampir selalu harga komponen yang jatuh
 * jauh sesudah potongannya ditetapkan, dan panel admin yang memberi tahu staff.
 *
 * Berkas ini tidak mengimpor apa pun, jadi Client Component boleh memakainya
 * (lihat docs/11-pc-prebuild.md §7 soal `limits.ts`).
 */

export type PrebuildDiscount = {
  /** Rupiah per SATU paket. Selalu bilangan bulat positif. */
  amount: number
  /**
   * Hari terakhir potongan berlaku, `YYYY-MM-DD`, dibaca sampai akhir hari itu
   * waktu Batam (WIB). `null` = berlaku tanpa batas waktu.
   */
  endsAt: string | null
}

/** Jauh di atas harga PC mana pun; sekadar menolak salah ketik berlebih nol. */
export const MAX_PREBUILD_DISCOUNT = 1_000_000_000

const TANGGAL = /^\d{4}-\d{2}-\d{2}$/

/** Bentuk mentah dari JSON → potongan yang sah, atau `null`. */
export function parsePrebuildDiscount(value: unknown): PrebuildDiscount | null {
  if (typeof value !== "object" || value === null) return null
  const raw = value as Record<string, unknown>

  if (typeof raw.amount !== "number" || !Number.isFinite(raw.amount)) return null
  const amount = Math.min(MAX_PREBUILD_DISCOUNT, Math.round(raw.amount))
  if (amount <= 0) return null

  const endsAt =
    typeof raw.endsAt === "string" && TANGGAL.test(raw.endsAt) && discountEndMs(raw.endsAt) !== null
      ? raw.endsAt
      : null

  return { amount, endsAt }
}

/** Akhir hari `YYYY-MM-DD` dalam WIB (UTC+7), dalam milidetik. */
function discountEndMs(endsAt: string): number | null {
  const ms = Date.parse(`${endsAt}T23:59:59.999+07:00`)
  return Number.isFinite(ms) ? ms : null
}

/** Potongan masih dalam masa berlakunya. */
export function isPrebuildDiscountActive(
  discount: PrebuildDiscount | null | undefined,
  now: number
): discount is PrebuildDiscount {
  if (!discount) return false
  if (discount.endsAt === null) return true
  const akhir = discountEndMs(discount.endsAt)
  return akhir !== null && now <= akhir
}

/**
 * Potongan yang BENAR-BENAR berlaku terhadap total normal satu paket.
 *
 * `amount` di sini sudah potongan yang aktif (lolos `isPrebuildDiscountActive`)
 * — penyaringan tanggal dikerjakan server, sekali, supaya halaman dan keranjang
 * tidak menilai "masih berlaku" dengan jam yang berbeda.
 */
export function applicablePrebuildDiscount(amount: number, normalTotal: number): number {
  if (!(amount > 0) || !(normalTotal > 0)) return 0
  return amount < normalTotal ? amount : 0
}

/** Total satu paket setelah potongan. */
export function applyPrebuildDiscount(amount: number, normalTotal: number): number {
  return normalTotal - applicablePrebuildDiscount(amount, normalTotal)
}

/**
 * `2026-09-30` → `30 Sep 2026` / `30 September 2026`.
 *
 * Dibaca sebagai tanggal KALENDER (zona UTC di kedua sisi), bukan jam — tanpa
 * itu, tanggal yang sama bisa tercetak mundur sehari di peramban yang zona
 * waktunya di barat UTC.
 */
export function formatDiscountEndDate(endsAt: string, month: "short" | "long" = "long"): string {
  const [tahun, bulan, hari] = endsAt.split("-").map(Number)
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month,
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(tahun, bulan - 1, hari)))
}
