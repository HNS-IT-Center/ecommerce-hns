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
  price: string;
  regular_price: string;
  sale_price: string;
  on_sale: boolean;
  date_on_sale_from_gmt: string | null;
  date_on_sale_to_gmt: string | null;
  stock_status: "instock" | "outofstock" | "onbackorder";
  stock_quantity: number | null;
  categories: Array<{ id: number; name: string; slug: string }>;
  images: Array<ProductImage>;
  attributes: Array<ProductAttribute>;
  variations: number[];
  meta_data: Array<{ id: number; key: string; value: unknown }>;
  average_rating: string;
  rating_count: number;
  total_sales: number;
};

export type GetProductsParams = {
  category?: string | number;
  brand?: string; // Custom if using brands taxonomy
  perPage?: number;
  page?: number;
  orderby?: "date" | "id" | "include" | "title" | "slug" | "price" | "popularity" | "rating";
  order?: "asc" | "desc";
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  onSale?: boolean;
  featured?: boolean;
  include?: number[];
  exclude?: number[];
};
