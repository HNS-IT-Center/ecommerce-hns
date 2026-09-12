/**
 * Bentuk state formulir panel pelanggan.
 *
 * Terpisah dari `actions.ts` karena berkas 'use server' hanya boleh mengekspor
 * fungsi async — konvensi yang sama dipakai layar toko, kategori, dan login.
 */
export type CustomerActionState = { error: string | null; success: string | null }

export const EMPTY_CUSTOMER_STATE: CustomerActionState = { error: null, success: null }

/**
 * Panjang minimum alasan penghapusan, dihitung dalam KATA, bukan karakter.
 *
 * Batas karakter gampang dipenuhi tanpa isi ("aaaaaaaaaa"), sedangkan menuntut
 * beberapa kata memaksa kalimat yang setidaknya berbentuk keterangan. Ini bukan
 * jaminan mutu — tidak ada validasi yang bisa memaksa orang menulis alasan yang
 * jujur — tapi cukup untuk menutup jalur "tekan saja Enter supaya cepat".
 *
 * Kolom yang boleh kosong akan selalu kosong, dan alasan yang selalu kosong
 * membuat seluruh tabel audit tidak ada gunanya.
 */
export const MIN_REASON_WORDS = 3
export const MAX_REASON_LENGTH = 500

/**
 * Konfirmasi penghapusan menuntut staff mengetik ulang EMAIL pelanggan, jadi
 * tidak ada kata sandi seragam yang disimpan di sini.
 *
 * Sempat ada `DELETE_CONFIRMATION_WORD = "HAPUS PERMANEN"`, lalu diganti: kata
 * seragam cuma menguji ketelitian mengetik, sedangkan mengetik email yang benar
 * memaksa staff memastikan ia menghapus ORANG YANG TEPAT. Kekeliruan yang
 * paling mungkin di sini bukan menekan tombol tanpa sengaja, melainkan
 * menghapus baris yang salah dari daftar.
 *
 * Pembandingnya dibaca dari database di dalam server action, BUKAN dikirim
 * lewat formulir — kalau ikut formulir, pengirim bisa mengubah keduanya
 * sekaligus dan konfirmasinya cuma mencocokkan dirinya sendiri.
 */
