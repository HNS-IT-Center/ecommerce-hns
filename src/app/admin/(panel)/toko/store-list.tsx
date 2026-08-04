"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, TriangleAlert } from "lucide-react";
import { formatOpeningHours, type StoreHours } from "@/lib/utils/opening-hours";
import { deleteStore } from "./actions";

/**
 * Daftar toko dengan konfirmasi hapus.
 *
 * Konfirmasinya panel inline, BUKAN modal, mengikuti pola yang sudah dipakai
 * modul Kategori. Project ini sekarang memang punya komponen Dialog, tapi
 * memakainya di sini berarti ada dua cara berbeda mengonfirmasi penghapusan di
 * dalam satu panel — dan inkonsistensi semacam itu justru yang dikeluhkan di
 * audit. Kalau suatu saat panel ini pindah ke modal, Kategori harus ikut.
 *
 * Komponen ini `"use client"` hanya karena butuh mengingat baris mana yang
 * sedang dikonfirmasi. Halaman induknya tetap Server Component dan tetap yang
 * mengambil datanya.
 *
 * Yang ditampilkan hanya nama tokonya, tanpa hitungan apa pun. Berbeda dari
 * kategori — di sana konfirmasi perlu memberi tahu berapa produk yang terdampak,
 * karena angkanya tidak bisa dilihat dari layar. Di sini seluruh isi barisnya
 * sudah terlihat tepat di atas tombolnya.
 */
type StoreRow = {
  id: string;
  name: string;
  address: string;
  phone: string;
  hours: StoreHours[];
};

export function StoreList({ stores }: { stores: StoreRow[] }) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  if (stores.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Belum ada data toko.</p>
    );
  }

  return (
    <div className="space-y-3">
      {stores.map((store) => {
        const isConfirming = confirmingId === store.id;

        return (
          <div
            key={store.id}
            className="rounded-xl border border-border bg-background p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="font-bold">{store.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {store.address}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatOpeningHours(store.hours)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  WA: {store.phone || "— belum diisi"}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/admin/toko/${store.id}`}
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label={`Edit ${store.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </Link>

                {/*
                  Tombol ini sekarang membuka konfirmasi, tidak lagi mengirim
                  formulir. Sebelumnya ia langsung menghapus barisnya — satu
                  klik tak sengaja dan alamat, jam buka, serta nomor WA toko
                  hilang tanpa jejak.

                  `aria-expanded` dan `aria-controls` dipasang supaya pembaca
                  layar tahu tombol ini memunculkan sesuatu di bawahnya, bukan
                  langsung bertindak.
                */}
                <button
                  type="button"
                  onClick={() =>
                    setConfirmingId(isConfirming ? null : store.id)
                  }
                  aria-expanded={isConfirming}
                  aria-controls={`konfirmasi-hapus-${store.id}`}
                  className="rounded-lg px-3 py-1.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
                >
                  Hapus
                </button>
              </div>
            </div>

            {isConfirming && (
              <div
                id={`konfirmasi-hapus-${store.id}`}
                className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5"
              >
                <p className="flex items-start gap-2 text-xs text-destructive">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Hapus <strong className="font-bold">{store.name}</strong> dari
                  daftar toko? Datanya tetap tersimpan dan bisa dipulihkan lewat
                  database, tapi tidak lagi muncul di panel.
                </p>

                <form
                  action={deleteStore}
                  className="mt-2 flex flex-wrap gap-2"
                >
                  <input type="hidden" name="id" value={store.id} />
                  <button
                    type="submit"
                    className="rounded-lg bg-destructive px-3 py-1 text-xs font-bold text-white transition-opacity hover:opacity-90"
                  >
                    Ya, hapus
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingId(null)}
                    className="rounded-lg px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
                  >
                    Batal
                  </button>
                </form>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
