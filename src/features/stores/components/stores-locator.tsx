"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { OpenStatusBadge } from "./open-status-badge";
import { StorePanel, type PanelStore } from "./store-panel";
import { StoresOverviewMapLoader } from "./stores-overview-map-loader";
import type {
  MapSelection,
  MapStoreItem,
} from "./stores-overview-map-maplibre";

/**
 * Pencari lokasi toko: satu peta, daftar ringkas cabang menempel di atasnya,
 * dan panel detail untuk cabang yang dipilih.
 *
 * Daftar dan panel adalah HTML biasa yang DILETAKKAN di atas peta, bukan isi
 * MapLibre. Peta hanya dimuat di browser; kalau info toko hidup di dalamnya,
 * ia kosong sampai peta selesai dimuat dan tidak ada di HTML server.
 *
 * Susunannya berbeda per lebar layar:
 * - Mulai `md`: daftar di kiri atas peta; memilih cabang menggantinya dengan
 *   panel detail di tempat yang sama.
 * - HP: daftar dua kolom di atas peta tetap terlihat, panel detail terbuka di
 *   BAWAH peta. Di peta selebar ±360px, panel berfoto setinggi ±350px akan
 *   menutupi hampir seluruh peta — termasuk pin toko yang sedang dilihat.
 *
 * Komponen ini memegang satu-satunya state bersama: cabang mana yang terbuka.
 * Daftar, pin, klik area kosong peta, dan tombol Esc semua menulis ke sini.
 */

type Pilihan = MapSelection & {
  /** Dibuka dari daftar (bukan pin) → fokus papan ketik ikut pindah ke panel. */
  dariDaftar: boolean;
};

/** Lebar layar tempat panel berpindah ke atas peta — breakpoint `md`. */
const WIDE_QUERY = "(min-width: 768px)";

export function StoresLocator({ stores }: { stores: PanelStore[] }) {
  const [pilihan, setPilihan] = useState<Pilihan | null>(null);
  /**
   * Cabang yang tombol daftarnya menerima fokus lagi setelah panel ditutup.
   * Ref, bukan state: nilainya hanya dibaca efek, tidak pernah ditampilkan.
   */
  const fokusKembali = useRef<string | null>(null);

  const tutupLebar = useRef<HTMLButtonElement>(null);
  const tutupSempit = useRef<HTMLButtonElement>(null);
  const detailSempit = useRef<HTMLDivElement>(null);
  const daftar = useRef<HTMLUListElement>(null);

  // Cabang tanpa koordinat tetap ada di daftar; ia hanya tidak punya pin.
  const diPeta: MapStoreItem[] = stores.flatMap((s) =>
    s.latitude !== null && s.longitude !== null
      ? [{ id: s.id, name: s.name, latitude: s.latitude, longitude: s.longitude }]
      : [],
  );

  const aktif = pilihan ? (stores.find((s) => s.id === pilihan.id) ?? null) : null;

  function buka(id: string, dariDaftar: boolean) {
    setPilihan((prev) => ({ id, dariDaftar, seq: (prev?.seq ?? 0) + 1 }));
  }

  function tutup(kembalikanFokus: boolean) {
    if (kembalikanFokus && pilihan) fokusKembali.current = pilihan.id;
    setPilihan(null);
  }

  /** Esc menutup panel, seperti dialog pada umumnya. */
  useEffect(() => {
    if (!pilihan) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") tutup(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pilihan]);

  /**
   * Setelah panel terbuka:
   * - Dibuka dari daftar → fokus pindah ke tombol Tutup panel. Di layar lebar
   *   tombol daftar yang baru ditekan ikut hilang, dan tanpa ini fokus papan
   *   ketik jatuh ke `<body>`.
   * - Pada HP, panel ada di bawah peta dan bisa berada di luar layar. Halaman
   *   digulir seminimal mungkin (`nearest`) HANYA kalau panelnya nyaris tidak
   *   terlihat — bukan setiap kali.
   *
   * `preventScroll` pada fokus WAJIB: tanpa itu fokus sendiri yang menggulir
   * halaman, persis gerakan yang ingin dihindari.
   */
  useEffect(() => {
    if (!pilihan) {
      // Panel baru ditutup lewat X/Esc → fokus kembali ke tombol daftar
      // cabangnya, yang di layar lebar baru saja muncul lagi.
      const id = fokusKembali.current;
      fokusKembali.current = null;
      if (id) {
        daftar.current
          ?.querySelector<HTMLButtonElement>(`[data-store-id="${id}"]`)
          ?.focus({ preventScroll: true });
      }
      return;
    }
    const frame = requestAnimationFrame(() => {
      const lebar = window.matchMedia(WIDE_QUERY).matches;

      if (pilihan.dariDaftar) {
        (lebar ? tutupLebar : tutupSempit).current?.focus({
          preventScroll: true,
        });
      }

      const detail = detailSempit.current;
      if (!lebar && detail) {
        const top = detail.getBoundingClientRect().top;
        if (top > window.innerHeight - 120) {
          detail.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [pilihan]);

  return (
    <div className="mt-6">
      <div
        role="region"
        aria-label="Peta lokasi cabang"
        /* `isolate`: z-index daftar dan isi peta tidak boleh bocor dan
           bersaing dengan dropdown header. */
        className="relative isolate h-96 overflow-hidden rounded-2xl border bg-muted md:h-120"
      >
        {diPeta.length > 0 && (
          <StoresOverviewMapLoader
            stores={diPeta}
            selection={pilihan}
            onSelect={(id) => (id === null ? tutup(false) : buka(id, false))}
          />
        )}

        {/*
          Lapisan di atas peta. `pointer-events-none` pada pembungkus supaya
          area kosongnya tetap bisa digeser dan diklik sebagai peta; hanya
          kartunya yang menangkap klik.

          Ukurannya dipakai peta untuk menjauhkan pin dari bagian yang
          tertutup — lihat OVERLAY_* di stores-overview-map-maplibre.tsx.
        */}
        <div className="pointer-events-none absolute inset-x-3 top-3 z-10 md:bottom-3 md:right-auto md:w-80">
          <ul
            ref={daftar}
            aria-label="Daftar cabang"
            className={cn(
              "grid grid-cols-2 gap-2 md:grid-cols-1",
              aktif && "md:hidden",
            )}
          >
            {stores.map((store) => {
              const dipilih = aktif?.id === store.id;
              return (
                <li key={store.id}>
                  <button
                    type="button"
                    data-store-id={store.id}
                    aria-expanded={dipilih}
                    onClick={() =>
                      dipilih ? tutup(false) : buka(store.id, true)
                    }
                    className={cn(
                      "pointer-events-auto flex h-full w-full flex-col items-start gap-1.5 rounded-xl border bg-card/95 p-2.5 text-left shadow-md backdrop-blur-sm transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:p-3",
                      dipilih && "border-primary ring-1 ring-primary",
                    )}
                  >
                    <span className="line-clamp-2 text-xs font-bold leading-snug md:text-sm">
                      {store.name}
                    </span>
                    <OpenStatusBadge
                      hours={store.hours}
                      className="px-2 py-0.5 text-[11px]"
                    />
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Panel detail layar lebar — menggantikan daftar di tempat yang
              sama. Digulir di dalam kalau jam lengkapnya dibuka. */}
          {aktif && (
            <div className="pointer-events-auto hidden max-h-full overflow-y-auto rounded-2xl md:block">
              <StorePanel
                ref={tutupLebar}
                store={aktif}
                onClose={() => tutup(true)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Panel detail HP — di bawah peta, supaya peta dan pinnya tetap
          terlihat. `scroll-mt-24`: header menempel di atas layar. */}
      {aktif && (
        <div ref={detailSempit} className="mt-4 scroll-mt-24 md:hidden">
          <StorePanel
            ref={tutupSempit}
            store={aktif}
            onClose={() => tutup(true)}
          />
        </div>
      )}
    </div>
  );
}
