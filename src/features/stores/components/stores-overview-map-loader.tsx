"use client";

import dynamic from "next/dynamic";

import type { MapStore } from "./stores-overview-map";

/**
 * Pemuat peta ikhtisar.
 *
 * Leaflet menyentuh `window` saat modulnya dievaluasi, jadi ia mustahil dirender
 * di server — karena itu `ssr: false`. Pembungkus ini ada karena `next/dynamic`
 * dengan `ssr: false` hanya boleh dipanggil dari Client Component, sedangkan
 * halaman `/stores` adalah Server Component yang membaca database.
 *
 * Penampungnya diberi tinggi yang sama persis dengan peta jadinya. Tanpa itu,
 * halaman melompat begitu peta selesai dimuat — dan lompatannya terjadi tepat
 * saat pembaca mulai membaca kartu toko di bawahnya.
 */
const StoresOverviewMap = dynamic(
  () => import("./stores-overview-map").then((m) => m.StoresOverviewMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-muted">
        <span className="text-sm text-muted-foreground">Memuat peta…</span>
      </div>
    ),
  },
);

export function StoresOverviewMapLoader({ stores }: { stores: MapStore[] }) {
  return <StoresOverviewMap stores={stores} />;
}
