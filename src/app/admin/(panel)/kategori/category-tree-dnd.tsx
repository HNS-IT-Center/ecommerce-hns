"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { Ban, GripVertical, LoaderCircle, TriangleAlert } from "lucide-react"

import type { AdminCategory } from "@/lib/api/woocommerce/categories"
import { collectDescendantIds, planCategoryMove } from "@/lib/utils/category-move"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import { moveCategoryAction } from "./actions"
import { EMPTY_STATE } from "./state"

/**
 * Seret-dan-jatuhkan untuk memindahkan kategori ke induk lain.
 *
 * Ini TAMBAHAN di atas tombol "Pindahkan" yang sudah ada, bukan penggantinya.
 * Seret adalah gerakan tikus; ia tidak punya padanan yang benar-benar setara
 * lewat papan ketik maupun pembaca layar, jadi satu-satunya jalan yang bisa
 * diandalkan semua orang harus tetap hidup. Kalau kelak tombol itu dihapus,
 * fitur ini berubah dari kemudahan menjadi penghalang.
 *
 * Yang TIDAK ada di berkas ini: aturan pemindahan itu sendiri. Penolakan
 * cincin, penyusunan ulang path, dan transaksinya sudah hidup di
 * `lib/utils/category-move` dan `lib/api/woocommerce/categories`. Di sini
 * `planCategoryMove` dipakai persis seperti layar lama memakainya — untuk
 * memberi tahu lebih awal, bukan untuk memutuskan. Pemutusnya tetap server,
 * yang menyusun ulang rencananya dari kondisi database terkini.
 */

/** Id zona jatuh untuk "jadikan kategori utama" — bukan id kategori mana pun. */
export const ROOT_DROP_ID = "kategori-utama"

/** Alasan sebuah baris tidak boleh menerima jatuhan, saat ada yang diseret. */
type BlockReason = "self" | "descendant" | "current-parent"

const BLOCK_MESSAGE: Record<BlockReason, string> = {
  self: "kategori tidak bisa dipindahkan ke dalam dirinya sendiri",
  descendant: "anak sendiri — akan membuat loop",
  "current-parent": "sudah menjadi induknya sekarang",
}

type RowStatus = { pending: boolean; error: string | null }

const IDLE: RowStatus = { pending: false, error: null }

type PendingMove = {
  sourceId: number
  sourceName: string
  /** `null` berarti dijadikan kategori utama. */
  targetId: number | null
  targetName: string
  newPath: string
  descendantCount: number
  productCount: number
}

type TreeDndValue = {
  /** Baris yang sedang diangkat. `null` saat tidak ada yang diseret. */
  draggingId: number | null
  /** Alasan sebuah baris terkunci saat ini — `null` kalau boleh menerima. */
  blockedReason: (id: number) => BlockReason | null
  statusOf: (id: number) => RowStatus
}

const TreeDndContext = createContext<TreeDndValue | null>(null)

function useTreeDnd(): TreeDndValue {
  const ctx = useContext(TreeDndContext)
  if (!ctx) {
    throw new Error("CategoryDragRow harus berada di dalam <CategoryTreeDnD>.")
  }
  return ctx
}

// --------------------------------------------------------------------- wadah

type CategoryTreeDnDProps = {
  categories: AdminCategory[]
  children: ReactNode
}

export function CategoryTreeDnD({ categories, children }: CategoryTreeDnDProps) {
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [forbidden, setForbidden] = useState<Set<number>>(new Set())
  const [pending, setPending] = useState<PendingMove | null>(null)

  // Status disimpan per baris, bukan satu bendera untuk seluruh pohon. Dengan
  // satu bendera, memindahkan satu kategori akan membekukan tombol di semua
  // baris lain dan kegagalannya muncul jauh dari tempat kejadian.
  const [statuses, setStatuses] = useState<Record<number, RowStatus>>({})

  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const setStatus = useCallback((id: number, next: RowStatus) => {
    setStatuses((prev) => ({ ...prev, [id]: next }))
  }, [])

  const statusOf = useCallback(
    (id: number): RowStatus => statuses[id] ?? IDLE,
    [statuses]
  )

  /**
   * Sensor tikus diberi ambang 6px supaya klik pada tombol aksi di dalam baris
   * tidak tertafsir sebagai awal seretan. Sensor papan ketik ikut dipasang
   * karena @dnd-kit menyediakannya, tapi lihat catatan di puncak berkas: jalan
   * yang sesungguhnya bagi pengguna papan ketik tetap tombol "Pindahkan".
   */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  )

  const blockedReason = useCallback(
    (id: number): BlockReason | null => {
      if (draggingId === null) return null
      if (id === draggingId) return "self"
      if (forbidden.has(id)) return "descendant"
      if (byId.get(draggingId)?.parentId === id) return "current-parent"
      return null
    },
    [byId, draggingId, forbidden]
  )

  function handleDragStart(event: DragStartEvent) {
    const id = Number(event.active.id)
    setDraggingId(id)
    // Keturunan dikumpulkan sekali di awal seretan, bukan dihitung ulang tiap
    // baris tersentuh kursor. Pohonnya kecil, tapi ini yang membuat kunci
    // droppable-nya konsisten selama seretan berlangsung.
    setForbidden(collectDescendantIds(categories, id))
    setStatus(id, IDLE)
  }

  function resetDrag() {
    setDraggingId(null)
    setForbidden(new Set())
  }

  function handleDragEnd(event: DragEndEvent) {
    const sourceId = Number(event.active.id)
    resetDrag()

    const over = event.over
    if (!over) return

    const targetId = over.id === ROOT_DROP_ID ? null : Number(over.id)
    if (targetId === sourceId) return

    const source = byId.get(sourceId)
    if (!source) return

    // Rencana disusun dengan fungsi yang sama yang dipakai server saat
    // menyimpan, jadi penolakan yang muncul di sini adalah penolakan yang
    // sesungguhnya — bukan tebakan yang bisa menyimpang diam-diam.
    const plan = planCategoryMove(categories, sourceId, targetId)
    if (!plan.ok) {
      setStatus(sourceId, { pending: false, error: plan.error })
      return
    }

    let productCount = source.productCount
    for (const id of collectDescendantIds(categories, sourceId)) {
      productCount += byId.get(id)?.productCount ?? 0
    }

    setStatus(sourceId, IDLE)
    setPending({
      sourceId,
      sourceName: source.name,
      targetId,
      targetName: targetId === null ? "kategori utama" : (byId.get(targetId)?.name ?? "—"),
      newPath: plan.plan.target.newPath,
      descendantCount: plan.plan.descendants.length,
      productCount,
    })
  }

  /**
   * Menjatuhkan tidak langsung menyimpan. Seretan gampang meleset satu baris,
   * dan pemindahan kategori menulis ulang path seluruh cabang di bawahnya —
   * terlalu mahal untuk dipicu gerakan yang tidak sengaja. Dialognya memakai
   * `ConfirmDialog` yang sudah ada, yang mengunci tombolnya selama aksi
   * berjalan sehingga satu jatuhan tidak terkirim dua kali.
   */
  async function confirmMove() {
    if (!pending) return
    const { sourceId, targetId } = pending

    setStatus(sourceId, { pending: true, error: null })

    const formData = new FormData()
    formData.set("id", String(sourceId))
    formData.set("parentId", targetId === null ? "" : String(targetId))

    const result = await moveCategoryAction(EMPTY_STATE, formData)

    // Kegagalan ditempelkan pada barisnya sendiri, lalu dialognya ditutup —
    // pesan yang muncul di tempat kejadian lebih mudah dihubungkan dengan
    // perbuatannya daripada spanduk di puncak halaman.
    setStatus(sourceId, { pending: false, error: result.error })
    setPending(null)
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Mengangkat ${byId.get(Number(active.id))?.name ?? "kategori"}.`,
    onDragOver: ({ over }) =>
      over
        ? `Di atas ${over.id === ROOT_DROP_ID ? "kategori utama" : (byId.get(Number(over.id))?.name ?? "kategori")}.`
        : "Di luar area yang bisa menerima.",
    onDragEnd: ({ over }) =>
      over
        ? "Dijatuhkan. Konfirmasi pemindahan akan ditampilkan."
        : "Dibatalkan, tidak ada yang berubah.",
    onDragCancel: () => "Dibatalkan, tidak ada yang berubah.",
  }

  const value: TreeDndValue = { draggingId, blockedReason, statusOf }

  return (
    <TooltipProvider>
      <TreeDndContext.Provider value={value}>
        <DndContext
          /**
           * Id tetap, bukan hasil penghitung otomatis @dnd-kit.
           *
           * Tanpa ini, `useUniqueId` memakai penghitung di tingkat modul untuk
           * menyusun `aria-describedby` tiap gagang. Penghitung itu hidup
           * terpisah di proses server dan di tab peramban — server sudah
           * beberapa kali me-render halaman ini sementara tab yang baru dimuat
           * mulai dari nol — sehingga HTML dari server dan hasil hidrasi klien
           * menunjuk id yang berbeda untuk elemen yang sama. Memberi id sendiri
           * membuat penghitungnya dilewati dan kedua sisi selalu sepakat.
           */
          id="kategori-tree-dnd"
          sensors={sensors}
          accessibility={{ announcements }}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={resetDrag}
        >
          {children}
        </DndContext>

        <ConfirmDialog
          open={pending !== null}
          onOpenChange={(open) => {
            if (!open) setPending(null)
          }}
          title={
            pending
              ? `Pindahkan "${pending.sourceName}" ke bawah "${pending.targetName}"?`
              : ""
          }
          description={
            pending ? (
              <span className="space-y-1">
                <span className="block">
                  Jalur barunya:{" "}
                  <span className="font-semibold break-words text-foreground">
                    {pending.newPath}
                  </span>
                </span>
                {pending.descendantCount > 0 && (
                  <span className="block">
                    {pending.descendantCount} sub-kategori ikut pindah dan jalurnya ditulis ulang.
                  </span>
                )}
                {pending.productCount > 0 && (
                  <span className="block">
                    {pending.productCount} produk ikut terbawa. Tidak ada produk yang diubah atau
                    kehilangan kaitan.
                  </span>
                )}
                <span className="block">
                  Alamat halaman kategori tidak berubah, jadi tautan lama tetap hidup.
                </span>
              </span>
            ) : null
          }
          confirmLabel="Pindahkan"
          onConfirm={confirmMove}
        />
      </TreeDndContext.Provider>
    </TooltipProvider>
  )
}

// --------------------------------------------------------------------- baris

type CategoryDragRowProps = {
  node: AdminCategory
  depth: number
  /**
   * Mode susun ulang. Saat `false`, gagangnya TIDAK dirender dan draggable
   * maupun droppable ikut dimatikan — bukan sekadar disembunyikan lewat CSS.
   * Menyembunyikan saja meninggalkan pemicu yang masih hidup bagi papan ketik
   * dan pembaca layar, padahal maksud modenya justru meniadakan kemungkinan
   * mengubah struktur tanpa sengaja.
   */
  arranging?: boolean
  children: ReactNode
}

/**
 * Pembungkus satu baris kategori: sumber seretan sekaligus tujuan jatuhan.
 *
 * `setNodeRef` milik draggable dan droppable dipasang pada elemen yang sama,
 * tapi pendengar seretannya HANYA menempel pada gagang. Kalau seluruh baris
 * yang mendengarkan, empat tombol aksi di dalamnya akan berebut kejadian yang
 * sama dengan seretan.
 */
export function CategoryDragRow({ node, depth, arranging = true, children }: CategoryDragRowProps) {
  const { draggingId, blockedReason, statusOf } = useTreeDnd()

  const status = statusOf(node.id)
  const blocked = blockedReason(node.id)
  const isDragging = draggingId === node.id

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    setActivatorNodeRef,
  } = useDraggable({ id: node.id, disabled: !arranging || status.pending })

  const { isOver, setNodeRef: setDropRef } = useDroppable({
    id: node.id,
    disabled: !arranging || blocked !== null,
  })

  const grip = !arranging ? null : (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...listeners}
      {...attributes}
      disabled={status.pending}
      aria-label={`Seret ${node.name} untuk memindahkannya ke kategori lain`}
      className={cn(
        "shrink-0 rounded p-1 text-muted-foreground",
        "hover:bg-muted hover:text-foreground",
        "cursor-grab active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50",
        // Gagang tetap terlihat samar supaya fitur seret bisa ditemukan — di
        // layar sentuh tidak ada hover, jadi kalau disembunyikan sepenuhnya ia
        // praktis hilang. Menguat saat baris disentuh atau difokus papan ketik.
        "opacity-40 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      )}
    >
      <GripVertical className="h-3.5 w-3.5" />
    </button>
  )

  return (
    <>
      <div
        ref={(el) => {
          setDragRef(el)
          setDropRef(el)
        }}
        style={{ paddingInlineStart: `${depth * 1}rem` }}
        className={cn(
          "group flex flex-wrap items-center gap-1 rounded-lg border border-transparent py-1",
          "hover:bg-muted/50",
          isDragging && "cursor-grabbing opacity-50",
          isOver && "border-primary bg-primary/5",
          blocked !== null && "cursor-not-allowed opacity-40",
          status.pending && "opacity-60"
        )}
      >
        {grip}

        {blocked !== null ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <span
                  className="shrink-0 text-muted-foreground"
                  aria-label={BLOCK_MESSAGE[blocked]}
                />
              }
            >
              <Ban className="h-3.5 w-3.5" />
            </TooltipTrigger>
            <TooltipContent>{BLOCK_MESSAGE[blocked]}</TooltipContent>
          </Tooltip>
        ) : null}

        {status.pending && (
          <LoaderCircle
            className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground"
            aria-label={`Memindahkan ${node.name}…`}
          />
        )}

        {children}
      </div>

      {status.error && (
        <p
          role="status"
          className="my-1 flex items-start gap-2 text-xs text-destructive"
          style={{ marginInlineStart: `${depth * 1 + 1.5}rem` }}
        >
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {status.error}
        </p>
      )}
    </>
  )
}

// ------------------------------------------------------------------ zona akar

/**
 * Tanpa zona ini, seretan hanya bisa membuat kategori makin dalam — tidak ada
 * baris yang mewakili "tidak punya induk", jadi mengeluarkan kategori kembali
 * ke tingkat teratas mustahil dilakukan dengan tikus.
 */
export function CategoryRootDropZone() {
  const { draggingId } = useTreeDnd()
  const { isOver, setNodeRef } = useDroppable({ id: ROOT_DROP_ID })

  if (draggingId === null) return null

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "mb-2 rounded-xl border border-dashed px-3 py-2 text-xs transition-colors",
        isOver
          ? "border-primary bg-primary/5 text-foreground"
          : "border-input text-muted-foreground"
      )}
    >
      Jatuhkan di sini untuk menjadikannya kategori utama.
    </div>
  )
}
