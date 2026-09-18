/**
 * Ambang yang menentukan warna angka FPS. Bukan selera — ini batas yang
 * dirasakan pemain:
 *
 *   30  batas layak dimainkan
 *   60  batas terasa mulus
 *   100 ranah layar berrefresh tinggi
 *
 * Dipakai chart matriks (panel admin dan halaman paket) dan daftar FPS di kartu
 * `/pc-prebuild`. SATU tempat, karena tiga daftar ambang yang terpisah akan
 * pelan-pelan berbeda — dan paket yang sama akan terlihat "hijau" di satu layar
 * dan "kuning" di layar sebelahnya.
 */
export type FpsTone = { bar: string; text: string }

/**
 * Tingkat FPS menurut ambang di atas. Layar memetakannya ke kelas Tailwind
 * (`fpsTone`), lembar cetak PDF ke warna tinta — ambangnya tetap satu.
 */
export type FpsLevel = "high" | "smooth" | "playable" | "low"

export function fpsLevel(avg: number): FpsLevel {
  if (avg >= 100) return "high"
  if (avg >= 60) return "smooth"
  if (avg >= 30) return "playable"
  return "low"
}

const TONES: Record<FpsLevel, FpsTone> = {
  high: { bar: "bg-brand-green", text: "text-brand-green" },
  smooth: { bar: "bg-success", text: "text-success" },
  playable: { bar: "bg-warning", text: "text-warning" },
  low: { bar: "bg-sale-red", text: "text-sale-red" },
}

export function fpsTone(avg: number): FpsTone {
  return TONES[fpsLevel(avg)]
}
