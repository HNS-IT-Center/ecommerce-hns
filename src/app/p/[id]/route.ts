import { NextRequest, NextResponse } from "next/server";
import { getProductById } from "@/lib/api/woocommerce/products";

/**
 * Tautan pendek produk — tujuan QR code di halaman produk (`/p/34394`).
 *
 * **`Location` sengaja RELATIF, bukan URL absolut.** Versi sebelumnya memakai
 * `new URL(path, request.url)`. Di balik proxy Hostinger `request.url` bukan
 * alamat publik: ia berisi alamat bind server Next.js, sehingga `Location`
 * yang sampai ke ponsel pemindai berbunyi `https://0.0.0.0:3000/product/...`.
 * QR-nya sendiri benar — ia dibangun dari `resolveSiteUrl()` — jadi pemindai
 * melihat `store.hnsitcenter.id` di layar kameranya, lalu mendarat di alamat
 * IP yang tidak bisa dibuka. Persis pola yang sudah dicatat di
 * `src/app/api/auth/google/route.ts`.
 *
 * Tujuan redirect ini selalu berada di origin yang sama dengan permintaannya,
 * jadi host tidak perlu ditentukan sama sekali: browser me-resolve `Location`
 * relatif terhadap URL yang IA minta. Dibuka dari domain produksi menghasilkan
 * domain produksi, dari localhost menghasilkan localhost — tanpa env, tanpa
 * daftar izin, tanpa host yang bisa salah tebak. Menebak host adalah satu-
 * satunya cara bug ini bisa muncul, jadi berhenti menebak menghapus seluruh
 * kelasnya, bukan cuma kejadiannya di produksi.
 *
 * Jangan "perbaiki" ini kembali menjadi `new URL(..., request.url)` atau
 * `request.nextUrl.origin`.
 */
function redirectTo(path: string, status: 301 | 302): NextResponse {
  return new NextResponse(null, { status, headers: { Location: path } });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id || isNaN(Number(id))) {
    return redirectTo("/shop", 302);
  }

  const productId = Number(id);
  const product = await getProductById(productId);

  if (!product) {
    return redirectTo("/shop", 302);
  }

  // Slug masuk ke path URL, jadi ia di-encode. Slug produk normalnya sudah
  // aman, tapi satu spasi atau `#` dari data lama sudah cukup membuat
  // `Location` cacat dan redirect-nya mendarat di tempat lain.
  const slug = encodeURIComponent(product.slug);

  // 301 Permanent Redirect supaya nilai SEO tautan pendek mengalir ke URL slug
  // kanonik.
  return redirectTo(`/product/${slug}`, 301);
}
