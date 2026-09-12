"use client"

import { Bar, BarChart, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

// Data placeholder — belum tersambung ke sumber order/revenue asli.
// Ganti dengan hasil agregasi dari lib/services/dashboard begitu tersedia.
const data = [
  { month: "Jan", total: 3820 },
  { month: "Feb", total: 3410 },
  { month: "Mar", total: 4390 },
  { month: "Apr", total: 1980 },
  { month: "May", total: 4870 },
  { month: "Jun", total: 4540 },
  { month: "Jul", total: 1720 },
  { month: "Aug", total: 3260 },
  { month: "Sep", total: 2190 },
  { month: "Oct", total: 2540 },
  { month: "Nov", total: 4980 },
  { month: "Dec", total: 4310 },
]

const chartConfig = {
  total: {
    label: "Penjualan",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

export function Overview() {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-[350px] w-full">
      <BarChart data={data}>
        <XAxis
          dataKey="month"
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `$${value}`}
        />
        <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
        <Bar dataKey="total" fill="var(--color-total)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}
