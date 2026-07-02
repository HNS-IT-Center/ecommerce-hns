# Page & Component Planning â€” HNS IT Center

## Ekosistem Sistem
**Ringkasan Singkat:** Website Next.js berfungsi sebagai storefront retail utama yang melayani pembelian produk (katalog, builder, cart). Di sisi lain, sistem seperti **Warranty Management** dan **Service Management** adalah web app eksternal yang dihosting secara terpisah (via subdomain seperti `sso.hnsitcenter.id`). Pengguna yang sudah login di Next.js akan bisa masuk ke sistem eksternal tersebut secara otomatis menggunakan integrasi SSO. Di project Next.js ini, kita hanya perlu merancang **entry point** (tombol/link) menuju sistem eksternal tersebut di lokasi yang relevan (misalnya Header, Footer, Account, dan Support Page) dan bukan mem-build ulang halamannya di Next.js.

---

## Kelompok 1: Homepage & Catalog

### Page Planning

#### Homepage (`/`)
- **Purpose:** Entry point utama website. Etalase digital untuk menunjukkan otoritas toko (toko fisik jelas, brand resmi) dan mempromosikan kategori/produk andalan.
- **Target user:** Semua persona (Gamer, Pekerja, Pemilik Bisnis) yang baru masuk ke situs.
- **Business goal:** Membangun *trust* dalam 5 detik pertama, mengarahkan trafik ke kategori produk, dan mendorong konversi cepat lewat promo harian.
- **Required components (P0):**
  - `HeroBanner` (Slider promo utama)
  - `TrustIndicators` (6 poin keunggulan toko HNS)
  - `BrandCarousel` (Logo Asus, MSI, Acer, Lenovo, dll)
  - `DealsOfTheDay` (Carousel produk diskon dengan countdown timer)
  - `NewItemsTabs` (Tab untuk memisahkan produk baru: Laptop, PC Components, Gaming Gears)
  - `StoreLocationsBrief` (Info singkat 2 lokasi toko fisik & jam buka)
- **Optional components (P1):** Artikel blog terbaru, testimonial dari Google Maps.
- **Required data:** `getProducts` (filter `featured=true` atau `onSale=true`), data kategori, dan data brand.
- **CTA utama:** "Belanja Sekarang", "Lihat Promo", "Kunjungi Toko".
- **SEO considerations:** Title: `HNS IT Center - Toko Komputer & IT Terlengkap di Batam`. Description: `Toko komputer terpercaya di Batam. Melayani rakit PC, service laptop, dan penjualan komponen IT bergaransi resmi.`. Schema: `Organization`, `LocalBusiness`, `WebSite`.
- **External SSO entry points:** Menu navigasi "Layanan" di Header, dan link di Footer menuju Warranty & Service.

#### Shop (`/shop`)
- **Purpose:** Katalog utama yang menampilkan seluruh produk HNS IT Center dengan kemampuan pencarian terarah.
- **Target user:** User yang ingin *browsing* atau mencari spesifikasi/range harga tertentu.
- **Business goal:** *Product discovery* yang mulus agar user cepat menemukan produk yang sesuai, mengurangi bounce rate katalog.
- **Required components (P0):**
  - `FilterSidebar` (Kategori, Harga, Brand, Ketersediaan)
  - `SortSelector` (Urutkan dari termurah, termahal, terbaru)
  - `ProductGrid` (Layout grid responsif untuk kartu produk)
  - `Pagination`
- **Optional components (P1):** Banner promo dinamis berdasarkan filter aktif.
- **Required data:** `getProductsPaginated` dengan argument filter dari URL `searchParams`.
- **CTA utama:** "Tambah ke Keranjang", "Lihat Detail".
- **SEO considerations:** Title: `Katalog Produk Komputer & IT - HNS IT Center`. Schema: `CollectionPage`, `BreadcrumbList`.
- **External SSO entry points:** Tidak ada secara langsung.

#### Product Detail (`/product/[slug]`)
*(Catatan: Bagian otentikasi guest/member seperti MemberPriceBadge, LoginCTA, dan PriceTag sudah di-plan di `notes/feature-guest-member.md` dan terintegrasi di sini)*
- **Purpose:** Menampilkan informasi detail, spesifikasi, dan foto produk secara menyeluruh untuk meyakinkan pembeli.
- **Target user:** User dengan intent pembelian tinggi.
- **Business goal:** Konversi langsung (Checkout / WhatsApp Order).
- **Required components (P0):**
  - `ProductGallery` (Galeri foto produk dengan thumbnail & zoom)
  - `ProductInfo` (Nama, SKU, Garansi, Highlight spec)
  - `ProductVariations` (Pilihan warna, ukuran memori jika tipe produk adalah *variable*)
  - `StockBadge` (Tersedia/Habis/Menipis)
  - `ProductTabs` (Tab untuk: Deskripsi Panjang & Spesifikasi Teknis)
  - `RelatedProducts` (Up-sell / Cross-sell)
- **Optional components (P1):** Review dan rating customer.
- **Required data:** `getProductBySlug(slug)` dan produk terkait.
- **CTA utama:** "Beli via WhatsApp", "Tambah ke Keranjang".
- **SEO considerations:** Title: `[Nama Produk] - HNS IT Center`. Description mengambil `short_description`. Schema: `Product` (dengan penyesuaian penawaran harga sesuai schema WooCommerce).
- **External SSO entry points:** Tidak ada secara langsung.

#### Category Page (`/category/[slug]`)
- **Purpose:** Etalase khusus untuk satu jenis produk (misalnya: "Laptop Gaming" atau "Monitor").
- **Target user:** User yang mencari jenis perangkat spesifik.
- **Business goal:** Landing page yang sangat SEO-friendly untuk pencarian kata kunci organik spesifik (e.g. "Jual Laptop Gaming Batam").
- **Required components (P0):**
  - `CategoryHeader` (Nama kategori & deskripsi SEO)
  - `FilterSidebar` (Filter yang relevan untuk kategori tersebut)
  - `ProductGrid` & `Pagination`
- **Optional components (P1):** Sub-category chips (filter cepat di atas grid).
- **Required data:** `getProductsPaginated(category=slug)`, `getCategoryBySlug`.
- **CTA utama:** Klik produk.
- **SEO considerations:** Title: `Jual [Nama Kategori] Resmi di Batam - HNS IT Center`. Schema: `CollectionPage`, `BreadcrumbList`.
- **External SSO entry points:** Tidak ada.

#### Brand Page (`/brand/[slug]`)
- **Purpose:** Menampilkan produk khusus dari satu merek partner (misal: "ASUS", "MSI").
- **Target user:** Brand-loyalist atau gamer yang ingin build satu ekosistem brand.
- **Business goal:** Mendukung promosi brand partner dan SEO untuk keyword brand lokal.
- **Required components (P0):**
  - `BrandHeader` (Logo besar brand & deskripsi singkat)
  - `FilterSidebar`, `ProductGrid`, `Pagination`
- **Optional components (P1):** Hero banner khusus brand tersebut.
- **Required data:** `getProductsPaginated(brand=slug)` (Asumsi: brand dikelola via product attributes/categories di WooCommerce).
- **CTA utama:** Klik produk.
- **SEO considerations:** Title: `Produk [Brand] Garansi Resmi di Batam - HNS IT Center`.
- **External SSO entry points:** Tidak ada.

#### Search Results (`/search`)
- **Purpose:** Menampilkan hasil pencarian berdasarkan keyword (Fase 1: via WooCommerce search).
- **Target user:** User yang tahu persis apa yang mereka cari (intent tertinggi).
- **Business goal:** Mengurangi drop-off dengan memberikan hasil yang relevan.
- **Required components (P0):**
  - `SearchPageHeader` (Menampilkan "Hasil pencarian untuk: [Keyword]")
  - `FilterSidebar`, `ProductGrid`, `Pagination`
  - `EmptySearchState` (Tampilan ramah jika produk tidak ditemukan, menampilkan kata kunci saran atau kategori populer)
- **Optional components (P1):** Top trending searches.
- **Required data:** `getProductsPaginated(search=keyword)`.
- **CTA utama:** Klik produk / ulangi pencarian.
- **SEO considerations:** Meta tag `<meta name="robots" content="noindex, follow">` untuk mencegah Google mengindeks ribuan halaman search (best practice SEO).
- **External SSO entry points:** Tidak ada.

---

### Component Planning

#### `components/layout/`
- **`Header`**
  - **Purpose:** Navigasi utama global, search bar, cart, dan akses akun/SSO.
  - **Props:** `cartItemCount: number`, `isLoggedIn: boolean`
  - **Responsive:** Hamburger menu di mobile dengan drawer; navigasi inline di desktop.
  - **Reusability:** Global (layout.tsx).
- **`Footer`**
  - **Purpose:** Menampilkan informasi penting, kontak, lokasi, SEO links, info Bank, dan SSO links (Warranty/Service).
  - **Props:** None.
  - **Responsive:** Stack vertikal di mobile, 4 kolom grid di desktop.
  - **Reusability:** Global (layout.tsx).

#### `components/shared/`
- **`ProductCard`**
  - **Purpose:** Kartu etalase produk (gambar, judul, harga, tag).
  - **Props:** `product: Product`
  - **Responsive:** Lebar penuh di mobile grid (2 kolom), ukuran tetap di desktop (4-5 kolom).
  - **Reusability:** Dipakai di Shop, Category, Brand, Search, Homepage, Related Products.
- **`TrustIndicators`**
  - **Purpose:** Baris icon + teks yang menjelaskan 6 nilai jual HNS IT Center (Harga Terbaik, Garansi Resmi, dll).
  - **Props:** None (Static).
  - **Responsive:** Swipeable row (mobile) / Grid 6 kolom (desktop).
  - **Reusability:** Homepage, About Us.
- **`BrandCarousel`**
  - **Purpose:** Slider otomatis menampilkan logo-logo brand partner.
  - **Props:** `brands: Array<{ id: string, name: string, logo: string }>`
  - **Responsive:** Menampilkan 3 logo (mobile) hingga 6-8 logo (desktop) bersamaan.
  - **Reusability:** Homepage, Footer area.
- **`ExternalAppLinkCard`**
  - **Purpose:** Entry point menuju aplikasi eksternal via SSO.
  - **Props:** `appName: string`, `description: string`, `icon: ReactNode`, `url: string`, `ctaText: string`
  - **Responsive:** Full width mobile, card proporsional desktop.
  - **Reusability:** Account, Support, Menu Dropdowns.

#### `features/product/components/`
- **`DealsOfTheDay`**
  - **Purpose:** Section promo dengan timer mundur dan slider produk.
  - **Props:** `products: Product[]`, `endTime: Date`
  - **Responsive:** Scroll horizontal di mobile, grid/slider panah di desktop.
  - **Reusability:** Homepage.
- **`NewItemsTabs`**
  - **Purpose:** Menampilkan produk terbaru dipisah berdasarkan kategori via Tabs.
  - **Props:** `tabs: Array<{ label: string, categoryId: string, products: Product[] }>`
  - **Responsive:** Tab scrollable di mobile, rapi di desktop.
  - **Reusability:** Homepage.
- **`ProductGallery`**
  - **Purpose:** Menampilkan foto utama produk dan thumbnail.
  - **Props:** `images: ProductImage[]`
  - **Responsive:** Swiper di mobile, Thumbnail grid di sebelah kiri/bawah gambar utama di desktop.
  - **Reusability:** Product Detail (`/product/[slug]`).
- **`ProductVariations`**
  - **Purpose:** Memilih opsi (RAM, Storage, Warna) jika produk adalah Variable Product.
  - **Props:** `attributes: ProductAttribute[]`, `onSelect: (attr: string, val: string) => void`
  - **Responsive:** Buttons flex-wrap.
  - **Reusability:** Product Detail.

#### `features/filter/components/`
- **`FilterSidebar`**
  - **Purpose:** Panel filter untuk menyaring hasil katalog.
  - **Props:** `categories: Category[]`, `brands: Brand[]`, `activeFilters: Record<string, string>`, `onChange: (filters) => void`
  - **Responsive:** Tersembunyi di dalam Sheet/Drawer di mobile (dengan tombol "Filter"); Sidebar permanen di kiri pada desktop.
  - **Reusability:** Shop, Category, Brand, Search.
- **`SortSelector`**
  - **Purpose:** Dropdown untuk mengurutkan produk (terbaru, harga termurah).
  - **Props:** `currentSort: string`, `onChange: (sort) => void`
  - **Responsive:** Full width select mobile, dropdown compact desktop.
  - **Reusability:** Mendampingi FilterSidebar.

## Kelompok 2: Transaksional & Builder

### Page Planning

#### Cart (/cart)
- **Purpose:** Tempat user meninjau kembali produk yang ingin dibeli, mengubah jumlah (qty), atau menghapus item sebelum checkout.
- **Target user:** User yang sudah memiliki niat beli (High intent).
- **Business goal:** Transparansi harga total (termasuk estimasi diskon/pajak jika ada) untuk mengurangi *cart abandonment*.
- **Required components (P0):**
  - CartItemList (Daftar produk dengan pengatur jumlah & tombol hapus)
  - CartSummary (Rincian subtotal, diskon, dan total akhir)
  - EmptyCartState (Jika keranjang kosong, beri CTA kembali belanja)
- **Optional components (P1):** Cross-sell "Mungkin Anda juga butuh" (misal: kabel HDMI, mousepad).
- **Required data:** State dari useCartStore (Zustand client-side).
- **CTA utama:** "Lanjut ke Checkout".
- **SEO considerations:** Meta tag 
oindex, nofollow (halaman privat/transaksional tidak boleh diindeks).
- **External SSO entry points:** Tidak ada.

#### Checkout (/checkout)
- **Purpose:** Mengumpulkan informasi pengiriman/kontak pembeli dan menyelesaikan pesanan. (Untuk Fase 1, diarahkan ke WhatsApp).
- **Target user:** User di tahap paling akhir dari *funnel* pembelian.
- **Business goal:** Mengamankan transaksi (konversi). Desain harus sangat minim distraksi.
- **Required components (P0):**
  - CheckoutForm (Form data diri, alamat, catatan pesanan)
  - OrderSummary (Ringkasan final keranjang)
- **Optional components (P1):** Payment method selector (disembunyikan/statis di Fase 1 karena full via WA).
- **Required data:** useCartStore untuk data item, integrasi dengan WooCommerce API createOrder (opsional di Fase 1, atau murni generate format text WA).
- **CTA utama:** "Kirim Pesanan via WhatsApp".
- **SEO considerations:** Meta tag 
oindex, nofollow.
- **External SSO entry points:** Tidak ada.

#### PC Builder (/build-pc)
- **Purpose:** Alat interaktif yang memungkinkan user merakit PC impian mereka komponen demi komponen dengan panduan sistem.
- **Target user:** PC Enthusiast, Gamer, atau user awam yang butuh PC custom tapi takut salah beli part.
- **Business goal:** **Differentiator utama HNS IT Center.** Mendorong pembelian set PC lengkap (AOV tinggi) dengan memberikan pengalaman visual dan teknis yang meyakinkan.
- **Required components (P0):**
  - BuilderStepList (Navigasi step-by-step: CPU -> Motherboard -> RAM -> GPU, dst.)
  - PartSelector (List produk per kategori yang bisa difilter & dipilih)
  - BuildSummary (Sidebar/Bottom sheet berisi total harga sementara dan status kelengkapan)
  - CompatibilityWarning (Peringatan jika misal CPU Intel dipasang ke Mobo AM5)
- **Optional components (P1):** Fitur "Share Build" (generate URL unik/image), Pre-built templates (Budget Gaming, Video Editing).
- **Required data:** getProductsPaginated per kategori komponen.
- **CTA utama:** "Beli Rakitan Ini", "Konsultasi Rakitan via WA".
- **SEO considerations:** Title: Simulasi Rakit PC Custom - HNS IT Center. Schema: WebApplication atau SoftwareApplication.
- **External SSO entry points:** Tidak ada.

---

### Component Planning (Kelompok 2)

#### eatures/cart/components/`n- **CartItemList**
  - **Purpose:** Me-render barisan item yang ada di keranjang lengkap dengan kontrol qty.
  - **Props:** items: CartItem[], onUpdateQty: (id, qty) => void, onRemove: (id) => void`n  - **Responsive:** List vertikal dengan gambar thumbnail di mobile, tabel list di desktop.
  - **Reusability:** Cart Page.
- **CartSummary**
  - **Purpose:** Kotak kalkulasi total harga.
  - **Props:** subtotal: number, 	otal: number`n  - **Responsive:** Nempel di bawah layar (sticky) di mobile, sidebar kanan di desktop.
  - **Reusability:** Cart Page.

#### eatures/checkout/components/`n- **CheckoutForm**
  - **Purpose:** Form validasi data diri pembeli (RHF + Zod).
  - **Props:** onSubmit: (data) => void`n  - **Responsive:** Form 1 kolom mobile, 2 kolom grid desktop (untuk field berdampingan).
  - **Reusability:** Checkout Page.
- **OrderSummary**
  - **Purpose:** Tampilan *read-only* dari item yang akan dibeli saat checkout.
  - **Props:** items: CartItem[], 	otal: number`n  - **Responsive:** Sticky sidebar.
  - **Reusability:** Checkout Page.

#### eatures/pc-builder/components/`n- **BuilderStepList**
  - **Purpose:** Accordion atau List vertikal yang menunjukkan slot komponen (CPU, Motherboard, dll) dan part yang sedang dipilih.
  - **Props:** steps: BuilderStep[], ctiveStep: string, onStepClick: (stepId) => void`n  - **Responsive:** Full width list.
  - **Reusability:** PC Builder Page.
- **PartSelector**
  - **Purpose:** Modal/Sheet atau section inline yang muncul saat user memilih satu slot, menampilkan produk WooCommerce di kategori tersebut.
  - **Props:** categoryId: string, onSelect: (product) => void`n  - **Responsive:** Fullscreen dialog/drawer di mobile, Modal besar atau kolom utama di desktop.
  - **Reusability:** PC Builder Page.
- **CompatibilityWarning**
  - **Purpose:** Banner peringatan (merah/kuning) jika ada komponen yang tidak klop.
  - **Props:** warnings: string[]`n  - **Responsive:** Banner di atas/bawah summary.
  - **Reusability:** PC Builder Page.
- **BuildSummary**
  - **Purpose:** Total harga PC rakitan dan tombol aksi akhir.
  - **Props:** 	otalPrice: number, isComplete: boolean`n  - **Responsive:** Sticky footer mobile, Sticky sidebar desktop.
  - **Reusability:** PC Builder Page.


## Kelompok 3: Content & Support

### Page Planning

#### Blog Listing (/blog)
- **Purpose:** Menampilkan daftar artikel, tips & trik IT, dan berita promo dari HNS IT Center.
- **Target user:** Semua persona, terutama yang mencari edukasi sebelum membeli.
- **Business goal:** Mendatangkan *traffic* organik (SEO) jangka panjang dan membangun otoritas brand.
- **Required components (P0):**
  - BlogGrid (Layout daftar artikel)
  - BlogCard (Thumbnail, judul, tanggal, kutipan)
  - Pagination`n- **Optional components (P1):** Kategori blog, Topik terpopuler.
- **Required data:** WordPress REST API /wp-json/wp/v2/posts.
- **CTA utama:** "Baca Selengkapnya".
- **SEO considerations:** Title: Blog & Artikel IT - HNS IT Center. Schema: Blog.
- **External SSO entry points:** Tidak ada.

#### Blog Detail (/blog/[slug])
- **Purpose:** Halaman untuk membaca satu artikel penuh.
- **Target user:** Pengunjung dari search engine atau social media.
- **Business goal:** Edukasi dan retensi, menyisipkan link internal ke produk (soft selling).
- **Required components (P0):**
  - BlogHeader (Judul, penulis, tanggal rilis)
  - BlogContent (Komponen untuk me-render HTML kaya/Markdown dari WordPress)
  - RelatedPosts (Artikel terkait)
- **Optional components (P1):** Tombol Share (WA/FB), Kolom komentar.
- **Required data:** WP API post berdasarkan slug.
- **CTA utama:** "Share Artikel", "Lihat Produk Terkait".
- **SEO considerations:** Title: [Judul Artikel] - HNS IT Center. Schema: Article atau NewsArticle.
- **External SSO entry points:** Tidak ada.

#### About Us (/about)
- **Purpose:** Menceritakan profil, sejarah, dan legalitas PT. Sentral Berkat Teknologi (HNS IT Center).
- **Target user:** Customer B2B (Pemilik Bisnis) yang butuh validasi sebelum pengadaan besar, dan customer baru.
- **Business goal:** Meningkatkan *trust* korporat.
- **Required components (P0):**
  - AboutHero (Foto tim atau toko depan)
  - TrustIndicators (Bisa di-reuse dari Homepage)
- **Optional components (P1):** Timeline perusahaan, Logo klien B2B.
- **Required data:** Konten statis.
- **CTA utama:** "Hubungi Kami".
- **SEO considerations:** Schema: AboutPage, Organization.
- **External SSO entry points:** Tidak ada.

#### Store Locations (/store-locations)
- **Purpose:** Memandu pengunjung ke dua lokasi fisik HNS IT Center di Batam.
- **Target user:** Customer lokal Batam.
- **Business goal:** Mendatangkan *foot traffic* ke toko offline (O2O - Online to Offline).
- **Required components (P0):**
  - StoreCard (Nama cabang: Nagoya Gateway / Nagoya Hill, Alamat lengkap, Jam operasional, Tombol WA Cabang)
  - GoogleMapEmbed (Iframe peta interaktif)
- **Required data:** Konten statis.
- **CTA utama:** "Dapatkan Petunjuk Arah", "Hubungi Toko Ini".
- **SEO considerations:** Sangat penting untuk Local SEO. Schema: LocalBusiness dengan info koordinat & jam buka.
- **External SSO entry points:** Tidak ada.

#### Support & Claim (/support)
- **Purpose:** Pusat bantuan (*helpdesk*) bagi customer yang mengalami masalah teknis atau mau klaim garansi.
- **Target user:** Customer lama yang butuh layanan purna jual (After-sales).
- **Business goal:** Meningkatkan kepuasan pelanggan, mengurangi *churn*, dan mengurangi *load* manual CS WhatsApp.
- **Required components (P0):**
  - SupportHero (Teks sambutan dan pencarian bantuan)
  - ExternalAppLinkCard (Untuk link ke Warranty App)
  - ExternalAppLinkCard (Untuk link ke Service App)
  - FAQSection (Pertanyaan umum)
  - ContactInfo (Email, No WA CS Pusat)
- **Required data:** Konten statis / WP Pages untuk FAQ.
- **CTA utama:** "Klaim Garansi Sekarang", "Booking Service".
- **SEO considerations:** Schema: FAQPage.
- **External SSO entry points:** **Sangat banyak.** Ini adalah *hub* utama untuk melempar user ke aplikasi Warranty Management dan Service Management via SSO.

---

### Component Planning (Kelompok 3)

#### eatures/blog/components/`n- **BlogCard**
  - **Purpose:** Kartu *preview* artikel.
  - **Props:** post: BlogPost`n  - **Responsive:** Stack vertikal mobile, grid desktop.
  - **Reusability:** Blog Listing, Homepage.
- **BlogContent**
  - **Purpose:** Me-render *rich text* HTML dari WordPress (dengan proteksi XSS/styling Prose Tailwind).
  - **Props:** htmlContent: string`n  - **Responsive:** Typography responsif (Tailwind Typography plugin).
  - **Reusability:** Blog Detail, Halaman statis (Kebijakan Privasi).

#### eatures/support/components/`n- **StoreCard**
  - **Purpose:** Kartu informasi cabang fisik.
  - **Props:** store: StoreLocation`n  - **Responsive:** Full width mobile, setengah layar desktop.
  - **Reusability:** Store Locations page.
- **FAQSection**
  - **Purpose:** Accordion tanya jawab.
  - **Props:** aqs: FAQItem[]`n  - **Responsive:** Sesuai UI primitive Accordion.
  - **Reusability:** Support Page, Product Detail (opsional).

---

## Auth Pages (Referensi)
Perencanaan halaman otentikasi (/login, /register, /account) dan integrasinya dengan detail produk (perubahan UI berdasarkan status Guest vs Member) sudah **selesai dan didokumentasikan sepenuhnya di 
otes/feature-guest-member.md**. 
Tidak ada perencanaan ulang di file ini untuk menghindari duplikasi.

---

## External Apps via SSO
Sebagai rangkuman, meskipun **Warranty Management** dan **Service Management** adalah aplikasi web eksternal (bukan route Next.js), entry point (pintu masuk) menuju aplikasi tersebut telah diintegrasikan di dalam Next.js pada lokasi-lokasi strategis berikut:

1. **Menu Header Global** — Dropdown "Layanan" berisi link ke Garansi & Service.
2. **Footer Global** — Link di kolom "Customer Service".
3. **Halaman /support** — Menggunakan komponen ExternalAppLinkCard berukuran besar sebagai CTA utama.
4. **Halaman /account (Dashboard Member)** — Menggunakan ExternalAppLinkCard agar member yang sedang melihat profilnya bisa langsung melompat ke dashboard servis/garansi mereka (login otomatis via SSO).

