"use client";

import { useEffect, useRef } from "react";
import type { LngLatBoundsLike, PaddingOptions } from "maplibre-gl";

import {
  Map,
  MapControls,
  MapMarker,
  MarkerContent,
  MarkerLabel,
  useMap,
} from "@/components/ui/map";
import { cn } from "@/lib/utils";

/**
 * UJI COBA (branch `feat/mapcn-trial`): satu peta untuk seluruh cabang, dibangun
 * dengan mapcn/MapLibre.
 *
 * Peta ini TIDAK memuat info toko. Daftar ringkas dan panel detailnya dirender
 * `StoresLocator` sebagai HTML biasa yang diletakkan di atas peta — peta dimuat
 * hanya di browser (`ssr: false`), dan isi yang hidup di dalamnya akan hilang
 * dari HTML server. Tugas komponen ini tinggal pin dan gerak kamera.
 */

export type MapStoreItem = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

/**
 * Cabang yang sedang dibuka. `seq` membuat pilihan ulang pada cabang yang sama
 * tetap menggerakkan peta — mis. setelah pengunjung menggesernya menjauh.
 */
export type MapSelection = { id: string; seq: number };

/**
 * Ruang yang ditutupi HTML di atas peta, dalam piksel. HARUS sama dengan ukuran
 * di `StoresLocator`: lebar panel (`md:w-80` = 320) + jarak tepinya (12), dan
 * pada HP tinggi daftar ringkas di atas peta.
 */
export const OVERLAY_WIDE_LEFT = 320 + 12;
export const OVERLAY_NARROW_TOP = 82 + 12;

/** Sama dengan breakpoint `md` Tailwind — titik panel berpindah ke atas peta. */
const WIDE_QUERY = "(min-width: 768px)";

/** Zoom saat satu cabang dibuka: cukup rapat untuk mengenali blok rukonya. */
const SINGLE_STORE_ZOOM = 16;

/** Jarak pin terluar dari tepi area peta yang terlihat. */
const EDGE = 48;

/**
 * Jarak bawah lebih lega: label nama menggantung di bawah pin, dan kotak
 * atribusi © CARTO menempati pojok kanan bawah — tanpa ruang ini label pin
 * terbawah tertimpa atribusi.
 */
const BOTTOM_EDGE = 88;

function isWide(): boolean {
  return window.matchMedia(WIDE_QUERY).matches;
}

/**
 * Padding untuk tampilan awal. Sisi yang tertutup panel/daftar diberi tambahan
 * selebar penutupnya — tanpa itu salah satu pin bisa jatuh tepat di bawah
 * panel dan tidak terlihat sama sekali.
 */
function overviewPadding(): PaddingOptions {
  return isWide()
    ? { top: EDGE, bottom: BOTTOM_EDGE, left: OVERLAY_WIDE_LEFT + EDGE, right: EDGE }
    : { top: OVERLAY_NARROW_TOP + EDGE, bottom: BOTTOM_EDGE, left: EDGE, right: EDGE };
}

/**
 * Geser titik tengah ke tengah area yang TIDAK tertutup — di kanan panel pada
 * layar lebar, di bawah daftar ringkas pada HP.
 */
function focusOffset(): [number, number] {
  return isWide() ? [OVERLAY_WIDE_LEFT / 2, 0] : [0, OVERLAY_NARROW_TOP / 2];
}

/**
 * Zoom roda gulir dikunci sampai peta diklik, lalu dikunci lagi saat kursor
 * pergi — peta yang langsung menangkap roda gulir menjebak pembaca yang
 * sebenarnya ingin menggulir halaman.
 */
function ScrollZoomOnClick() {
  const { map } = useMap();

  useEffect(() => {
    if (!map) return;
    const enable = () => map.scrollZoom.enable();
    const disable = () => map.scrollZoom.disable();
    map.on("click", enable);
    map.on("mouseout", disable);
    return () => {
      map.off("click", enable);
      map.off("mouseout", disable);
    };
  }, [map]);

  return null;
}

/** Klik area kosong peta = tutup detail. Klik pin tidak sampai ke sini. */
function CloseOnMapClick({ onClose }: { onClose: () => void }) {
  const { map } = useMap();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!map) return;
    const handler = () => onCloseRef.current();
    map.on("click", handler);
    return () => {
      map.off("click", handler);
    };
  }, [map]);

  return null;
}

/**
 * Gerak kamera mengikuti pilihan: dibuka → terbang ke cabangnya; ditutup →
 * kembali ke tampilan awal yang memuat semua cabang, supaya peta tidak tertinggal
 * menyorot satu toko setelah pengunjung selesai melihatnya.
 */
function CameraFollowsSelection({
  selection,
  stores,
  bounds,
  single,
}: {
  selection: MapSelection | null;
  stores: MapStoreItem[];
  bounds: LngLatBoundsLike | undefined;
  single: MapStoreItem | null;
}) {
  const { map } = useMap();
  const pernahDipilih = useRef(false);

  useEffect(() => {
    if (!map) return;

    // Tanpa `essential: true`, MapLibre menghormati `prefers-reduced-motion`
    // dan melompat langsung alih-alih bergerak.
    if (selection) {
      const target = stores.find((s) => s.id === selection.id);
      if (!target) return;
      pernahDipilih.current = true;
      map.flyTo({
        center: [target.longitude, target.latitude],
        zoom: Math.max(map.getZoom(), SINGLE_STORE_ZOOM),
        offset: focusOffset(),
        duration: 900,
      });
      return;
    }

    // Saat pertama dipasang, tampilan awal sudah diatur lewat prop `Map`.
    if (!pernahDipilih.current) return;

    if (bounds) {
      map.fitBounds(bounds, { padding: overviewPadding(), duration: 900 });
    } else if (single) {
      map.flyTo({
        center: [single.longitude, single.latitude],
        zoom: SINGLE_STORE_ZOOM,
        offset: focusOffset(),
        duration: 900,
      });
    }
    // `stores`/`bounds`/`single` diturunkan dari data toko yang tetap selama
    // halaman terbuka; yang memicu gerak hanya pilihan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, selection]);

  return null;
}

type Props = {
  stores: MapStoreItem[];
  selection: MapSelection | null;
  onSelect: (id: string | null) => void;
};

export function StoresOverviewMap({ stores, selection, onSelect }: Props) {
  if (stores.length === 0) return null;

  const tunggal = stores.length === 1 ? stores[0] : null;

  /*
    `fitBounds` atas satu titik menghasilkan zoom maksimum, jadi satu cabang
    memakai center + zoom tetap; dua cabang atau lebih dihitung batasnya — tidak
    ada angka zoom yang ditulis tangan, jadi cabang ketiga ikut termuat sendiri.
  */
  const bounds: LngLatBoundsLike | undefined = tunggal
    ? undefined
    : [
        [
          Math.min(...stores.map((s) => s.longitude)),
          Math.min(...stores.map((s) => s.latitude)),
        ],
        [
          Math.max(...stores.map((s) => s.longitude)),
          Math.max(...stores.map((s) => s.latitude)),
        ],
      ];

  return (
    <Map
      /*
        `theme="light"` WAJIB. Tanpa prop ini mapcn mengikuti setelan gelap
        SISTEM OPERASI, padahal situs ini selalu digambar terang (kelas `.dark`
        tidak pernah dipasang). Akibatnya: peta hitam di tengah halaman putih
        bagi setiap pengunjung yang Windows/HP-nya disetel gelap.
      */
      theme="light"
      center={tunggal ? [tunggal.longitude, tunggal.latitude] : undefined}
      zoom={tunggal ? SINGLE_STORE_ZOOM : undefined}
      bounds={bounds}
      fitBoundsOptions={{ padding: overviewPadding() }}
      scrollZoom={false}
      /* `isolate`: z-index isi peta tidak boleh bocor dan bersaing dengan
         dropdown header. */
      className="isolate"
    >
      <ScrollZoomOnClick />
      <CloseOnMapClick onClose={() => onSelect(null)} />
      <CameraFollowsSelection
        selection={selection}
        stores={stores}
        bounds={bounds}
        single={tunggal}
      />
      {/* Kanan bawah: kiri atas milik panel, dan kanan atas pada HP ikut
          tertutup daftar ringkas yang selebar peta. */}
      <MapControls position="bottom-right" showZoom />

      {stores.map((store) => {
        const dipilih = selection?.id === store.id;
        return (
          <MapMarker
            key={store.id}
            longitude={store.longitude}
            latitude={store.latitude}
            anchor="bottom"
            onClick={(e) => {
              /*
                WAJIB. Tanpa ini kliknya menggelembung ke peta, dan
                `CloseOnMapClick` langsung menutup detail yang baru dibuka.
              */
              e.stopPropagation();
              onSelect(store.id);
            }}
          >
            <MarkerContent
              className={cn(
                "origin-bottom text-primary transition-transform",
                dipilih && "scale-115",
              )}
            >
              <svg
                width="32"
                height="42"
                viewBox="0 0 32 42"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M16 41C16 41 30 25.5 30 16C30 8.26801 23.732 2 16 2C8.26801 2 2 8.26801 2 16C2 25.5 16 41 16 41Z"
                  fill="currentColor"
                  stroke="white"
                  strokeWidth="2.5"
                />
                <circle cx="16" cy="16" r="5.5" fill="white" />
              </svg>
              <MarkerLabel
                position="bottom"
                className="mt-0.5 rounded bg-background/90 px-1.5 py-0.5 text-[11px] font-semibold shadow-sm"
              >
                {store.name}
              </MarkerLabel>
            </MarkerContent>
          </MapMarker>
        );
      })}
    </Map>
  );
}
