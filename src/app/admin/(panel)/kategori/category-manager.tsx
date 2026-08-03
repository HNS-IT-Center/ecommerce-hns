"use client"

import { useActionState, useMemo, useState } from "react"
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderInput,
  FolderOpen,
  Merge,
  Pencil,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react"
import type { AdminCategory } from "@/lib/api/woocommerce/categories"
import { collectDescendantIds, planCategoryMove } from "@/lib/utils/category-move"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  createCategoryAction,
  deleteCategoryAction,
  mergeCategoryAction,
  moveCategoryAction,
  previewMergeCategoryAction,
  renameCategoryAction,
} from "./actions"
import { EMPTY_MERGE_PREVIEW, EMPTY_STATE } from "./state"
import { CategoryDragRow, CategoryRootDropZone, CategoryTreeDnD } from "./category-tree-dnd"

/**
 * Layar kelola kategori untuk PIC.
 *
 * Pohon kategori menentukan bagaimana 3.000 produk ditemukan customer, tapi
 * sampai sekarang hanya bisa diubah lewat script migrasi — artinya setiap
 * penataan ulang harus menunggu developer. Layar ini memindahkan kendali itu ke
 * PIC, dengan rem yang membuat kesalahan mahal jadi sulit dilakukan tanpa
 * sengaja.
 *
 * Aksi tiap baris dikumpulkan di balik satu menu "Aksi" berlabel teks, bukan
 * deretan ikon telanjang: kata lebih mudah dibaca staff awam daripada tebakan
 * ikon, dan satu tombol per baris tetap rapi di layar sempit. Logika di baliknya
 * — rename, pindah (dengan preview), gabung (dengan preview), hapus (dengan
 * penjaga sub-kategori & produk) — tidak berubah; menu hanya jadi pemicunya.
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
  const [mergeState, mergeAction, merging] = useActionState(mergeCategoryAction, EMPTY_STATE)
  const [mergePreview, previewAction, previewing] = useActionState(
    previewMergeCategoryAction,
    EMPTY_MERGE_PREVIEW
  )

  const [editingId, setEditingId] = useState<number | null>(null)
  const [confirmingId, setConfirmingId] = useState<number | null>(null)
  const [movingId, setMovingId] = useState<number | null>(null)
  const [moveTarget, setMoveTarget] = useState<string>("")
  const [mergingId, setMergingId] = useState<number | null>(null)
  const [mergeTarget, setMergeTarget] = useState<string>("")
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const [query, setQuery] = useState("")
  const [showCreate, setShowCreate] = useState(false)

  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  /** Id kategori yang punya anak — dipakai tombol buka/tutup semua. */
  const parentIds = useMemo(() => {
    const s = new Set<number>()
    for (const c of categories) if (c.parentId !== null) s.add(c.parentId)
    return s
  }, [categories])

  const allExpanded = useMemo(
    () => [...parentIds].every((id) => !collapsed.has(id)),
    [parentIds, collapsed]
  )

  const toggleAll = () => setCollapsed(allExpanded ? new Set(parentIds) : new Set())

  /**
   * Saat mencari, hanya node yang cocok DAN seluruh leluhurnya yang ditampilkan
   * — leluhur ikut supaya jalurnya tetap terlihat. `null` berarti tidak sedang
   * mencari, jadi pohon utuh apa adanya.
   */
  const matchIds = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q === "") return null
    const keep = new Set<number>()
    for (const c of categories) {
      if (!c.name.toLowerCase().includes(q)) continue
      keep.add(c.id)
      let parent = c.parentId
      while (parent !== null) {
        keep.add(parent)
        parent = byId.get(parent)?.parentId ?? null
      }
    }
    return keep
  }, [categories, byId, query])

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

  const startEdit = (node: AdminCategory) => {
    setEditingId(node.id)
    setConfirmingId(null)
    setMovingId(null)
    setMergingId(null)
  }

  const openMove = (node: AdminCategory) => {
    setMovingId(node.id)
    setMoveTarget(node.parentId === null ? "" : String(node.parentId))
    setEditingId(null)
    setConfirmingId(null)
    setMergingId(null)
  }

  const openMerge = (node: AdminCategory) => {
    setMergingId(node.id)
    setMergeTarget("")
    setEditingId(null)
    setConfirmingId(null)
    setMovingId(null)
  }

  const openDelete = (node: AdminCategory) => {
    setConfirmingId(node.id)
    setEditingId(null)
    setMovingId(null)
    setMergingId(null)
  }

  const toggle = (id: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const message =
    createState.error ??
    renameState.error ??
    deleteState.error ??
    moveState.error ??
    mergeState.error ??
    mergePreview.error
  const success =
    createState.ok ?? renameState.ok ?? deleteState.ok ?? moveState.ok ?? mergeState.ok

  function renderNode(node: Node, depth: number) {
    // Saat mencari, node yang tidak cocok (dan bukan leluhur yang cocok)
    // disembunyikan sepenuhnya.
    if (matchIds && !matchIds.has(node.id)) return null

    const isEditing = editingId === node.id
    const isConfirming = confirmingId === node.id
    const isMoving = movingId === node.id
    const isMerging = mergingId === node.id
    // Saat mencari, cabang selalu dibuka supaya hasil yang dalam tetap terlihat
    // tanpa harus membuka manual satu per satu.
    const isOpen = matchIds !== null || !collapsed.has(node.id)
    const hasChildren = node.children.length > 0
    // Dampak hanya ditampilkan kalau memang milik kategori & tujuan yang sedang
    // dipilih, supaya angka dari percobaan sebelumnya tidak ikut dikonfirmasi.
    const shownPreview =
      isMerging &&
      mergePreview.preview &&
      mergePreview.preview.sourceId === node.id &&
      String(mergePreview.preview.targetId) === mergeTarget
        ? mergePreview.preview
        : null

    return (
      <li key={node.id}>
        <CategoryDragRow node={node} depth={depth}>
          {hasChildren ? (
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

          {/* Ikon folder memberi hierarki yang bisa dibaca sekejap: induk hijau,
              daun abu-abu pudar. */}
          {hasChildren ? (
            isOpen ? (
              <FolderOpen className="h-4 w-4 shrink-0 text-brand-green" aria-hidden="true" />
            ) : (
              <Folder className="h-4 w-4 shrink-0 text-brand-green" aria-hidden="true" />
            )
          ) : (
            <Folder className="h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden="true" />
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
              <span
                className={`flex-1 break-words text-sm ${depth === 0 ? "font-semibold" : ""}`}
              >
                {node.name}
              </span>
              <span
                className="shrink-0 rounded-full border border-input bg-muted/40 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground"
                title="Produk yang menempel langsung di kategori ini"
              >
                {node.productCount}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-lg border border-input bg-background px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                  Aksi
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-44">
                  <DropdownMenuItem onClick={() => startEdit(node)}>
                    <Pencil className="h-4 w-4" />
                    Ganti nama
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openMove(node)}>
                    <FolderInput className="h-4 w-4" />
                    Pindahkan…
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openMerge(node)}>
                    <Merge className="h-4 w-4" />
                    Gabungkan…
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => openDelete(node)}>
                    <Trash2 className="h-4 w-4" />
                    Hapus
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </CategoryDragRow>

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

        {isMerging && (
          <div
            className="my-1 rounded-xl border border-input bg-muted/30 px-3 py-2"
            style={{ marginInlineStart: `${depth * 1 + 1.5}rem` }}
          >
            {node.childCount > 0 ? (
              <p className="flex items-start gap-2 text-xs text-destructive">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Masih punya {node.childCount} sub-kategori. Pindahkan dulu isinya, baru gabungkan.
              </p>
            ) : (
              <>
                <label className="mb-1 block text-xs font-semibold" htmlFor={`merge-${node.id}`}>
                  Gabungkan &quot;{node.name}&quot; ke
                </label>
                <select
                  id={`merge-${node.id}`}
                  value={mergeTarget}
                  onChange={(e) => setMergeTarget(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="">— pilih kategori tujuan —</option>
                  {categories
                    .filter((c) => c.id !== node.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.path}
                      </option>
                    ))}
                </select>

                <form action={previewAction} className="mt-2">
                  <input type="hidden" name="sourceId" value={node.id} />
                  <input type="hidden" name="targetId" value={mergeTarget} />
                  <button
                    type="submit"
                    disabled={previewing || mergeTarget === ""}
                    className="rounded-lg border border-input bg-background px-3 py-1 text-xs font-semibold disabled:opacity-60"
                  >
                    Lihat dampak
                  </button>
                </form>

                {shownPreview && (
                  <>
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <p>
                        <span className="font-semibold text-foreground">
                          {shownPreview.productsToMove} produk
                        </span>{" "}
                        akan dipindahkan ke &quot;{shownPreview.targetName}&quot;.
                      </p>
                      {shownPreview.productsAlreadyInTarget > 0 && (
                        <p>
                          {shownPreview.productsAlreadyInTarget} produk sudah ada di kedua kategori;
                          kaitannya cukup dirapikan jadi satu.
                        </p>
                      )}
                      {shownPreview.productsWithOtherCategories > 0 && (
                        <p>
                          {shownPreview.productsWithOtherCategories} kaitan ke kategori lain tetap
                          dibiarkan — penggabungan tidak membereskan cabang lama.
                        </p>
                      )}
                      <p className="text-destructive">
                        &quot;{shownPreview.sourceName}&quot; dihapus setelah digabungkan.
                      </p>
                    </div>

                    <form action={mergeAction} className="mt-2 flex flex-wrap gap-2">
                      <input type="hidden" name="sourceId" value={shownPreview.sourceId} />
                      <input type="hidden" name="targetId" value={shownPreview.targetId} />
                      <input
                        type="hidden"
                        name="acknowledgedMoveCount"
                        value={shownPreview.productsToMove}
                      />
                      <button
                        type="submit"
                        disabled={merging}
                        className="rounded-lg bg-primary px-3 py-1 text-xs font-bold text-primary-foreground disabled:opacity-60"
                      >
                        Ya, gabungkan
                      </button>
                      <button
                        type="button"
                        onClick={() => setMergingId(null)}
                        className="rounded-lg px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
                      >
                        Batal
                      </button>
                    </form>
                  </>
                )}
              </>
            )}
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

        {hasChildren && isOpen && (
          <ul>{node.children.map((child) => renderNode(child, depth + 1))}</ul>
        )}
      </li>
    )
  }

  const noSearchResult = matchIds !== null && matchIds.size === 0

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

      {/* Toolbar: cari, buka/tutup semua, dan pemicu form tambah. Dikumpulkan di
          satu baris supaya pohon di bawahnya jadi fokus utama layar. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari kategori…"
            aria-label="Cari kategori"
            className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <button
          type="button"
          onClick={toggleAll}
          disabled={parentIds.size === 0 || matchIds !== null}
          className="shrink-0 rounded-lg border border-input bg-background px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          {allExpanded ? "Tutup semua" : "Buka semua"}
        </button>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          aria-expanded={showCreate}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Tambah kategori
        </button>
      </div>

      {showCreate && (
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
            Simpan
          </button>
        </form>
      )}

      <CategoryTreeDnD categories={categories}>
        <div className="rounded-xl border border-input p-2">
          <CategoryRootDropZone />
          {tree.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">Belum ada kategori.</p>
          ) : noSearchResult ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              Tidak ada kategori yang cocok dengan &quot;{query.trim()}&quot;.
            </p>
          ) : (
            <ul>{tree.map((node) => renderNode(node, 0))}</ul>
          )}
        </div>
      </CategoryTreeDnD>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <X className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Mengganti nama tidak mengubah alamat halaman kategori, jadi tautan lama tetap hidup.
      </p>
    </div>
  )
}
