"use server";

import { priceCartFromCatalog } from "@/lib/api/woocommerce/cart-pricing";
import { getActiveStores } from "@/lib/api/stores";
import { normalizePhone } from "@/features/stores/lib/maps";

/**
 * Menyiapkan pesan WhatsApp untuk rakitan PC, dengan harga dari katalog.
 *
 * Klien hanya mengirim id komponen, kuantitas, dan label langkahnya. Harga
 * dibaca ulang di server — sama seperti `handlePrint`, yang sejak awal
 * mengirimkan id ke `/build-pc/print` dan membiarkan harganya dibaca di sana.
 *
 * Ini bukan kehati-hatian berlebihan. Pilihan rakitan tersimpan di
 * `hns-builder-storage` (localStorage), jadi bisa disunting lewat devtools
 * seperti keranjang. Dan rakitan PC adalah nilai terbesar di situs ini: contoh
 * di CLAUDE.md §2.7 memakai angka Rp 20 juta karena memang segitu ordenya.
 * Orang yang memalsukan tidak akan menulis Rp 10 — mereka menulis angka yang
 * masuk akal, dan CS yang melayani puluhan chat sehari tidak menghafal harga
 * 4.925 produk.
 */

export type BuildLineInput = {
  productId: number;
  quantity: number;
  /** Nama langkah/slot, mis. "Processor". Hanya untuk menyusun pesan. */
  stepName: string;
};

export type PrepareBuildResult =
  | { ok: false; reason: "empty" | "all-unavailable" | "no-store" }
  | {
      ok: true;
      waUrl: string;
      total: number;
      /** Harga satuan katalog per id produk, untuk menyamakan angka di layar. */
      unitPriceByProductId: Record<number, number>;
      /** Komponen yang sudah tidak terbit — tidak ikut ke pesan. */
      unavailableProductIds: number[];
      summarised: boolean;
    };

/** Sama dengan ambang di checkout; alasan lengkapnya ada di features/checkout/actions.ts. */
const MAX_URL_LENGTH = 4000;

const rupiah = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

export async function prepareBuildWhatsApp(
  input: BuildLineInput[],
): Promise<PrepareBuildResult> {
  if (!Array.isArray(input) || input.length === 0) {
    return { ok: false, reason: "empty" };
  }

  const [priced, stores] = await Promise.all([
    priceCartFromCatalog(
      input.map((l) => ({ productId: l.productId, quantity: l.quantity })),
    ),
    getActiveStores(),
  ]);

  if (priced.lines.length === 0) {
    return { ok: false, reason: "all-unavailable" };
  }

  const cabangUtama = stores.find((s) => s.phone?.trim());
  if (!cabangUtama) return { ok: false, reason: "no-store" };

  // Label langkah dari klien hanya dipakai sebagai keterangan; harga dan nama
  // tetap dari hasil pembacaan katalog.
  const stepPerId = new Map(input.map((l) => [Number(l.productId), l.stepName]));

  const baris = priced.lines.map((l) => {
    const step = stepPerId.get(l.productId);
    const prefix = step ? `${step}: ` : "";
    const qty = l.quantity > 1 ? ` x${l.quantity}` : "";
    return `- ${prefix}${l.name}${qty} (${rupiah(l.lineTotal)})`;
  });

  const rinci =
    `Halo HNS IT Center, saya ingin merakit PC dengan spesifikasi berikut:\n\n` +
    `${baris.join("\n")}\n\n` +
    `*Total: ${rupiah(priced.total)}*\n\n` +
    `Mohon info ketersediaan barang dan biaya rakit. Terima kasih.`;

  const ringkas =
    `Halo HNS IT Center, saya ingin merakit PC dengan ${priced.lines.length} komponen, ` +
    `total ${rupiah(priced.total)}.\n\n` +
    `Daftarnya terlalu panjang untuk pesan ini — mohon dibantu buka rincian ` +
    `rakitan saya bersama CS. Terima kasih.`;

  const nomor = normalizePhone(cabangUtama.phone);
  const urlRinci = `https://wa.me/${nomor}?text=${encodeURIComponent(rinci)}`;
  const perluRingkas = urlRinci.length > MAX_URL_LENGTH;

  const unitPriceByProductId: Record<number, number> = {};
  for (const l of priced.lines) unitPriceByProductId[l.productId] = l.unitPrice;

  return {
    ok: true,
    waUrl: perluRingkas
      ? `https://wa.me/${nomor}?text=${encodeURIComponent(ringkas)}`
      : urlRinci,
    total: priced.total,
    unitPriceByProductId,
    unavailableProductIds: priced.unavailableProductIds,
    summarised: perluRingkas,
  };
}
