import { ProductStatus } from "@prisma/client";
import { getPrisma } from "@/lib/prisma/client";
import { decodeHtmlEntities } from "@/lib/utils/html";
import { buildVariationLabel } from "@/lib/utils/variation";

/**
 * Membaca ulang harga keranjang dari database.
 *
 * KENAPA INI ADA
 * Keranjang disimpan di localStorage, dan localStorage bisa disunting siapa saja
 * lewat devtools dalam sepuluh detik. Kalau pesan WhatsApp disusun dari angka di
 * keranjang, CS menerima total yang dikarang pembelinya sendiri — dan menolaknya
 * di depan orang yang merasa sudah melihat harga itu di situs HNS. Untuk PC
 * rakitan puluhan juta, selisihnya bukan main-main.
 *
 * Karena itu klien hanya boleh mengirim `productId` dan `quantity`; nama, SKU,
 * dan harga selalu dibaca di server. Pola yang sama dipakai `handlePrint` di PC
 * builder — lihat `dynamic-builder-view.tsx`.
 *
 * Lihat juga CLAUDE.md §2.7: harga yang tampil ke pelanggan hanya boleh berasal
 * dari katalog.
 */

/** Yang dikirim klien. Sengaja hanya dua field — tidak ada harga di sini. */
export type CartLineRequest = {
  productId: number;
  quantity: number;
};

export type PricedCartLine = {
  productId: number;
  name: string;
  sku: string;
  quantity: number;
  /** Harga satuan menurut katalog, sesudah obral yang masih berlaku. */
  unitPrice: number;
  lineTotal: number;
  /**
   * Terisi HANYA kalau barisnya sebuah varian: nama induknya, dan nilai atribut
   * pembedanya (mis. "1TB · Hitam").
   *
   * Keduanya sengaja dilaporkan TERPISAH dari `name`, bukan disambung ke
   * dalamnya. `name` sudah dipakai apa adanya oleh checkout (`features/
   * checkout/actions.ts`) untuk pesan WhatsApp dan daftar barang yang hilang;
   * mengubah isinya berarti mengubah jalur pemesanan yang sudah berjalan demi
   * kebutuhan PC Builder. Pemanggil yang memang butuh nama lengkapnya
   * merangkainya sendiri lewat `displayVariationName`.
   *
   * Kenapa label tidak diambil dari `name` saja: nama baris varian tidak bisa
   * dipercaya sebagai pembeda — varian warisan impor WooCommerce sering hanya
   * mengulang nama induknya utuh. Lihat `lib/utils/variation.ts`.
   */
  parentName: string | null;
  variationLabel: string | null;
};

export type PricedCart = {
  lines: PricedCartLine[];
  total: number;
  /**
   * Produk yang diminta tapi tidak lagi bisa dijual — terhapus, jadi draft, atau
   * private. Dilaporkan terpisah supaya pelanggan tahu barangnya hilang dari
   * pesanan, bukan diam-diam dibuang.
   */
  unavailableProductIds: number[];
};

/** Batas jumlah baris per permintaan — menahan permintaan yang dibuat-buat besar. */
const MAX_LINES = 50;

/**
 * Menolkan obral yang masa berlakunya sudah lewat.
 *
 * Menyalin aturan `applySaleExpiry` di `products.ts`: kolom `saleEndDate` TIDAK
 * dibersihkan otomatis saat lewat tanggal, jadi lapisan bacalah yang wajib
 * mengabaikannya. Tanpa ini, harga di pesan WhatsApp bisa lebih murah daripada
 * harga di halaman produk — persis jenis selisih yang harus ditanggung CS.
 */
function harga(
  regularPrice: unknown,
  salePrice: unknown,
  saleEndDate: Date | null,
): number {
  const regular = Number(regularPrice ?? 0);
  const sale = salePrice == null ? null : Number(salePrice);

  const obralBerlaku =
    sale != null &&
    sale > 0 &&
    (saleEndDate === null || saleEndDate.getTime() > Date.now());

  return obralBerlaku ? sale : regular;
}

/**
 * Menghitung ulang seluruh keranjang dari katalog.
 *
 * Satu kueri untuk semua baris (`id: { in: [...] }`), bukan satu kueri per
 * barang: Hostinger membatasi 500 koneksi per jam, dan keranjang 20 barang yang
 * memakai 20 koneksi akan menghabiskannya jauh lebih cepat daripada yang diduga.
 *
 * Tidak memakai `unstable_cache`. Harga di sini dipakai untuk transaksi yang
 * benar-benar dikirim ke CS, jadi ia harus mencerminkan katalog pada detik ini —
 * bukan salinan berumur lima menit.
 */
export async function priceCartFromCatalog(
  requested: CartLineRequest[],
): Promise<PricedCart> {
  // Gabungkan baris berulang dan buang yang tidak masuk akal sebelum menyentuh
  // database — kuantitas nol, negatif, atau id palsu tidak perlu dikueri.
  const diminta = new Map<number, number>();
  for (const baris of requested) {
    const id = Number(baris.productId);
    const qty = Math.floor(Number(baris.quantity));
    if (!Number.isSafeInteger(id) || id <= 0) continue;
    if (!Number.isSafeInteger(qty) || qty <= 0) continue;
    diminta.set(id, Math.min((diminta.get(id) ?? 0) + qty, 999));
  }

  if (diminta.size === 0) {
    return { lines: [], total: 0, unavailableProductIds: [] };
  }

  const ids = [...diminta.keys()].slice(0, MAX_LINES);

  const rows = await getPrisma().product.findMany({
    // `status: PUBLISHED` bukan sekadar kerapian: tanpa ini, produk yang sengaja
    // ditarik staf dari etalase masih bisa dipesan oleh siapa pun yang menyimpan
    // id-nya.
    where: { id: { in: ids }, status: ProductStatus.PUBLISHED },
    select: {
      id: true,
      name: true,
      sku: true,
      regularPrice: true,
      salePrice: true,
      saleEndDate: true,
      // Terisi hanya untuk baris VARIATION. Tanpa keduanya, CS menerima dua
      // baris bernama sama persis untuk dua barang yang berbeda kapasitas.
      parent: { select: { name: true } },
      attributes: { select: { value: { select: { value: true } } } },
    },
  });

  const ditemukan = new Map(rows.map((r) => [r.id, r]));

  const lines: PricedCartLine[] = [];
  const unavailableProductIds: number[] = [];

  // Ditelusuri menurut urutan permintaan, bukan urutan hasil kueri, supaya
  // urutan barang di pesan WhatsApp sama dengan yang dilihat pelanggan.
  for (const id of ids) {
    const row = ditemukan.get(id);
    if (!row) {
      unavailableProductIds.push(id);
      continue;
    }
    const quantity = diminta.get(id)!;
    const unitPrice = harga(row.regularPrice, row.salePrice, row.saleEndDate);
    lines.push({
      productId: row.id,
      // Nama produk tersimpan dengan entitas HTML dari impor WooCommerce lama;
      // tanpa decode, CS menerima "Laptop &amp; Aksesori" di WhatsApp.
      name: decodeHtmlEntities(row.name),
      sku: row.sku ?? "",
      quantity,
      unitPrice,
      lineTotal: unitPrice * quantity,
      parentName: row.parent ? decodeHtmlEntities(row.parent.name) : null,
      // Atribut hanya berarti sebagai "varian" kalau barisnya memang punya
      // induk. Produk biasa juga punya atribut, dan menampilkannya sebagai
      // varian akan membuat setiap barang tampak bervarian.
      variationLabel: row.parent
        ? buildVariationLabel(row.attributes.map((a) => a.value.value))
        : null,
    });
  }

  return {
    lines,
    total: lines.reduce((sum, l) => sum + l.lineTotal, 0),
    unavailableProductIds,
  };
}
