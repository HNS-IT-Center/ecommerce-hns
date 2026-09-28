"use client";

import dynamic from "next/dynamic";

import type {
  MapSelection,
  MapStoreItem,
} from "./stores-overview-map-maplibre";

/**
 * Pemuat peta ikhtisar.
 *
 * MapLibre menyentuh `window` dan `document` saat dirender, jadi ia mustahil
 * dirender di server — karena itu `ssr: false`. Pembungkus ini ada karena
 * `next/dynamic` dengan `ssr: false` hanya boleh dipanggil dari Client
 * Component.
 *
 * Penampungnya diberi tinggi yang sama persis dengan peta jadinya. Tanpa itu,
 * halaman melompat begitu peta selesai dimuat — dan lompatannya terjadi tepat
 * saat pembaca mulai membaca kartu toko di bawahnya.
 */
const StoresOverviewMap = dynamic(
  () =>
    import("./stores-overview-map-maplibre").then((m) => m.StoresOverviewMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-muted">
        <span className="text-sm text-muted-foreground">Memuat peta…</span>
      </div>
    ),
  },
);

export function StoresOverviewMapLoader(props: {
  stores: MapStoreItem[];
  selection: MapSelection | null;
  onSelect: (id: string | null) => void;
}) {
  return <StoresOverviewMap {...props} />;
}
