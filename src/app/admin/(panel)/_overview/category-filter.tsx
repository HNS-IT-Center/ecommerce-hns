"use client"

import type { RootCategoryOption } from "@/lib/api/woocommerce/categories"

/**
 * Pemilih kategori induk untuk kartu dashboard. `null` = semua kategori.
 *
 * `<select>` bawaan, sama dengan penyaring di daftar produk: di ponsel ia
 * membuka pemilih sistem yang jauh lebih mudah ditekan daripada popover.
 */
export function CategoryFilter({
  categories,
  value,
  onChange,
  label,
}: {
  categories: RootCategoryOption[]
  value: number | null
  onChange: (value: number | null) => void
  label: string
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}
      aria-label={label}
      className="w-full min-w-0 rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary sm:w-48"
    >
      <option value="">Semua kategori</option>
      {categories.map((category) => (
        <option key={category.id} value={category.id}>
          {category.name}
        </option>
      ))}
    </select>
  )
}
