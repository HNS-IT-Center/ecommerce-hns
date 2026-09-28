import Link from "next/link";
import Image from "next/image";

import { MegaMenu } from "./mega-menu";
import { getPcPrebuildConfig } from "@/lib/pc-prebuild/config";
import { CartBadge } from "./cart-badge";
import { SearchBar } from "./search-bar";
import { AccountNav } from "./account-nav";
import { HeaderMobileBar } from "./header-mobile-bar";
import { HeaderShell, HeaderSpacer } from "./header-shell";
import { getCategories } from "@/lib/api/woocommerce/categories";
import { getThemeSettings } from "@/lib/theme/settings";
import { customerLogoutActionForClient } from "@/app/profile/actions";
import {
  ChristmasHeaderDecor,
  ChristmasHeaderPattern,
} from "@/components/theme/christmas-decor";

export async function Header() {
  // Dua pembacaan ini independen, jadi dijalankan berbarengan. Status login
  // SENGAJA TIDAK dibaca di sini — lihat komentar panjang di
  // `hooks/use-customer.ts`: `getCurrentCustomer()` memanggil `cookies()`, dan
  // itu menandai SETIAP halaman yang me-render Header (yaitu semuanya) sebagai
  // dynamic, termasuk yang sebelumnya statis (/cart, /faq, dst). `AccountNav`
  // membaca statusnya sendiri lewat `/api/auth/me` di klien.
  const [categories, theme, prebuild] = await Promise.all([
    // `perPage` harus menampung SELURUH kategori, bukan 100 pertama.
    // Daftarnya diurutkan alfabetis, jadi batas 100 memotong ekor abjad tanpa
    // pesan apa pun: menambah 10 sub-kategori berhuruf A–R pada 28 September
    // 2026 mendorong "SOFTWARE" keluar dari 100 besar, dan kategori utama itu
    // lenyap dari menu. Angkanya disamakan dengan /shop dan /search (500).
    getCategories({ hideEmpty: true, perPage: 500 }),
    getThemeSettings(),
    getPcPrebuildConfig(),
  ]);

  // Kategori yang ADA demi fitur lain, bukan untuk dijelajahi lewat menu.
  //
  // "Jasa Rakit" menampung satu produk (JASA RAKIT PC) yang dipakai PC Builder
  // sebagai step WAJIB — `PC_BUILDER_CONFIG` menyebut kategorinya lewat
  // `categoryIds: [179]`, `isRequired: true`. Pelanggan memilih jasa rakit di
  // dalam alur builder, jadi memunculkannya lagi sebagai kategori di dropdown
  // KATEGORI cuma menawarkan jalan kedua yang membingungkan.
  //
  // Disaring DI SINI saja, bukan di `getCategories`: penyaringan di lapisan
  // data ikut menghilangkannya dari /shop, /search, dan sitemap — dan itu di
  // luar yang diminta. Yang disembunyikan hanya dropdown menu ini; filter
  // katalog dan halaman produknya tetap apa adanya.
  //
  // Kategorinya sendiri TIDAK boleh dihapus: menghapusnya memutus step wajib
  // PC Builder.
  const SLUG_TERSEMBUNYI_DI_MENU = ["laptop-pc-jasa-rakit"];
  const categoriesMenu = categories.filter((c) => !SLUG_TERSEMBUNYI_DI_MENU.includes(c.slug));

  // Tautan PC Prebuild hanya dirender kalau sakelarnya menyala. Bacanya di
  // sini, bukan di MegaMenu: komponen itu `use client` dan tidak boleh
  // menyentuh lapisan data sendiri (CLAUDE.md §2.5).
  const showPrebuild = prebuild.enabled;

  const isChristmas = theme.activeChromeThemeId === "christmas";

  return (
    <>
      {/* `theme-chrome` = titik cantol Theme Editor. Token di dalam scope ini
          didefinisikan ulang oleh CSS yang disuntik root layout, dan karena
          custom property diwarisi, seluruh `bg-background`/`text-foreground` di
          dalamnya — termasuk MegaMenu, SearchBar, CartBadge, AccountNav — ikut
          berubah tanpa satu pun className disentuh. */}
      <HeaderShell>
        {isChristmas && <ChristmasHeaderDecor />}
        <div className="container relative z-10 mx-auto flex h-16 items-center px-4 md:px-6">
          {/* Mobile Layout (< md): Back - Search - Cart.
              BackButton menyembunyikan dirinya sendiri di luar halaman detail. */}
          <HeaderMobileBar />

          {/* Desktop Layout (>= md), tidak berubah dari sebelumnya */}
          <div className="hidden w-full items-center md:flex">
            {/* Logo */}
            <Link href="/" className="mr-6 flex items-center shrink-0">
              <Image
                src="/images/Logo HNS IT Center.png"
                alt="HNS IT Center Logo"
                width={160}
                height={40}
                className="h-10 w-auto object-contain"
                priority
              />
            </Link>

            {/* Desktop Navigation */}
            <MegaMenu categories={categoriesMenu} showPrebuild={showPrebuild} />

            {/* Search Bar */}
            <div className="flex flex-1 items-center justify-center px-4 lg:px-8">
              <SearchBar />
            </div>

            <nav className="flex items-center gap-2">
              {/* Versi tanpa `redirect()`: `AccountNav` yang mengurus urutan sesudah
                  cookie tercabut (segarkan tab ini, beri aba-aba ke tab lain,
                  baru pindah halaman). */}
              <AccountNav logoutAction={customerLogoutActionForClient} />
              <CartBadge />
            </nav>
          </div>
        </div>
      </HeaderShell>
      {/* Spacer to prevent content from jumping under the fixed header.

        Juga jadi jangkar setrip pola salju: header sendiri `fixed`, jadi
        apa pun yang dipasang di dalamnya ikut menempel di layar dan tidak
        pernah tergulung. Spacer ini bagian normal dari aliran halaman, jadi
        setripnya ikut naik saat halaman digulung — persis yang diinginkan. */}
      <HeaderSpacer>
        {isChristmas && <ChristmasHeaderPattern />}
      </HeaderSpacer>
    </>
  );
}
