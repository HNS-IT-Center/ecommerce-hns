"use client";

import { Clock, MapPin, MessageCircle, Navigation } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useOpenStatus } from "@/hooks/use-open-status";
import {
  DAY_NAMES,
  sortForDisplay,
  type StoreHours,
} from "@/lib/utils/opening-hours";

import { StoresOverviewMapLoader } from "./stores-overview-map-loader";

/**
 * Satu cabang, satu panel.
 *
 * Halaman ini menampilkan seluruh cabang berdampingan alih-alih daftar dengan
 * satu yang terpilih. Alasannya jumlah: dengan dua cabang, pola "pilih dulu baru
 * lihat" menyembunyikan setengah isi halaman di balik klik yang belum tentu
 * terjadi — dan orang yang tidak tahu ada cabang kedua akan pergi ke cabang yang
 * lebih jauh.
 *
 * Komponen ini klien HANYA karena lencana buka/tutup bergantung pada jam
 * sekarang. Sisanya — nama, alamat, jam, tautan — sudah ada di HTML dari server,
 * jadi tetap terbaca tanpa JavaScript.
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
};

export function StorePanel({ store }: { store: PanelStore }) {
  const status = useOpenStatus(store.hours);
  const jam = sortForDisplay(store.hours);

  const punyaKoordinat = store.latitude !== null && store.longitude !== null;

  return (
    /* `h-full` + `flex-col`: panel bersaudara diregangkan sama tinggi oleh grid,
       dan `mt-auto` pada tombol mendorongnya ke dasar. Tanpa itu, panel dengan
       alamat lebih pendek menyisakan tombol menggantung di tengah. */
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow hover:shadow-md">
      {/* Peta kecil hanya muncul kalau koordinatnya ada. Tanpa foto dan tanpa
          koordinat, panel langsung dimulai dari nama — bukan kotak abu-abu. */}
      {punyaKoordinat && (
        <div className="h-40 w-full bg-muted sm:h-48">
          <StoresOverviewMapLoader
            showLabels={false}
            stores={[
              {
                id: store.id,
                name: store.name,
                address: store.address,
                phone: store.phone,
                googlePlaceId: store.googlePlaceId,
                latitude: store.latitude as number,
                longitude: store.longitude as number,
              },
            ]}
          />
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3 p-5 sm:p-6">
        <h2 className="text-lg font-bold sm:text-xl">{store.name}</h2>

        {/* Satu lencana, bukan lencana ditambah baris jam di bawahnya: keduanya
            mengatakan hal yang sama dan memaksa mata membaca dua kali. Ditahan
            sampai hidrasi selesai supaya tidak sempat menampilkan status keliru. */}
        {status && (
          <span
            className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
              status.state === "open"
                ? "bg-brand-green/10 text-brand-green"
                : status.state === "closed"
                  ? "bg-muted text-muted-foreground"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            <span
              className="h-1.5 w-1.5 rounded-full bg-current"
              aria-hidden="true"
            />
            {status.label}
          </span>
        )}

        <p className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-green" />
          {store.address}
        </p>

        {/* `<details>`, bukan tautan yang selalu berdampingan dengan daftarnya.
            Ia bekerja tanpa JavaScript, bisa dibuka lewat papan ketik, dan tidak
            menampilkan pemicu bersamaan dengan isi yang dipicunya. */}
        {jam.length > 0 && (
          <details className="group text-sm">
            <summary className="flex cursor-pointer list-none items-center gap-2.5 text-muted-foreground marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
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

        <div className="mt-auto grid grid-cols-2 gap-3 pt-2">
          <Button
            variant="outline"
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
            render={
              <a href={store.waUrl} target="_blank" rel="noopener noreferrer" />
            }
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </Button>
        </div>
      </div>
    </article>
  );
}
