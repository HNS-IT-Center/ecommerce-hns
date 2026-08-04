"use client";

import { useState } from "react";
import { CopyCheck } from "lucide-react";

import {
  DAY_NAMES,
  type DayOfWeek,
  type StoreHours,
} from "@/lib/utils/opening-hours";

/**
 * Pengisi jam buka tujuh hari.
 *
 * Memakai `<select>`, BUKAN `<input type="time">`. Bedanya bukan selera: input
 * waktu bawaan peramban menampilkan format mengikuti locale sistem, sehingga
 * staff yang mesinnya berbahasa Inggris melihat "09:00 AM" sementara yang lain
 * melihat "09.00" — padahal yang tersimpan harus selalu "HH:MM" 24 jam. Daftar
 * pilihan menutup celah itu sekaligus membuat jam ganjil seperti 09:07 mustahil
 * terketik.
 *
 * Nilainya dikendalikan React supaya tombol "terapkan ke semua hari" bisa
 * mengubah enam baris sekaligus — hal yang tidak mungkin kalau medannya tak
 * terkendali.
 */

/** Senin dulu, Minggu terakhir: urutan baca, bukan urutan simpan (0 = Minggu). */
const DAYS_IN_FORM: readonly DayOfWeek[] = [1, 2, 3, 4, 5, 6, 0];

const DEFAULT_OPENS = "09:00";
const DEFAULT_CLOSES = "21:00";

/**
 * Pilihan jam tiap setengah jam, 06:00–23:30.
 *
 * Rentangnya sengaja tidak 24 jam penuh — toko ritel tidak buka pukul 03:00, dan
 * daftar yang lebih pendek lebih cepat dipindai. Nilai di luar rentang yang
 * sudah terlanjur tersimpan tetap disisipkan (lihat `withStored`), supaya
 * membuka formulir tidak diam-diam mengubah jam yang sudah benar.
 */
function baseTimes(): string[] {
  const out: string[] = [];
  for (let h = 6; h <= 23; h++) {
    for (const m of ["00", "30"])
      out.push(`${String(h).padStart(2, "0")}:${m}`);
  }
  return out;
}

function withStored(times: string[], ...stored: string[]): string[] {
  const set = new Set(times);
  for (const t of stored) if (/^\d{2}:\d{2}$/.test(t)) set.add(t);
  return [...set].sort();
}

type Row = {
  dayOfWeek: DayOfWeek;
  isClosed: boolean;
  opensAt: string;
  closesAt: string;
};

function buildRows(initial: readonly StoreHours[]): Row[] {
  const byDay = new Map(initial.map((h) => [h.dayOfWeek, h]));
  return DAYS_IN_FORM.map((day) => {
    const ada = byDay.get(day);
    return {
      dayOfWeek: day,
      isClosed: ada?.isClosed ?? false,
      opensAt: ada?.opensAt || DEFAULT_OPENS,
      closesAt: ada?.closesAt || DEFAULT_CLOSES,
    };
  });
}

const selectClass =
  "w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm tabular-nums outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground";

export function StoreHoursEditor({
  initial,
}: {
  initial: readonly StoreHours[];
}) {
  const [rows, setRows] = useState<Row[]>(() => buildRows(initial));

  const ubah = (day: DayOfWeek, patch: Partial<Row>) =>
    setRows((prev) =>
      prev.map((r) => (r.dayOfWeek === day ? { ...r, ...patch } : r)),
    );

  /**
   * Menyalin jam Senin ke hari lain, KECUALI hari yang ditandai tutup — menimpa
   * hari libur dengan jam kerja adalah kesalahan yang sulit disadari setelah
   * halaman disimpan.
   */
  const terapkanKeSemua = () => {
    const senin = rows.find((r) => r.dayOfWeek === 1);
    if (!senin) return;
    setRows((prev) =>
      prev.map((r) =>
        r.isClosed
          ? r
          : { ...r, opensAt: senin.opensAt, closesAt: senin.closesAt },
      ),
    );
  };

  return (
    <div className="overflow-hidden rounded-xl border border-input">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-input bg-muted/40 px-3 py-2">
        <span className="text-xs text-muted-foreground">
          Isi Senin, lalu salin ke hari lain.
        </span>
        <button
          type="button"
          onClick={terapkanKeSemua}
          className="flex items-center gap-1.5 rounded-lg border border-primary px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
        >
          <CopyCheck className="h-3.5 w-3.5" />
          Terapkan ke semua hari
        </button>
      </div>

      {rows.map((row, i) => {
        const day = row.dayOfWeek;
        const pilihan = withStored(baseTimes(), row.opensAt, row.closesAt);

        return (
          <div
            key={day}
            className={`grid grid-cols-[3.5rem_1fr_auto_1fr_auto] items-center gap-2 px-3 py-1.5 ${
              i > 0 ? "border-t border-input/60" : ""
            }`}
          >
            <span
              className={`text-sm ${row.isClosed ? "text-muted-foreground" : "font-medium text-foreground"}`}
            >
              {DAY_NAMES[day]}
            </span>

            {/*
              Saat hari ditandai tutup, `<select>` dinonaktifkan — dan medan yang
              nonaktif TIDAK ikut terkirim. Nilainya dititipkan ke input
              tersembunyi supaya jam lama tidak hilang begitu hari libur disimpan
              lalu dibuka kembali.
            */}
            <select
              name={row.isClosed ? undefined : `opens-${day}`}
              value={row.opensAt}
              disabled={row.isClosed}
              onChange={(e) => ubah(day, { opensAt: e.target.value })}
              aria-label={`Jam buka ${DAY_NAMES[day]}`}
              className={selectClass}
            >
              {pilihan.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <span
              className={`text-xs ${row.isClosed ? "text-muted-foreground/40" : "text-muted-foreground"}`}
            >
              –
            </span>

            <select
              name={row.isClosed ? undefined : `closes-${day}`}
              value={row.closesAt}
              disabled={row.isClosed}
              onChange={(e) => ubah(day, { closesAt: e.target.value })}
              aria-label={`Jam tutup ${DAY_NAMES[day]}`}
              className={selectClass}
            >
              {pilihan.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            {row.isClosed && (
              <>
                <input
                  type="hidden"
                  name={`opens-${day}`}
                  value={row.opensAt}
                />
                <input
                  type="hidden"
                  name={`closes-${day}`}
                  value={row.closesAt}
                />
              </>
            )}

            <label
              className={`flex shrink-0 cursor-pointer select-none items-center gap-1.5 text-xs ${
                row.isClosed
                  ? "font-medium text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              <input
                type="checkbox"
                name={`closed-${day}`}
                checked={row.isClosed}
                onChange={(e) => ubah(day, { isClosed: e.target.checked })}
                className="h-3.5 w-3.5 accent-destructive"
              />
              Tutup
            </label>
          </div>
        );
      })}
    </div>
  );
}
