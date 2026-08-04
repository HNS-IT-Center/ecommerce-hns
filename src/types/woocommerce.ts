export type ProductImage = {
  id: number;
  src: string;
  alt: string;
};

export type ProductCategory = {
  id: number;
  name: string;
  slug: string;
  parent: number;
  description: string;
  display: string;
  image: ProductImage | null;
  menu_order: number;
  count: number;
};

export type ProductAttribute = {
  id: number;
  name: string;
  slug: string;
  options: string[];
  variation: boolean;
};

export type Product = {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  type: "simple" | "variable" | "grouped" | "external";
  status: "publish" | "draft" | "pending" | "private";
  description: string;
  short_description: string;
  sku: string;
  date_created: string;
  date_modified: string;
  price: string;
  regular_price: string;
  sale_price: string;
  on_sale: boolean;
  date_on_sale_from_gmt: string | null;
  date_on_sale_to_gmt: string | null;
  stock_status: "instock" | "outofstock" | "onbackorder";
  stock_quantity: number | null;
  /** `primary` menandai kategori utama — jalur yang dipakai breadcrumb & URL kanonik. */
  categories: Array<{ id: number; name: string; slug: string; primary?: boolean }>;
  brands: Array<{ id: number; name: string; slug: string }>;
  images: Array<ProductImage>;
  video_url: string | null;
  attributes: Array<ProductAttribute>;
  variations: number[];
  meta_data: Array<{ id: number; key: string; value: unknown }>;
  average_rating: string;
  rating_count: number;
  total_sales: number;
};

export type ProductVariationAttribute = {
  id: number;
  name: string;
  option: string;
};

export type ProductVariation = {
  id: number;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: string;
  on_sale: boolean;
  stock_status: "instock" | "outofstock" | "onbackorder";
  stock_quantity: number | null;
  attributes: Array<ProductVariationAttribute>;
  image: ProductImage | null;
};

export type GetProductsParams = {
  /**
   * `string` = slug kategori tunggal, `number` = id tunggal, `number[]` = satu
   * kategori beserta keturunannya (halaman kategori induk melistkan produk yang
   * menempel di anak-anaknya).
   */
  category?: string | number | number[] | string[];
  excludeCategory?: string | string[];
  brand?: string | string[]; // Custom if using brands taxonomy
  perPage?: number;
  page?: number;
  orderby?: "date" | "id" | "include" | "title" | "slug" | "price" | "popularity" | "rating" | "sku";
  order?: "asc" | "desc";
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  onSale?: boolean;
  featured?: boolean;
  include?: number[];
  exclude?: number[];
  attribute?: string; // slug taxonomy, mis. "pa_kapasitas-storage"
  attributeTerm?: string | number;
  /**
   * Default (tidak diisi) = hanya produk terbit, perilaku yang dibutuhkan
   * storefront. Admin memakai "any" supaya draft dan private ikut terlihat —
   * tanpa itu produk baru, yang defaultnya draft, langsung lenyap dari daftar
   * begitu dibuat.
   */
  status?: "publish" | "draft" | "private" | "any";
  stock_status?: "instock" | "outofstock" | "onbackorder";
};

export type ProductAttributeTaxonomy = {
  id: number;
  name: string;
  slug: string;
};

export type ProductAttributeTerm = {
  id: number;
  name: string;
  count: number;
};

// Payload buat create/update produk lewat admin panel. Cuma field yang
// benar-benar dipakai form admin — WooCommerce menerima jauh lebih banyak
// field opsional daripada ini.
export type ProductInput = {
  name: string;
  type?: "simple";
  status?: "publish" | "draft" | "private";
  description?: string;
  short_description?: string;
  regular_price?: string;
  sale_price?: string;
  date_on_sale_to_gmt?: string;
  manage_stock?: boolean;
  stock_status?: "instock" | "outofstock" | "onbackorder";
  stock_quantity?: number;
  categories?: Array<{ id: number }>;
  attributes?: Array<{ name: string; options: string[]; visible?: boolean }>;
  images?: Array<{ url: string }>;
  video_url?: string | null;
  /** Nama brand apa adanya — dicocokkan/di-upsert di server, bukan id. */
  brand?: string | null;
};
