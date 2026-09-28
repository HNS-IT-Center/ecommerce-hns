"use client";

import { forwardRef } from "react";
import Image from "next/image";
import { Clock, MapPin, MessageCircle, Navigation, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DAY_NAMES,
  sortForDisplay,
  type StoreHours,
} from "@/lib/utils/opening-hours";

import { OpenStatusBadge } from "./open-status-badge";

/**
 * Detail satu cabang: foto, status, alamat, jam, dan tombol aksi.
 *
 * Tampil setelah pengunjung memilih cabang di peta `/stores` — menempel di atas
 * peta mulai tablet, di bawah peta pada HP (lihat `StoresLocator`). Tidak lagi
 * berupa kartu yang selalu terbuka: nama dan status tiap cabang sudah terlihat
 * di daftar ringkas di atas peta, jadi pengunjung tetap tahu ada berapa cabang
 * tanpa harus mengklik apa pun.
 *
 * Komponen ini klien karena lencana buka/tutup bergantung pada jam sekarang.
 */

export type PanelStore = {
  id: string;
  name: string;
  address: string;
  hours: StoreHours[];
  mapsUrl: string;
  waUrl: string;
  directionsUrl: string;
  latitude: number | null;
  longitude: number | null;
  phone: string;
  googlePlaceId: string | null;
  /** Foto depan toko di R2, atau null — tanpa foto, panel dimulai dari nama. */
  imageUrl: string | null;
};

type Props = {
  store: PanelStore;
  onClose: () => void;
  className?: string;
};

/**
 * `ref` menunjuk tombol Tutup — pemanggil memindahkan fokus ke sana saat panel
 * dibuka, supaya pengguna papan ketik tidak tertinggal di daftar yang baru saja
 * disembunyikan.
 */
export const StorePanel = forwardRef<HTMLButtonElement, Props>(
  function StorePanel({ store, onClose, className }, tombolTutup) {
    const jam = sortForDisplay(store.hours);

    return (
      <article
        className={cn(
          "relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-lg",
          className,
        )}
      >
        <button
          ref={tombolTutup}
          type="button"
          onClick={onClose}
          aria-label="Tutup detail toko"
          className={cn(
            "absolute right-2 top-2 z-10 inline-flex size-8 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
            // Di atas foto butuh latar gelap; tanpa foto, ikon polos cukup.
            store.imageUrl
              ? "bg-black/60 text-white hover:bg-black/80"
              : "text-foreground hover:bg-muted",
          )}
        >
          <X className="size-4" />
        </button>

        {/* Rasio 2:1 sama dengan pratinjau di admin, supaya potongan yang
            dilihat staff saat mengunggah adalah potongan yang dilihat pelanggan. */}
        {store.imageUrl && (
          <div className="relative aspect-2/1 w-full shrink-0 bg-muted">
            <Image
              src={store.imageUrl}
              alt={`Tampak depan ${store.name}`}
              fill
              sizes="(min-width: 768px) 320px, 100vw"
              className="object-cover object-center"
            />
          </div>
        )}

        <div className="flex flex-col gap-3 p-4">
          <h2
            className={cn(
              "text-base font-bold leading-tight",
              !store.imageUrl && "pr-8",
            )}
          >
            {store.name}
          </h2>

          <OpenStatusBadge hours={store.hours} />

          <p className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-green" />
            {store.address}
          </p>

          {/* `<details>`, bukan tautan yang selalu berdampingan dengan daftarnya.
              Ia bisa dibuka lewat papan ketik dan tidak menampilkan pemicu
              bersamaan dengan isi yang dipicunya. */}
          {jam.length > 0 && (
            <details className="group text-sm">
              <summary className="flex cursor-pointer list-none items-center gap-2.5 text-muted-foreground marker:content-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                <Clock className="h-4 w-4 shrink-0 text-sale-red" />
                <span className="underline underline-offset-2 group-open:hidden">
                  Lihat jam lengkap
                </span>
                <span className="hidden underline underline-offset-2 group-open:inline">
                  Tutup jam lengkap
                </span>
              </summary>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-5 gap-y-1 pl-6.5 text-sm text-muted-foreground">
                {jam.map((h) => (
                  <div key={h.dayOfWeek} className="contents">
                    <dt className="text-foreground">{DAY_NAMES[h.dayOfWeek]}</dt>
                    <dd className="tabular-nums">
                      {h.isClosed
                        ? "Tutup"
                        : `${h.opensAt.replace(":", ".")}–${h.closesAt.replace(":", ".")}`}
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1">
            {/*
              `nativeButton={false}` WAJIB menyertai `render={<a/>}`.

              Tanpa itu Base UI memperingatkan di konsol setiap kali halaman ini
              dibuka: komponen mengaku tombol native padahal yang dirender <a>,
              dan semantik tombolnya hilang — yang berdampak pada pembaca layar,
              bukan sekadar peringatan kosmetik.

              Pola yang sama sudah dipakai benar di `admin/(panel)/banner`.
            */}
            <Button
              variant="outline"
              nativeButton={false}
              render={
                <a
                  href={store.directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <Navigation className="h-4 w-4" />
              Petunjuk Arah
            </Button>
            <Button
              variant="whatsapp"
              nativeButton={false}
              render={
                <a
                  href={store.waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </Button>
          </div>
        </div>
      </article>
    );
  },
);
