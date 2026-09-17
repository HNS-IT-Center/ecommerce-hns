# Blog dinonaktifkan sementara — 17 September 2026

`/blog` dan `/blog/[slug]` **dimatikan**, bukan dihapus. Kedua halamannya ada di
folder ini dengan akhiran `.bak`:

| Berkas di sini | Tempatnya semula |
|---|---|
| `page.tsx.bak` | `src/app/blog/page.tsx` |
| `slug-page.tsx.bak` | `src/app/blog/[slug]/page.tsx` |

Folder berawalan `_` dikecualikan Next.js dari routing, jadi isinya tidak
menghasilkan halaman apa pun.

## Kenapa dimatikan

Keduanya membaca WordPress lewat `lib/api/wordpress/posts.ts`, yang memanggil
`WOOCOMMERCE_URL`. **WordPress-nya sudah tidak ada di mana pun:**

```
hnsitcenter.id/wp-json/wp/v2/posts      -> 404
old.hnsitcenter.id/wp-json/...          -> tidak terjangkau
```

Akibatnya `/blog` menjawab **HTTP 500** — halaman publik yang ditautkan dari
footer, jadi pengunjung yang mengkliknya melihat halaman error. 404 karena
halamannya memang tidak ada sekarang lebih jujur daripada 500 karena sumbernya
hilang.

Ini keadaan sementara sampai diputuskan nasib artikelnya (lihat di bawah).

## Yang ikut dibersihkan saat mematikan

- `src/app/sitemap.ts` — entri `/blog` dibuang; mengumumkan alamat yang 404 ke
  mesin pencari hanya mengundang perayapan sia-sia.
- `src/components/layout/footer.tsx` — tautan "Blog" dibuang dari kolom
  Perusahaan.
- `src/components/layout/back-button.tsx` — awalan `/blog/` **DIBIARKAN**. Ia
  hanya menentukan perilaku tombol kembali untuk alamat yang cocok, dan
  membiarkannya membuat penghidupan kembali tidak perlu menyentuh berkas itu.

## Menghidupkan kembali

1. Pastikan WordPress terjangkau dan `WOOCOMMERCE_URL` menunjuk ke alamat yang
   benar. Uji: `curl -I "$WOOCOMMERCE_URL/wp-json/wp/v2/posts?per_page=1"`.
2. Kembalikan kedua berkas ke tempatnya semula (tabel di atas), buang akhiran
   `.bak`, buat lagi folder `[slug]`.
3. Kembalikan entri sitemap dan tautan footer.
4. Hapus folder ini.

## Kalau WordPress TIDAK akan kembali

Artikelnya perlu dipindahkan ke Prisma, seperti yang sudah dilakukan untuk
produk (CLAUDE.md §2.2). Dalam hal itu kedua berkas di sini tetap berguna
sebagai acuan bentuk halamannya, tapi lapisan datanya ditulis ulang dan
`lib/api/wordpress/` ikut dipensiunkan.
