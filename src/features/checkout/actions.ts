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
   * Id baris keranjang: `"<productId>"` untuk produk biasa,
   * `"<productId>_<variationId>"` untuk varian, dan bentuk bersegmen ketiga
   * untuk komponen paket PC Prebuild (lihat `CartItem.id` dan
   * `priceBearingId` di bawah).
   *
   * WAJIB dikirim. Untuk produk variable, `productId` menyimpan id INDUK,
   * sementara harga yang dilihat pelanggan berasal dari variannya. Tanpa id
   * varian, harga yang dibaca adalah harga induk — yang pada produk variable
   * sering nol atau harga termurah, dan CS menerima total yang salah.
   */
  cartItemId: string;
  /**
   * Terisi kalau baris ini komponen dari paket PC Prebuild.
   *
   * Ketiganya HANYA memengaruhi cara pesan disusun — harga tetap dibaca ulang
   * per `productId` seperti baris lain. Paket tidak punya jalur harga sendiri;
   * lihat `CartBundleRef` di store/cart.ts.
   */
  bundleKey?: string;
  bundleName?: string;
  /** Jumlah paket, untuk keterangan "x2 paket" di kepala blok. */
  bundleQuantity?: number;
};

/**
 * Mengambil id yang benar-benar memegang harga.
 *
 * Varian bukan tabel tersendiri di skema ini: ia baris `Product` sendiri yang
 * menunjuk induknya lewat relasi `ProductVariations`. Jadi id varian bisa
 * dikueri persis seperti id produk biasa — yang penting memilih id yang tepat.
 *
 * `cartItemId` punya TIGA bentuk yang harus dibaca semuanya:
 *
 *   "123"              produk biasa
 *   "123_456"          varian — 456 yang memegang harga
 *   "123_456_bKUNCI"   komponen paket PC Prebuild (varian atau bukan)
 *   "123__bKUNCI"      komponen paket yang bukan varian — segmen tengah kosong
 *
 * Segmen KE-2 yang dibaca, apa pun yang menyusul sesudahnya. Bentuk pertama dan
 * kedua masih beredar di localStorage pelanggan lama, jadi ketiganya wajib
 * ditangani sampai kapan pun — keranjang tidak pernah dimigrasi.
 */
function priceBearingId(line: CheckoutLineInput): number {
  const segmen = String(line.cartItemId ?? "").split("_");
  const varian = Number(segmen[1]);
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


/**
 * Satu baris yang benar-benar dikirim ke CS.
 *
 * Sengaja dirakit dari INPUT KLIEN yang dilekati harga katalog, bukan langsung
 * dari `cart.lines`. Sebabnya `priceCartFromCatalog` MENGGABUNGKAN baris
 * berid sama (dua "RAM 16GB" jadi satu baris berjumlah 2) — perilaku yang benar
 * untuk menghitung, tapi merusak begitu produk yang sama bisa berada di sebuah
 * paket sekaligus berdiri sendiri di keranjang. Yang tergabung akan kehilangan
 * paketnya, dan `unitPriceByCartItemId` cuma terisi untuk salah satu barisnya.
 *
 * Harganya tetap satu-satunya yang sah: `unitPrice` di sini SELALU berasal dari
 * hasil kueri katalog, tidak pernah dari angka kiriman klien.
 */
type BarisTerkirim = {
  cartItemId: string;
  /** Id yang memegang harga — id varian kalau barisnya sebuah varian. */
  productId: number;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

/** Blok pesan: satu barang lepas, atau satu paket beserta isinya. */
type BlokPesan =
  | { kind: "item"; baris: BarisTerkirim }
  | { kind: "bundle"; name: string; quantity: number; baris: BarisTerkirim[]; total: number };

function jumlahUnit(blok: BlokPesan[]): number {
  return blok.reduce(
    (n, b) => n + (b.kind === "item" ? b.baris.quantity : b.baris.reduce((m, l) => m + l.quantity, 0)),
    0,
  );
}

/**
 * Pesan rinci.
 *
 * Paket ditulis sebagai SATU nomor bernama, dengan komponennya menjorok di
 * bawahnya tanpa harga satuan dan satu total untuk seluruh paket. Kalau
 * komponennya ditulis rata bersama barang lepas, CS menerima tujuh baris yang
 * tidak punya cara dibedakan dari tujuh barang terpisah — lalu mengambilnya
 * satu per satu dari rak dan menghitung ongkos rakitnya sebagai nol.
 */
function buildDetailedMessage(blok: BlokPesan[], total: number): string {
  const daftar = blok
    .map((b, i) => {
      if (b.kind === "item") {
        const sku = b.baris.sku ? ` (SKU: ${b.baris.sku})` : "";
        return `${i + 1}. ${b.baris.name}${sku}\n   ${b.baris.quantity} x ${rupiah(b.baris.unitPrice)} = ${rupiah(b.baris.lineTotal)}`;
      }

      const isi = b.baris.map((l) => `   - ${l.name} (x${l.quantity})`).join("\n");
      const jumlahPaket = b.quantity > 1 ? ` (${b.quantity} paket)` : "";
      return `${i + 1}. *PAKET: ${b.name}*${jumlahPaket}\n${isi}\n   Total paket: ${rupiah(b.total)}`;
    })
    .join("\n");

  const unit = jumlahUnit(blok);

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
 *
 * Nama paket TETAP disebut walau rinciannya tidak — paket adalah hal yang
 * dipesan sebagai satu barang, dan menghitungnya sebagai "7 jenis barang" akan
 * membuat CS menduga isinya salah sejak kalimat pertama.
 */
function buildSummaryMessage(blok: BlokPesan[], total: number): string {
  const unit = jumlahUnit(blok);
  const paket = blok.filter((b) => b.kind === "bundle");
  const lepas = blok.length - paket.length;

  const sebutanPaket = paket
    .map((b) => (b.kind === "bundle" ? `"${b.name}"${b.quantity > 1 ? ` x${b.quantity}` : ""}` : ""))
    .join(", ");

  const isi =
    paket.length > 0
      ? `${paket.length} paket rakitan (${sebutanPaket})` +
        (lepas > 0 ? ` dan ${lepas} jenis barang lain` : "")
      : `${lepas} jenis barang`;

  return (
    `Halo HNS IT Center, saya ingin memesan ${isi} ` +
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

  // Harga katalog dikunci id pemegang harga. Satu baris hasil kueri bisa
  // melayani BEBERAPA baris keranjang (produk yang sama di paket dan di luar
  // paket), jadi ia dipakai sebagai kamus, bukan sebagai daftar kiriman.
  const katalog = new Map(cart.lines.map((l) => [l.productId, l]));
  const tidakTersedia = new Set(cart.unavailableProductIds);

  const unavailableCartItemIds = input
    .filter((l) => tidakTersedia.has(priceBearingId(l)))
    .map((l) => l.cartItemId);

  // Namanya diambil dari keranjang klien: produk yang sudah tidak terbit tidak
  // punya nama untuk dibaca di server. Ini hanya keterangan untuk pelanggan,
  // tidak pernah ikut ke pesan WhatsApp.
  const removedNames = input
    .filter((l) => tidakTersedia.has(priceBearingId(l)))
    .map((l) => l.displayedName?.trim() || `Produk #${l.productId}`);

  /**
   * Paket yang salah satu komponennya sudah ditarik dari katalog TIDAK
   * dikirim — seluruhnya, bukan cuma komponen yang hilang.
   *
   * PC yang kehilangan motherboard-nya bukan pesanan yang lebih murah, ia
   * pesanan yang tidak bisa dipenuhi. Membuang komponennya diam-diam dan tetap
   * mengirim sisanya membuat CS menerima rakitan cacat dengan total yang
   * kelihatan sah — persis jenis selisih yang harus ditolak di depan pelanggan.
   */
  const paketDiblokir = new Set(
    input
      .filter((l) => l.bundleKey && tidakTersedia.has(priceBearingId(l)))
      .map((l) => l.bundleKey as string),
  );

  const unitPriceByCartItemId: Record<string, number> = {};
  const changes: PriceChange[] = [];
  const blok: BlokPesan[] = [];
  const indeksPaket = new Map<string, number>();

  for (const l of input) {
    const row = katalog.get(priceBearingId(l));
    if (!row) continue;

    // Harga yang tampil di keranjang dilaporkan apa adanya walau paketnya
    // diblokir: pelanggan tetap berhak melihat angka barisnya sendiri.
    unitPriceByCartItemId[l.cartItemId] = row.unitPrice;

    const lama = Number(l.displayedUnitPrice);
    if (Number.isFinite(lama) && lama > 0 && lama !== row.unitPrice) {
      changes.push({ name: row.name, oldUnitPrice: lama, newUnitPrice: row.unitPrice });
    }

    if (l.bundleKey && paketDiblokir.has(l.bundleKey)) continue;

    const baris: BarisTerkirim = {
      cartItemId: l.cartItemId,
      productId: row.productId,
      name: row.name,
      sku: row.sku,
      quantity: l.quantity,
      unitPrice: row.unitPrice,
      lineTotal: row.unitPrice * l.quantity,
    };

    if (!l.bundleKey) {
      blok.push({ kind: "item", baris });
      continue;
    }

    const sudahAda = indeksPaket.get(l.bundleKey);
    if (sudahAda === undefined) {
      indeksPaket.set(l.bundleKey, blok.length);
      blok.push({
        kind: "bundle",
        name: l.bundleName?.trim() || "Paket Rakitan",
        quantity: Math.max(1, Math.floor(Number(l.bundleQuantity) || 1)),
        baris: [baris],
        total: baris.lineTotal,
      });
      continue;
    }

    const paket = blok[sudahAda];
    if (paket.kind === "bundle") {
      paket.baris.push(baris);
      paket.total += baris.lineTotal;
    }
  }

  if (blok.length === 0) {
    return { ok: false, reason: "all-unavailable" };
  }

  const lines = blok.flatMap((b) => (b.kind === "item" ? [b.baris] : b.baris));
  // Totalnya dihitung dari baris yang BENAR-BENAR dikirim, bukan `cart.total` —
  // paket yang diblokir sudah tidak ikut, dan angka di layar harus sama dengan
  // angka di pesan.
  const total = lines.reduce((n, l) => n + l.lineTotal, 0);

  // `normalizePhone`, bukan sekadar membuang non-digit: nomor tersimpan dalam
  // bentuk lokal ("0821-6970-3377") dan wa.me menolak awalan 0 — tautannya
  // terbuka tapi tidak menemukan siapa pun.
  const nomor = normalizePhone(cabangUtama.phone);
  const rinci = buildDetailedMessage(blok, total);
  const urlRinci = `https://wa.me/${nomor}?text=${encodeURIComponent(rinci)}`;

  const perluRingkas = urlRinci.length > MAX_URL_LENGTH;
  const pesan = perluRingkas ? buildSummaryMessage(blok, total) : rinci;

  return {
    ok: true,
    waUrl: `https://wa.me/${nomor}?text=${encodeURIComponent(pesan)}`,
    lines: lines.map((l) => ({
      productId: l.productId,
      name: l.name,
      sku: l.sku,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      lineTotal: l.lineTotal,
    })),
    total,
    removedNames,
    unitPriceByCartItemId,
    unavailableCartItemIds,
    changes,
    summarised: perluRingkas,
  };
}
