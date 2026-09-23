/**
 * Kelas bersama untuk tombol aksi di halaman detail quotation.
 *
 * Ada karena tombol-tombol itu lahir bertahap — Cetak ulang dan Revisi lebih
 * dulu, lalu Follow up, lalu Harga Terbaru dan DP — dan setiap tambahan membawa
 * tinggi, padding, serta ukuran huruf versinya sendiri. Hasilnya satu baris
 * berisi lima tombol dengan lima ukuran berbeda.
 *
 * Modul biasa, bukan komponen: sebagiannya `<Link>` milik halaman server,
 * sebagiannya `<button>` di dalam komponen klien. Yang perlu disamakan cuma
 * kelasnya, dan membungkus keduanya jadi satu komponen hanya akan memaksa
 * tautan berperilaku seperti tombol.
 *
 * `w-full sm:w-auto` disengaja: di HP tombolnya mengisi satu kolom grid dua
 * kolom, di layar lebar ia menyusut ke lebar isinya.
 */
const DASAR =
  "inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"

/** Wadah tombol: dua kolom rapi di HP, sebaris mengalir di layar lebar. */
export const QUOTE_ACTION_ROW = "grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"

export const QUOTE_ACTION_OUTLINE = `${DASAR} border border-input hover:bg-muted`
export const QUOTE_ACTION_PRIMARY = `${DASAR} bg-primary text-primary-foreground hover:bg-primary/90`
export const QUOTE_ACTION_WHATSAPP = `${DASAR} bg-whatsapp text-white hover:brightness-95`
export const QUOTE_ACTION_GREEN = `${DASAR} bg-brand-green text-white hover:bg-brand-green/90`
