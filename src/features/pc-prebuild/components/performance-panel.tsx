"use client"

import { Gauge, TriangleAlert } from "lucide-react"

import type { PrebuildGame } from "@/lib/pc-prebuild/games"
import {
  PREBUILD_RESOLUTION_TIERS,
  type PrebuildPerformance,
} from "@/lib/pc-prebuild/performance"

import { FpsMatrixChart } from "./fps-matrix-chart"
import { UseCaseScores } from "./use-cases"

/**
 * Panel "Estimasi Performa" di halaman paket.
 *
 * DUA hal yang TIDAK boleh dirender di sini, dan bukan karena kelupaan
 * (keputusan 26 Agustus 2026, docs/11-pc-prebuild.md §9):
 *
 * - `performance.bottleneck` — untuk panel admin saja. Bagi pembeli, "CPU 78 /
 *   GPU 91" bukan informasi yang bisa ditindaklanjuti, dan angka yang terbaca
 *   seperti nilai rapor membuat paket yang sehat terlihat cacat.
 * - Saran upgrade — fiturnya dibuang seluruhnya, bukan disembunyikan.
 *
 * Yang dioper ke sini WAJIB `performancePublic` (sudah tayang dan belum basi),
 * bukan `performance` apa adanya. Penyaringannya di `resolve.ts` supaya tidak
 * diulang di tiap halaman.
 *
 * ## Disclaimer ada DI DALAM panel
 *
 * Bukan ditambahkan halaman pemanggil. Halaman yang lupa menyertakannya adalah
 * halaman yang menampilkan perkiraan sebagai janji — dan angka FPS yang salah
 * tidak punya gejala apa pun sampai ada pelanggan yang mengeluh.
 */

type Props = {
  performance: PrebuildPerformance
  games: PrebuildGame[]
}

const TIER_LABELS = new Map(PREBUILD_RESOLUTION_TIERS.map((t) => [t.id, t]))

export function PerformancePanel({ performance, games }: Props) {
  const tier = TIER_LABELS.get(performance.resolution.tier)

  return (
    <section className="space-y-6 rounded-2xl border bg-card p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Gauge className="h-5 w-5 text-brand-green" />
            Estimasi Performa
          </h2>
          {performance.headline && (
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {performance.headline}
            </p>
          )}
        </div>

        {tier && (
          <span className="shrink-0 rounded-xl bg-brand-green px-3 py-2 text-center text-primary-foreground">
            <span className="block text-base font-extrabold leading-none">{tier.label}</span>
            <span className="mt-1 block text-[11px] opacity-90">
              {performance.resolution.quality}
            </span>
          </span>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Cocok untuk
        </h3>
        <UseCaseScores useCases={performance.useCases} />
      </div>

      <div>
        <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Perkiraan FPS
        </h3>

        {/* Catatan "bukan untuk game" tetap ditampilkan DI ATAS grid, bukan
            menggantikannya: paket kantor pun masih menjalankan sebagian game,
            dan pembelinya tetap ingin tahu berapa. */}
        {!performance.gaming.suitable && performance.gaming.note && (
          <p className="mb-3 rounded-lg bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            {performance.gaming.note}
          </p>
        )}
        {performance.gaming.suitable && performance.gaming.note && (
          <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
            {performance.gaming.note}
          </p>
        )}

        <div className="mt-3">
          {/* Tanpa `onChange` — baca-saja. Angka hanya bisa disunting staff di
              panel admin. */}
          <FpsMatrixChart fps={performance.gaming.fps} games={games} />
        </div>
      </div>

      <p className="flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning/5 p-3.5 text-xs leading-relaxed">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <span>
          <strong className="font-bold">Angka di atas perkiraan kasar, bukan hasil pengukuran.</strong>{" "}
          Hasil sebenarnya bisa berbeda cukup jauh — tergantung versi dan update game, setelan
          grafis yang lebih rinci (bayangan, tekstur, ray tracing, upscaling seperti DLSS/FSR),
          versi driver, resolusi dan refresh rate layar Anda, suhu ruangan, serta program lain yang
          sedang berjalan. Pakai angka ini untuk membandingkan paket, bukan sebagai janji performa.
          Kalau ada target FPS tertentu yang harus dicapai, hubungi kami dulu sebelum memesan.
        </span>
      </p>
    </section>
  )
}
