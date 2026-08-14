"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useNewBuilderStore, type BuilderSelection } from "@/store/new-builder";
import { prepareBuildWhatsApp, type BuildLineInput } from "../actions-whatsapp";

/**
 * Membaca harga rakitan dari katalog dan melaporkan apa yang berubah.
 *
 * Bentuknya sengaja mencerminkan `features/checkout/hooks/use-catalog-pricing.ts`
 * (dipakai `/cart` dan `/checkout`): baca sekali saat terpasang, `refresh()`
 * untuk membaca ulang saat tombol ditekan. Dibuat terpisah — bukan
 * menggeneralisasi hook itu — karena keduanya memanggil server action yang
 * berbeda bentuk hasilnya (`cartItemId` + varian di keranjang, `productId`
 * polos di rakitan), dan jalur checkout sudah terbukti; menyatukannya berarti
 * menyentuh jalur uang demi keseragaman internal.
 *
 * Keduanya tetap bermuara ke `priceCartFromCatalog` yang sama, jadi angka yang
 * tampil di keranjang dan di panel rakitan tidak akan pernah berbeda aturannya.
 *
 * Harga di `pc-builder-storage` (localStorage) bisa berumur berbulan-bulan dan
 * bisa disunting lewat devtools. Yang dikirim ke server hanya id, kuantitas,
 * dan label langkah. Lihat CLAUDE.md §2.7.
 */

export type BuilderPricing = {
  /** Total katalog, HANYA dari komponen yang masih tersedia. */
  total: number;
  /** Harga satuan katalog per id produk. */
  unitPriceByProductId: Record<number, number>;
  /** Id komponen yang sudah tidak terbit di katalog. */
  unavailableProductIds: number[];
  /** Selisih terhadap harga yang tersimpan di store. */
  changes: Array<{
    productId: number;
    name: string;
    oldUnitPrice: number;
    newUnitPrice: number;
  }>;
  waUrl: string;
};

/** Bentuk baris yang dikirim ke server — tanpa harga, sesuai §2.7. */
function toInput(
  steps: { id: string; name: string }[],
  selections: Record<string, BuilderSelection[]>,
): BuildLineInput[] {
  return steps.flatMap((step) => {
    const stepSels = selections[step.id];
    if (!Array.isArray(stepSels)) return [];
    return stepSels.map((sel) => ({
      productId: Number(sel.product.id),
      quantity: sel.quantity,
      stepName: step.name,
    }));
  });
}

type Options = {
  /** Baca katalog sekali saat komponen terpasang. */
  auto?: boolean;
};

export function useBuilderCatalogPricing({ auto = false }: Options = {}) {
  const [pricing, setPricing] = useState<BuilderPricing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * State builder dibaca lewat `getState()` DI DALAM `refresh`, bukan lewat
   * `useNewBuilderStore(...)` di badan hook.
   *
   * Kalau berlangganan, setiap penambahan/penghapusan komponen membuat hook ini
   * render ulang, dan `refresh` yang bergantung padanya berganti identitas —
   * yang pada gilirannya bisa membangunkan efek auto di bawah. Panel ini hidup
   * di halaman tempat orang mengganti komponen berkali-kali; satu kueri per
   * penggantian akan menghabiskan kuota 500 koneksi/jam Hostinger dengan cepat.
   *
   * `refresh` karena itu punya daftar dependensi kosong dan identitasnya tetap
   * seumur hidup komponen.
   */
  const refresh = useCallback(async (): Promise<BuilderPricing | null> => {
    const { steps, selections } = useNewBuilderStore.getState();
    const lines = toInput(steps, selections);

    if (lines.length === 0) {
      setPricing(null);
      return null;
    }

    setLoading(true);
    setError(null);
    try {
      const hasil = await prepareBuildWhatsApp(lines);
      if (!hasil.ok) {
        setError(
          hasil.reason === "all-unavailable"
            ? "Komponen yang dipilih sudah tidak tersedia."
            : hasil.reason === "no-store"
              ? "Nomor WhatsApp CS belum tersedia."
              : "Belum ada komponen yang dipilih.",
        );
        return null;
      }

      // Selisih dihitung di sini, terhadap harga yang tersimpan di store —
      // server tidak tahu angka mana yang sedang dilihat pelanggan.
      const changes: BuilderPricing["changes"] = [];
      for (const step of steps) {
        const stepSels = selections[step.id];
        if (!Array.isArray(stepSels)) continue;
        for (const sel of stepSels) {
          const id = Number(sel.product.id);
          const baru = hasil.unitPriceByProductId[id];
          const lama = Number(sel.product.price);
          if (baru === undefined) continue;
          if (!Number.isFinite(lama) || lama <= 0) continue;
          if (baru === lama) continue;
          changes.push({
            productId: id,
            name: sel.product.name,
            oldUnitPrice: lama,
            newUnitPrice: baru,
          });
        }
      }

      const hasilPricing: BuilderPricing = {
        total: hasil.total,
        unitPriceByProductId: hasil.unitPriceByProductId,
        unavailableProductIds: hasil.unavailableProductIds,
        changes,
        waUrl: hasil.waUrl,
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
   * TEPAT SEKALI seumur hidup komponen, saat rakitan sudah ter-hydrate dan
   * berisi sesuatu.
   *
   * `adaIsi` dibaca lewat selector supaya efek ini bangun saat hydration
   * localStorage selesai (isi berubah dari kosong ke terisi). Setelah `sudahJalan`
   * menyala, tidak ada jalan untuk memicunya lagi — termasuk saat pelanggan
   * mengganti komponen, yang justru paling sering terjadi di halaman ini.
   *
   * Pembacaan ulang berikutnya HANYA lewat `refresh()` eksplisit, yaitu saat
   * tombol Konsultasi ditekan.
   */
  const adaIsi = useNewBuilderStore(
    (s) => Object.values(s.selections).some((v) => Array.isArray(v) && v.length > 0),
  );
  const sudahJalan = useRef(false);
  useEffect(() => {
    if (!auto || sudahJalan.current || !adaIsi) return;
    sudahJalan.current = true;
    void refresh();
  }, [auto, adaIsi, refresh]);

  return { pricing, loading, error, refresh };
}
