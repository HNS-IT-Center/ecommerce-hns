"use client"

import { useMemo, useState } from "react"
import { ChevronRight, Search, CheckSquare, Square, X } from "lucide-react"
import type { ProductCategory } from "@/types/woocommerce"

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

function ancestorsOf(id: number, byId: Map<number, ProductCategory>): number[] {
  const chain: number[] = []
  let current = byId.get(id)?.parent ?? 0

  for (let guard = 0; current && guard < MAX_DEPTH_GUARD; guard += 1) {
    chain.unshift(current)
    current = byId.get(current)?.parent ?? 0
  }

  return chain
}

function descendantsOf(id: number, treeNodes: Map<number, CategoryNode>): number[] {
  const descendants: number[] = []
  const node = treeNodes.get(id)
  if (!node) return descendants
  
  const stack = [...node.children]
  while (stack.length > 0) {
    const curr = stack.pop()!
    descendants.push(curr.id)
    stack.push(...curr.children)
  }
  return descendants
}

function pathLabelOf(id: number, byId: Map<number, ProductCategory>): string {
  return [...ancestorsOf(id, byId), id].map((cid) => byId.get(cid)?.name ?? "?").join(" › ")
}

function buildTree(categories: ProductCategory[]): { roots: CategoryNode[], nodes: Map<number, CategoryNode> } {
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

  return { roots, nodes }
}

export function CategoryPicker({ categories, value, onChange }: CategoryPickerProps) {
  const [query, setQuery] = useState("")

  const byId = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  )
  
  const { roots: tree, nodes: treeNodes } = useMemo(() => buildTree(categories), [categories])

  const [expanded, setExpanded] = useState<Set<number>>(() => {
    const initial = new Set<number>()
    for (const id of value) {
      for (const ancestor of ancestorsOf(id, byId)) initial.add(ancestor)
    }
    return initial
  })

  const searchResults = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return null

    const matches = categories
      .filter((category) => pathLabelOf(category.id, byId).toLowerCase().includes(trimmed))
      .sort((a, b) => pathLabelOf(a.id, byId).localeCompare(pathLabelOf(b.id, byId), "id"))

    return { items: matches.slice(0, MAX_SEARCH_RESULTS), total: matches.length }
  }, [query, categories, byId])

  const selectedSet = useMemo(() => new Set(value), [value])

  function toggleCategory(id: number) {
    const next = new Set(value)
    
    if (next.has(id)) {
      next.delete(id)
      for (const childId of descendantsOf(id, treeNodes)) {
        next.delete(childId)
      }
    } else {
      next.add(id)
      for (const ancId of ancestorsOf(id, byId)) {
        next.add(ancId)
      }
    }
    
    onChange(Array.from(next))
    
    if (query) {
      setExpanded((prev) => {
        const nextExp = new Set(prev)
        for (const anc of ancestorsOf(id, byId)) nextExp.add(anc)
        return nextExp
      })
    }
  }

  function toggleExpanded(id: number, e: React.MouseEvent) {
    e.stopPropagation()
    setExpanded((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedLeaves = useMemo(() => {
    return value.filter(id => !value.some(otherId => byId.get(otherId)?.parent === id))
  }, [value, byId])

  function renderNode(node: CategoryNode, depth: number) {
    const hasChildren = node.children.length > 0
    const isExpanded = expanded.has(node.id)
    const isSelected = selectedSet.has(node.id)

    return (
      <li key={node.id}>
        <div
          className="flex items-center gap-1"
          style={{ paddingInlineStart: `${depth * 0.875}rem` }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => toggleExpanded(node.id, e)}
              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted"
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
            onClick={() => toggleCategory(node.id)}
            className={`flex min-h-9 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-start text-sm transition-colors hover:bg-muted`}
          >
            {isSelected ? (
              <CheckSquare className="h-4 w-4 text-primary shrink-0" />
            ) : (
              <Square className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <span className={`flex-1 break-words ${isSelected ? "font-semibold text-primary" : "text-foreground"}`}>
              {node.name}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
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

  return (
    <div className="space-y-2">
      {selectedLeaves.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-xl border border-input bg-muted/20 px-3 py-2">
          <p className="text-xs font-semibold text-muted-foreground">Kategori Terpilih:</p>
          <div className="flex flex-wrap gap-2">
            {selectedLeaves.map(id => (
              <div key={id} className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                <span>{pathLabelOf(id, byId)}</span>
                <button
                  type="button"
                  onClick={() => toggleCategory(id)}
                  className="rounded-sm hover:bg-primary/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-input px-3 py-2 text-sm text-muted-foreground">
          Belum ada kategori dipilih.
        </p>
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
              {searchResults.items.map((category) => {
                const isSelected = selectedSet.has(category.id)
                return (
                  <li key={category.id}>
                    <button
                      type="button"
                      onClick={() => toggleCategory(category.id)}
                      className="flex min-h-9 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-sm transition-colors hover:bg-muted"
                    >
                      {isSelected ? (
                        <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                      ) : (
                        <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span className={`flex-1 break-words ${isSelected ? "font-semibold text-primary" : ""}`}>
                        {pathLabelOf(category.id, byId)}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {category.count}
                      </span>
                    </button>
                  </li>
                )
              })}
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
