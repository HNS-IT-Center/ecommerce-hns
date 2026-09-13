"use client"

import { useState } from "react"
import Image, { type ImageProps } from "next/image"
import { ImageOff } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * `next/image` yang jatuh ke placeholder saat gambarnya gagal dimuat.
 *
 * Sebabnya data, bukan kode: sebagian foto produk belum dipindahkan ke CDN
 * `media.hnsitcenter.com`, jadi URL-nya ada di database tapi menjawab 404.
 * `next/image` tanpa `onError` menampilkan ikon gambar-rusak bawaan peramban —
 * berbeda bentuknya di tiap peramban, dan di semuanya terbaca seperti situs
 * yang rusak, bukan foto yang belum diunggah.
 *
 * Perhatikan bedanya dengan fallback yang sudah ada di `mapper.ts`: yang di
 * sana menangani produk yang TIDAK PUNYA gambar sama sekali (`images[0]?.src
 * ?? placeholder`), dan itu keputusan di sisi server yang tidak bisa tahu
 * apakah sebuah URL nantinya menjawab 200. Kasus "URL ada tapi 404" hanya
 * ketahuan di peramban, jadi hanya bisa ditangani di sini — keduanya saling
 * melengkapi, bukan menggantikan.
 *
 * Sengaja TIDAK memakai `/images/placeholder.svg`. Berkas itu menulis "No
 * Image" dengan warna yang dipatok (`#f1f5f9`/`#94a3b8`), jadi ia tidak ikut
 * tema gelap dan teksnya berbahasa Inggris — melanggar CLAUDE.md §7 untuk
 * sesuatu yang dilihat pelanggan. Placeholder di sini digambar dengan token
 * tema, tanpa teks sama sekali.
 */
type ProductImageProps = Omit<ImageProps, "onError" | "src"> & {
  /**
   * Boleh `null`/`undefined` — produk tanpa foto langsung tampil sebagai
   * placeholder, tanpa perlu pemanggil menyiapkan URL palsu lebih dulu.
   */
  src: string | null | undefined
  /**
   * Kelas untuk kotak placeholder-nya, BUKAN untuk `<Image>`. Dipakai saat
   * placeholder perlu latar berbeda dari bawaan — mis. di atas kartu yang
   * latarnya sudah putih.
   */
  fallbackClassName?: string
}

export function ProductImage({
  src,
  alt,
  className,
  fallbackClassName,
  fill,
  width,
  height,
  ...props
}: ProductImageProps) {
  const [gagal, setGagal] = useState(false)

  const tidakAdaGambar = !src || gagal

  if (tidakAdaGambar) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground",
          // `absolute inset-0` menyamai perilaku `fill` pada <Image>, supaya
          // pemanggil yang memakai `fill` tidak perlu mengubah pembungkusnya
          // saat gambarnya gagal.
          fill ? "absolute inset-0 h-full w-full" : "",
          fallbackClassName,
        )}
        style={fill ? undefined : { width, height }}
        /*
         * `alt=""` diteruskan apa adanya sebagai elemen tersembunyi dari
         * pembaca layar. Itu bukan kelalaian pemanggil: di beberapa tempat
         * (baris bundel di keranjang) nama produknya sudah tertulis tepat di
         * sebelah kotak ini, jadi menyuarakan "foto tidak tersedia" hanya
         * menambah kebisingan. Di tempat lain, gambarnya informatif dan
         * ketiadaannya layak disebut.
         */
        role={alt ? "img" : undefined}
        aria-label={alt ? `${alt} — foto tidak tersedia` : undefined}
        aria-hidden={alt ? undefined : true}
      >
        <ImageOff
          className="h-1/4 max-h-10 w-1/4 max-w-10 opacity-40"
          aria-hidden="true"
        />
      </div>
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      className={className}
      fill={fill}
      width={width}
      height={height}
      onError={() => setGagal(true)}
      {...props}
    />
  )
}
