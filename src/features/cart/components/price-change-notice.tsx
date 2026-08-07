"use client";

import { ArrowDown, ArrowUp, PackageX, Trash2 } from "lucide-react";

import { formatRupiah } from "@/lib/utils";

/**
 * Penanda per baris untuk barang yang harganya berubah atau sudah tidak dijual.
 *
 * Harga di keranjang berasal dari localStorage dan bisa berumur berhari-hari.
 * Mengganti angkanya diam-diam berarti pelanggan melihat total yang berbeda
 * dari yang mereka ingat, tanpa tahu sebabnya — jadi setiap perubahan disebut
 * di baris barangnya sendiri, lengkap dengan arah dan selisihnya.
 */

export function PriceChangedBadge({
  oldUnitPrice,
  newUnitPrice,
}: {
  oldUnitPrice: number;
  newUnitPrice: number;
}) {
  const naik = newUnitPrice > oldUnitPrice;
  const selisih = Math.abs(newUnitPrice - oldUnitPrice);

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
 */
export function UnavailableNotice({
  onRemove,
  name,
}: {
  onRemove: () => void;
  name: string;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <p className="inline-flex items-center gap-1.5 rounded-md bg-sale-red/10 px-2 py-1 text-xs font-semibold text-sale-red">
        <PackageX className="h-3.5 w-3.5" aria-hidden="true" />
        Sudah tidak tersedia
      </p>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Hapus ${name} dari keranjang`}
        className="inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        Hapus dari keranjang
      </button>
    </div>
  );
}
