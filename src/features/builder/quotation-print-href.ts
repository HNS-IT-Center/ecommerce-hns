/**
 * Alamat halaman cetak, lengkap dengan token penawarannya.
 *
 * `t=` bukan hiasan: sejak 23 September 2026 halaman cetak menolak `?kode=`
 * telanjang dari siapa pun yang tidak punya sesi staff. Yang menekan Print di
 * builder sebagian besar justru PENGUNJUNG anonim, jadi tanpa token mereka akan
 * ditolak membuka dokumen yang baru saja mereka terbitkan sendiri.
 *
 * Token boleh kosong hanya untuk quotation lama yang belum di-backfill; dalam
 * hal itu `?t=` tidak ikut ditulis dan yang membuka harus staff.
 *
 * Dipakai builder dan halaman paket PC Prebuild — keduanya membuka halaman
 * cetak yang sama setelah menerbitkan quotation.
 */
export function printHref(code: string, token: string): string {
  const alamat = `/build-pc/print?kode=${encodeURIComponent(code)}`
  return token ? `${alamat}&t=${encodeURIComponent(token)}` : alamat
}
