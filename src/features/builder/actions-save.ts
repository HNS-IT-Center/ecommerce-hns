"use server";

import { getCurrentCustomer } from "@/lib/auth/customer";
import {
  createSavedBuild,
  deleteSavedBuild,
  getSavedBuildForBuilder,
  refreshBuildPrices,
  type CreateSavedBuildInput,
  type BuilderReadySelections,
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

export type SaveBuildResult = { ok: true; id: string } | { ok: false; error: string };

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

  return createSavedBuild(customer.id, finalName, refs);
}

export async function deleteSavedBuildAction(id: string): Promise<{ ok: boolean }> {
  const customer = await getCurrentCustomer();
  if (!customer) return { ok: false };

  const deleted = await deleteSavedBuild(id, customer.id);
  return { ok: deleted };
}

/** Dipakai tombol "Lanjutkan di Builder" di halaman detail rakitan tersimpan. */
export async function loadSavedBuildForBuilderAction(id: string): Promise<BuilderReadySelections | null> {
  const customer = await getCurrentCustomer();
  if (!customer) return null;

  return getSavedBuildForBuilder(id, customer.id);
}

/** Dipakai tombol "Perbarui Harga Acuan" di halaman detail rakitan tersimpan. */
export async function refreshBuildPricesAction(id: string): Promise<{ ok: boolean }> {
  const customer = await getCurrentCustomer();
  if (!customer) return { ok: false };

  const ok = await refreshBuildPrices(id, customer.id);
  return { ok };
}
