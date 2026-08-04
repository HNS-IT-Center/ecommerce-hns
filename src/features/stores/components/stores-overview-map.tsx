"use client";

import { useMemo } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";

// WAJIB. Tanpa berkas ini peta tampil rusak — tile bertumpuk dan kontrol
// berserakan — tanpa satu pun pesan galat yang menjelaskan sebabnya.
import "leaflet/dist/leaflet.css";

import { getDirectionsUrl } from "../lib/maps";

/**
 * Peta ikhtisar berisi seluruh toko, satu marker per cabang.
 *
 * Memakai Leaflet, bukan iframe OpenStreetMap, karena iframe bawaan OSM hanya
 * menerima SATU parameter `marker` — dua cabang tidak mungkin tampil bersamaan.
 * Dan tanpa marker sama sekali, peta ini cuma memperlihatkan area Nagoya tanpa
 * satu pun tanda di mana HNS berada, yang lebih buruk daripada tidak ada peta.
 *
 * Label "HNS #1 IT CENTER" yang dulu terlihat di peta Google adalah POI milik
 * Google, bukan sesuatu yang kita pasang. OpenStreetMap tidak menyimpan data itu,
 * jadi penandanya harus dibuat sendiri — dan justru itu membuatnya terkendali:
 * nama yang tampil adalah nama dari database, bukan hasil keputusan pihak lain.
 */

export type MapStore = {
  id: string;
  name: string;
  address: string;
  phone: string;
  googlePlaceId: string | null;
  latitude: number;
  longitude: number;
};

/**
 * Marker dibuat dari SVG sebaris, bukan ikon bawaan Leaflet.
 *
 * Dua alasan sekaligus. Ikon bawaan menunjuk berkas PNG lewat jalur relatif yang
 * pecah di bundler modern — gejalanya marker tidak muncul dengan 404 senyap di
 * konsol. Dan warnanya harus mengikuti token brand, yang tidak bisa dilakukan
 * pada gambar raster.
 *
 * `currentColor` diwarisi dari `text-primary` pada pembungkusnya, jadi warnanya
 * ikut berubah bersama tema tanpa satu pun nilai heksadesimal ditulis di sini.
 */
function brandIcon(label: string): L.DivIcon {
  return L.divIcon({
    className: "!bg-transparent !border-0",
    iconSize: [32, 42],
    iconAnchor: [16, 42],
    popupAnchor: [0, -38],
    html: `
      <div class="flex flex-col items-center text-primary">
        <svg width="32" height="42" viewBox="0 0 32 42" fill="none" aria-hidden="true">
          <path d="M16 41C16 41 30 25.5 30 16C30 8.26801 23.732 2 16 2C8.26801 2 2 8.26801 2 16C2 25.5 16 41 16 41Z"
                fill="currentColor" stroke="white" stroke-width="2.5"/>
          <circle cx="16" cy="16" r="5.5" fill="white"/>
        </svg>
        <span class="mt-0.5 whitespace-nowrap rounded bg-background/90 px-1.5 py-0.5 text-[11px] font-semibold text-foreground shadow-sm">
          ${label}
        </span>
      </div>
    `,
  });
}

/** Ruang di sekitar titik terluar supaya marker tidak menempel di tepi peta. */
const BOUNDS_PADDING: [number, number] = [48, 48];

/**
 * Zoom roda gulir dikunci sampai peta diklik, lalu dikunci lagi saat kursor
 * pergi.
 *
 * Peta yang langsung menangkap roda gulir menjebak pembaca: mereka bermaksud
 * menggulir halaman, yang bergerak justru petanya. Mengklik dulu adalah
 * pernyataan niat yang jelas.
 *
 * Dilakukan lewat `useMapEvents`, bukan dengan mengubah prop `scrollWheelZoom`,
 * karena prop itu hanya dibaca sekali saat peta dibuat — mengubahnya setelah
 * terpasang tidak berpengaruh apa pun.
 */
function ScrollZoomOnClick() {
  const map = useMapEvents({
    click: () => map.scrollWheelZoom.enable(),
    mouseout: () => map.scrollWheelZoom.disable(),
  });
  return null;
}

export function StoresOverviewMap({ stores }: { stores: MapStore[] }) {
  const bounds = useMemo(
    () =>
      L.latLngBounds(
        stores.map((s) => [s.latitude, s.longitude] as [number, number]),
      ),
    [stores],
  );

  if (stores.length === 0) return null;

  return (
    <MapContainer
      bounds={bounds}
      boundsOptions={{ padding: BOUNDS_PADDING }}
      scrollWheelZoom={false}
      className="h-full w-full"
    >
      <ScrollZoomOnClick />
      {/*
        Tile dari server sukarela OpenStreetMap. Untuk dua cabang dengan trafik
        toko lokal ini masih di dalam batas wajar kebijakan pemakaian mereka.
        Kalau trafik halaman ini tumbuh besar, pindahkan ke penyedia tile berbayar
        (Stadia, Carto, MapTiler) — jangan biarkan beban jatuh ke infrastruktur
        sumbangan.

        Atribusi WAJIB tampil: itu syarat lisensi ODbL, bukan pilihan gaya.
      */}
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        maxZoom={19}
      />

      {stores.map((store) => (
        <Marker
          key={store.id}
          position={[store.latitude, store.longitude]}
          icon={brandIcon(store.name)}
        >
          <Popup>
            <span className="block text-sm font-bold">{store.name}</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {store.address}
            </span>
            <a
              href={getDirectionsUrl(store)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block font-semibold text-primary underline underline-offset-2"
            >
              Petunjuk Arah
            </a>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
