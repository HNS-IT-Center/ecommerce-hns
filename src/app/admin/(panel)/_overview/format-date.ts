/**
 * Tanggal & jam untuk kartu dashboard, dikunci ke WIB.
 *
 * Zona waktunya ditulis eksplisit karena kartu berpenyaring dirender dua kali —
 * di server (Vercel berjalan dalam UTC) dan di browser staff (WIB). Tanpa zona
 * yang sama keduanya menghasilkan teks berbeda, React melaporkan hydration
 * mismatch, dan log pukul 01.00 WIB tampil bertanggal kemarin.
 */
const DATE_TIME = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
})

export function formatDashboardDate(value: Date | string) {
  return DATE_TIME.format(new Date(value))
}
