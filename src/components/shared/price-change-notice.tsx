"use client";

import { ArrowDown, ArrowUp, PackageX, Trash2 } from "lucide-react";

import { formatRupiah } from "@/lib/utils";

/**
 * Penanda per baris untuk barang yang harganya berubah atau sudah tidak dijual.
 *
 * Harga di keranjang dan di panel rakitan sama-sama berasal dari localStorage
 * dan bisa berumur berhari-hari. Mengganti angkanya diam-diam berarti pelanggan
 * melihat total yang berbeda dari yang mereka ingat, tanpa tahu sebabnya — jadi
 * setiap perubahan disebut di baris barangnya sendiri, lengkap dengan arah dan
 * selisihnya.
 *
 * Naik dari `features/cart/components/` ke sini saat panel "My Build" di
 * `/build-pc` mulai memakainya juga — aturan naik-level di
 * docs/04-component-guidelines.md §2. Business logic-nya minimal (memformat dan
 * membandingkan dua angka yang sudah jadi), sesuai batas tipe "Shared".
 */

/** `compact` untuk panel sempit seperti sidebar My Build (lg:w-72 ≈ 288px). */
type Density = "default" | "compact";

export function PriceChangedBadge({
  oldUnitPrice,
  newUnitPrice,
  density = "default",
}: {
  oldUnitPrice: number;
  newUnitPrice: number;
  density?: Density;
}) {
  const naik = newUnitPrice > oldUnitPrice;
  const selisih = Math.abs(newUnitPrice - oldUnitPrice);

  /**
   * Versi ringkas: harga barunya sudah tampil di baris item panel, jadi yang
   * ditambahkan di sini hanya arah + selisih. Menampilkan ulang harga baru di
   * kolom selebar 288px membuat barisnya terlipat dua kali.
   */
  if (density === "compact") {
    return (
      <p
        className={`mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-tight ${
          naik ? "bg-sale-red/10 text-sale-red" : "bg-success/10 text-success"
        }`}
      >
        {naik ? (
          <ArrowUp className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
        ) : (
          <ArrowDown className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
        )}
        <span className="truncate">
          {naik ? "Naik" : "Turun"} {formatRupiah(selisih)}
        </span>
      </p>
    );
  }

  return (
    <div className="mt-2 space-y-1">
      <p className="text-sm">
        <span className="font-semibold">{formatRupiah(newUnitPrice)}</span>{" "}
        <span className="text-muted-foreground line-through">
          {formatRupiah(oldUnitPrice)}
        </span>
      </p>
      {/*
        Warna saja tidak cukup — panah dan kata "naik"/"turun" ikut menyatakan
        arahnya, supaya terbaca juga oleh orang yang tidak membedakan warna.
      */}
      <p
        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${
          naik
            ? "bg-sale-red/10 text-sale-red"
            : "bg-success/10 text-success"
        }`}
      >
        {naik ? (
          <ArrowUp className="h-3 w-3" aria-hidden="true" />
        ) : (
          <ArrowDown className="h-3 w-3" aria-hidden="true" />
        )}
        Harga {naik ? "naik" : "turun"} {formatRupiah(selisih)}
      </p>
    </div>
  );
}

/**
 * Barang yang sudah tidak terbit di katalog.
 *
 * Sengaja TIDAK dihapus sendiri dari keranjang: barang yang hilang tanpa
 * pemberitahuan membuat orang mengira dirinya salah ingat. Ia tetap terlihat,
 * ditandai jelas, dan pelanggan sendiri yang memutuskan mengeluarkannya.
 *
 * `onRemove` opsional: di panel My Build tombol hapus (X) sudah ada di baris
 * itu sendiri, jadi tombol kedua di kolom sempit hanya menambah kebingungan
 * untuk fungsi yang sudah tersedia.
 */
export function UnavailableNotice({
  onRemove,
  name,
  density = "default",
}: {
  onRemove?: () => void;
  name: string;
  density?: Density;
}) {
  if (density === "compact") {
    return (
      <p className="mt-1 inline-flex items-center gap-1 rounded bg-sale-red/10 px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-sale-red">
        <PackageX className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
        Tidak tersedia
      </p>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <p className="inline-flex items-center gap-1.5 rounded-md bg-sale-red/10 px-2 py-1 text-xs font-semibold text-sale-red">
        <PackageX className="h-3.5 w-3.5" aria-hidden="true" />
        Sudah tidak tersedia
      </p>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Hapus ${name} dari keranjang`}
          className="inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          Hapus dari keranjang
        </button>
      )}
    </div>
  );
}

/**
 * Penanda bahwa angka yang sedang tampil BELUM diverifikasi ke katalog.
 *
 * Ini bukan hiasan. Selama belum diverifikasi, yang tampil adalah harga dari
 * localStorage, yaitu persis angka yang berpotensi basi. Tanpa penanda,
 * pelanggan melihat harga lama tanpa tahu itu sementara — keadaan yang sama
 * dengan sebelum perbaikan ini ada. Lihat CLAUDE.md §2.7.
 *
 * Tiga keadaan, dan ketiganya WAJIB dibedakan:
 *
 * - `loading` — pembacaan katalog sedang berjalan.
 * - `error`   — pembacaannya gagal.
 * - `pending` — tidak ada yang sedang berjalan, tapi barang ini memang belum
 *   pernah ikut dibaca. Terjadi pada barang yang masuk SETELAH pembacaan
 *   sekali-per-kunjungan itu.
 *
 * `pending` sengaja tidak digabung ke `loading`: memutar spinner "Memeriksa
 * harga terbaru…" selagi tidak ada apa pun yang diperiksa adalah keterangan
 * yang salah, dan ia tidak akan pernah berhenti berputar.
 */
export function UnverifiedPriceNotice({
  state,
  density = "default",
}: {
  state: "loading" | "error" | "pending";
  density?: Density;
}) {
  const teks =
    state === "loading"
      ? "Memeriksa harga terbaru…"
      : state === "pending"
        ? "Harga belum diverifikasi"
        : "Harga belum bisa diverifikasi";

  if (density === "compact") {
    return (
      <p className="mt-1 inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-tight text-muted-foreground">
        <span className="truncate">{teks}</span>
      </p>
    );
  }

  return (
    <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
      {teks}
    </p>
  );
}
