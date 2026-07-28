"use client"

import { useMemo, useState } from "react"
import { ChevronRight, CornerDownRight, Search, TriangleAlert, X } from "lucide-react"
import type { ProductCategory } from "@/types/woocommerce"

/**
 * Pemilih kategori berbentuk pohon.
 *
 * Menggantikan daftar 133 checkbox datar yang sebelumnya hanya menampilkan nama
 * kategori tanpa jalur induknya. Daftar datar itu membuat staff tidak bisa
 * membedakan "AMD" (prosesor) dari "AMD / ATI RADEON" (VGA), atau tahu bahwa
 * "MID TOWER" itu anak dari "CASING PC" — akibatnya mereka mencentang kategori
 * payung saja. Hasilnya di data: 140 produk berhenti di kategori level 1 dan 49
 * produk berhenti di level 2 padahal kategorinya punya anak.
 *
 * Aturan pemilihan: staff memilih SATU kategori paling spesifik, induknya ikut
 * otomatis. Satu produk = satu jalur kategori (keputusan 2026-07-27).
 */

type CategoryNode = {
  id: number
  name: string
  count: number
  children: CategoryNode[]
}

type CategoryPickerProps = {
  categories: ProductCategory[]
  value: number[]
  onChange: (ids: number[]) => void
}

const MAX_DEPTH_GUARD = 20
const MAX_SEARCH_RESULTS = 50

/** Rantai induk dari akar sampai tepat di atas `id` (tidak termasuk `id`). */
function ancestorsOf(id: number, byId: Map<number, ProductCategory>): number[] {
  const chain: number[] = []
  let current = byId.get(id)?.parent ?? 0

  // Pembatas iterasi supaya data induk yang melingkar tidak bikin loop tak henti.
  for (let guard = 0; current && guard < MAX_DEPTH_GUARD; guard += 1) {
    chain.unshift(current)
    current = byId.get(current)?.parent ?? 0
  }

  return chain
}

/** Jalur lengkap sebagai teks, mis. "KOMPONEN PC / NB › MOTHERBOARD › MOTHERBOARD AMD". */
function pathLabelOf(id: number, byId: Map<number, ProductCategory>): string {
  return [...ancestorsOf(id, byId), id].map((cid) => byId.get(cid)?.name ?? "?").join(" › ")
}

function buildTree(categories: ProductCategory[]): CategoryNode[] {
  const nodes = new Map<number, CategoryNode>()
  for (const category of categories) {
    nodes.set(category.id, {
      id: category.id,
      name: category.name,
      count: category.count,
      children: [],
    })
  }

  const roots: CategoryNode[] = []
  for (const category of categories) {
    const node = nodes.get(category.id)
    if (!node) continue

    const parent = category.parent ? nodes.get(category.parent) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  const sortRecursively = (list: CategoryNode[]) => {
    list.sort((a, b) => a.name.localeCompare(b.name, "id"))
    for (const node of list) sortRecursively(node.children)
  }
  sortRecursively(roots)

  return roots
}

export function CategoryPicker({ categories, value, onChange }: CategoryPickerProps) {
  const [query, setQuery] = useState("")

  const byId = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  )
  const tree = useMemo(() => buildTree(categories), [categories])

  // Kategori terpilih = yang paling dalam. Induknya memang ikut tersimpan di
  // `value`, tapi yang ditampilkan ke staff cukup yang paling spesifik.
  const selectedId = useMemo(() => {
    let deepest: number | null = null
    let deepestLevel = -1

    for (const id of value) {
      const level = ancestorsOf(id, byId).length
      if (level > deepestLevel) {
        deepestLevel = level
        deepest = id
      }
    }

    return deepest
  }, [value, byId])

  // Produk lama bisa punya kategori dari beberapa pohon sekaligus (mis. TP-LINK
  // ada di AKSESSORIES KOMPUTER dan NETWORK TOOLS). Itu ditampilkan sebagai
  // peringatan supaya staff memilih satu, bukan diam-diam dibuang.
  const conflictingPaths = useMemo(() => {
    const deepestPerRoot = new Map<number, number>()

    for (const id of value) {
      const chain = [...ancestorsOf(id, byId), id]
      const root = chain[0]
      const incumbent = deepestPerRoot.get(root)
      const incumbentLength =
        incumbent === undefined ? -1 : ancestorsOf(incumbent, byId).length + 1

      if (chain.length > incumbentLength) deepestPerRoot.set(root, id)
    }

    return deepestPerRoot.size > 1 ? [...deepestPerRoot.values()] : []
  }, [value, byId])

  const [expanded, setExpanded] = useState<Set<number>>(() => {
    // Buka otomatis jalur kategori yang sedang terpilih supaya langsung kelihatan.
    const initial = new Set<number>()
    for (const id of value) for (const ancestor of ancestorsOf(id, byId)) initial.add(ancestor)
    return initial
  })

  const searchResults = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return null

    const matches = categories
      .filter((category) => pathLabelOf(category.id, byId).toLowerCase().includes(trimmed))
      .sort((a, b) => pathLabelOf(a.id, byId).localeCompare(pathLabelOf(b.id, byId), "id"))

    // Daftar dipotong supaya kata kunci pendek (mis. "PC") tidak merender ratusan
    // baris. Jumlah aslinya tetap dibawa supaya staff tahu ada sisa yang belum
    // tampil — kalau tidak, mereka bisa salah simpul kategorinya tidak ada.
    return { items: matches.slice(0, MAX_SEARCH_RESULTS), total: matches.length }
  }, [query, categories, byId])

  function selectCategory(id: number) {
    const ancestors = ancestorsOf(id, byId)

    // Induk ikut disimpan supaya halaman kategori level atas tetap bisa
    // menampilkan seluruh produk di bawahnya tanpa query rekursif.
    onChange([...ancestors, id])

    // Buka jalurnya di pohon: kalau pilihan dibuat lewat kotak cari, staff yang
    // menghapus kata kuncinya harus tetap melihat kategori yang barusan dipilih.
    // Node terpilih ikut dibuka supaya sub-kategorinya (kalau ada) langsung
    // terlihat — itu pasangan dari peringatan "pilih yang lebih spesifik".
    setExpanded((previous) => new Set([...previous, ...ancestors, id]))
  }

  function toggleExpanded(id: number) {
    setExpanded((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function renderNode(node: CategoryNode, depth: number) {
    const hasChildren = node.children.length > 0
    const isExpanded = expanded.has(node.id)
    const isSelected = selectedId === node.id

    return (
      <li key={node.id}>
        <div
          className="flex items-center gap-1"
          style={{ paddingInlineStart: `${depth * 0.875}rem` }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleExpanded(node.id)}
              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted"
              aria-label={isExpanded ? `Tutup ${node.name}` : `Buka ${node.name}`}
              aria-expanded={isExpanded}
            >
              <ChevronRight
                className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`}
              />
            </button>
          ) : (
            <span className="w-6 shrink-0" aria-hidden="true" />
          )}

          <button
            type="button"
            onClick={() => selectCategory(node.id)}
            aria-pressed={isSelected}
            className={`flex min-h-9 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-start text-sm transition-colors ${
              isSelected ? "bg-primary font-semibold text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            <span className="flex-1 break-words">{node.name}</span>
            <span
              className={`shrink-0 text-xs tabular-nums ${
                isSelected ? "text-primary-foreground/70" : "text-muted-foreground"
              }`}
            >
              {node.count}
            </span>
          </button>
        </div>

        {hasChildren && isExpanded && (
          <ul>{node.children.map((child) => renderNode(child, depth + 1))}</ul>
        )}
      </li>
    )
  }

  const selectedHasChildren =
    selectedId !== null &&
    categories.some((category) => category.parent === selectedId)

  return (
    <div className="space-y-2">
      {selectedId !== null ? (
        <div className="flex flex-wrap items-start gap-2 rounded-xl border border-input bg-muted/40 px-3 py-2">
          <CornerDownRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="flex-1 break-words text-sm font-medium">{pathLabelOf(selectedId, byId)}</p>
          <button
            type="button"
            onClick={() => onChange([])}
            className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Hapus pilihan kategori"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-input px-3 py-2 text-sm text-muted-foreground">
          Belum ada kategori dipilih.
        </p>
      )}

      {selectedHasChildren && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-500">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Kategori ini masih punya sub-kategori. Pilih yang lebih spesifik kalau ada yang cocok
          supaya produk gampang ditemukan customer.
        </p>
      )}

      {conflictingPaths.length > 0 && (
        <div className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <p className="flex items-start gap-2 font-semibold">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Produk ini terdaftar di beberapa kategori yang berbeda pohon:
          </p>
          <ul className="mt-1 list-inside list-disc space-y-0.5 ps-5">
            {conflictingPaths.map((id) => (
              <li key={id}>{pathLabelOf(id, byId)}</li>
            ))}
          </ul>
          <p className="mt-1 ps-5">Pilih satu yang paling tepat — pilihan lain akan dilepas.</p>
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cari kategori…"
          className="w-full rounded-xl border border-input bg-muted/50 py-2 pe-3 ps-9 text-sm outline-none transition-colors focus:border-primary focus:bg-background"
        />
      </div>

      <div className="max-h-72 overflow-y-auto rounded-xl border border-input p-2">
        {searchResults ? (
          searchResults.items.length > 0 ? (
            <ul className="space-y-0.5">
              {searchResults.items.map((category) => (
                <li key={category.id}>
                  <button
                    type="button"
                    onClick={() => selectCategory(category.id)}
                    aria-pressed={selectedId === category.id}
                    className={`flex min-h-9 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-sm transition-colors ${
                      selectedId === category.id
                        ? "bg-primary font-semibold text-primary-foreground"
                        : "hover:bg-muted"
                    }`}
                  >
                    <span className="flex-1 break-words">{pathLabelOf(category.id, byId)}</span>
                    <span
                      className={`shrink-0 text-xs tabular-nums ${
                        selectedId === category.id
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground"
                      }`}
                    >
                      {category.count}
                    </span>
                  </button>
                </li>
              ))}
              {searchResults.total > searchResults.items.length && (
                <li className="px-2 py-2 text-xs text-muted-foreground">
                  Menampilkan {searchResults.items.length} dari {searchResults.total} kategori yang
                  cocok. Ketik kata kunci yang lebih spesifik untuk mempersempit.
                </li>
              )}
            </ul>
          ) : (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              Kategori “{query}” tidak ditemukan.
            </p>
          )
        ) : (
          <ul className="space-y-0.5">{tree.map((node) => renderNode(node, 0))}</ul>
        )}
      </div>
    </div>
  )
}
