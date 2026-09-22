/**
 * Label breadcrumb untuk halaman kebijakan.
 *
 * Keempat halaman lama menulis labelnya sendiri secara harfiah — judulnya
 * "Kebijakan Pengiriman", breadcrumb-nya "Pengiriman" — karena breadcrumb sudah
 * berada di bawah "Beranda › Kebijakan" dan mengulang katanya jadi
 * "Kebijakan Kebijakan Pengiriman".
 *
 * Diturunkan dari judul, bukan disimpan sebagai kolom sendiri: satu isian lagi
 * di formulir admin untuk sesuatu yang bisa dihitung hanya akan dikosongkan
 * staff, dan kosongnya baru ketahuan setelah halaman tayang.
 */
export function policyBreadcrumbLabel(title: string): string {
  const tanpaPrefiks = title.replace(/^kebijakan\s+/i, "").trim()

  // Judul yang memang hanya "Kebijakan" tidak boleh menghasilkan breadcrumb
  // kosong — kembalikan judul aslinya.
  return tanpaPrefiks || title
}
