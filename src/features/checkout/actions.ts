"use server";

import {
  priceCartFromCatalog,
  type CartLineRequest,
  type PricedCartLine,
} from "@/lib/api/woocommerce/cart-pricing";
import { getActiveStores } from "@/lib/api/stores";
import { normalizePhone } from "@/features/stores/lib/maps";

/**
 * Menyiapkan pesan WhatsApp untuk isi keranjang.
 *
 * Semua yang menentukan angka dikerjakan DI SINI, bukan di klien: klien hanya
 * mengirim `productId` dan `quantity`. Lihat catatan panjang di
 * `lib/api/woocommerce/cart-pricing.ts` dan CLAUDE.md §2.7.
 */

/** Selisih antara harga yang tampil di keranjang dan harga katalog sekarang. */
export type PriceChange = {
  name: string;
  /** Harga yang tadi tampil di keranjang pelanggan. */
  oldUnitPrice: number;
  /** Harga menurut katalog saat tombol ditekan. */
  newUnitPrice: number;
};

export type PrepareCheckoutResult =
  | { ok: false; reason: "empty" | "all-unavailable" | "no-store" }
  | {
      ok: true;
      waUrl: string;
      lines: PricedCartLine[];
      total: number;
      /** Barang yang tidak lagi bisa dijual — sudah dikeluarkan dari pesan. */
      removedNames: string[];
      /**
       * Harga satuan katalog, dikunci dengan `cartItemId` — BUKAN `productId`,
       * yang tidak unik untuk varian (dua varian berbagi id induk yang sama).
       * Dipakai halaman checkout untuk menampilkan angka yang sama dengan yang
       * dikirim ke CS.
       */
      unitPriceByCartItemId: Record<string, number>;
      /** Id baris keranjang yang produknya sudah tidak terbit. */
      unavailableCartItemIds: string[];
      /** Harga yang berubah sejak halaman dimuat. Kosong = tidak ada yang berubah. */
      changes: PriceChange[];
      /** True kalau pesan diringkas karena terlalu panjang. */
      summarised: boolean;
    };

/**
 * Yang dikirim klien: id, kuantitas, dan harga yang SEDANG TAMPIL di keranjang.
 *
 * `displayedUnitPrice` tidak pernah dipakai untuk menghitung apa pun — ia hanya
 * dibandingkan dengan harga katalog supaya perubahan bisa diberitahukan ke
 * pelanggan. Angka yang masuk ke pesan selalu dari database.
 */
export type CheckoutLineInput = CartLineRequest & {
  displayedUnitPrice: number;
  /**
   * Nama yang tampil di keranjang. Dipakai HANYA untuk memberi tahu pelanggan
   * barang mana yang sudah tidak tersedia — produk yang hilang dari katalog
   * tidak punya nama lagi di sisi server. Tidak pernah masuk ke pesan WhatsApp.
   */
  displayedName: string;
  /**
   * Id baris keranjang: `"<productId>"` untuk produk biasa, atau
   * `"<productId>_<variationId>"` untuk varian (lihat `CartItem.id`).
   *
   * WAJIB dikirim. Untuk produk variable, `productId` menyimpan id INDUK,
   * sementara harga yang dilihat pelanggan berasal dari variannya. Tanpa id
   * varian, harga yang dibaca adalah harga induk — yang pada produk variable
   * sering nol atau harga termurah, dan CS menerima total yang salah.
   */
  cartItemId: string;
};

/**
 * Mengambil id yang benar-benar memegang harga.
 *
 * Varian bukan tabel tersendiri di skema ini: ia baris `Product` sendiri yang
 * menunjuk induknya lewat relasi `ProductVariations`. Jadi id varian bisa
 * dikueri persis seperti id produk biasa — yang penting memilih id yang tepat.
 */
function priceBearingId(line: CheckoutLineInput): number {
  const [, variationId] = String(line.cartItemId ?? "").split("_");
  const varian = Number(variationId);
  return Number.isSafeInteger(varian) && varian > 0 ? varian : Number(line.productId);
}

/**
 * Ambang panjang URL wa.me.
 *
 * wa.me menyalurkan pesan lewat query string, jadi yang membatasi adalah panjang
 * URL, dan yang paling ketat di rantai ini adalah WhatsApp Android — bermasalah
 * mulai kisaran ~8.000 karakter.
 *
 * Diukur dengan nama produk sungguhan dari katalog (rata-rata 61 karakter,
 * terpanjang 148):
 *
 *   barang | URL nama khas | URL nama terpanjang
 *   -------|---------------|--------------------
 *       10 |         1.702 |               2.957
 *       15 |         2.430 |               4.290
 *       20 |         3.207 |               5.568
 *       30 |         4.672 |               8.192
 *
 * 4.000 dipilih supaya keranjang 20 barang biasa tetap terkirim utuh, sementara
 * keranjang bernama panjang diringkas jauh sebelum menyentuh batas WhatsApp.
 *
 * Kalau terlampaui, pesan diringkas jadi jumlah item + total. Yang TIDAK boleh
 * terjadi adalah CS menerima daftar terpotong tanpa tahu ada yang hilang —
 * karena itu versi ringkasnya menyatakan jumlah barang secara eksplisit dan
 * meminta CS mengambil rinciannya.
 */
const MAX_URL_LENGTH = 4000;

const rupiah = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

function buildDetailedMessage(lines: PricedCartLine[], total: number): string {
  const daftar = lines
    .map((l, i) => {
      const sku = l.sku ? ` (SKU: ${l.sku})` : "";
      return `${i + 1}. ${l.name}${sku}\n   ${l.quantity} x ${rupiah(l.unitPrice)} = ${rupiah(l.lineTotal)}`;
    })
    .join("\n");

  const unit = lines.reduce((n, l) => n + l.quantity, 0);

  return (
    `Halo HNS IT Center, saya ingin memesan barang berikut:\n\n${daftar}\n\n` +
    `*Total ${unit} barang: ${rupiah(total)}*\n\n` +
    `Mohon konfirmasi ketersediaan stok dan ongkir. Terima kasih.`
  );
}

/**
 * Versi ringkas untuk keranjang yang terlalu besar.
 *
 * Menyebutkan jumlah barang dan total, lalu meminta CS mengambil rinciannya.
 * Sengaja TIDAK memuat sebagian daftar: daftar yang terpotong di tengah terlihat
 * lengkap, dan CS tidak punya cara tahu ada yang hilang.
 */
function buildSummaryMessage(lines: PricedCartLine[], total: number): string {
  const unit = lines.reduce((n, l) => n + l.quantity, 0);
  return (
    `Halo HNS IT Center, saya ingin memesan ${lines.length} jenis barang ` +
    `(${unit} unit) dengan total ${rupiah(total)}.\n\n` +
    `Daftarnya terlalu panjang untuk dikirim lewat pesan ini — mohon dibantu ` +
    `buka keranjang saya bersama CS supaya rinciannya bisa dicek satu per satu. ` +
    `Terima kasih.`
  );
}

export async function prepareCheckoutWhatsApp(
  input: CheckoutLineInput[],
): Promise<PrepareCheckoutResult> {
  if (!Array.isArray(input) || input.length === 0) {
    return { ok: false, reason: "empty" };
  }

  const [cart, stores] = await Promise.all([
    priceCartFromCatalog(
      input.map((l) => ({
        productId: priceBearingId(l),
        quantity: l.quantity,
      })),
    ),
    getActiveStores(),
  ]);

  if (cart.lines.length === 0) {
    return { ok: false, reason: "all-unavailable" };
  }

  /**
   * Cabang utama = `sortOrder` terkecil, urutan yang sama dengan daftar toko.
   * Nomornya dari database, tidak ditulis di kode — kalau nanti pelanggan bisa
   * memilih cabang, tinggal mengoper toko pilihannya ke sini.
   */
  const cabangUtama = stores.find((s) => s.phone?.trim());
  if (!cabangUtama) {
    return { ok: false, reason: "no-store" };
  }

  // Harga yang berubah sejak halaman dimuat. Dilaporkan supaya pelanggan
  // melihatnya sendiri — angka tidak pernah diganti diam-diam.
  // Dikunci dengan id pemegang harga, bukan `productId`, supaya baris varian
  // dicocokkan dengan hasil kueri yang benar.
  const dimintaPerId = new Map(input.map((l) => [priceBearingId(l), l]));
  const changes: PriceChange[] = [];
  for (const l of cart.lines) {
    const diminta = dimintaPerId.get(l.productId);
    if (!diminta) continue;
    const lama = Number(diminta.displayedUnitPrice);
    if (Number.isFinite(lama) && lama > 0 && lama !== l.unitPrice) {
      changes.push({ name: l.name, oldUnitPrice: lama, newUnitPrice: l.unitPrice });
    }
  }

  // Namanya diambil dari keranjang klien: produk yang sudah tidak terbit tidak
  // punya nama untuk dibaca di server. Ini hanya keterangan untuk pelanggan,
  // tidak pernah ikut ke pesan WhatsApp.
  const removedNames = cart.unavailableProductIds.map(
    (id) => dimintaPerId.get(id)?.displayedName?.trim() || `Produk #${id}`,
  );
  const unavailableCartItemIds = cart.unavailableProductIds
    .map((id) => dimintaPerId.get(id)?.cartItemId)
    .filter((v): v is string => typeof v === "string");

  const unitPriceByCartItemId: Record<string, number> = {};
  for (const l of cart.lines) {
    const cartItemId = dimintaPerId.get(l.productId)?.cartItemId;
    if (cartItemId) unitPriceByCartItemId[cartItemId] = l.unitPrice;
  }

  // `normalizePhone`, bukan sekadar membuang non-digit: nomor tersimpan dalam
  // bentuk lokal ("0821-6970-3377") dan wa.me menolak awalan 0 — tautannya
  // terbuka tapi tidak menemukan siapa pun.
  const nomor = normalizePhone(cabangUtama.phone);
  const rinci = buildDetailedMessage(cart.lines, cart.total);
  const urlRinci = `https://wa.me/${nomor}?text=${encodeURIComponent(rinci)}`;

  const perluRingkas = urlRinci.length > MAX_URL_LENGTH;
  const pesan = perluRingkas
    ? buildSummaryMessage(cart.lines, cart.total)
    : rinci;

  return {
    ok: true,
    waUrl: `https://wa.me/${nomor}?text=${encodeURIComponent(pesan)}`,
    lines: cart.lines,
    total: cart.total,
    removedNames,
    unitPriceByCartItemId,
    unavailableCartItemIds,
    changes,
    summarised: perluRingkas,
  };
}
