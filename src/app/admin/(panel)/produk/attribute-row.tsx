"use client"

import * as React from "react"
import { Trash2 } from "lucide-react"

import { Combobox, type ComboboxOption } from "@/components/ui/combobox"
import { TagInput } from "@/components/ui/tag-input"
import type { ProductAttributeTaxonomy } from "@/types/woocommerce"

type AttributeRowProps = {
  name: string
  /** Bisa lebih dari satu, mis. ["ATX", "Micro-ATX"]. */
  values: string[]
  onNameChange: (name: string) => void
  onValuesChange: (values: string[]) => void
  onRemove: () => void
  attributeOptions: ProductAttributeTaxonomy[]
}

function slugifyAttributeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-")
}

/**
 * Satu baris Spesifikasi/Atribut.
 *
 * Nama & nilai boleh dipilih dari yang sudah ada di database (supaya konsisten
 * antar produk, mis. "Warna" tidak jadi "warna" di satu produk dan "Warna " di
 * produk lain) atau diketik baru — backend meng-upsert otomatis saat produk
 * disimpan.
 *
 * Nilainya jamak: satu atribut sah punya beberapa nilai sekaligus, mis. casing
 * yang muat "ATX" dan "Micro-ATX". Struktur database sudah mendukung itu (satu
 * baris `product_attributes` per nilai).
 */
export function AttributeRow({
  name,
  values,
  onNameChange,
  onValuesChange,
  onRemove,
  attributeOptions,
}: AttributeRowProps) {
  const [valueOptions, setValueOptions] = React.useState<ComboboxOption[]>([])

  const nameOptions: ComboboxOption[] = React.useMemo(
    () => attributeOptions.map((attr) => ({ id: attr.id, label: attr.name })),
    [attributeOptions]
  )

  // Nilai hanya bisa diisi setelah atributnya jelas: daftar saran diambil
  // per-atribut, dan mengetik nilai tanpa nama atribut menghasilkan data yang
  // tidak bisa disimpan.
  const hasAttribute = name.trim().length > 0

  React.useEffect(() => {
    let cancelled = false

    async function loadValueOptions() {
      const matched = attributeOptions.find(
        (attr) => attr.name.toLowerCase() === name.trim().toLowerCase()
      )
      if (!matched) {
        if (!cancelled) setValueOptions([])
        return
      }

      try {
        const slug = slugifyAttributeName(matched.name)
        const res = await fetch(`/api/attribute-terms?attributeSlug=${encodeURIComponent(slug)}`)
        const terms: Array<{ id: number; name: string }> = await res.json()
        if (!cancelled) setValueOptions(terms.map((t) => ({ id: t.id, label: t.name })))
      } catch {
        if (!cancelled) setValueOptions([])
      }
    }

    loadValueOptions()

    return () => {
      cancelled = true
    }
  }, [name, attributeOptions])

  return (
    <div className="flex items-start gap-2">
      <Combobox
        value={name}
        onValueChange={onNameChange}
        options={nameOptions}
        placeholder="Nama (mis. Warna)"
        createHint={(q) => `Atribut baru: "${q}"`}
        className="w-full max-w-[13rem] shrink-0"
        inputClassName="text-xs md:text-xs"
      />
      <TagInput
        values={values}
        onValuesChange={onValuesChange}
        options={valueOptions}
        placeholder={hasAttribute ? "Nilai (mis. Hitam) — Enter" : "Pilih atribut dulu"}
        createHint={(q) => `Nilai baru: "${q}"`}
        disabled={!hasAttribute}
        disabledHint="Isi nama atribut di sebelah kiri dulu."
        className="flex-1"
      />
      <button
        type="button"
        onClick={onRemove}
        className="mt-1 shrink-0 rounded-lg p-2 text-destructive hover:bg-destructive/10"
        aria-label="Hapus atribut"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}
