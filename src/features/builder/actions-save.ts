"use server";

import { revalidatePath } from "next/cache";

import { getCurrentCustomer } from "@/lib/auth/customer";
import {
  createSavedBuild,
  deleteSavedBuild,
  refreshBuildPrices,
  updateSavedBuild,
  type CreateSavedBuildInput,
  type UpdateSavedBuildResult,
} from "@/lib/api/saved-pc-builds";

/**
 * Simpan rakitan yang sedang disusun di /build-pc ke akun pelanggan.
 *
 * Sama seperti `prepareBuildWhatsApp`: klien hanya mengirim id komponen,
 * kuantitas, dan label langkah — TIDAK ADA harga yang dikirim dari sini.
 * Harga acuan diisi di server dari katalog saat itu juga (lihat
 * `createSavedBuild`), lalu dibandingkan dengan harga terkini setiap kali
 * rakitan dibuka. Lihat CLAUDE.md §2.7 dan catatan di saved-pc-builds.ts.
 */

export type SaveBuildInput = {
  productId: number;
  quantity: number;
  stepId: string;
  stepName: string;
};

export type SaveBuildResult =
  | { ok: true; id: string; name: string }
  | { ok: false; error: string };

/**
 * Hasil "Simpan Perubahan". `gone` diteruskan apa adanya dari
 * `UpdateSavedBuildResult` — artinya barisnya sudah tidak ada, dan dialognya
 * menutup jalan menimpa alih-alih menyuruh mencoba lagi.
 */
export type UpdateBuildResult =
  | { ok: true; name: string }
  | (Extract<UpdateSavedBuildResult, { ok: false }>);

const DEFAULT_NAME_PREFIX = "Rakitan";

function fallbackName(): string {
  const now = new Date();
  return `${DEFAULT_NAME_PREFIX} ${now.toLocaleDateString("id-ID", { day: "numeric", month: "long" })}`;
}

export async function saveBuildAction(name: string, items: SaveBuildInput[]): Promise<SaveBuildResult> {
  const customer = await getCurrentCustomer();
  if (!customer) {
    return { ok: false, error: "Masuk dengan akun Google dulu untuk menyimpan rakitan." };
  }

  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: "Belum ada komponen yang dipilih." };
  }

  const trimmedName = name.trim().slice(0, 120);
  const finalName = trimmedName || fallbackName();

  const refs: CreateSavedBuildInput[] = items.map((item) => ({
    stepId: item.stepId,
    stepName: item.stepName,
    productId: item.productId,
    quantity: item.quantity,
  }));

  const hasil = await createSavedBuild(customer.id, finalName, refs);

  if (!hasil.ok) return hasil;

  invalidasiHalamanRakitan();

  // Alasan `name` ikut pulang: lihat catatan di `updateSavedBuildAction`.
  return { ok: true, id: hasil.id, name: finalName };
}

/**
 * Buang salinan `/profile` (dan halaman detail rakitan) dari cache Next.
 *
 * Tanpa ini, rakitan yang BARU SAJA tersimpan tidak muncul di "Rakitan
 * Tersimpan": daftarnya dirender di server, dan hasil render itu masih
 * tersimpan di Router Cache milik peramban dari kunjungan sebelumnya. Tombol
 * "Lihat Rakitan Saya" lalu mengantar pelanggan ke daftar versi lama —
 * rakitannya sudah ada di database, hanya tidak terlihat oleh yang menyimpannya.
 * Dari sisi pelanggan itu tidak bisa dibedakan dari "simpannya gagal", dan
 * satu-satunya jalan keluar adalah memuat ulang halaman secara manual.
 *
 * Dipanggil dari SELURUH aksi yang mengubah daftar rakitan (simpan, hapus,
 * perbarui harga acuan), bukan hanya simpan: ketiganya mengubah apa yang
 * seharusnya tampil di halaman yang sama.
 *
 * `revalidatePath` di sini melengkapi `router.refresh()` di sisi klien, tidak
 * menggantikannya — yang satu menyegarkan sesi yang sedang berjalan, yang lain
 * menjamin permintaan berikutnya tidak dilayani dari cache server.
 */
function invalidasiHalamanRakitan() {
  revalidatePath("/profile");
  revalidatePath("/profile/rakitan/[id]", "page");
}

export async function deleteSavedBuildAction(id: string): Promise<{ ok: boolean }> {
  const customer = await getCurrentCustomer();
  if (!customer) return { ok: false };

  const deleted = await deleteSavedBuild(id, customer.id);
  if (deleted) invalidasiHalamanRakitan();

  return { ok: deleted };
}

/**
 * Menimpa rakitan yang sedang dibuka lewat `/build-pc?build=<id>`.
 *
 * Bentuk masukannya sama persis dengan `saveBuildAction` — hanya id komponen,
 * kuantitas, dan label langkah. Harga acuan tetap diisi server dari katalog
 * (CLAUDE.md §2.7), jadi "timpa" tidak membuka satu pun jalan baru bagi angka
 * yang datang dari klien.
 *
 * Nama ikut diperbarui: dialognya memuat nama lama dan membolehkannya diubah,
 * sehingga mengganti nama tidak perlu jadi perjalanan terpisah ke halaman
 * detail.
 */
export async function updateSavedBuildAction(
  id: string,
  name: string,
  items: SaveBuildInput[]
): Promise<UpdateBuildResult> {
  const customer = await getCurrentCustomer();
  if (!customer) {
    return { ok: false, error: "Sesi Anda sudah berakhir. Masuk lagi untuk menyimpan." };
  }

  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: "Belum ada komponen yang dipilih." };
  }

  const trimmedName = name.trim().slice(0, 120);
  const finalName = trimmedName || fallbackName();

  const refs: CreateSavedBuildInput[] = items.map((item) => ({
    stepId: item.stepId,
    stepName: item.stepName,
    productId: item.productId,
    quantity: item.quantity,
  }));

  const hasil = await updateSavedBuild(id, customer.id, finalName, refs);

  if (!hasil.ok) return hasil;

  invalidasiHalamanRakitan();

  // Nama BALIK dari server, bukan ditebak ulang di klien: kalau kolom nama
  // dikosongkan, yang tersimpan adalah `fallbackName()` di atas, dan bar
  // "Mengedit rakitan tersimpan" harus menyebut nama yang benar-benar ada di
  // database — bukan nama sementara yang cuma hidup di layar.
  return { ok: true, name: finalName };
}

/** Dipakai tombol "Perbarui Harga Acuan" di halaman detail rakitan tersimpan. */
export async function refreshBuildPricesAction(id: string): Promise<{ ok: boolean }> {
  const customer = await getCurrentCustomer();
  if (!customer) return { ok: false };

  const ok = await refreshBuildPrices(id, customer.id);
  if (ok) invalidasiHalamanRakitan();

  return { ok };
}
