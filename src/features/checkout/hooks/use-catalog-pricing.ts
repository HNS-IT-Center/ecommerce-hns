"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useCartStore, type CartItem } from "@/store/cart";
import { prepareCheckoutWhatsApp } from "../actions";

/**
 * Membaca harga keranjang dari katalog dan melaporkan apa yang berubah.
 *
 * Dipakai bersama oleh `/cart` (otomatis saat halaman dibuka) dan `/checkout`
 * (saat tombol ditekan). Logikanya satu tempat supaya dua halaman tidak pernah
 * menampilkan angka yang berbeda untuk hal yang sama.
 *
 * Harga di keranjang berasal dari localStorage — ia bisa berumur seminggu, dan
 * bisa disunting siapa saja lewat devtools. Yang dikirim ke server hanya id dan
 * kuantitas; lihat `lib/api/woocommerce/cart-pricing.ts` dan CLAUDE.md §2.7.
 */

export type CatalogPricing = {
  total: number;
  /** Harga satuan katalog, dikunci `CartItem.id`. */
  unitPriceByCartItemId: Record<string, number>;
  /** Id baris keranjang yang produknya sudah tidak terbit. */
  unavailableCartItemIds: string[];
  /** Selisih terhadap harga yang tersimpan di keranjang. */
  changes: Array<{
    cartItemId: string;
    name: string;
    oldUnitPrice: number;
    newUnitPrice: number;
  }>;
  waUrl: string;
  summarised: boolean;
};

function toInput(items: CartItem[]) {
  return items.map((i) => ({
    cartItemId: i.id,
    productId: i.productId,
    quantity: i.quantity,
    displayedUnitPrice: i.price,
    displayedName: i.variationLabel ? `${i.name} (${i.variationLabel})` : i.name,
    // Keterangan paket ikut dikirim supaya pesan ke CS menulis rakitan sebagai
    // satu blok bernama. Ia tidak menyentuh harga sama sekali — harga tetap
    // dibaca ulang per produk di server.
    ...(i.bundle
      ? {
          bundleKey: i.bundle.key,
          bundleName: i.bundle.name,
          bundleQuantity: i.bundle.quantity,
        }
      : {}),
  }));
}

type Options = {
  /** Baca katalog sekali saat komponen terpasang. */
  auto?: boolean;
  /** Batasi ke barang tertentu; default seluruh isi keranjang. */
  filter?: (item: CartItem) => boolean;
};

export function useCatalogPricing({ auto = false, filter }: Options = {}) {
  const items = useCartStore((s) => s.items);
  const [pricing, setPricing] = useState<CatalogPricing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const target = filter ? items.filter(filter) : items;

  /**
   * Disimpan di ref supaya `refresh` tidak berubah identitasnya setiap render —
   * tanpa ini, efek auto di bawah akan berjalan berulang tanpa henti.
   *
   * Ditulis di dalam efek, bukan saat render: menulis ref selagi merender
   * dilarang React dan bisa menyimpan nilai dari render yang akhirnya dibuang.
   */
  const targetRef = useRef(target);
  useEffect(() => {
    targetRef.current = target;
  });

  const refresh = useCallback(async (): Promise<CatalogPricing | null> => {
    const current = targetRef.current;
    if (current.length === 0) {
      setPricing(null);
      return null;
    }

    setLoading(true);
    setError(null);
    try {
      const hasil = await prepareCheckoutWhatsApp(toInput(current));
      if (!hasil.ok) {
        setError(
          hasil.reason === "all-unavailable"
            ? "Barang di keranjang sudah tidak tersedia."
            : hasil.reason === "no-store"
              ? "Nomor WhatsApp CS belum tersedia."
              : "Keranjang kosong.",
        );
        return null;
      }

      // Selisih dihitung ulang di sini terhadap `unitPriceByCartItemId`, bukan
      // memakai `changes` dari server: yang itu dikunci nama, dan dua varian
      // dari produk yang sama bisa bernama mirip. Id baris keranjang unik.
      const hasilPricing: CatalogPricing = {
        total: hasil.total,
        unitPriceByCartItemId: hasil.unitPriceByCartItemId,
        unavailableCartItemIds: hasil.unavailableCartItemIds,
        changes: current
          .filter((i) => {
            const baru = hasil.unitPriceByCartItemId[i.id];
            return baru !== undefined && baru !== i.price;
          })
          .map((i) => ({
            cartItemId: i.id,
            name: i.name,
            oldUnitPrice: i.price,
            newUnitPrice: hasil.unitPriceByCartItemId[i.id],
          })),
        waUrl: hasil.waUrl,
        summarised: hasil.summarised,
      };

      setPricing(hasilPricing);
      return hasilPricing;
    } catch {
      setError("Gagal memeriksa harga. Coba muat ulang halaman.");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Sekali saat terpasang, bukan setiap kali isi keranjang berubah.
   *
   * Kalau ikut setiap perubahan, menekan tombol tambah/kurang akan memicu satu
   * kueri per tekanan — dan kuota koneksi Hostinger 500/jam bukan angka yang
   * bisa diabaikan.
   */
  const sudahJalan = useRef(false);
  const adaIsi = target.length > 0;
  useEffect(() => {
    if (!auto || sudahJalan.current || !adaIsi) return;
    sudahJalan.current = true;
    void refresh();
  }, [auto, adaIsi, refresh]);

  return { pricing, loading, error, refresh };
}
