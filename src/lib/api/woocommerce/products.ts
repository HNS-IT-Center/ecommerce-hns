import { revalidateTag, unstable_cache } from "next/cache";
import { ProductStatus, ProductType, StockStatus, type Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/prisma/client";
import { prismaProductToWoo } from "./db-mapper";
import type {
  Product,
  GetProductsParams,
  ProductVariation,
  ProductAttributeTaxonomy,
  ProductAttributeTerm,
  ProductInput,
} from "@/types/woocommerce";
import { decodeHtmlEntities } from "@/lib/utils/html";
import { CategoryOperationError } from "./categories";

// Base include for Prisma queries to fetch all relations needed by the mapper
const productInclude = {
  brand: true,
  // Kategori bertanda utama ditarik ke depan supaya konsumen yang mengambil
  // elemen pertama (breadcrumb, label kategori, produk terkait) mendapat jalur
  // yang memang dipilih, bukan urutan bawaan DB. Sengaja tanpa tiebreaker:
  // menambah urutan kedua akan mengubah kategori yang tampil untuk 2.861 produk
  // yang belum punya penanda, dan itu di luar cakupan perubahan ini.
  categories: { include: { category: true }, orderBy: { isPrimary: 'desc' as const } },
  tags: { include: { tag: true } },
  images: { orderBy: { position: 'asc' as const } },
  attributes: {
    include: { attribute: true, value: true },
    orderBy: { position: 'asc' as const },
  },
  variations: {
    include: {
      attributes: { include: { attribute: true, value: true } },
    },
  },
};

/**
 * Nolkan harga obral yang masa berlakunya sudah lewat.
 *
 * Sengaja dijalankan DI SINI, bukan hanya di dalam `prismaProductToWoo`: mapper
 * itu dipanggil di dalam `unstable_cache`, jadi "sekarang" yang dilihatnya adalah
 * saat entri cache dibuat — obral yang berakhir tengah hari masih akan tampil
 * diskon sampai cache-nya kedaluwarsa (300-600 detik kemudian). `decodeProduct`
 * berjalan di luar cache pada setiap permintaan, sehingga di sinilah tanggalnya
 * benar-benar akurat. Operasinya idempoten, aman walau mapper sudah menolkannya.
 */
function applySaleExpiry(product: Product): Product {
  if (!product.sale_price || !product.date_on_sale_to_gmt) return product;
  if (new Date(product.date_on_sale_to_gmt).getTime() > Date.now()) return product;

  return {
    ...product,
    sale_price: "",
    on_sale: false,
    price: product.regular_price,
  };
}

function decodeProduct(product: Product): Product {
  const withPricing = applySaleExpiry(product);
  return {
    ...withPricing,
    name: decodeHtmlEntities(withPricing.name),
    categories: withPricing.categories?.map((c) => ({ ...c, name: decodeHtmlEntities(c.name) })),
    brands: withPricing.brands?.map((b) => ({ ...b, name: decodeHtmlEntities(b.name) })),
  };
}

const STATUS_FROM_PARAM = {
  publish: ProductStatus.PUBLISHED,
  draft: ProductStatus.DRAFT,
  private: ProductStatus.PRIVATE,
} as const;

function buildPrismaWhere(params: GetProductsParams): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {
    parentId: null, // Only fetch parent products by default for listing
  };

  // Storefront hanya boleh melihat produk terbit, jadi itu tetap defaultnya.
  // Admin melewatkan "any" supaya draft & private ikut terbawa.
  if (params.status !== "any") {
    where.status = STATUS_FROM_PARAM[params.status ?? "publish"];
  }

  if (params.category) {
    // Daftar id dipakai halaman kategori induk: satu kategori beserta seluruh
    // keturunannya. Tanpa cabang ini daftar tersebut jatuh ke pencocokan slug
    // dan tidak pernah cocok dengan apa pun.
    if (Array.isArray(params.category)) {
      if (params.category.length > 0) {
        if (typeof params.category[0] === 'number') {
          where.categories = { some: { categoryId: { in: params.category as number[] } } };
        } else {
          where.categories = { some: { category: { slug: { in: params.category as string[] } } } };
        }
      }
    } else if (typeof params.category === 'string') {
      where.categories = { some: { category: { slug: params.category } } };
    } else {
      where.categories = { some: { categoryId: params.category } };
    }
  }

  if (params.excludeCategory) {
    const excludes = Array.isArray(params.excludeCategory) ? params.excludeCategory : [params.excludeCategory];
    // If where.categories doesn't exist, initialize it
    where.categories = where.categories || {};
    // Ensure we don't match any of the excluded category slugs
    where.categories.none = { category: { slug: { in: excludes } } };
  }

  if (params.brand) {
    if (Array.isArray(params.brand)) {
      if (params.brand.length > 0) {
        where.brand = { slug: { in: params.brand } };
      }
    } else {
      where.brand = { slug: params.brand };
    }
  }

  if (params.search) {
    const searchTerms = params.search.trim().split(/\s+/).filter(Boolean);
    if (searchTerms.length > 0) {
      // Tiap kata dicari ke nama, SKU, brand, DAN kategori — bukan ke nama saja.
      //
      // Alasannya: pelanggan mengetik jenis barang lalu mereknya ("laptop
      // lenovo", "mouse rexus"), padahal jenis barang itu justru jarang ada di
      // nama produk — "Lenovo LOQ 15IRX9" tidak memuat kata "laptop", kata itu
      // ada di kategorinya. Dengan pencocokan nama saja kombinasi paling wajar
      // yang diketik orang malah tidak menghasilkan apa-apa.
      //
      // Struktur OR-di-dalam-AND penting: antar kata tetap AND (tiap kata wajib
      // cocok di suatu tempat) sehingga menambah kata tetap MEMPERSEMPIT hasil.
      // Kalau seluruhnya dijadikan OR, "laptop lenovo" akan mengembalikan semua
      // laptop ditambah semua produk Lenovo — kebalikan dari yang dimaksud.
      //
      // Deskripsi sengaja TIDAK diikutkan: kata umum seperti "gaming" muncul di
      // ratusan deskripsi dan akan menenggelamkan hasil yang benar-benar relevan.
      where.AND = [
        ...(where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []),
        ...searchTerms.map(term => ({
          OR: [
            { name: { contains: term } },
            { sku: { contains: term } },
            { brand: { name: { contains: term } } },
            { categories: { some: { category: { name: { contains: term } } } } },
          ],
        }))
      ];
    }
  }

  if (params.onSale) {
    // Harus ikut memeriksa tanggal berakhir, bukan cuma "salePrice terisi".
    // Kolom sale_price sengaja tidak dikosongkan saat masa obral lewat (lihat
    // catatan di schema.prisma), jadi tanpa syarat tanggal di sini produk yang
    // obralnya sudah berakhir tetap muncul di daftar "sedang diskon" padahal
    // halaman produknya sudah menampilkan harga normal.
    where.salePrice = { not: null };
    where.AND = [
      ...(where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []),
      { OR: [{ saleEndDate: null }, { saleEndDate: { gt: new Date() } }] },
    ];
  }

  if (params.featured) {
    where.featured = true;
  }

  if (params.minPrice !== undefined || params.maxPrice !== undefined) {
    where.regularPrice = {};
    if (params.minPrice !== undefined) where.regularPrice.gte = params.minPrice;
    if (params.maxPrice !== undefined) where.regularPrice.lte = params.maxPrice;
  }

  return where;
}

function buildPrismaOrderBy(params: GetProductsParams): Prisma.ProductOrderByWithRelationInput {
  const orderDir = params.order === 'asc' ? 'asc' : 'desc';
  switch (params.orderby) {
    case 'date': return { importedAt: orderDir };
    case 'price': return { regularPrice: orderDir };
    case 'popularity': return { viewCount: orderDir };
    case 'title': return { name: orderDir };
    case 'sku': return { sku: orderDir };
    default: return { id: orderDir };
  }
}

function productsTags(params: GetProductsParams): string[] {
  return ["products", params.category ? `category-${params.category}` : "all-products"];
}

export async function getProducts(
  params: GetProductsParams = {}
): Promise<Product[]> {
  const fetcher = unstable_cache(
    async () => {
      const products = await getPrisma().product.findMany({
        where: buildPrismaWhere(params),
        orderBy: buildPrismaOrderBy(params),
        take: params.perPage || 24,
        skip: params.page && params.perPage ? (params.page - 1) * params.perPage : 0,
        include: productInclude,
      });
      return products.map((p) => prismaProductToWoo(p));
    },
    [JSON.stringify(params), "getProducts"],
    { revalidate: 300, tags: productsTags(params) }
  );

  const products = await fetcher();
  return products.map(decodeProduct);
}

export type GetProductsPaginatedResult = {
  products: Product[];
  total: number;
  totalPages: number;
};

export async function getProductsPaginated(
  params: GetProductsParams = {}
): Promise<GetProductsPaginatedResult> {
  const fetcher = unstable_cache(
    async () => {
      const where = buildPrismaWhere(params);
      const perPage = params.perPage || 24;
      
      const [total, products] = await Promise.all([
        getPrisma().product.count({ where }),
        getPrisma().product.findMany({
          where,
          orderBy: buildPrismaOrderBy(params),
          take: perPage,
          skip: params.page ? (params.page - 1) * perPage : 0,
          include: productInclude,
        }),
      ]);

      const totalPages = Math.ceil(total / perPage);
      return {
        products: products.map((p) => prismaProductToWoo(p)),
        total,
        totalPages,
      };
    },
    [JSON.stringify(params), "getProductsPaginated"],
    { revalidate: 300, tags: productsTags(params) }
  );

  const data = await fetcher();
  return { ...data, products: data.products.map(decodeProduct) };
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const fetcher = unstable_cache(
    async () => {
      const product = await getPrisma().product.findFirst({
        where: { slug, status: 'PUBLISHED' },
        include: productInclude,
      });
      return product ? prismaProductToWoo(product) : null;
    },
    [`product-${slug}`],
    { revalidate: 600, tags: [`product-${slug}`] }
  );

  const product = await fetcher();
  return product ? decodeProduct(product) : null;
}

/** Dipakai admin panel — cari produk by ID WooCommerce (dari link daftar produk). */
export async function getProductById(id: number): Promise<Product | null> {
  try {
    const fetcher = unstable_cache(
      async () => {
        const product = await getPrisma().product.findUnique({
          where: { wooId: id },
          include: productInclude,
        });
        return product ? prismaProductToWoo(product) : null;
      },
      [`product-id-${id}`],
      { revalidate: 600, tags: [`product-id-${id}`] }
    );
    const product = await fetcher();
    return product ? decodeProduct(product) : null;
  } catch {
    return null;
  }
}

/** Detail per varian (harga/stok/SKU spesifik) untuk produk `type: "variable"`. */
export async function getProductVariations(productId: number): Promise<ProductVariation[]> {
  const fetcher = unstable_cache(
    async () => {
      // Find the parent's internal ID
      const parent = await getPrisma().product.findUnique({ where: { wooId: productId }});
      if (!parent) return [];

      const variations = await getPrisma().product.findMany({
        where: { parentId: parent.id },
        include: productInclude,
      });

      return variations.map((v) => {
        const woo = prismaProductToWoo(v);
        // Map WooProduct to ProductVariation format
        return {
          id: woo.id,
          sku: woo.sku,
          price: woo.price,
          regular_price: woo.regular_price,
          sale_price: woo.sale_price,
          on_sale: woo.on_sale,
          stock_status: woo.stock_status,
          stock_quantity: woo.stock_quantity,
          attributes: woo.attributes.map(a => ({
            id: a.id,
            name: a.name,
            option: a.options[0] || "",
          })),
          image: woo.images?.[0] || null,
        };
      });
    },
    [`product-${productId}-variations`],
    { revalidate: 300, tags: [`product-${productId}-variations`] }
  );
  return fetcher();
}

/** Daftar taxonomy atribut global (mis. "Kapasitas Storage" -> slug pa_kapasitas-storage). */
export async function getProductAttributes(): Promise<ProductAttributeTaxonomy[]> {
  const fetcher = unstable_cache(
    async () => {
      const attributes = await getPrisma().attribute.findMany();
      return attributes.map(a => ({
        id: a.id,
        name: a.name,
        slug: a.name.toLowerCase().replace(/\s+/g, '-'),
      }));
    },
    ["product-attributes"],
    { revalidate: 3600, tags: ["product-attributes"] }
  );
  return fetcher();
}

/** Term (pilihan nilai) untuk satu taxonomy atribut, mis. "1TB+", "2TB+" untuk Kapasitas Storage. */
export async function getProductAttributeTerms(attributeId: number): Promise<ProductAttributeTerm[]> {
  const fetcher = unstable_cache(
    async () => {
      const terms = await getPrisma().attributeValue.findMany({
        where: { attributeId },
      });
      return terms.map(t => ({
        id: t.id,
        name: t.value,
        count: 0, // In full implementation, we'd count products with this term
      }));
    },
    [`attribute-${attributeId}-terms`],
    { revalidate: 3600, tags: [`attribute-${attributeId}-terms`] }
  );
  return fetcher();
}

function slugify(name: string, wooId: number): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "") + `-${wooId}`
  );
}

function brandSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

/**
 * Cari brand berdasarkan nama, buat kalau belum ada.
 *
 * Form admin mengirim nama apa adanya (staff boleh mengetik brand baru), jadi
 * pencocokan dilakukan lewat slug — "ASUS", "Asus", dan "asus " semuanya jatuh
 * ke baris yang sama, alih-alih menumpuk tiga brand berbeda yang tampak identik
 * di katalog. Kolom `slug` unik, `name` tidak, jadi slug memang satu-satunya
 * kunci yang bisa diandalkan di sini.
 */
async function resolveBrandId(
  tx: Prisma.TransactionClient,
  brandName: string | null | undefined
): Promise<number | null> {
  const trimmed = brandName?.trim();
  if (!trimmed) return null;

  const slug = brandSlug(trimmed);
  if (!slug) return null;

  const brand = await tx.brand.upsert({
    where: { slug },
    create: { name: trimmed, slug },
    update: {},
  });
  return brand.id;
}

// --------------------------------------------------------------- kategori utama

/**
 * Tetapkan kategori utama sebuah produk.
 *
 * Produk bisa menempel di beberapa kategori, tapi hanya satu yang menjawab
 * "di rak mana barang ini sebenarnya" — itu yang dipakai breadcrumb, URL
 * kanonik, dan laporan per kategori. Tanpa penanda ini ketiganya harus menebak,
 * dan tebakan yang berbeda-beda antar halaman jauh lebih membingungkan
 * daripada satu jawaban yang konsisten.
 *
 * MariaDB tidak punya partial unique index, jadi "hanya satu utama per produk"
 * tidak bisa dititipkan ke database. Aturan itu ditegakkan di sini: penanda
 * lama dibersihkan dan yang baru dipasang dalam satu transaksi, supaya tidak
 * pernah ada saat di mana sebuah produk punya dua kategori utama.
 */
export async function setPrimaryCategory(
  productWooId: number,
  categoryId: number
): Promise<void> {
  const prisma = getPrisma();

  const product = await prisma.product.findUnique({
    where: { wooId: productWooId },
    select: { id: true },
  });
  if (!product) throw new CategoryOperationError("Produk tidak ditemukan.");

  const link = await prisma.productCategory.findUnique({
    where: { productId_categoryId: { productId: product.id, categoryId } },
  });
  if (!link) {
    throw new CategoryOperationError(
      "Produk ini tidak terdaftar di kategori tersebut. Tambahkan kategorinya lebih dulu."
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.productCategory.updateMany({
      where: { productId: product.id, isPrimary: true },
      data: { isPrimary: false },
    });
    await tx.productCategory.update({
      where: { productId_categoryId: { productId: product.id, categoryId } },
      data: { isPrimary: true },
    });
  });
}

// --------------------------------------------------------------- kategori massal

export type BulkCategoryMode = "add" | "remove";

export type BulkAssignPreview = {
  categoryId: number;
  categoryName: string;
  mode: BulkCategoryMode;
  /** Produk terpilih yang benar-benar ada. */
  selected: number;
  /** Yang kaitannya akan berubah — angka inilah yang harus dikonfirmasi. */
  willChange: number;
  /** Sudah sesuai sejak awal, tidak disentuh. */
  alreadyDone: number;
  /** Terpilih tapi tidak ditemukan lagi (mis. terhapus di tab lain). */
  missing: number;
  /**
   * Khusus mode hapus: produk yang setelah operasi ini tidak punya kategori
   * sama sekali. Bukan larangan — kadang memang disengaja — tapi produk tanpa
   * kategori tidak bisa ditemukan lewat penjelajahan, jadi PIC harus tahu.
   */
  wouldBeLeftWithoutCategory: number;
  /**
   * Khusus mode hapus: produk yang kategori ini justru kategori UTAMA-nya.
   * Melepasnya berarti produk kehilangan jalur yang dipakai breadcrumb dan URL
   * kanonik, jadi harus ditetapkan ulang setelahnya.
   */
  primaryBeingRemoved: number;
};

/** Pemeriksaan yang sama dipakai preview dan penyimpanan, supaya tidak bisa berbeda. */
async function resolveBulkTargets(productWooIds: number[], categoryId: number) {
  const prisma = getPrisma();

  if (productWooIds.length === 0) {
    throw new CategoryOperationError("Belum ada produk yang dipilih.");
  }

  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) throw new CategoryOperationError("Kategori tidak ditemukan.");

  const products = await prisma.product.findMany({
    where: { wooId: { in: productWooIds } },
    select: { id: true },
  });

  return { category, productIds: products.map((p) => p.id) };
}

/**
 * Hitung dampak penetapan kategori massal TANPA menulis apa pun — dry run.
 */
export async function previewBulkAssignCategory(
  productWooIds: number[],
  categoryId: number,
  mode: BulkCategoryMode
): Promise<BulkAssignPreview> {
  const prisma = getPrisma();
  const { category, productIds } = await resolveBulkTargets(productWooIds, categoryId);

  const existing = await prisma.productCategory.findMany({
    where: { productId: { in: productIds }, categoryId },
    select: { productId: true, isPrimary: true },
  });
  const alreadyLinked = new Set(existing.map((r) => r.productId));

  const willChange =
    mode === "add" ? productIds.length - alreadyLinked.size : alreadyLinked.size;
  const alreadyDone = productIds.length - willChange;

  let wouldBeLeftWithoutCategory = 0;
  if (mode === "remove" && alreadyLinked.size > 0) {
    const counts = await prisma.productCategory.groupBy({
      by: ["productId"],
      where: { productId: { in: [...alreadyLinked] } },
      _count: { categoryId: true },
    });
    wouldBeLeftWithoutCategory = counts.filter((c) => c._count.categoryId === 1).length;
  }

  return {
    categoryId,
    categoryName: category.name,
    mode,
    selected: productIds.length,
    willChange,
    alreadyDone,
    missing: productWooIds.length - productIds.length,
    wouldBeLeftWithoutCategory,
    primaryBeingRemoved: mode === "remove" ? existing.filter((r) => r.isPrimary).length : 0,
  };
}

/**
 * Tambahkan atau lepaskan satu kategori pada banyak produk sekaligus.
 *
 * Hanya kategori yang disebut yang disentuh — kaitan produk ke kategori lain
 * dibiarkan apa adanya. Operasi ini sengaja dibuat sesempit itu supaya bisa
 * disusun bertahap: memindahkan produk antar kategori adalah satu penghapusan
 * lalu satu penambahan, masing-masing dengan dampaknya sendiri yang terlihat
 * lebih dulu.
 *
 * Jumlah perubahan wajib dikirim balik dari layar konfirmasi. Kalau katalog
 * bergeser antara melihat dampak dan menyetujuinya, angkanya tidak lagi cocok
 * dan operasi ditolak — lebih baik gagal daripada menyentuh lebih banyak baris
 * daripada yang ditunjukkan.
 *
 * Seluruh penulisan berada dalam satu transaksi: sebagian produk berubah dan
 * sebagian tidak adalah keadaan yang paling sulit ditelusuri belakangan.
 */
export async function bulkAssignCategory(
  productWooIds: number[],
  categoryId: number,
  mode: BulkCategoryMode,
  acknowledgedChangeCount: number
): Promise<void> {
  const prisma = getPrisma();
  const { productIds } = await resolveBulkTargets(productWooIds, categoryId);

  const preview = await previewBulkAssignCategory(productWooIds, categoryId, mode);
  if (preview.willChange !== acknowledgedChangeCount) {
    throw new CategoryOperationError(
      `Jumlah produk yang terdampak berubah sejak dampaknya ditampilkan (sekarang ${preview.willChange}). Lihat dampaknya sekali lagi.`
    );
  }

  if (preview.willChange === 0) {
    throw new CategoryOperationError("Tidak ada yang perlu diubah.");
  }

  await prisma.$transaction(async (tx) => {
    if (mode === "add") {
      await tx.productCategory.createMany({
        data: productIds.map((productId) => ({ productId, categoryId })),
        skipDuplicates: true,
      });
    } else {
      await tx.productCategory.deleteMany({
        where: { productId: { in: productIds }, categoryId },
      });
    }
  });
}

async function nextWooId(): Promise<number> {
  const result = await getPrisma().product.aggregate({ _max: { wooId: true } });
  return (result._max.wooId ?? 0) + 1;
}

async function replaceProductRelations(
  tx: Prisma.TransactionClient,
  productId: number,
  input: Partial<ProductInput>
) {
  if (input.categories !== undefined) {
    await tx.productCategory.deleteMany({ where: { productId } });
    if (input.categories.length) {
      const ids = input.categories.map((c) => c.id);

      // Kategori utama = yang paling dalam di antara yang dipilih. Pemilih
      // kategori mengirim satu jalur utuh (daun beserta seluruh leluhurnya),
      // jadi yang terdalam adalah daun yang benar-benar dipilih staff — tidak
      // perlu pertanyaan tambahan di form untuk sesuatu yang sudah tersirat.
      const rows = await tx.category.findMany({
        where: { id: { in: ids } },
        select: { id: true, depth: true },
      });
      const deepest = rows.reduce<{ id: number; depth: number } | null>(
        (best, row) => (best === null || row.depth > best.depth ? row : best),
        null
      );

      await tx.productCategory.createMany({
        data: ids.map((categoryId) => ({
          productId,
          categoryId,
          isPrimary: categoryId === deepest?.id,
        })),
        skipDuplicates: true,
      });
    }
  }

  if (input.images !== undefined) {
    await tx.productImage.deleteMany({ where: { productId } });
    if (input.images.length) {
      await tx.productImage.createMany({
        data: input.images.map((img, i) => ({
          productId,
          url: img.url,
          position: i,
          isPrimary: i === 0,
        })),
      });
    }
  }

  if (input.attributes !== undefined) {
    // Form admin isi atribut sebagai teks bebas (nama+nilai), bukan pilih dari
    // master data -> upsert ke Attribute/AttributeValue supaya tetap normalisasi.
    await tx.productAttribute.deleteMany({ where: { productId } });
    if (input.attributes.length) {
      let position = 0;
      for (const attr of input.attributes) {
        const value = attr.options[0];
        if (!attr.name?.trim() || !value?.trim()) continue;

        const attribute = await tx.attribute.upsert({
          where: { name: attr.name.trim() },
          create: { name: attr.name.trim() },
          update: {},
        });
        const attributeValue = await tx.attributeValue.upsert({
          where: { attributeId_value: { attributeId: attribute.id, value: value.trim() } },
          create: { attributeId: attribute.id, value: value.trim() },
          update: {},
        });
        await tx.productAttribute.create({
          data: {
            productId,
            attributeId: attribute.id,
            valueId: attributeValue.id,
            position: position++,
          },
        });
      }
    }
  }
}

async function refetchAsWoo(productId: number): Promise<Product> {
  const product = await getPrisma().product.findUniqueOrThrow({
    where: { id: productId },
    include: productInclude,
  });
  return decodeProduct(prismaProductToWoo(product));
}

/** Buat produk baru (dipakai admin panel). Tulis langsung ke Prisma DB (lihat CLAUDE.md §2.2 — WooCommerce tidak lagi dipakai untuk data produk). Gambar tetap diupload lewat WordPress Media API sebelum sampai sini (lihat lib/api/wordpress/media.ts), di sini cuma menyimpan URL-nya. */
export async function createProduct(input: ProductInput): Promise<Product> {
  const prisma = getPrisma();
  const wooId = await nextWooId();
  const slug = slugify(input.name, wooId);
  const stockQty = input.stock_quantity ?? null;
  // Status stok datang eksplisit dari form (Tersedia/Stok Habis) sekarang —
  // "Tersedia" dengan kuantitas kosong berarti stok tidak dilacak, bukan 0.
  // Jangan turunkan status dari kuantitas seperti sebelumnya, itu membuat
  // "Tersedia" tanpa angka diam-diam tersimpan sebagai "Stok Habis".
  const stockStatus =
    input.stock_status === "outofstock"
      ? StockStatus.OUTOFSTOCK
      : input.stock_status === "onbackorder"
        ? StockStatus.ONBACKORDER
        : StockStatus.INSTOCK;

  const created = await prisma.$transaction(async (tx) => {
    const brandId = await resolveBrandId(tx, input.brand);
    const product = await tx.product.create({
      data: {
        wooId,
        type: ProductType.SIMPLE,
        status: STATUS_FROM_PARAM[input.status ?? "draft"],
        name: input.name,
        slug,
        shortDescription: input.short_description || null,
        description: input.description || null,
        regularPrice: input.regular_price || null,
        salePrice: input.sale_price || null,
        saleEndDate: input.date_on_sale_to_gmt ? new Date(input.date_on_sale_to_gmt) : null,
        stockQty,
        stockStatus,
        videoUrl: input.video_url || null,
        brandId,
      },
    });
    await replaceProductRelations(tx, product.id, input);
    return product;
  }, { timeout: 30000 });

  const result = await refetchAsWoo(created.id);
  revalidateTag("products", "max");
  revalidateTag("all-products", "max");
  return result;
}

/** Update produk (dipakai admin panel). `id` di sini adalah woo_id (konvensi lama, tetap dipakai sebagai identifier publik) - lihat getProductById. */
export async function updateProduct(id: number, input: Partial<ProductInput>): Promise<Product> {
  const prisma = getPrisma();
  const existing = await prisma.product.findUnique({ where: { wooId: id } });
  if (!existing) throw new Error(`Produk dengan woo_id=${id} tidak ditemukan`);

  const stockQty = input.stock_quantity;

  const updated = await prisma.$transaction(async (tx) => {
    const brandId =
      input.brand !== undefined ? await resolveBrandId(tx, input.brand) : undefined;
    const product = await tx.product.update({
      where: { id: existing.id },
      data: {
        ...(brandId !== undefined && { brandId }),
        ...(input.name !== undefined && { name: input.name, slug: slugify(input.name, existing.wooId) }),
        ...(input.status !== undefined && {
          status: STATUS_FROM_PARAM[input.status] ?? ProductStatus.DRAFT,
        }),
        ...(input.short_description !== undefined && { shortDescription: input.short_description || null }),
        ...(input.description !== undefined && { description: input.description || null }),
        ...(input.regular_price !== undefined && { regularPrice: input.regular_price || null }),
        ...(input.sale_price !== undefined && { salePrice: input.sale_price || null }),
        ...(input.date_on_sale_to_gmt !== undefined && {
          saleEndDate: input.date_on_sale_to_gmt ? new Date(input.date_on_sale_to_gmt) : null,
        }),
        ...(input.video_url !== undefined && { videoUrl: input.video_url || null }),
        ...(stockQty !== undefined && input.stock_status === undefined && {
          stockQty,
          stockStatus: stockQty > 0 ? StockStatus.INSTOCK : StockStatus.OUTOFSTOCK,
        }),
        ...(input.stock_status !== undefined && {
          stockQty: stockQty !== undefined ? stockQty : null,
          stockStatus: input.stock_status === 'instock' ? StockStatus.INSTOCK : 
                       input.stock_status === 'outofstock' ? StockStatus.OUTOFSTOCK : 
                       StockStatus.ONBACKORDER,
        }),
      },
    });

    if (input.categories || input.images || input.attributes) {
      await replaceProductRelations(tx, product.id, input as ProductInput);
    }
    return product;
  }, { timeout: 30000 });

  const result = await refetchAsWoo(updated.id);
  revalidateTag("products", "max");
  revalidateTag("all-products", "max");
  revalidateTag(`product-${existing.slug}`, "max");
  if (id) {
    revalidateTag(`product-id-${id}`, "max");
  }
  return result;
}

/** Hapus produk beserta relasinya (dipakai admin panel). */
export async function deleteProduct(id: number): Promise<void> {
  const prisma = getPrisma();
  
  const product = await prisma.product.findUnique({
    where: { wooId: id }
  });
  
  if (!product) {
    throw new Error(`Produk dengan woo_id=${id} tidak ditemukan`);
  }

  // Use transaction to ensure everything is deleted cleanly
  await prisma.$transaction(async (tx) => {
    // Relasi akan terhapus otomatis jika onDelete: Cascade diset di schema Prisma.
    // Tapi untuk amannya, kita hapus manual relasinya dulu.
    await tx.productCategory.deleteMany({ where: { productId: product.id } });
    await tx.productImage.deleteMany({ where: { productId: product.id } });
    await tx.productAttribute.deleteMany({ where: { productId: product.id } });
    
    // Hapus variasi jika ini adalah produk variabel
    await tx.product.deleteMany({ where: { parentId: product.id } });
    
    // Hapus produk utama
    await tx.product.delete({ where: { id: product.id } });
  });

  revalidateTag("products", "max");
  revalidateTag("all-products", "max");
  revalidateTag(`product-${product.slug}`, "max");
  revalidateTag(`product-id-${id}`, "max");
}

