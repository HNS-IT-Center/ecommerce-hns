"use client"

import { useMemo, useState, useActionState } from "react"
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
import type { AdminCategory, MergeCategoryPreview } from "@/lib/api/woocommerce/categories"
import { collectDescendantIds, planCategoryMove } from "@/lib/utils/category-move"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
 * Aksi tiap baris dikumpulkan di balik satu tombol "Aksi" berlabel teks — di
 * desktop jadi dropdown, di layar sentuh jadi lembar bawah (sheet). Kata lebih
 * mudah dibaca staff awam daripada tebakan ikon, dan satu pemicu per baris tetap
 * rapi di layar sempit. Pindah, gabung, dan hapus dikonfirmasi lewat dialog yang
 * senada dengan konfirmasi seret — bukan lagi panel yang menyelip di tengah
 * pohon. Logika di baliknya (penolakan cincin, penyusunan ulang path, penjaga
 * produk) tidak berubah; UI hanya jadi pemicunya.
 */

type Props = { categories: AdminCategory[] }

type Node = AdminCategory & { children: Node[] }

type RowActionHandlers = {
  onRename: (node: AdminCategory) => void
  onMove: (node: AdminCategory) => void
  onMerge: (node: AdminCategory) => void
  onDelete: (node: AdminCategory) => void
}

const ACTION_TRIGGER_CLASS =
  "ml-1 inline-flex shrink-0 items-center gap-1 rounded-lg border border-input bg-background px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"

const SHEET_ITEM_CLASS =
  "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium hover:bg-muted"

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

/**
 * Menu aksi satu baris. Di desktop sebuah dropdown; di layar sentuh sebuah
 * lembar bawah dengan sasaran ketuk yang besar. Isinya sama — hanya wadahnya
 * yang mengikuti perangkat.
 */
function RowActions({
  node,
  isMobile,
  onRename,
  onMove,
  onMerge,
  onDelete,
}: { node: AdminCategory; isMobile: boolean } & RowActionHandlers) {
  const [open, setOpen] = useState(false)

  if (isMobile) {
    const run = (fn: (n: AdminCategory) => void) => {
      setOpen(false)
      fn(node)
    }
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger className={ACTION_TRIGGER_CLASS}>
          Aksi
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </SheetTrigger>
        <SheetContent side="bottom" className="pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SheetHeader className="pb-0">
            <SheetTitle className="text-sm">Aksi untuk &quot;{node.name}&quot;</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col px-2 pb-2">
            <button type="button" onClick={() => run(onRename)} className={SHEET_ITEM_CLASS}>
              <Pencil className="h-4 w-4 text-muted-foreground" />
              Ganti nama
            </button>
            <button type="button" onClick={() => run(onMove)} className={SHEET_ITEM_CLASS}>
              <FolderInput className="h-4 w-4 text-muted-foreground" />
              Pindahkan…
            </button>
            <button type="button" onClick={() => run(onMerge)} className={SHEET_ITEM_CLASS}>
              <Merge className="h-4 w-4 text-muted-foreground" />
              Gabungkan…
            </button>
            <button
              type="button"
              onClick={() => run(onDelete)}
              className={`${SHEET_ITEM_CLASS} text-destructive hover:bg-destructive/10`}
            >
              <Trash2 className="h-4 w-4" />
              Hapus
            </button>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={ACTION_TRIGGER_CLASS}>
        Aksi
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem onClick={() => onRename(node)}>
          <Pencil className="h-4 w-4" />
          Ganti nama
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onMove(node)}>
          <FolderInput className="h-4 w-4" />
          Pindahkan…
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onMerge(node)}>
          <Merge className="h-4 w-4" />
          Gabungkan…
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => onDelete(node)}>
          <Trash2 className="h-4 w-4" />
          Hapus
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function CategoryManager({ categories }: Props) {
  const tree = useMemo(() => buildTree(categories), [categories])
  const isMobile = useIsMobile()

  // Buat & ganti nama tetap lewat form + useActionState: keduanya form biasa yang
  // sudah bekerja baik. Pindah/gabung/hapus dipanggil langsung supaya dialognya
  // bisa dikontrol penuh (menutup saat sukses, menahan pesan galat di tempat).
  const [createState, createAction, creating] = useActionState(createCategoryAction, EMPTY_STATE)
  const [renameState, renameAction, renaming] = useActionState(renameCategoryAction, EMPTY_STATE)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [movingId, setMovingId] = useState<number | null>(null)
  const [moveTarget, setMoveTarget] = useState<string>("")
  const [mergingId, setMergingId] = useState<number | null>(null)
  const [mergeTarget, setMergeTarget] = useState<string>("")
  const [mergePreview, setMergePreview] = useState<MergeCategoryPreview | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const [query, setQuery] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [activeRootId, setActiveRootId] = useState<number | null>(null)

  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  /**
   * Satu cabang pada satu waktu.
   *
   * Merender 108 kategori sekaligus membuat halaman ini sepanjang delapan layar,
   * padahal penataan hampir selalu terjadi di dalam SATU cabang — memindahkan
   * "KABEL HDMI" ke bawah "KABEL / CONVERTER", bukan memindahkan "PROYEKTOR" ke
   * bawah "FURNITURE". Akar dipilih dari daftar di kiri, dan yang dirender hanya
   * pohon di bawahnya; cabang terbesar pun tinggal ±25 baris.
   *
   * Perpindahan antar akar yang jarang itu tetap terlayani menu "Pindahkan",
   * yang bisa menunjuk kategori mana pun beserta preview dampaknya.
   *
   * Cadangan ke akar pertama dilakukan lewat pencarian, bukan disimpan ke state:
   * akar yang sedang dipilih bisa lenyap kapan saja karena dihapus, digabung,
   * atau dipindahkan jadi anak orang lain oleh orang di layar sebelah.
   */
  const activeRoot = useMemo(() => {
    if (tree.length === 0) return null
    return tree.find((node) => node.id === activeRootId) ?? tree[0]
  }, [tree, activeRootId])

  /**
   * Id kategori beranak DI DALAM cabang aktif — dipakai tombol buka/tutup semua.
   * Dibatasi pada cabang yang terlihat supaya label tombolnya tidak berbohong
   * gara-gara ada cabang lain yang kebetulan masih tertutup.
   */
  const parentIds = useMemo(() => {
    const s = new Set<number>()
    const walk = (node: Node) => {
      if (node.children.length > 0) s.add(node.id)
      for (const child of node.children) walk(child)
    }
    if (activeRoot) walk(activeRoot)
    return s
  }, [activeRoot])

  const allExpanded = useMemo(
    () => [...parentIds].every((id) => !collapsed.has(id)),
    [parentIds, collapsed]
  )

  const toggleAll = () => setCollapsed(allExpanded ? new Set(parentIds) : new Set())

  /**
   * Total produk satu cabang = kaitan langsung kategori itu ditambah kaitan
   * langsung seluruh keturunannya. Dihitung di klien dari data yang sudah ada,
   * jadi tidak ada query tambahan. Catatan jujur: karena satu produk boleh
   * menempel di beberapa kategori sekaligus, ini penjumlahan kaitan — bukan
   * jumlah produk unik. Cukup untuk gambaran isi cabang, bukan angka akuntansi.
   */
  const subtreeTotal = useMemo(() => {
    const childrenOf = new Map<number, number[]>()
    for (const c of categories) {
      if (c.parentId === null) continue
      const arr = childrenOf.get(c.parentId) ?? []
      arr.push(c.id)
      childrenOf.set(c.parentId, arr)
    }
    const memo = new Map<number, number>()
    const compute = (id: number): number => {
      const cached = memo.get(id)
      if (cached !== undefined) return cached
      let total = byId.get(id)?.productCount ?? 0
      for (const childId of childrenOf.get(id) ?? []) total += compute(childId)
      memo.set(id, total)
      return total
    }
    for (const c of categories) compute(c.id)
    return memo
  }, [categories, byId])

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
   * Berapa kategori yang cocok di tiap akar. Hanya nama yang benar-benar cocok
   * yang dihitung — leluhur yang ikut ditampilkan demi menjaga jalur tidak boleh
   * ikut menggelembungkan angkanya, karena angka ini dipakai staff untuk memilih
   * cabang mana yang layak dibuka.
   */
  const matchCountPerRoot = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q === "") return null
    const counts = new Map<number, number>()
    const walk = (node: Node, rootId: number) => {
      if (node.name.toLowerCase().includes(q)) {
        counts.set(rootId, (counts.get(rootId) ?? 0) + 1)
      }
      for (const child of node.children) walk(child, rootId)
    }
    for (const root of tree) walk(root, root.id)
    return counts
  }, [tree, query])

  const movingNode = movingId === null ? null : byId.get(movingId) ?? null
  const mergingNode = mergingId === null ? null : byId.get(mergingId) ?? null
  const deletingNode = deletingId === null ? null : byId.get(deletingId) ?? null

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

  function resetDialogs() {
    setMovingId(null)
    setMergingId(null)
    setDeletingId(null)
    setMergePreview(null)
    setActionError(null)
  }

  const startEdit = (node: AdminCategory) => {
    resetDialogs()
    setEditingId(node.id)
  }

  const openMove = (node: AdminCategory) => {
    resetDialogs()
    setEditingId(null)
    setMovingId(node.id)
    setMoveTarget(node.parentId === null ? "" : String(node.parentId))
  }

  const openMerge = (node: AdminCategory) => {
    resetDialogs()
    setEditingId(null)
    setMergingId(node.id)
    setMergeTarget("")
  }

  const openDelete = (node: AdminCategory) => {
    resetDialogs()
    setEditingId(null)
    setDeletingId(node.id)
  }

  const toggle = (id: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  async function submitMove() {
    if (movingId === null || !movePreview?.ok) return
    setBusy(true)
    setActionError(null)
    const formData = new FormData()
    formData.set("id", String(movingId))
    formData.set("parentId", moveTarget)
    const result = await moveCategoryAction(EMPTY_STATE, formData)
    setBusy(false)
    if (result.error) {
      setActionError(result.error)
      return
    }
    setFlash(result.ok)
    setMovingId(null)
  }

  async function loadMergePreview() {
    if (mergingId === null || mergeTarget === "") return
    setBusy(true)
    setActionError(null)
    setMergePreview(null)
    const formData = new FormData()
    formData.set("sourceId", String(mergingId))
    formData.set("targetId", mergeTarget)
    const result = await previewMergeCategoryAction(EMPTY_MERGE_PREVIEW, formData)
    setBusy(false)
    if (result.error) {
      setActionError(result.error)
      return
    }
    setMergePreview(result.preview)
  }

  async function submitMerge() {
    if (!mergePreview) return
    setBusy(true)
    setActionError(null)
    const formData = new FormData()
    formData.set("sourceId", String(mergePreview.sourceId))
    formData.set("targetId", String(mergePreview.targetId))
    formData.set("acknowledgedMoveCount", String(mergePreview.productsToMove))
    const result = await mergeCategoryAction(EMPTY_STATE, formData)
    setBusy(false)
    if (result.error) {
      setActionError(result.error)
      return
    }
    setFlash(result.ok)
    setMergingId(null)
    setMergePreview(null)
  }

  async function submitDelete() {
    if (deletingNode === null) return
    setBusy(true)
    setActionError(null)
    const formData = new FormData()
    formData.set("id", String(deletingNode.id))
    formData.set("acknowledgedProductCount", String(deletingNode.productCount))
    const result = await deleteCategoryAction(EMPTY_STATE, formData)
    setBusy(false)
    if (result.error) {
      setActionError(result.error)
      return
    }
    setFlash(result.ok)
    setDeletingId(null)
  }

  const message = createState.error ?? renameState.error
  const success = flash ?? createState.ok ?? renameState.ok

  // Preview hanya ditampilkan kalau memang milik kategori & tujuan yang sedang
  // dipilih, supaya angka dari percobaan sebelumnya tidak ikut dikonfirmasi.
  const shownMergePreview =
    mergePreview &&
    mergePreview.sourceId === mergingId &&
    String(mergePreview.targetId) === mergeTarget
      ? mergePreview
      : null

  function renderNode(node: Node, depth: number) {
    // Saat mencari, node yang tidak cocok (dan bukan leluhur yang cocok)
    // disembunyikan sepenuhnya.
    if (matchIds && !matchIds.has(node.id)) return null

    const isEditing = editingId === node.id
    // Saat mencari, cabang selalu dibuka supaya hasil yang dalam tetap terlihat
    // tanpa harus membuka manual satu per satu.
    const isOpen = matchIds !== null || !collapsed.has(node.id)
    const hasChildren = node.children.length > 0
    const total = subtreeTotal.get(node.id) ?? node.productCount

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
              <span className={`flex-1 break-words text-sm ${depth === 0 ? "font-semibold" : ""}`}>
                {node.name}
              </span>
              {hasChildren ? (
                <span
                  className="shrink-0 rounded-full border border-brand-green/30 bg-brand-green/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-brand-green"
                  title="Total produk di seluruh cabang (menjumlahkan kaitan langsung tiap sub-kategori)"
                >
                  {total}
                </span>
              ) : (
                <span
                  className="shrink-0 rounded-full border border-input bg-muted/40 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground"
                  title="Produk yang menempel langsung di kategori ini"
                >
                  {node.productCount}
                </span>
              )}
              <RowActions
                node={node}
                isMobile={isMobile}
                onRename={startEdit}
                onMove={openMove}
                onMerge={openMerge}
                onDelete={openDelete}
              />
            </>
          )}
        </CategoryDragRow>

        {hasChildren && isOpen && (
          <ul>{node.children.map((child) => renderNode(child, depth + 1))}</ul>
        )}
      </li>
    )
  }

  const searching = matchIds !== null
  const noSearchResult = searching && matchIds.size === 0

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
        <div className="grid gap-2 md:grid-cols-[minmax(11rem,15rem)_1fr]">
          {/* Rail akar. Saat mencari ia jadi penunjuk arah — angkanya memberi tahu
              cabang mana yang menyimpan hasilnya — bukan lagi penyaring, karena
              hasil pencarian ditampilkan dari seluruh cabang sekaligus. */}
          <nav
            aria-label="Kategori utama"
            className="flex flex-row gap-1 overflow-x-auto rounded-xl border border-input p-2 md:flex-col md:overflow-x-visible"
          >
            {tree.map((root) => {
              const isActive = !searching && activeRoot?.id === root.id
              const hits = matchCountPerRoot?.get(root.id) ?? 0
              return (
                <button
                  key={root.id}
                  type="button"
                  onClick={() => {
                    // Mengklik akar saat mencari berarti "bawa saya ke cabang ini",
                    // jadi pencariannya dibersihkan — kalau tidak, tombolnya
                    // seolah tidak berbuat apa-apa.
                    setQuery("")
                    setActiveRootId(root.id)
                  }}
                  aria-current={isActive ? "true" : "false"}
                  className={`flex shrink-0 items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm md:shrink ${
                    isActive
                      ? "bg-primary/10 font-semibold text-primary"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  <span className="min-w-0 break-words">{root.name}</span>
                  {searching ? (
                    hits > 0 && (
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 text-xs font-semibold tabular-nums text-primary">
                        {hits}
                      </span>
                    )
                  ) : (
                    <span
                      className={`shrink-0 text-xs tabular-nums ${
                        isActive ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {subtreeTotal.get(root.id) ?? 0}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>

          <div className="min-w-0 rounded-xl border border-input p-2">
            <CategoryRootDropZone />
            {tree.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">Belum ada kategori.</p>
            ) : noSearchResult ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">
                Tidak ada kategori yang cocok dengan &quot;{query.trim()}&quot;.
              </p>
            ) : searching ? (
              <>
                <p className="px-2 pb-2 text-xs text-muted-foreground">
                  Hasil pencarian dari seluruh cabang.
                </p>
                <ul>{tree.map((node) => renderNode(node, 0))}</ul>
              </>
            ) : activeRoot ? (
              <ul>{renderNode(activeRoot, 0)}</ul>
            ) : null}
          </div>
        </div>
      </CategoryTreeDnD>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <X className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Mengganti nama tidak mengubah alamat halaman kategori, jadi tautan lama tetap hidup.
      </p>

      {/* ------------------------------------------------------------- Pindahkan */}
      <Dialog
        open={movingNode !== null}
        onOpenChange={(open) => {
          if (!open) {
            setMovingId(null)
            setActionError(null)
          }
        }}
      >
        {movingNode && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Pindahkan &quot;{movingNode.name}&quot;</DialogTitle>
              <DialogDescription>
                Pilih induk barunya. Dampaknya ditampilkan di bawah sebelum kamu simpan.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <label className="block text-xs font-semibold" htmlFor="move-target">
                Pindahkan ke bawah
              </label>
              <select
                id="move-target"
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
                <p className="flex items-start gap-2 text-xs text-destructive">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {movePreview.error}
                </p>
              )}

              {movePreview?.ok && (
                <div className="space-y-1 text-xs text-muted-foreground">
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

              {actionError && (
                <p className="flex items-start gap-2 text-xs text-destructive">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {actionError}
                </p>
              )}
            </div>

            <DialogFooter>
              <button
                type="button"
                onClick={() => setMovingId(null)}
                className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={submitMove}
                disabled={busy || !movePreview?.ok}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
              >
                {busy ? "Memproses…" : "Pindahkan"}
              </button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* -------------------------------------------------------------- Gabungkan */}
      <Dialog
        open={mergingNode !== null}
        onOpenChange={(open) => {
          if (!open) {
            setMergingId(null)
            setMergePreview(null)
            setActionError(null)
          }
        }}
      >
        {mergingNode && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Gabungkan &quot;{mergingNode.name}&quot;</DialogTitle>
              <DialogDescription>
                Produknya dipindahkan ke kategori tujuan, lalu kategori ini dihapus.
              </DialogDescription>
            </DialogHeader>

            {mergingNode.childCount > 0 ? (
              <p className="flex items-start gap-2 text-xs text-destructive">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Masih punya {mergingNode.childCount} sub-kategori. Pindahkan dulu isinya, baru
                gabungkan.
              </p>
            ) : (
              <div className="space-y-2">
                <label className="block text-xs font-semibold" htmlFor="merge-target">
                  Gabungkan ke
                </label>
                <div className="flex gap-2">
                  <select
                    id="merge-target"
                    value={mergeTarget}
                    onChange={(e) => {
                      setMergeTarget(e.target.value)
                      setMergePreview(null)
                    }}
                    className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  >
                    <option value="">— pilih kategori tujuan —</option>
                    {categories
                      .filter((c) => c.id !== mergingNode.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.path}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={loadMergePreview}
                    disabled={busy || mergeTarget === ""}
                    className="shrink-0 rounded-lg border border-input bg-background px-3 py-2 text-xs font-semibold disabled:opacity-60"
                  >
                    Lihat dampak
                  </button>
                </div>

                {shownMergePreview && (
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>
                      <span className="font-semibold text-foreground">
                        {shownMergePreview.productsToMove} produk
                      </span>{" "}
                      akan dipindahkan ke &quot;{shownMergePreview.targetName}&quot;.
                    </p>
                    {shownMergePreview.productsAlreadyInTarget > 0 && (
                      <p>
                        {shownMergePreview.productsAlreadyInTarget} produk sudah ada di kedua
                        kategori; kaitannya cukup dirapikan jadi satu.
                      </p>
                    )}
                    {shownMergePreview.productsWithOtherCategories > 0 && (
                      <p>
                        {shownMergePreview.productsWithOtherCategories} kaitan ke kategori lain tetap
                        dibiarkan — penggabungan tidak membereskan cabang lama.
                      </p>
                    )}
                    <p className="text-destructive">
                      &quot;{shownMergePreview.sourceName}&quot; dihapus setelah digabungkan.
                    </p>
                  </div>
                )}

                {actionError && (
                  <p className="flex items-start gap-2 text-xs text-destructive">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {actionError}
                  </p>
                )}
              </div>
            )}

            <DialogFooter>
              <button
                type="button"
                onClick={() => setMergingId(null)}
                className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                Batal
              </button>
              {mergingNode.childCount === 0 && (
                <button
                  type="button"
                  onClick={submitMerge}
                  disabled={busy || !shownMergePreview}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
                >
                  {busy ? "Memproses…" : "Ya, gabungkan"}
                </button>
              )}
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* ------------------------------------------------------------------ Hapus */}
      <Dialog
        open={deletingNode !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingId(null)
            setActionError(null)
          }
        }}
      >
        {deletingNode && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Hapus &quot;{deletingNode.name}&quot;?</DialogTitle>
            </DialogHeader>

            {deletingNode.childCount > 0 ? (
              <p className="flex items-start gap-2 text-xs text-destructive">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Masih punya {deletingNode.childCount} sub-kategori. Hapus atau pindahkan isinya lebih
                dulu.
              </p>
            ) : (
              <>
                <p className="flex items-start gap-2 text-xs text-destructive">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {deletingNode.productCount > 0
                    ? `${deletingNode.productCount} produk akan kehilangan kaitan ke kategori ini. Produknya sendiri tidak ikut terhapus.`
                    : "Kategori ini tidak dipakai produk mana pun."}
                </p>
                {actionError && (
                  <p className="flex items-start gap-2 text-xs text-destructive">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {actionError}
                  </p>
                )}
              </>
            )}

            <DialogFooter>
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                Batal
              </button>
              {deletingNode.childCount === 0 && (
                <button
                  type="button"
                  onClick={submitDelete}
                  disabled={busy}
                  className="rounded-lg bg-destructive px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                >
                  {busy ? "Memproses…" : "Ya, hapus"}
                </button>
              )}
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
