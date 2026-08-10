"use client"

import * as React from "react"

import type { ComboboxOption } from "@/components/ui/combobox"
import type { ProductAttributeTaxonomy } from "@/types/woocommerce"

function slugifyAttributeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-")
}

/**
 * Muat daftar nilai yang sudah ada untuk beberapa atribut sekaligus.
 *
 * Dipakai editor varian supaya nilai varian dipilih dari yang sudah ada
 * ("Black", "WHITE", …) alih-alih diketik bebas. Dengan 296 nilai WARNA di
 * sistem, isian teks bebas hampir pasti melahirkan ejaan kembar yang tampil
 * sebagai dua pilihan berbeda di halaman produk.
 *
 * Hasilnya dikunci nama atribut yang sudah dinormalisasi, sehingga "WARNA" dan
 * "Warna" berbagi satu daftar — sama seperti perlakuan di sisi server.
 *
 * Nilai yang belum ada tetap boleh diketik: backend meng-upsert-nya saat produk
 * disimpan (lihat `resolveAttributeValueId` di lib/api/woocommerce/products.ts).
 */
export function useAttributeValues(
  attributeNames: string[],
  attributeOptions: ProductAttributeTaxonomy[],
): Record<string, ComboboxOption[]> {
  const [valuesByAttribute, setValuesByAttribute] = React.useState<Record<string, ComboboxOption[]>>({})

  // Dirangkai jadi string supaya efek di bawah tidak berjalan ulang tiap render
  // hanya karena array-nya identitas baru dengan isi yang sama.
  const namesKey = attributeNames.join("|")

  React.useEffect(() => {
    let cancelled = false
    const names = namesKey ? namesKey.split("|") : []

    async function load() {
      const loaded: Record<string, ComboboxOption[]> = {}

      await Promise.all(
        names.map(async (name) => {
          const matched = attributeOptions.find(
            (attr) => attr.name.trim().toLowerCase() === name.trim().toLowerCase(),
          )
          // Atribut yang baru diketik admin belum ada di master, jadi belum
          // punya nilai apa pun — daftar kosong sudah benar.
          if (!matched) {
            loaded[name.trim().toLowerCase()] = []
            return
          }

          try {
            const res = await fetch(
              `/api/attribute-terms?attributeSlug=${encodeURIComponent(slugifyAttributeName(matched.name))}`,
            )
            const terms: Array<{ id: number; name: string }> = await res.json()
            loaded[name.trim().toLowerCase()] = terms.map((t) => ({ id: t.id, label: t.name }))
          } catch {
            // Kegagalan jaringan tidak boleh mengunci isian: daftar saran kosong,
            // admin tetap bisa mengetik nilainya sendiri.
            loaded[name.trim().toLowerCase()] = []
          }
        }),
      )

      if (!cancelled) setValuesByAttribute(loaded)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [namesKey, attributeOptions])

  return valuesByAttribute
}
