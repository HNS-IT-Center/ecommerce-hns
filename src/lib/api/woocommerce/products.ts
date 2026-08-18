import { revalidateTag, unstable_cache } from "next/cache";
import { ProductStatus, ProductType, StockStatus, type Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/prisma/client";
import { prismaProductToWoo, productInclude, STOCK_STATUS_TO_WOO } from "./db-mapper";
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

const STOCK_STATUS_FROM_PARAM = {
  instock: StockStatus.INSTOCK,
  outofstock: StockStatus.OUTOFSTOCK,
  onbackorder: StockStatus.ONBACKORDER,
} as const;

const TYPE_FROM_PARAM = {
  simple: ProductType.SIMPLE,
  variable: ProductType.VARIABLE,
  grouped: ProductType.GROUPED,
  external: ProductType.EXTERNAL,
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

  // Sebelumnya `stock_status` diteruskan pemanggil tapi tidak pernah dibaca di
  // sini, sehingga filter "Stok Kosong" di admin tidak menyaring apa pun —
  // daftar tetap menampilkan seluruh produk.
  if (params.stock_status) {
    where.stockStatus = STOCK_STATUS_FROM_PARAM[params.stock_status];
  }

  if (params.type) {
    where.type = TYPE_FROM_PARAM[params.type];
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

/** Satu entri produk untuk peta situs — hanya yang dibutuhkan `<url>`. */
export type ProductSitemapEntry = {
  slug: string;
  updatedAt: Date;
};

/**
 * Daftar slug produk terbit untuk peta situs.
 *
 * Sengaja TIDAK memakai `getProducts`: fungsi itu ikut menarik gambar, atribut,
 * variasi, dan deskripsi lengkap tiap produk. Untuk ~2.800 produk hasilnya
 * sekitar 8 MB — melewati batas 2 MB data cache Next.js, sehingga cache-nya
 * gagal diam-diam dan seluruh query berat itu diulang setiap peta situs
 * dibangun ulang. Peta situs hanya perlu dua kolom, dan dua kolom itu muat
 * dengan sangat lapang.
 */
export async function getProductsForSitemap(
  limit: number
): Promise<ProductSitemapEntry[]> {
  const fetcher = unstable_cache(
    async () => {
      const products = await getPrisma().product.findMany({
        where: { parentId: null, status: ProductStatus.PUBLISHED },
        select: { slug: true, updatedAt: true },
        orderBy: { id: "desc" },
        take: limit,
      });
      return products;
    },
    [`products-sitemap-${limit}`],
    { revalidate: 3600, tags: ["products", "all-products"] }
  );

  return fetcher();
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

/**
 * Versi tanpa cache dari `getProductById`, khusus form edit admin.
 *
 * Layar ini adalah satu-satunya tempat data yang dibaca langsung dipakai untuk
 * MENULIS kembali: staff membuka form, mengubah satu kolom, lalu menyimpan
 * seluruh isinya. Kalau yang termuat adalah salinan lama, penyimpanan itu
 * mengembalikan nilai usang ke database tanpa ada yang menyadarinya — kerusakan
 * senyap yang jauh lebih mahal daripada waktu muat yang dihemat cache.
 *
 * Biayanya terukur kecil: halaman ini hanya dibuka segelintir staff, dan tanpa
 * cache waktu mautnya masih di bawah ambang yang terasa lambat. Halaman produk
 * publik tetap memakai versi ber-cache di atas — di sana beban trafiknya nyata
 * dan datanya tidak dipakai untuk menulis.
 */
export async function getProductByIdFresh(id: number): Promise<Product | null> {
  try {
    const product = await getPrisma().product.findUnique({
      where: { wooId: id },
      include: productInclude,
    });
    return product ? decodeProduct(prismaProductToWoo(product)) : null;
  } catch {
    return null;
  }
}

/**
 * Kolom & relasi yang benar-benar dibutuhkan sebuah `ProductVariation`.
 *
 * Sengaja BUKAN `productInclude`. Bentuk varian jauh lebih sempit dari produk
 * penuh — tidak ada kategori, tag, brand, maupun deskripsi di dalamnya — dan
 * menarik relasi itu untuk tiap anak berarti puluhan baris tambahan per
 * permintaan yang langsung dibuang oleh pemetaan di bawah. Satu induk dengan 12
 * varian menyeret 12 set kategori dan tag yang tak pernah dibaca.
 *
 * Gambar dibatasi satu: varian hanya menampilkan gambar utamanya.
 */
const variationSelect = {
  wooId: true,
  sku: true,
  regularPrice: true,
  salePrice: true,
  saleEndDate: true,
  stockStatus: true,
  stockQty: true,
  images: { orderBy: { position: "asc" as const }, take: 1 },
  attributes: {
    include: { attribute: true, value: true },
    orderBy: { position: "asc" as const },
  },
};

/** Isi sebenarnya dari `getProductVariations`, dipisah supaya bisa dipanggil
 *  dengan maupun tanpa cache tanpa menduplikasi logikanya. */
async function fetchProductVariations(productId: number): Promise<ProductVariation[]> {
      // Dari induk hanya dibutuhkan harga & satu gambar sebagai cadangan —
      // sebagian besar varian warisan Woo tidak punya gambar sendiri (877 dari
      // 2.077) dan sebagian tidak punya harga. Menarik induk dengan relasi
      // lengkap hanya untuk dua nilai itu adalah pemborosan yang terukur.
      const parent = await getPrisma().product.findUnique({
        where: { wooId: productId },
        select: {
          id: true,
          name: true,
          regularPrice: true,
          salePrice: true,
          saleEndDate: true,
          images: { orderBy: { position: "asc" }, take: 1 },
          variations: { select: { regularPrice: true, salePrice: true } },
        },
      });
      if (!parent) return [];

      // Harga induk produk VARIABLE selalu "mulai dari" varian termurah — sama
      // seperti yang dihitung `prismaProductToWoo`, dihitung ulang di sini
      // supaya induk tidak perlu ditarik lengkap hanya demi angka ini.
      const parentPrices = parent.variations
        .map((v) => ({
          regular: v.regularPrice != null ? Number(v.regularPrice) : null,
          sale: v.salePrice != null ? Number(v.salePrice) : null,
        }))
        .filter((p): p is { regular: number; sale: number | null } => p.regular !== null);

      const saleExpired =
        parent.saleEndDate !== null && parent.saleEndDate.getTime() <= Date.now();

      let parentRegular: string;
      let parentSale: string;
      if (parentPrices.length > 0) {
        const minRegular = Math.min(...parentPrices.map((p) => p.regular));
        const minEffective = Math.min(
          ...parentPrices.map((p) => (p.sale && p.sale > 0 ? p.sale : p.regular)),
        );
        parentRegular = String(minRegular);
        parentSale = minEffective < minRegular ? String(minEffective) : "";
      } else {
        parentRegular = parent.regularPrice ? String(parent.regularPrice) : "0";
        parentSale = saleExpired || !parent.salePrice ? "" : String(parent.salePrice);
      }

      const parentImageRow = parent.images[0];
      const parentImage = parentImageRow
        ? { id: parentImageRow.id, src: parentImageRow.url, alt: parent.name }
        : null;

      const variations = await getPrisma().product.findMany({
        where: { parentId: parent.id },
        select: variationSelect,
        orderBy: { id: "asc" },
      });

      return variations.map((v) => {
        // Varian tanpa harga sendiri mewarisi harga induk ("mulai dari" hasil
        // agregat varian lain). Tanpa ini, memilih varian tersebut membuat harga
        // di halaman produk berubah jadi "0".
        const ownRegular = v.regularPrice != null ? Number(v.regularPrice) : 0;
        const hasOwnPrice = ownRegular > 0;

        // Obral yang tanggalnya sudah lewat diperlakukan seolah tidak ada —
        // dihitung saat baca, sama seperti di `prismaProductToWoo`.
        const ownSaleExpired =
          v.saleEndDate !== null && v.saleEndDate.getTime() <= Date.now();
        const ownSale =
          !ownSaleExpired && v.salePrice != null && Number(v.salePrice) > 0
            ? String(v.salePrice)
            : "";

        const regular_price = hasOwnPrice ? String(ownRegular) : parentRegular;
        const sale_price = hasOwnPrice ? ownSale : parentSale;
        const price = sale_price || regular_price;

        const imageRow = v.images[0];

        return {
          id: v.wooId,
          sku: v.sku ?? "",
          price,
          regular_price,
          sale_price,
          on_sale: Boolean(sale_price),
          stock_status: v.stockStatus
            ? STOCK_STATUS_TO_WOO[v.stockStatus] ?? "instock"
            : "instock",
          stock_quantity: v.stockQty,
          // Satu nilai per atribut, yang PERTAMA menurut `position`.
          //
          // Data warisan Woo punya baris rusak yang menyimpan dua nilai untuk
          // atribut yang sama pada satu varian (mis. woo 15443: UKURAN="1\" dan
          // UKURAN="5M"). Varian hanya boleh punya satu nilai per atribut —
          // dengan dua entri bernama sama, pencocokan pilihan di halaman produk
          // jadi ambigu. Mengambil yang pertama menyamai perilaku lama lewat
          // `options[0]`, jadi tak ada produk yang berubah tampilannya.
          attributes: (() => {
            const seen = new Set<number>();
            const result: ProductVariation["attributes"] = [];
            for (const pa of v.attributes) {
              if (seen.has(pa.attribute.id)) continue;
              seen.add(pa.attribute.id);
              result.push({
                id: pa.attribute.id,
                name: pa.attribute.name,
                option: pa.value.value,
              });
            }
            return result;
          })(),
          image: imageRow ? { id: imageRow.id, src: imageRow.url, alt: "" } : parentImage,
        };
      });
}

/** Detail per varian (harga/stok/SKU spesifik) untuk produk `type: "variable"`. */
export async function getProductVariations(productId: number): Promise<ProductVariation[]> {
  const fetcher = unstable_cache(
    () => fetchProductVariations(productId),
    [`product-${productId}-variations`],
    { revalidate: 300, tags: [`product-${productId}-variations`] }
  );
  return fetcher();
}

/**
 * Versi tanpa cache, khusus form edit admin — alasannya sama dengan
 * `getProductByIdFresh`: isi form ini disimpan kembali ke database, jadi
 * membacanya dari salinan lama berarti menulis ulang data usang.
 */
export async function getProductVariationsFresh(productId: number): Promise<ProductVariation[]> {
  return fetchProductVariations(productId);
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
      // Diurutkan supaya daftar saran terbaca konsisten — tanpa ini urutannya
      // mengikuti urutan sisip, dan 296 nilai WARNA tampil acak.
      const terms = await getPrisma().attributeValue.findMany({
        where: { attributeId },
        orderBy: { value: "asc" },
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

/**
 * `client` sengaja bisa diisi transaction client: saat membuat banyak varian
 * sekaligus, id harus dihitung dari data DI DALAM transaksi yang sedang
 * berjalan. Membacanya lewat koneksi lain akan melewatkan baris yang baru
 * dibuat beberapa langkah sebelumnya, dan seluruh varian berebut wooId yang
 * sama sampai unique constraint-nya gagal.
 */
async function nextWooId(client: Prisma.TransactionClient | ReturnType<typeof getPrisma> = getPrisma()): Promise<number> {
  const result = await client.product.aggregate({ _max: { wooId: true } });
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
        if (!attr.name?.trim()) continue;

        const attribute = await tx.attribute.upsert({
          where: { name: attr.name.trim() },
          create: { name: attr.name.trim() },
          update: {},
        });

        // SELURUH nilai disimpan, bukan cuma `options[0]` seperti sebelumnya.
        // Atribut spek memang hanya punya satu nilai, tapi atribut pembeda
        // varian membawa seluruh pilihan (mis. 9 warna) — mengambil elemen
        // pertama saja akan memangkasnya jadi satu dan menghapus pilihan
        // pembeli di halaman produk.
        const seen = new Set<string>();
        for (const rawValue of attr.options) {
          const value = rawValue?.trim();
          if (!value || seen.has(value.toLowerCase())) continue;
          seen.add(value.toLowerCase());

          const valueId = await resolveAttributeValueId(tx, attribute.id, value);
          await tx.productAttribute.create({
            data: {
              productId,
              attributeId: attribute.id,
              valueId,
              position: position++,
            },
          });
        }
      }
    }
  }
}

/**
 * Operasi varian yang ditolak karena akan merusak relasi induk-anak.
 * Dibedakan dari Error biasa supaya route API bisa membalas 400 dengan pesan
 * yang bisa dibaca admin, bukan 500 "Gagal menyimpan produk" yang buntu.
 */
export class ProductVariationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductVariationError";
  }
}

const STOCK_STATUS_FROM_INPUT = {
  instock: StockStatus.INSTOCK,
  outofstock: StockStatus.OUTOFSTOCK,
  onbackorder: StockStatus.ONBACKORDER,
} as const;

/**
 * Cari-atau-buat nilai atribut ("MERAH", "XL", "2 Meter").
 *
 * CATATAN KAPITALISASI: kolom `attribute_values.value` memakai kolasi bawaan
 * MySQL/MariaDB yang mengabaikan besar-kecil huruf, dan unique constraint
 * `attribute_values_attribute_id_value_key` ikut memakainya. Konsekuensinya
 * "HITAM" dan "Hitam" TIDAK bisa hidup berdampingan sebagai dua baris — dan
 * nilai yang lebih dulu ada yang menang.
 *
 * Jadi kalau admin mengetik "HITAM" sedangkan database sudah menyimpan "Hitam"
 * dari data warisan WooCommerce, yang tampil di toko tetap "Hitam". Ini
 * disengaja dibiarkan: menyeragamkan ejaan lintas 892 nilai atribut yang ada
 * adalah pekerjaan pembersihan data tersendiri, dan mengubah kolasi kolom
 * berisiko memecah nilai yang selama ini dianggap sama.
 *
 * Perilaku ini identik dengan `upsert`, tapi ditulis eksplisit supaya alasannya
 * terbaca dan tidak "diperbaiki" jadi sesuatu yang tidak bisa bekerja.
 */
async function resolveAttributeValueId(
  tx: Prisma.TransactionClient,
  attributeId: number,
  value: string,
): Promise<number> {
  const existing = await tx.attributeValue.findFirst({ where: { attributeId, value } });
  if (existing) return existing.id;

  const created = await tx.attributeValue.create({ data: { attributeId, value } });
  return created.id;
}

/**
 * Samakan daftar varian di database dengan yang dikirim form.
 *
 * Tiap varian disimpan sebagai baris `products` tersendiri bertipe VARIATION
 * yang menunjuk induk lewat `parentId` — struktur warisan WooCommerce yang
 * sudah dipakai 2.077 varian yang ada, jadi varian baru mengikuti pola sama
 * dan tetap terbaca oleh mapper maupun halaman produk.
 *
 * Varian lama yang tidak lagi ada di input akan DIHAPUS, jadi pemanggil wajib
 * mengirim daftar varian yang lengkap, bukan sebagian.
 */
async function syncProductVariations(
  tx: Prisma.TransactionClient,
  parent: { id: number; name: string; status: ProductStatus },
  variationAttributes: string[],
  variations: NonNullable<ProductInput["variations"]>,
): Promise<void> {
  // Dipetakan lewat `wooId`, BUKAN id database.
  //
  // `ProductVariation.id` yang dibaca form (dari `getProductVariations`) adalah
  // wooId — identifier publik yang dipakai seluruh sistem. Sebelumnya fungsi ini
  // mencocokkannya dengan id database, sehingga varian yang sudah ada dianggap
  // baru: ia mencoba membuat baris duplikat dan gagal pada unique constraint
  // SKU, atau — kalau SKU-nya kosong — diam-diam menggandakan varian lalu
  // menghapus yang lama.
  const existing = await tx.product.findMany({
    where: { parentId: parent.id },
    select: { id: true, wooId: true },
  });
  const idByWooId = new Map(existing.map((v) => [v.wooId, v.id]));
  const existingIds = new Set(existing.map((v) => v.id));

  const keptIds = new Set<number>();

  for (const variation of variations) {
    // Label varian ikut di nama supaya baris VARIATION tetap bisa dikenali saat
    // dilihat langsung di database atau di log produk.
    const label = variationAttributes
      .map((name) => variation.attributes[name])
      .filter(Boolean)
      .join(" / ");
    const name = label ? `${parent.name} - ${label}` : parent.name;

    const data = {
      name,
      // Varian mewarisi status induk: varian terbit di bawah induk draft tidak
      // punya arti, karena halamannya sendiri tidak pernah tampil.
      status: parent.status,
      sku: variation.sku?.trim() || null,
      regularPrice: variation.regular_price || null,
      salePrice: variation.sale_price || null,
      stockStatus: STOCK_STATUS_FROM_INPUT[variation.stock_status ?? "instock"],
      stockQty: variation.stock_quantity ?? null,
    };

    let variationId: number;

    // Cocokkan lewat wooId lebih dulu; id database tetap diterima supaya
    // pemanggil lama (mis. skrip) tidak ikut rusak.
    const matchedId =
      variation.id === undefined
        ? undefined
        : idByWooId.get(variation.id) ?? (existingIds.has(variation.id) ? variation.id : undefined);

    if (matchedId !== undefined) {
      await tx.product.update({ where: { id: matchedId }, data });
      variationId = matchedId;
    } else {
      const wooId = await nextWooId(tx);
      const created = await tx.product.create({
        data: {
          ...data,
          wooId,
          type: ProductType.VARIATION,
          parentId: parent.id,
          slug: slugify(name, wooId),
        },
      });
      variationId = created.id;
    }

    keptIds.add(variationId);

    // Gambar & atribut ditulis ulang seluruhnya — jumlahnya sedikit per varian,
    // dan cara ini menghindari penelusuran beda yang rumit tanpa manfaat nyata.
    await tx.productImage.deleteMany({ where: { productId: variationId } });
    if (variation.image_url?.trim()) {
      await tx.productImage.create({
        data: { productId: variationId, url: variation.image_url.trim(), position: 0, isPrimary: true },
      });
    }

    await tx.productAttribute.deleteMany({ where: { productId: variationId } });
    let position = 0;
    for (const attributeName of variationAttributes) {
      const value = variation.attributes[attributeName]?.trim();
      if (!attributeName.trim() || !value) continue;

      const attribute = await tx.attribute.upsert({
        where: { name: attributeName.trim() },
        create: { name: attributeName.trim() },
        update: {},
      });
      const valueId = await resolveAttributeValueId(tx, attribute.id, value);
      await tx.productAttribute.create({
        data: { productId: variationId, attributeId: attribute.id, valueId, position: position++ },
      });
    }
  }

  // Varian yang dibuang admin ikut dihapus beserta relasinya (onDelete: Cascade
  // di schema menangani gambar & atribut).
  const removed = [...existingIds].filter((id) => !keptIds.has(id));
  if (removed.length) {
    await tx.product.deleteMany({ where: { id: { in: removed } } });
  }

  // Induk menyimpan gabungan seluruh nilai varian sebagai daftar pilihan —
  // ini yang dibaca `prismaProductToWoo` untuk menyusun tombol di halaman produk.
  //
  // HANYA atribut pembeda varian yang dihapus di sini. Dulu barisnya
  // `deleteMany({ productId: parent.id })` tanpa syarat, dan itu menghapus
  // SELURUH atribut induk — termasuk spesifikasi yang baru saja ditulis
  // `replaceProductRelations` beberapa langkah sebelumnya (fungsi ini berjalan
  // sesudahnya). Akibatnya atribut seperti "Motherboard Size" yang dipakai PC
  // Builder lenyap setiap kali produk bervariasi disimpan, tanpa pesan apa pun.
  const variationAttributeIds: number[] = [];
  const attributeByName = new Map<string, { id: number }>();
  for (const attributeName of variationAttributes) {
    const trimmedName = attributeName.trim();
    if (!trimmedName) continue;
    const attribute = await tx.attribute.upsert({
      where: { name: trimmedName },
      create: { name: trimmedName },
      update: {},
    });
    attributeByName.set(attributeName, attribute);
    variationAttributeIds.push(attribute.id);
  }

  if (variationAttributeIds.length > 0) {
    await tx.productAttribute.deleteMany({
      where: { productId: parent.id, attributeId: { in: variationAttributeIds } },
    });
  }

  // Posisi dilanjutkan dari atribut spesifikasi yang sudah ada supaya urutannya
  // tidak bertabrakan.
  const lastPosition = await tx.productAttribute.aggregate({
    where: { productId: parent.id },
    _max: { position: true },
  });
  let parentPosition = (lastPosition._max.position ?? -1) + 1;

  for (const attributeName of variationAttributes) {
    const attribute = attributeByName.get(attributeName);
    if (!attribute) continue;

    const seen = new Set<string>();
    for (const variation of variations) {
      const value = variation.attributes[attributeName]?.trim();
      if (!value || seen.has(value.toLowerCase())) continue;
      seen.add(value.toLowerCase());

      const valueId = await resolveAttributeValueId(tx, attribute.id, value);
      await tx.productAttribute.create({
        data: { productId: parent.id, attributeId: attribute.id, valueId, position: parentPosition++ },
      });
    }
  }
}

/**
 * Profil kedaluwarsa untuk `revalidateTag`: entri yang ditandai basi langsung
 * dibuang, bukan disajikan lagi sambil disegarkan di belakang. Ini setara
 * dengan yang dilakukan `updateTag` secara internal — dipakai lewat
 * `revalidateTag` karena `updateTag` melempar kalau dipanggil dari route
 * handler, dan form produk menyimpan lewat /api/admin/products.
 */
const EXPIRE_NOW = { expire: 0 } as const;

/**
 * Buang seluruh cache yang menyangkut satu produk, seketika.
 *
 * Dua hal penting yang dulu salah di sini:
 *
 * 1. Profil `"max"`. Di Next 16 argumen kedua `revalidateTag` adalah masa hidup
 *    entri yang sudah ditandai basi — `"max"` justru memberi umur PALING PANJANG,
 *    sehingga permintaan berikutnya tetap disajikan dari cache lama. Halaman edit
 *    admin karena itu masih menampilkan harga sebelum penyuntingan. Menghilangkan
 *    argumennya berarti kedaluwarsa segera, yaitu perilaku `updateTag` —
 *    yang sendirinya tidak bisa dipakai karena melempar kalau dipanggil dari
 *    route handler, dan form produk memang menyimpan lewat /api/admin/products.
 *
 * 2. Tag varian tidak pernah ikut dibuang, jadi daftar varian bisa basi sampai
 *    300 detik walau produknya baru saja disunting.
 *
 * Slug ikut diterima karena halaman produk publik di-cache per slug, dan slug
 * berubah setiap kali nama produk diganti — tanpa membuang slug LAMA, halaman
 * dengan alamat sebelumnya tetap menyajikan isi usang.
 */
function invalidateProductCaches(options: {
  wooId?: number;
  slugs?: (string | null | undefined)[];
}): void {
  // Daftar & katalog selalu ikut, karena harga/nama/stok tampil di sana juga.
  revalidateTag("products", EXPIRE_NOW);
  revalidateTag("all-products", EXPIRE_NOW);

  if (options.wooId !== undefined) {
    revalidateTag(`product-id-${options.wooId}`, EXPIRE_NOW);
    revalidateTag(`product-${options.wooId}-variations`, EXPIRE_NOW);
  }

  for (const slug of options.slugs ?? []) {
    if (slug) revalidateTag(`product-${slug}`, EXPIRE_NOW);
  }
}

async function refetchAsWoo(productId: number): Promise<Product> {
  const product = await getPrisma().product.findUniqueOrThrow({
    where: { id: productId },
    include: productInclude,
  });
  return decodeProduct(prismaProductToWoo(product));
}

/** Buat produk baru (dipakai admin panel). Tulis langsung ke Prisma DB (lihat CLAUDE.md §2.2 — WooCommerce tidak lagi dipakai untuk data produk). Gambar sudah diupload ke Cloudflare R2 sebelum sampai sini (lihat lib/api/cloudflare/r2.ts, dipanggil lewat POST /api/admin/media), di sini cuma menyimpan URL-nya. BUKAN WordPress Media API — jalur itu sudah mati. */
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

  const isVariable = input.type === "variable";
  const status = STATUS_FROM_PARAM[input.status ?? "draft"];

  const created = await prisma.$transaction(async (tx) => {
    const brandId = await resolveBrandId(tx, input.brand);
    const product = await tx.product.create({
      data: {
        wooId,
        type: isVariable ? ProductType.VARIABLE : ProductType.SIMPLE,
        status,
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

    // Dijalankan SETELAH replaceProductRelations: fungsi itu menulis atribut
    // biasa milik induk, sedangkan sinkronisasi varian menulis ulang atribut
    // induk sebagai daftar pilihan varian. Urutan terbalik akan membuat daftar
    // pilihan tertimpa dan selector di halaman produk kosong.
    if (isVariable) {
      await syncProductVariations(
        tx,
        { id: product.id, name: product.name, status },
        input.variation_attributes ?? [],
        input.variations ?? [],
      );
    }
    return product;
  }, { timeout: 30000 });

  const result = await refetchAsWoo(created.id);
  invalidateProductCaches({ wooId, slugs: [slug] });
  return result;
}

/** Update produk (dipakai admin panel). `id` di sini adalah woo_id (konvensi lama, tetap dipakai sebagai identifier publik) - lihat getProductById. */
export async function updateProduct(id: number, input: Partial<ProductInput>): Promise<Product> {
  const prisma = getPrisma();
  const existing = await prisma.product.findUnique({ where: { wooId: id } });
  if (!existing) throw new Error(`Produk dengan woo_id=${id} tidak ditemukan`);

  const stockQty = input.stock_quantity;

  // Produk yang punya anak tidak boleh diturunkan jadi SIMPLE begitu saja —
  // anak-anaknya akan menggantung dengan parentId yang tidak lagi bermakna
  // (schema memakai onDelete: SetNull, jadi kerusakannya senyap). Admin harus
  // menghapus varian lebih dulu kalau memang mau mengubahnya jadi produk biasa.
  if (input.type === "simple" && existing.type === ProductType.VARIABLE) {
    const variationCount = await prisma.product.count({ where: { parentId: existing.id } });
    if (variationCount > 0) {
      throw new ProductVariationError(
        `Produk ini punya ${variationCount} varian. Hapus semua varian dulu sebelum mengubahnya jadi produk biasa.`,
      );
    }
  }

  const nextStatus = input.status !== undefined ? STATUS_FROM_PARAM[input.status] ?? ProductStatus.DRAFT : existing.status;
  const nextType =
    input.type === undefined
      ? existing.type
      : input.type === "variable"
        ? ProductType.VARIABLE
        : ProductType.SIMPLE;

  const updated = await prisma.$transaction(async (tx) => {
    const brandId =
      input.brand !== undefined ? await resolveBrandId(tx, input.brand) : undefined;
    const product = await tx.product.update({
      where: { id: existing.id },
      data: {
        ...(brandId !== undefined && { brandId }),
        ...(input.type !== undefined && { type: nextType }),
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
        // Status diturunkan dari jumlah HANYA kalau jumlahnya benar-benar angka
        // dan status tidak dikirim eksplisit. `null` berarti "tidak dilacak per
        // jumlah", bukan "nol" — menurunkan status darinya akan menandai habis
        // produk yang sebenarnya tersedia.
        ...(typeof stockQty === "number" && input.stock_status === undefined && {
          stockQty,
          stockStatus: stockQty > 0 ? StockStatus.INSTOCK : StockStatus.OUTOFSTOCK,
        }),
        ...(input.stock_status !== undefined && {
          stockQty: stockQty ?? null,
          stockStatus: input.stock_status === 'instock' ? StockStatus.INSTOCK : 
                       input.stock_status === 'outofstock' ? StockStatus.OUTOFSTOCK : 
                       StockStatus.ONBACKORDER,
        }),
      },
    });

    if (input.categories || input.images || input.attributes) {
      await replaceProductRelations(tx, product.id, input as ProductInput);
    }

    // Sama seperti createProduct: harus setelah replaceProductRelations supaya
    // daftar pilihan varian di induk tidak tertimpa atribut biasa.
    if (nextType === ProductType.VARIABLE && input.variations !== undefined) {
      await syncProductVariations(
        tx,
        { id: product.id, name: product.name, status: nextStatus },
        input.variation_attributes ?? [],
        input.variations,
      );
    }
    return product;
  }, { timeout: 30000 });

  const result = await refetchAsWoo(updated.id);
  // Slug lama DAN baru dibuang: mengganti nama produk mengubah slug, dan tanpa
  // membuang yang lama, alamat sebelumnya tetap menyajikan isi usang sampai
  // masa cache-nya habis.
  invalidateProductCaches({ wooId: id, slugs: [existing.slug, updated.slug] });
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

  invalidateProductCaches({ wooId: id, slugs: [product.slug] });
}

