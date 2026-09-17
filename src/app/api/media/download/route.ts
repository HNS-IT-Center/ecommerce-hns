import { NextRequest, NextResponse } from "next/server"

import { MediaFetchError, fetchRemoteImage } from "@/lib/api/media-file"

/**
 * Menyalurkan satu foto produk dari host media supaya bisa diunduh atau
 * disalin pembeli dari galeri produk.
 *
 * Kenapa lewat server, bukan langsung ke host gambarnya:
 *
 * - `<a download>` hanya dipatuhi peramban untuk alamat same-origin. Menunjuk
 *   langsung ke `media.hnsitcenter.com` cuma membuka gambarnya di tab baru.
 * - Penyalinan ke clipboard perlu `fetch` isi berkasnya, dan itu butuh header
 *   CORS yang tidak dijamin ada di host media.
 * - Lewat sini nama berkasnya bisa dibuat terbaca (`asus-rog-strix-g16.jpg`),
 *   bukan nama acak hasil unggahan.
 *
 * Tanpa autentikasi: gambarnya memang sudah publik di halaman produk, dan
 * pembatasannya ada di daftar izin host (lihat `lib/api/media-file.ts`).
 */
export async function GET(request: NextRequest) {
  const src = request.nextUrl.searchParams.get("src")
  const name = request.nextUrl.searchParams.get("name")

  if (!src) {
    return NextResponse.json({ error: "Parameter src wajib diisi" }, { status: 400 })
  }

  try {
    const image = await fetchRemoteImage(src, name)

    const headers = new Headers({
      "Content-Type": image.contentType,
      // `attachment` inilah yang membuat peramban menyimpan berkas alih-alih
      // menampilkannya, sekaligus menentukan nama berkasnya. Namanya sudah
      // di-slug (hanya a-z, 0-9, dan `-`), jadi bentuk ASCII polos cukup.
      "Content-Disposition": `attachment; filename="${image.fileName}"`,
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      // Foto produk bukan HTML; tanpa ini peramban boleh menebak-nebak isinya.
      "X-Content-Type-Options": "nosniff",
    })
    if (image.contentLength) headers.set("Content-Length", image.contentLength)

    return new NextResponse(image.body, { headers })
  } catch (error) {
    if (error instanceof MediaFetchError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("Failed to proxy media download:", error)
    return NextResponse.json({ error: "Gagal mengambil gambar" }, { status: 500 })
  }
}
