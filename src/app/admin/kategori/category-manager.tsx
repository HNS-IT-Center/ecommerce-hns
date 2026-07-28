"use client"

import { useActionState, useMemo, useState } from "react"
import { ChevronRight, FolderInput, Pencil, Plus, Trash2, TriangleAlert, X } from "lucide-react"
import type { AdminCategory } from "@/lib/api/woocommerce/categories"
import { collectDescendantIds, planCategoryMove } from "@/lib/utils/category-move"
import {
  EMPTY_STATE,
  createCategoryAction,
  deleteCategoryAction,
  moveCategoryAction,
  renameCategoryAction,
} from "./actions"

/**
 * Layar kelola kategori untuk PIC.
 *
 * Pohon kategori menentukan bagaimana 3.000 produk ditemukan customer, tapi
 * sampai sekarang hanya bisa diubah lewat script migrasi — artinya setiap
 * penataan ulang harus menunggu developer. Layar ini memindahkan kendali itu ke
 * PIC, dengan rem yang membuat kesalahan mahal jadi sulit dilakukan tanpa
 * sengaja.
 */

type Props = { categories: AdminCategory[] }

type Node = AdminCategory & { children: Node[] }

function buildTree(categories: AdminCategory[]): Node[] {
  const nodes = new Map<number, Node>()
  for (const c of categories) nodes.set(c.id, { ...c, children: [] })

  const roots: Node[] = []
  for (const c of categories) {
    const node = nodes.get(c.id)!
    const parent = c.parentId === null ? undefined : nodes.get(c.parentId)
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  const sort = (list: Node[]) => {
    list.sort((a, b) => a.name.localeCompare(b.name, "id"))
    for (const n of list) sort(n.children)
  }
  sort(roots)
  return roots
}

export function CategoryManager({ categories }: Props) {
  const tree = useMemo(() => buildTree(categories), [categories])

  const [createState, createAction, creating] = useActionState(createCategoryAction, EMPTY_STATE)
  const [renameState, renameAction, renaming] = useActionState(renameCategoryAction, EMPTY_STATE)
  const [deleteState, deleteAction, deleting] = useActionState(deleteCategoryAction, EMPTY_STATE)
  const [moveState, moveAction, moving] = useActionState(moveCategoryAction, EMPTY_STATE)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [confirmingId, setConfirmingId] = useState<number | null>(null)
  const [movingId, setMovingId] = useState<number | null>(null)
  const [moveTarget, setMoveTarget] = useState<string>("")
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())

  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  /**
   * Preview dihitung dengan fungsi yang sama persis yang dipakai server saat
   * menyimpan, jadi apa yang dilihat PIC di sini adalah apa yang akan terjadi —
   * bukan perkiraan yang ditulis terpisah lalu menyimpang diam-diam.
   */
  const movePreview = useMemo(() => {
    if (movingId === null) return null
    return planCategoryMove(categories, movingId, moveTarget === "" ? null : Number(moveTarget))
  }, [categories, movingId, moveTarget])

  /** Kategori tujuan yang mustahil dipilih tidak usah ditawarkan sejak awal. */
  const moveOptions = useMemo(() => {
    if (movingId === null) return []
    const excluded = collectDescendantIds(categories, movingId)
    excluded.add(movingId)
    return categories.filter((c) => !excluded.has(c.id))
  }, [categories, movingId])

  /** Produk yang ikut terbawa pindah — tidak satu pun diubah, hanya konteks. */
  const movingProductCount = useMemo(() => {
    if (movingId === null) return 0
    const ids = collectDescendantIds(categories, movingId)
    ids.add(movingId)
    let total = 0
    for (const id of ids) total += byId.get(id)?.productCount ?? 0
    return total
  }, [byId, categories, movingId])

  const openMove = (node: AdminCategory) => {
    setMovingId(node.id)
    setMoveTarget(node.parentId === null ? "" : String(node.parentId))
    setEditingId(null)
    setConfirmingId(null)
  }

  const toggle = (id: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const message = createState.error ?? renameState.error ?? deleteState.error ?? moveState.error
  const success = createState.ok ?? renameState.ok ?? deleteState.ok ?? moveState.ok

  function renderNode(node: Node, depth: number) {
    const isEditing = editingId === node.id
    const isConfirming = confirmingId === node.id
    const isMoving = movingId === node.id
    const isOpen = !collapsed.has(node.id)

    return (
      <li key={node.id}>
        <div
          className="flex flex-wrap items-center gap-1 rounded-lg py-1 hover:bg-muted/50"
          style={{ paddingInlineStart: `${depth * 1}rem` }}
        >
          {node.children.length > 0 ? (
            <button
              type="button"
              onClick={() => toggle(node.id)}
              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted"
              aria-label={isOpen ? `Tutup ${node.name}` : `Buka ${node.name}`}
              aria-expanded={isOpen}
            >
              <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`} />
            </button>
          ) : (
            <span className="w-6 shrink-0" aria-hidden="true" />
          )}

          {isEditing ? (
            <form action={renameAction} className="flex flex-1 flex-wrap items-center gap-1">
              <input type="hidden" name="id" value={node.id} />
              <input
                name="name"
                defaultValue={node.name}
                autoFocus
                className="min-w-0 flex-1 rounded-lg border border-primary bg-background px-2 py-1 text-sm outline-none"
              />
              <button
                type="submit"
                disabled={renaming}
                className="rounded-lg bg-primary px-3 py-1 text-xs font-bold text-primary-foreground disabled:opacity-60"
              >
                Simpan
              </button>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
              >
                Batal
              </button>
            </form>
          ) : (
            <>
              <span className="flex-1 break-words text-sm">{node.name}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {node.productCount} produk
              </span>
              <button
                type="button"
                onClick={() => {
                  setEditingId(node.id)
                  setConfirmingId(null)
                  setMovingId(null)
                }}
                className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`Ganti nama ${node.name}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => (isMoving ? setMovingId(null) : openMove(node))}
                className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`Pindahkan ${node.name}`}
              >
                <FolderInput className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmingId(isConfirming ? null : node.id)
                  setEditingId(null)
                  setMovingId(null)
                }}
                className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Hapus ${node.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>

        {isMoving && (
          <div
            className="my-1 rounded-xl border border-input bg-muted/30 px-3 py-2"
            style={{ marginInlineStart: `${depth * 1 + 1.5}rem` }}
          >
            <label className="mb-1 block text-xs font-semibold" htmlFor={`move-${node.id}`}>
              Pindahkan ke bawah
            </label>
            <select
              id={`move-${node.id}`}
              value={moveTarget}
              onChange={(e) => setMoveTarget(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="">— kategori utama —</option>
              {moveOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.path}
                </option>
              ))}
            </select>

            {movePreview && !movePreview.ok && (
              <p className="mt-2 flex items-start gap-2 text-xs text-destructive">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {movePreview.error}
              </p>
            )}

            {movePreview?.ok && (
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <p>
                  Jalur baru:{" "}
                  <span className="break-words font-semibold text-foreground">
                    {movePreview.plan.target.newPath}
                  </span>
                </p>
                {movePreview.plan.descendants.length > 0 && (
                  <p>
                    {movePreview.plan.descendants.length} sub-kategori di bawahnya ikut pindah dan
                    jalurnya ditulis ulang.
                  </p>
                )}
                {movingProductCount > 0 && (
                  <p>
                    {movingProductCount} produk ikut terbawa. Tidak ada produk yang diubah atau
                    kehilangan kaitan.
                  </p>
                )}
                <p>Alamat halaman kategori tidak berubah, jadi tautan lama tetap hidup.</p>
              </div>
            )}

            <form action={moveAction} className="mt-2 flex flex-wrap gap-2">
              <input type="hidden" name="id" value={node.id} />
              <input type="hidden" name="parentId" value={moveTarget} />
              <button
                type="submit"
                disabled={moving || !movePreview?.ok}
                className="rounded-lg bg-primary px-3 py-1 text-xs font-bold text-primary-foreground disabled:opacity-60"
              >
                Pindahkan
              </button>
              <button
                type="button"
                onClick={() => setMovingId(null)}
                className="rounded-lg px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
              >
                Batal
              </button>
            </form>
          </div>
        )}

        {isConfirming && (
          <div
            className="my-1 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2"
            style={{ marginInlineStart: `${depth * 1 + 1.5}rem` }}
          >
            {node.childCount > 0 ? (
              <p className="flex items-start gap-2 text-xs text-destructive">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Masih punya {node.childCount} sub-kategori. Hapus atau pindahkan isinya lebih dulu.
              </p>
            ) : (
              <>
                <p className="flex items-start gap-2 text-xs text-destructive">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {node.productCount > 0
                    ? `${node.productCount} produk akan kehilangan kaitan ke kategori ini. Produknya sendiri tidak ikut terhapus.`
                    : "Kategori ini tidak dipakai produk mana pun."}
                </p>
                <form action={deleteAction} className="mt-2 flex flex-wrap gap-2">
                  <input type="hidden" name="id" value={node.id} />
                  <input type="hidden" name="acknowledgedProductCount" value={node.productCount} />
                  <button
                    type="submit"
                    disabled={deleting}
                    className="rounded-lg bg-destructive px-3 py-1 text-xs font-bold text-white disabled:opacity-60"
                  >
                    Ya, hapus
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingId(null)}
                    className="rounded-lg px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
                  >
                    Batal
                  </button>
                </form>
              </>
            )}
          </div>
        )}

        {node.children.length > 0 && isOpen && (
          <ul>{node.children.map((child) => renderNode(child, depth + 1))}</ul>
        )}
      </li>
    )
  }

  return (
    <div className="space-y-4">
      {message && (
        <p className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {message}
        </p>
      )}
      {success && !message && (
        <p className="rounded-xl border border-brand-green/30 bg-brand-green/10 px-4 py-3 text-sm text-brand-green">
          {success}
        </p>
      )}

      <form
        action={createAction}
        className="flex flex-wrap items-end gap-2 rounded-xl border border-input bg-muted/30 p-3"
      >
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-xs font-semibold" htmlFor="new-name">
            Kategori baru
          </label>
          <input
            id="new-name"
            name="name"
            required
            placeholder="Nama kategori"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-xs font-semibold" htmlFor="new-parent">
            Di bawah
          </label>
          <select
            id="new-parent"
            name="parentId"
            defaultValue=""
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="">— kategori utama —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.path}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={creating}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          Tambah
        </button>
      </form>

      <div className="rounded-xl border border-input p-2">
        {tree.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">Belum ada kategori.</p>
        ) : (
          <ul>{tree.map((node) => renderNode(node, 0))}</ul>
        )}
      </div>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <X className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Mengganti nama tidak mengubah alamat halaman kategori, jadi tautan lama tetap hidup.
      </p>
    </div>
  )
}
