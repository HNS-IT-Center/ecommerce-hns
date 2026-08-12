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

/** Yang harus diketik ulang staff untuk mengonfirmasi penghapusan. */
export const DELETE_CONFIRMATION_WORD = "HAPUS PERMANEN"
