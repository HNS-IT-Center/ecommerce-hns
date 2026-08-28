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

export function fpsTone(avg: number): FpsTone {
  if (avg >= 100) return { bar: "bg-brand-green", text: "text-brand-green" }
  if (avg >= 60) return { bar: "bg-success", text: "text-success" }
  if (avg >= 30) return { bar: "bg-warning", text: "text-warning" }
  return { bar: "bg-sale-red", text: "text-sale-red" }
}
