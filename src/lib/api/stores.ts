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
import { getPrisma } from "@/lib/prisma/client";
import type { Store } from "@prisma/client";
import {
  isDayOfWeek,
  isValidTime,
  sortForDisplay,
  type StoreHours,
} from "@/lib/utils/opening-hours";

/**
 * Toko beserta jam bukanya — bentuk yang dipakai seluruh halaman.
 *
 * `latitude`/`longitude` sengaja ditulis ulang jadi `number`. Prisma
 * mengembalikan `Decimal` dari decimal.js, dan objek itu tidak bisa dilempar
 * lintas batas Server Component tanpa serialisasi, juga tidak bisa langsung
 * dipakai membangun URL peta. Mengubahnya sekali di sini lebih baik daripada
 * setiap pemanggil mengingat untuk memanggil `.toNumber()`.
 */
export type StoreWithHours = Omit<Store, "latitude" | "longitude"> & {
  latitude: number | null;
  longitude: number | null;
  hours: StoreHours[];
};

export type StoreInput = {
  id: string;
  name: string;
  address: string;
  hours: StoreHours[];
  mapsUrl: string;
  /** Apa adanya seperti diketik staff; dinormalisasi saat membangun tautan wa.me. */
  phone: string;
  /** `null` berarti belum diisi — peta jatuh ke pencarian alamat. */
  latitude: number | null;
  longitude: number | null;
  googlePlaceId: string | null;
  sortOrder: number;
};

/**
 * Jam selalu ikut terbaca dan sudah diurutkan mulai Senin, jadi tidak ada
 * halaman yang perlu mengingat untuk menyertakannya sendiri — persis alasan
 * yang sama kenapa penyaringan `deletedAt` dikumpulkan di berkas ini.
 */
function withHours(
  row: Store & {
    hours: {
      dayOfWeek: number;
      isClosed: boolean;
      opensAt: string;
      closesAt: string;
    }[];
  },
): StoreWithHours {
  const jam = row.hours
    .filter((h) => isDayOfWeek(h.dayOfWeek))
    .map((h) => ({
      dayOfWeek: h.dayOfWeek as StoreHours["dayOfWeek"],
      isClosed: h.isClosed,
      opensAt: h.opensAt,
      closesAt: h.closesAt,
    }));

  return {
    ...row,
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    hours: sortForDisplay(jam),
  };
}

/** Hanya toko yang belum dihapus. Dipakai admin maupun storefront. */
export async function getStores(): Promise<StoreWithHours[]> {
  const rows = await getPrisma().store.findMany({
    where: { deletedAt: null },
    orderBy: { sortOrder: "asc" },
    include: { hours: true },
  });
  return rows.map(withHours);
}

/**
 * Satu toko yang belum dihapus, atau null.
 *
 * Menyaring `deletedAt` juga di sini, bukan hanya di daftar. Tanpa itu, halaman
 * sunting masih bisa dibuka lewat URL langsung untuk toko yang sudah dihapus,
 * dan menyimpannya akan menghidupkannya kembali tanpa siapa pun memutuskannya.
 */
export async function getStore(id: string): Promise<StoreWithHours | null> {
  const row = await getPrisma().store.findFirst({
    where: { id, deletedAt: null },
    include: { hours: true },
  });
  return row ? withHours(row) : null;
}

/** Kesalahan yang layak ditampilkan apa adanya ke staff, bukan ditelan jadi 500. */
export class StoreOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreOperationError";
  }
}

/**
 * Nama toko wajib unik di antara toko yang masih hidup.
 *
 * Bukan aturan kosmetik. Nama itu tampil sebagai judul kartu di halaman lokasi,
 * dan sejak peta beralih memakai nama sebagai kunci pencarian, dua nama identik
 * membuat Google berpotensi menunjuk satu listing yang sama untuk dua cabang
 * berbeda — pelanggan diarahkan ke toko yang salah tanpa ada yang menyadarinya.
 *
 * Toko yang sudah dihapus dikecualikan: namanya tidak tampil di mana pun, jadi
 * menahan nama itu selamanya hanya menghalangi tanpa melindungi apa pun.
 *
 * Perbandingannya tidak peka huruf besar-kecil karena kolomnya memakai
 * collation `utf8mb4_unicode_ci` — "Nagoya Hill" dan "NAGOYA HILL" dianggap
 * sama oleh MariaDB, dan memang itu yang diinginkan di sini.
 */
async function assertNameAvailable(
  name: string,
  exceptId?: string,
): Promise<void> {
  const clash = await getPrisma().store.findFirst({
    where: {
      name,
      deletedAt: null,
      ...(exceptId ? { NOT: { id: exceptId } } : {}),
    },
    select: { id: true },
  });

  if (clash) {
    throw new StoreOperationError(
      `Sudah ada toko bernama "${name}" (id: ${clash.id}). Pakai nama yang berbeda supaya pelanggan bisa membedakan keduanya.`,
    );
  }
}

function assertFilled(input: StoreInput): void {
  const kosong = (
    ["id", "name", "address", "mapsUrl", "phone"] as const
  ).filter((key) => input[key] === "");
  if (kosong.length > 0) {
    throw new StoreOperationError(
      `Kolom berikut wajib diisi: ${kosong.join(", ")}.`,
    );
  }
  if (!Number.isFinite(input.sortOrder)) {
    throw new StoreOperationError("Urutan tampil harus berupa angka.");
  }
  assertCoordinatesValid(input.latitude, input.longitude);
  assertHoursValid(input.hours);
}

/**
 * Koordinat diperiksa berpasangan, bukan sendiri-sendiri.
 *
 * Satu angka tanpa pasangannya tidak menunjuk ke mana pun, tapi cukup untuk
 * membuat kode di hilir mengira koordinatnya ada — dan peta akan menggambar
 * titik di tengah laut alih-alih memberi tahu bahwa isiannya belum lengkap.
 *
 * Rentangnya dijaga juga: lintang di luar ±90 dan bujur di luar ±180 bukan
 * sekadar salah, ia diterima diam-diam oleh kolom Decimal dan baru terlihat
 * salah setelah peta tampil kosong.
 */
function assertCoordinatesValid(
  latitude: number | null,
  longitude: number | null,
): void {
  if (latitude === null && longitude === null) return;

  if (latitude === null || longitude === null) {
    throw new StoreOperationError(
      "Latitude dan longitude harus diisi berpasangan — satu tanpa yang lain tidak menunjuk lokasi mana pun.",
    );
  }
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new StoreOperationError("Latitude harus angka antara -90 dan 90.");
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new StoreOperationError("Longitude harus angka antara -180 dan 180.");
  }
}

/**
 * Jam diperiksa di sini, bukan hanya di formulir. Formulir bisa dilewati —
 * server action punya alamatnya sendiri — dan jam yang salah bentuk tidak
 * sekadar tampil jelek: ia masuk ke structured data dan membuat Google
 * menampilkan jam buka yang keliru di hasil pencarian.
 */
function assertHoursValid(hours: StoreHours[]): void {
  const hariTerlihat = new Set<number>();

  for (const jam of hours) {
    if (!isDayOfWeek(jam.dayOfWeek)) {
      throw new StoreOperationError(
        `Hari tidak sah: ${jam.dayOfWeek}. Nilainya harus 0 (Minggu) sampai 6 (Sabtu).`,
      );
    }
    if (hariTerlihat.has(jam.dayOfWeek)) {
      throw new StoreOperationError("Ada hari yang tercatat dua kali.");
    }
    hariTerlihat.add(jam.dayOfWeek);

    // Hari tutup tidak perlu jam yang masuk akal — jamnya memang tidak dipakai.
    if (jam.isClosed) continue;

    if (!isValidTime(jam.opensAt) || !isValidTime(jam.closesAt)) {
      throw new StoreOperationError(
        `Jam untuk hari ke-${jam.dayOfWeek} harus berformat HH:MM 24 jam, mis. 09:00.`,
      );
    }
    if (jam.opensAt >= jam.closesAt) {
      throw new StoreOperationError(
        `Jam tutup harus lebih malam dari jam buka (hari ke-${jam.dayOfWeek}: ${jam.opensAt}–${jam.closesAt}).`,
      );
    }
  }
}

export async function createStore(input: StoreInput): Promise<void> {
  assertFilled(input);

  // Id diperiksa TANPA menyaring `deletedAt`: ia kunci utama tabel, jadi baris
  // yang sudah dihapus pun masih memegangnya. Tanpa pemeriksaan ini staff cuma
  // melihat pelanggaran constraint dari database, yang tidak memberi tahu apa
  // pun tentang apa yang harus mereka perbuat.
  const existing = await getPrisma().store.findUnique({
    where: { id: input.id },
    select: { deletedAt: true },
  });
  if (existing) {
    throw new StoreOperationError(
      existing.deletedAt
        ? `Id "${input.id}" masih dipegang toko yang sudah dihapus. Pakai id lain.`
        : `Id "${input.id}" sudah dipakai toko lain.`,
    );
  }

  await assertNameAvailable(input.name);

  const { hours, ...store } = input;
  await getPrisma().store.create({
    data: { ...store, hours: { create: hours } },
  });
}

export async function updateStore(input: StoreInput): Promise<void> {
  assertFilled(input);

  const { id, hours, ...data } = input;

  const target = await getPrisma().store.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!target) {
    throw new StoreOperationError(
      "Toko tidak ditemukan, atau sudah dihapus orang lain.",
    );
  }

  await assertNameAvailable(data.name, id);

  /**
   * Jam ditulis ulang seluruhnya dalam satu transaksi, bukan ditambal per baris.
   *
   * Formulir mengirim gambaran utuh tujuh hari, jadi menyamakan keadaan lebih
   * sederhana dan lebih jujur daripada mencocokkan baris mana yang berubah —
   * dan transaksinya memastikan toko tidak pernah terlihat tanpa jam sama sekali
   * di antara penghapusan dan penulisan ulang.
   */
  await getPrisma().$transaction([
    getPrisma().store.update({ where: { id }, data }),
    getPrisma().storeHours.deleteMany({ where: { storeId: id } }),
    getPrisma().storeHours.createMany({
      data: hours.map((h) => ({ ...h, storeId: id })),
    }),
  ]);
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
export async function softDeleteStore(
  id: string,
  deletedBy: string,
): Promise<number> {
  const { count } = await getPrisma().store.updateMany({
    where: { id, deletedAt: null },
    data: { deletedAt: new Date(), deletedBy },
  });
  return count;
}
