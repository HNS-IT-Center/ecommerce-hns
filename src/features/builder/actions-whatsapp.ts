"use server";

import { priceCartFromCatalog } from "@/lib/api/woocommerce/cart-pricing";
import { getActiveStores } from "@/lib/api/stores";
import { recordPcBuildQuote } from "@/lib/api/pc-build-quotes";
import { resolveSiteUrl } from "@/lib/utils/site-url";
import { normalizePhone } from "@/features/stores/lib/maps";
import { displayVariationName } from "@/lib/utils/variation";

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
      // Builder menyimpan `id` internal (`fetchBuilderProducts` → `id: p.id`),
      // BUKAN `wooId` seperti keranjang. Lihat `CatalogIdColumn`.
      "id",
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
    // Opsi varian WAJIB ikut ke pesan. Rakitan yang menyebut "SSD Samsung 980"
    // tanpa kapasitasnya adalah rakitan yang harganya tidak bisa dicocokkan CS
    // dengan barang mana pun di rak — dan selisih antara 1TB dan 4TB pada
    // rakitan puluhan juta bukan selisih yang bisa dibereskan di chat.
    const nama = displayVariationName(l);
    // Harga per baris sengaja tidak ikut: pesan cukup membawa total, dan
    // rinciannya (termasuk harga satuan) bisa dibuka CS lewat kode quotation.
    return `- ${prefix}${nama}${qty}`;
  });

  // Harga katalog bisa berubah kapan saja, jadi total di pesan WAJIB bertanggal.
  // Zona waktu dikunci ke WIB (Batam): server bisa berjalan di UTC, dan pesan
  // yang dikirim pukul 06.00 WIB tidak boleh bertanggal kemarin.
  const tanggal = new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
  const catatanHarga =
    `_Harga berlaku per ${tanggal} dan dapat berubah sewaktu-waktu. ` +
    `Harga dapat dikunci dengan DP._\n\n`;

  const kodeQuotation = await catatQuotation(priced.lines, stepPerId);

  // Tautannya ke /verify, yang hanya bisa dibuka staff berizin `verify`.
  // Pelanggan yang mengkliknya dialihkan ke beranda (lihat proxy.ts), jadi
  // barisnya diberi label "untuk CS" supaya tidak terasa seperti tautan rusak.
  // Rincian untuk pelanggan tetap ada di teks pesan itu sendiri.
  const barisKode = kodeQuotation
    ? `Kode quotation (untuk CS): ${kodeQuotation.code}\n${kodeQuotation.url}\n\n`
    : "";

  const rinci =
    `Halo HNS IT Center, saya ingin merakit PC dengan spesifikasi berikut:\n\n` +
    `${baris.join("\n")}\n\n` +
    `*Total: ${rupiah(priced.total)}*\n` +
    catatanHarga +
    barisKode +
    `Mohon info ketersediaan barang. Terima kasih.`;

  // Tanpa kode, CS tidak punya apa pun untuk "dibuka" — jadi kalimatnya
  // berbeda tergantung pencatatan quotation berhasil atau tidak.
  const ringkas =
    `Halo HNS IT Center, saya ingin merakit PC dengan ${priced.lines.length} komponen, ` +
    `total ${rupiah(priced.total)}.\n` +
    catatanHarga +
    (kodeQuotation
      ? `Daftarnya terlalu panjang untuk pesan ini — rinciannya bisa dibuka CS ` +
        `lewat kode di bawah.\n\n${barisKode}Terima kasih.`
      : `Daftarnya terlalu panjang untuk pesan ini — mohon dibantu buka rincian ` +
        `rakitan saya bersama CS. Terima kasih.`);

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

/**
 * Mencatat rakitan sebagai quotation, sama seperti halaman `/build-pc/print`.
 *
 * Kodenya deterministik dari `productId:qty:harga` (lihat `computeContentHash`),
 * jadi rakitan yang sama pada harga yang sama mendapat kode yang SAMA dengan
 * PDF yang dicetak pelanggan — CS dan kasir melihat satu dokumen, bukan dua.
 *
 * Yang dicatat adalah hasil `priceCartFromCatalog`, yaitu angka yang persis
 * tertulis di pesan WhatsApp. Snapshot di /verify harus cocok dengan pesan
 * yang dipegang CS.
 *
 * Kegagalan TIDAK menggagalkan Konsultasi: pesan tetap terkirim, hanya tanpa
 * kode — pola yang sama dengan halaman print.
 */
async function catatQuotation(
  lines: Awaited<ReturnType<typeof priceCartFromCatalog>>["lines"],
  stepPerId: Map<number, string>,
): Promise<{ code: string; url: string } | null> {
  try {
    const [{ code }, siteUrl] = await Promise.all([
      recordPcBuildQuote(
        lines.map((l) => ({
          productId: l.productId,
          // Nama induk, bukan nama baris varian — sama dengan halaman print.
          name: l.parentName ?? l.name,
          parentName: l.parentName,
          variationLabel: l.variationLabel,
          sku: l.sku || null,
          price: l.unitPrice,
          quantity: l.quantity,
          stepName: stepPerId.get(l.productId) ?? null,
        })),
      ),
      resolveSiteUrl(),
    ]);
    return { code, url: `${siteUrl}/verify/${code}` };
  } catch (error) {
    console.error("[build-pc/whatsapp] gagal mencatat quotation:", error);
    return null;
  }
}
