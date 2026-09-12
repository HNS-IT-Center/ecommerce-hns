import type { Prisma } from "@prisma/client";
import type { Product as WooProduct, ProductCategory as WooCategory, ProductImage, ProductAttribute } from "@/types/woocommerce";

/**
 * Relasi yang WAJIB ikut ditarik supaya `prismaProductToWoo` bisa bekerja.
 *
 * Didefinisikan di sini, bukan di `products.ts`, supaya bentuk query dan mapper
 * yang membacanya tidak bisa berpisah diam-diam: menghapus relasi di sini
 * langsung memunculkan error tipe di mapper, bukan `undefined` saat runtime.
 */
export const productInclude = {
  brand: true,
  // Kategori bertanda utama ditarik ke depan supaya konsumen yang mengambil
  // elemen pertama (breadcrumb, label kategori, produk terkait) mendapat jalur
  // yang memang dipilih, bukan urutan bawaan DB. Sengaja tanpa tiebreaker:
  // menambah urutan kedua akan mengubah kategori yang tampil untuk 2.861 produk
  // yang belum punya penanda, dan itu di luar cakupan perubahan ini.
  categories: { include: { category: true }, orderBy: { isPrimary: "desc" as const } },
  // `tags` sengaja TIDAK ditarik: relasinya tidak pernah dibaca
  // `prismaProductToWoo` dan tipe `Product` pun tidak punya field tag. Dulu ikut
  // di sini dan menambah ~42 ms pada setiap query 25 produk — biaya penuh untuk
  // data yang langsung dibuang.
  images: { orderBy: { position: "asc" as const } },
  attributes: {
    include: { attribute: true, value: true },
    orderBy: { position: "asc" as const },
  },
  // Varian hanya dipakai untuk dua hal oleh mapper: menghitung harga "mulai
  // dari" (butuh harga saja) dan menandai atribut mana yang membedakan varian
  // (butuh nama atributnya). Menarik seluruh kolom tiap anak menambah ~83 ms
  // per 25 produk tanpa ada yang membacanya.
  variations: {
    select: {
      wooId: true,
      regularPrice: true,
      salePrice: true,
      attributes: { include: { attribute: true, value: true } },
    },
  },
} satisfies Prisma.ProductInclude;

/** Baris produk lengkap dengan relasi `productInclude` — masukan mapper. */
export type PrismaProductWithRelations = Prisma.ProductGetPayload<{
  include: typeof productInclude;
}>;

/** Baris kategori beserta jumlah produknya — masukan `prismaCategoryToWoo`. */
export type PrismaCategoryWithCount = Prisma.CategoryGetPayload<{
  include: { _count: { select: { products: true } } };
}>;

/**
 * Enum Prisma -> nilai status ala WooCommerce.
 *
 * Dulu ini `status.toLowerCase()`, dan itu diam-diam salah: PUBLISHED menjadi
 * "published", sedangkan seluruh kode membandingkannya dengan "publish".
 * Cast `as` membuat typechecker ikut diam. Akibatnya setiap pemeriksaan
 * `status === "publish"` selalu gagal — form admin memuat produk terbit dengan
 * status "draft", lalu menyimpannya benar-benar menurunkannya jadi draft.
 * Pemetaan eksplisit menutup celah itu sekaligus membuat perbedaan penamaan
 * kedua sistem terlihat.
 */
const STATUS_TO_WOO = {
  PUBLISHED: "publish",
  DRAFT: "draft",
  PRIVATE: "private",
} as const satisfies Record<string, WooProduct["status"]>;

/** Diekspor supaya `getProductVariations` bisa memetakan status stok tanpa
 *  harus melewatkan seluruh baris varian melalui `prismaProductToWoo`. */
export const STOCK_STATUS_TO_WOO = {
  INSTOCK: "instock",
  OUTOFSTOCK: "outofstock",
  ONBACKORDER: "onbackorder",
} as const satisfies Record<string, WooProduct["stock_status"]>;

/**
 * Kunci pembanding nama atribut, bukan untuk ditampilkan.
 *
 * Data warisan WooCommerce menulis atribut yang sama dengan bentuk berbeda —
 * "WARNA", "Warna", dan "Warna " dianggap tiga atribut berbeda kalau dibanding
 * mentah. Pencocokan induk↔varian memakai kunci ini supaya pilihan varian tetap
 * ketemu; nama aslinya tetap dipakai apa adanya di UI.
 */
export function normalizeAttributeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function prismaProductToWoo(prismaProduct: PrismaProductWithRelations): WooProduct {
  // Produk VARIABLE (induk) tidak punya harga sendiri di database - harga
  // nempel di tiap VARIATION (child). Tampilkan "mulai dari" harga variasi
  // termurah, bukan field harga induk yang memang kosong (lihat diskusi
  // 2026-07-25 soal parent/child pricing).
  const variationPrices =
    prismaProduct.type === "VARIABLE" && prismaProduct.variations
      ? prismaProduct.variations
          .map((v) => ({
            regular: v.regularPrice != null ? Number(v.regularPrice) : null,
            sale: v.salePrice != null ? Number(v.salePrice) : null,
          }))
          // Predikat tipe: tanpa ini `regular` tetap `number | null` setelah
          // filter, dan `Math.min` di bawah kehilangan jaminan non-null-nya.
          .filter((p): p is { regular: number; sale: number | null } => p.regular !== null)
      : [];

  let regularPrice: string;
  let salePrice: string;

  if (variationPrices.length > 0) {
    const minRegular = Math.min(...variationPrices.map((p) => p.regular));
    const minEffective = Math.min(
      ...variationPrices.map((p) => (p.sale && p.sale > 0 ? p.sale : p.regular))
    );
    regularPrice = String(minRegular);
    salePrice = minEffective < minRegular ? String(minEffective) : "";
  } else {
    regularPrice = prismaProduct.regularPrice ? String(prismaProduct.regularPrice) : "0";
    salePrice = prismaProduct.salePrice ? String(prismaProduct.salePrice) : "";
  }

  // Obral yang sudah lewat tanggal berakhir diperlakukan seolah tidak ada.
  // Ini disengaja dihitung saat baca, bukan dengan meng-NULL-kan kolomnya lewat
  // cron: obral berhenti tepat pada detik tanggalnya, dan tidak ada jendela
  // waktu di mana harga diskon masih tampil karena job belum sempat jalan.
  // Nilai aslinya tetap utuh di database sebagai riwayat.
  const saleEndDate: Date | null = prismaProduct.saleEndDate ?? null;
  const saleExpired = saleEndDate !== null && saleEndDate.getTime() <= Date.now();
  if (saleExpired) {
    salePrice = "";
  }

  const price = salePrice ? salePrice : regularPrice;
  const onSale = Boolean(salePrice);

  // Map categories
  const categories = prismaProduct.categories
    ? prismaProduct.categories.map((pc) => ({
        id: pc.category.id,
        name: pc.category.name,
        slug: pc.category.slug,
        // Penanda kategori utama ikut dibawa supaya breadcrumb dan URL kanonik
        // punya satu jalur yang jelas saat produk berada di beberapa cabang.
        primary: Boolean(pc.isPrimary),
      }))
    : [];

  // Map brands
  const brands = prismaProduct.brand
    ? [
        {
          id: prismaProduct.brand.id,
          name: prismaProduct.brand.name,
          slug: prismaProduct.brand.slug,
        },
      ]
    : [];

  // Map images
  const images: ProductImage[] = prismaProduct.images
    ? prismaProduct.images.map((img) => ({
        id: img.id,
        src: img.url,
        alt: prismaProduct.name,
      }))
    : [];

  // Atribut mana yang benar-benar membedakan varian, diturunkan dari data:
  // sebuah atribut disebut atribut varian kalau anak-anak produk ini memakainya.
  // Sebelumnya `variation` dipatok `false`, dan itu mematikan seluruh fitur —
  // halaman produk memfilter `attributes.filter(a => a.variation)`, sehingga
  // daftar pilihannya selalu kosong dan selector varian tidak pernah tampil
  // walau produknya punya 9 varian di database.
  //
  // Diturunkan (bukan disimpan sebagai kolom) supaya tidak perlu migrasi di
  // database produksi dan tidak ada flag yang bisa basi saat varian berubah.
  // Perbandingan lewat `normalizeAttributeName` karena data warisan Woo menulis
  // nama yang sama dengan kapitalisasi/spasi berbeda ("WARNA" vs "Warna").
  const variationAttributeNames = new Set<string>();
  if (prismaProduct.variations) {
    for (const variation of prismaProduct.variations) {
      for (const pa of variation.attributes ?? []) {
        if (!pa.attribute) continue;
        variationAttributeNames.add(normalizeAttributeName(pa.attribute.name));
      }
    }
  }

  // Baris VARIATION tidak punya anak, jadi aturan di atas tidak pernah menandai
  // apa pun untuknya — atribut sebuah varian SELALU atribut pembeda, karena
  // itulah yang membedakannya dari saudaranya. Tanpa cabang ini, form edit admin
  // yang membaca `attr.variation` dari objek varian tidak menemukan satu pun
  // nama atribut, dan 85 produk induk yang tidak mencatat atribut di barisnya
  // sendiri tampil dengan daftar varian kosong seolah varian-nya hilang.
  if (prismaProduct.type === "VARIATION" && prismaProduct.attributes) {
    for (const pa of prismaProduct.attributes) {
      if (!pa.attribute) continue;
      variationAttributeNames.add(normalizeAttributeName(pa.attribute.name));
    }
  }

  // Map attributes (group by attribute ID to match Woo structure)
  const attributesMap = new Map<number, ProductAttribute>();
  if (prismaProduct.attributes) {
    for (const pa of prismaProduct.attributes) {
      if (!pa.attribute || !pa.value) continue;

      if (!attributesMap.has(pa.attribute.id)) {
        attributesMap.set(pa.attribute.id, {
          id: pa.attribute.id,
          name: pa.attribute.name,
          slug: pa.attribute.name.toLowerCase().replace(/\s+/g, '-'),
          options: [],
          variation: variationAttributeNames.has(normalizeAttributeName(pa.attribute.name)),
        });
      }
      // Nilai ganda pada atribut yang sama disaring: induk warisan Woo kadang
      // menyimpan nilai identik berulang, dan itu memunculkan tombol pilihan
      // kembar di selector varian.
      const bucket = attributesMap.get(pa.attribute.id)!;
      if (!bucket.options.includes(pa.value.value)) {
        bucket.options.push(pa.value.value);
      }
    }
  }
  const attributes = Array.from(attributesMap.values());

  // Map variations
  const variations = prismaProduct.variations
    ? prismaProduct.variations.map((v) => v.wooId)
    : [];

  return {
    id: prismaProduct.wooId,
    name: prismaProduct.name,
    slug: prismaProduct.slug,
    permalink: `https://hnsitcenter.id/product/${prismaProduct.slug}`,
    type: prismaProduct.type.toLowerCase() as "simple" | "variable" | "grouped" | "external",
    status: STATUS_TO_WOO[prismaProduct.status as keyof typeof STATUS_TO_WOO] ?? "draft",
    description: prismaProduct.description || "",
    short_description: prismaProduct.shortDescription || "",
    sku: prismaProduct.sku || "",
    // `importedAt` (@default(now())) adalah kapan baris ini masuk ke katalog
    // HNS: tanggal impor massal untuk produk warisan Woo, dan waktu simpan
    // untuk produk yang dibuat lewat admin panel — keduanya tidak pernah
    // diisi manual. Tidak ada kolom `createdAt` di model Product; kode lama
    // membacanya, selalu dapat `undefined`, lalu jatuh ke `new Date()`
    // sehingga setiap produk tampak baru dibuat DETIK ITU JUGA setiap kali
    // dibaca — badge "New" tidak pernah kedaluwarsa dan pengurutan menurut
    // tanggal ikut kacau.
    //
    // Fallback ke string kosong, BUKAN `new Date()`: tanggal yang tak
    // diketahui tidak boleh menyamar jadi produk baru. `isNewProduct`
    // memperlakukan nilai kosong sebagai "tanpa badge" — gagal ke sisi aman.
    date_created: prismaProduct.importedAt?.toISOString() ?? "",
    date_modified: prismaProduct.updatedAt?.toISOString() ?? "",
    price,
    regular_price: regularPrice,
    sale_price: salePrice,
    on_sale: onSale,
    date_on_sale_from_gmt: null,
    date_on_sale_to_gmt: saleEndDate ? saleEndDate.toISOString() : null,
    stock_status: prismaProduct.stockStatus
      ? STOCK_STATUS_TO_WOO[prismaProduct.stockStatus as keyof typeof STOCK_STATUS_TO_WOO] ?? "instock"
      : "instock",
    stock_quantity: prismaProduct.stockQty,
    categories,
    brands,
    images,
    video_url: prismaProduct.videoUrl ?? null,
    attributes,
    variations,
    meta_data: [],
    average_rating: "0",
    rating_count: 0,
    total_sales: prismaProduct.viewCount || 0, // Fallback view count as sales
  };
}

export function prismaCategoryToWoo(prismaCategory: PrismaCategoryWithCount): WooCategory {
  return {
    id: prismaCategory.id,
    name: prismaCategory.name,
    slug: prismaCategory.slug,
    parent: prismaCategory.parentId || 0,
    description: "",
    display: "default",
    image: null,
    menu_order: 0,
    count: prismaCategory._count?.products || 0,
  };
}
