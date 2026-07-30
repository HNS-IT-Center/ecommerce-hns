/**
 * Lapisan data untuk tabel `stores`.
 *
 * Dibuat supaya penyaringan `deletedAt` punya SATU tempat. Kalau saringannya
 * ditulis di masing-masing halaman, halaman berikutnya yang dibuat orang lain
 * akan melewatkannya — dan yang muncul bukan galat, melainkan toko yang sudah
 * dihapus tampil kembali seolah tidak pernah dihapus. Kegagalan yang senyap
 * seperti itu baru ketahuan setelah ada yang mengeluh.
 *
 * `revalidateTag`/`revalidatePath` sengaja TIDAK dipanggil dari sini, mengikuti
 * konvensi yang sama seperti modul kategori: pembersihan cache milik lapisan
 * action, supaya fungsi di sini tetap bisa dipakai dari script.
 */
import { getPrisma } from "@/lib/prisma/client"
import type { Store } from "@prisma/client"

export type StoreInput = {
  id: string
  name: string
  address: string
  hours: string
  mapsUrl: string
  phone: string
  sortOrder: number
}

/** Hanya toko yang belum dihapus. Dipakai admin maupun (nanti) storefront. */
export async function getStores(): Promise<Store[]> {
  return getPrisma().store.findMany({
    where: { deletedAt: null },
    orderBy: { sortOrder: "asc" },
  })
}

/**
 * Satu toko yang belum dihapus, atau null.
 *
 * Menyaring `deletedAt` juga di sini, bukan hanya di daftar. Tanpa itu, halaman
 * sunting masih bisa dibuka lewat URL langsung untuk toko yang sudah dihapus,
 * dan menyimpannya akan menghidupkannya kembali tanpa siapa pun memutuskannya.
 */
export async function getStore(id: string): Promise<Store | null> {
  return getPrisma().store.findFirst({ where: { id, deletedAt: null } })
}

export async function createStore(input: StoreInput): Promise<void> {
  await getPrisma().store.create({ data: input })
}

export async function updateStore(input: StoreInput): Promise<void> {
  const { id, ...data } = input
  await getPrisma().store.update({ where: { id }, data })
}

/**
 * Tandai terhapus, JANGAN hapus barisnya.
 *
 * Sebelum ini `deleteStore` memanggil `prisma.store.delete()` — alamat, jam
 * buka, dan nomor WA yang dikumpulkan bertahun-tahun lenyap tanpa jejak, dan
 * tanpa konfirmasi apa pun di layar. Sekarang barisnya tetap ada beserta
 * keterangan siapa yang menghapusnya.
 *
 * `updateMany` dengan syarat `deletedAt: null`, bukan `update` biasa: kalau dua
 * orang menekan Hapus pada toko yang sama, yang kedua tidak boleh menimpa
 * catatan siapa yang sebenarnya menghapus lebih dulu. Kembaliannya jumlah baris
 * yang benar-benar berubah, jadi pemanggilnya bisa tahu bedanya.
 */
export async function softDeleteStore(id: string, deletedBy: string): Promise<number> {
  const { count } = await getPrisma().store.updateMany({
    where: { id, deletedAt: null },
    data: { deletedAt: new Date(), deletedBy },
  })
  return count
}
