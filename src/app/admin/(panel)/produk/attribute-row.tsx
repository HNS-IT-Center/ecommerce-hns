"use client"

import * as React from "react"
import { Trash2 } from "lucide-react"

import { Combobox, type ComboboxOption } from "@/components/ui/combobox"
import type { ProductAttributeTaxonomy } from "@/types/woocommerce"

type AttributeRowProps = {
  name: string
  value: string
  onNameChange: (name: string) => void
  onValueChange: (value: string) => void
  onRemove: () => void
  attributeOptions: ProductAttributeTaxonomy[]
}

function slugifyAttributeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-")
}

/**
 * Satu baris Spesifikasi/Atribut. Nama & nilai boleh dipilih dari yang sudah
 * ada di database (supaya konsisten antar produk, mis. "Warna" tidak jadi
 * "warna" di satu produk dan "Warna " di produk lain) atau diketik baru —
 * backend meng-upsert otomatis saat produk disimpan.
 */
export function AttributeRow({
  name,
  value,
  onNameChange,
  onValueChange,
  onRemove,
  attributeOptions,
}: AttributeRowProps) {
  const [valueOptions, setValueOptions] = React.useState<ComboboxOption[]>([])

  const nameOptions: ComboboxOption[] = React.useMemo(
    () => attributeOptions.map((attr) => ({ id: attr.id, label: attr.name })),
    [attributeOptions]
  )

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
        className="flex-1"
        inputClassName="text-xs md:text-xs"
      />
      <Combobox
        value={value}
        onValueChange={onValueChange}
        options={valueOptions}
        placeholder="Nilai (mis. Hitam)"
        createHint={(q) => `Nilai baru: "${q}"`}
        className="flex-1"
        inputClassName="text-xs md:text-xs"
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
