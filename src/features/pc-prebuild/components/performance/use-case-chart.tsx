"use client"

import { Bar, BarChart, Cell, LabelList, XAxis, YAxis } from "recharts"

import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import { PREBUILD_USE_CASES, type PrebuildPerformance } from "@/lib/pc-prebuild/performance"

/**
 * Seberapa cocok paket ini untuk tiap kebutuhan — batang mendatar, 0-100.
 *
 * Mendatar, bukan tegak, karena labelnya berupa frasa ("3D Render & Desain").
 * Pada batang tegak label sepanjang itu harus dimiringkan atau dipotong, dan
 * panel ini hidup di kolom sempit (~380px) di sisi kanan halaman paket.
 *
 * Warnanya BUKAN gradasi tujuh warna. Tiga tingkat saja — cocok, lumayan,
 * kurang — supaya matanya langsung menangkap peringkatnya. Tujuh warna berbeda
 * untuk tujuh baris cuma jadi hiasan yang harus diterjemahkan lewat legenda.
 */

const USE_CASE_LABELS = new Map(PREBUILD_USE_CASES.map((u) => [u.id, u.label]))

const chartConfig = {
  score: { label: "Kecocokan", color: "var(--chart-1)" },
} satisfies ChartConfig

/** Ambang warna. Di bawah 50 sengaja dibuat abu — itu bukan "buruk", tapi "bukan untuk ini". */
function warna(score: number): string {
  if (score >= 75) return "var(--primary)"
  if (score >= 50) return "var(--chart-3)"
  return "var(--muted-foreground)"
}

export function UseCaseChart({ performance }: { performance: PrebuildPerformance }) {
  const data = performance.useCases.map((u) => ({
    label: USE_CASE_LABELS.get(u.id) ?? u.id,
    score: u.score,
  }))

  if (data.length === 0) return null

  return (
    <ChartContainer
      config={chartConfig}
      // Tingginya mengikuti jumlah baris, bukan angka tetap: daftar use case
      // bisa menyusut kalau ada id yang tidak dikenali parser, dan tinggi tetap
      // akan menyisakan ruang kosong di tengah panel.
      className="aspect-auto w-full"
      style={{ height: `${Math.max(data.length * 34 + 8, 80)}px` }}
    >
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 36, bottom: 0, left: 0 }}>
        <XAxis type="number" domain={[0, 100]} hide />
        <YAxis
          type="category"
          dataKey="label"
          width={118}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12 }}
        />
        <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={16}>
          {data.map((baris) => (
            <Cell key={baris.label} fill={warna(baris.score)} />
          ))}
          {/* Angkanya ditulis di ujung batang, bukan lewat tooltip: panel ini
              ikut tercetak dan ikut dibaca di layar sentuh, dan pada keduanya
              tooltip tidak pernah muncul. */}
          <LabelList
            dataKey="score"
            position="right"
            offset={8}
            className="fill-muted-foreground"
            fontSize={11}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
