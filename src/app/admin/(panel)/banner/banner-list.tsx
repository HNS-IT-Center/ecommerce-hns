"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { GripVertical, Layers, Loader2, EyeOff } from "lucide-react"

import {
  activeBatchGate,
  effectiveBannerState,
  isPinnedByBatch,
  sortBannersForDisplay,
  type BannerLiveState,
} from "@/lib/utils/banner"
// Hanya TIPE — `import type` dihapus saat kompilasi, jadi lapisan data (dan
// Prisma di belakangnya) tidak ikut terseret ke bundel browser.
import type { BannerWithBatch } from "@/lib/api/banners"
import { deleteBanner, reorderBanners } from "./actions"
import { BannerRow } from "./banner-row"
import { Button } from "@/components/ui/button"
import { useToastManager } from "@/components/ui/toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

/**
 * Berapa banner "tidak tayang" yang dirender sekaligus.
 *
 * Bagian itu adalah tempat menumpuknya promo lama, dan tiap baris memuat satu
 * gambar. Merender seluruhnya sekaligus berarti puluhan permintaan gambar
 * setiap kali halaman dibuka — padahal yang dicari staff hampir selalu ada di
 * bagian atas. Sisanya menyusul saat digulir.
 */
const INACTIVE_CHUNK = 12

/**
 * Blok pengurutan. Menyeret antar blok DILARANG: blok kampanye selalu berada
 * di depan (lihat `sortBannersForDisplay`), jadi memindahkan banner biasa ke
 * atasnya adalah urutan yang tidak akan pernah terjadi di beranda.
 */
type BlockId = "batch" | "other"

type ClassifiedBanner = {
  banner: BannerWithBatch
  state: BannerLiveState
  heldByBatch: boolean
  gate: { name: string } | null
  /** `null` berarti tidak sedang tayang — tidak ikut diurutkan. */
  block: BlockId | null
}

export function BannerList({ banners }: { banners: BannerWithBatch[] }) {
  const router = useRouter()
  const toastManager = useToastManager()

  const [pendingDelete, setPendingDelete] = React.useState<BannerWithBatch | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [draggingId, setDraggingId] = React.useState<string | null>(null)
  const [isSavingOrder, startTransition] = React.useTransition()

  /**
   * Ambang 6 piksel sebelum seretan dimulai. Tanpa itu, klik pada tombol
   * Edit/Hapus di dalam baris terbaca sebagai awal seretan dan tombolnya
   * terasa "tidak menekan".
   */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const serverOrder = React.useMemo(
    () => sortBannersForDisplay(banners).map((banner) => banner.id),
    [banners]
  )

  /**
   * Urutan yang sedang ditampilkan.
   *
   * `useOptimistic`, bukan state biasa: baris harus langsung pindah begitu
   * dilepas, tapi kebenarannya tetap milik server. Begitu `router.refresh()`
   * selesai, nilai ini kembali mengikuti data server dengan sendirinya — tidak
   * ada salinan urutan yang hidup sendiri di klien dan bisa menyimpang.
   */
  const [orderedIds, setOrderedIds] = React.useOptimistic(serverOrder)

  const rows = React.useMemo<ClassifiedBanner[]>(() => {
    const byId = new Map(banners.map((banner) => [banner.id, banner]))

    // "Sekarang" sengaja dibaca di dalam fungsi-fungsi murni itu sendiri
    // (parameter `now` dibiarkan bawaan), bukan dipanggil di sini: memanggil
    // `Date.now()` saat render melanggar aturan kemurnian React.
    return orderedIds.flatMap((id) => {
      const banner = byId.get(id)
      if (!banner) return []

      const gate = activeBatchGate(banner.batch)
      const { state, heldByBatch } = effectiveBannerState(banner, gate)
      const block: BlockId | null =
        state === "live" ? (isPinnedByBatch(banner) ? "batch" : "other") : null

      return [{ banner, state, heldByBatch, gate, block }]
    })
  }, [banners, orderedIds])

  const batchRows = rows.filter((row) => row.block === "batch")
  const otherRows = rows.filter((row) => row.block === "other")
  const inactiveRows = rows.filter((row) => row.block === null)
  const liveCount = batchRows.length + otherRows.length

  const draggingBlock = draggingId
    ? (rows.find((row) => row.banner.id === draggingId)?.block ?? null)
    : null

  /** Memindahkan `id` ke posisi `targetId` di dalam daftar global. */
  function moveTo(ids: string[], id: string, targetId: string): string[] {
    const from = ids.indexOf(id)
    const to = ids.indexOf(targetId)
    if (from < 0 || to < 0 || from === to) return ids

    const next = [...ids]
    next.splice(from, 1)
    next.splice(to, 0, id)
    return next
  }

  function commitOrder(next: string[]) {
    if (next === orderedIds) return

    startTransition(async () => {
      setOrderedIds(next)
      try {
        // Seluruh id dikirim, bukan hanya blok yang diseret — menulis ulang
        // sebagian membuat nomor yang tersisa bertabrakan dengan yang baru.
        const result = await reorderBanners(next)
        if (!result.success) {
          toastManager.add({ title: "Urutan gagal disimpan", description: result.error })
        }
      } catch {
        toastManager.add({
          title: "Urutan gagal disimpan",
          description: "Terjadi kesalahan tak terduga. Urutan lama dipulihkan.",
        })
      }
      router.refresh()
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingId(null)

    const id = String(event.active.id)
    const overId = event.over ? String(event.over.id) : null
    if (!overId || overId === id) return

    const from = rows.find((row) => row.banner.id === id)?.block ?? null
    const to = rows.find((row) => row.banner.id === overId)?.block ?? null

    if (from !== to) {
      toastManager.add({
        title: "Tidak bisa dipindah ke sana",
        description:
          "Banner kampanye selalu menempati urutan paling depan di beranda, jadi urutannya hanya bisa ditukar sesama blok.",
      })
      return
    }

    commitOrder(moveTo(orderedIds, id, overId))
  }

  /** Menukar posisi dengan tetangga di dalam blok yang sama. */
  function moveWithinBlock(blockRows: ClassifiedBanner[], index: number, direction: -1 | 1) {
    const target = blockRows[index + direction]
    if (!target) return
    commitOrder(moveTo(orderedIds, blockRows[index].banner.id, target.banner.id))
  }

  function renderSortableBlock(blockRows: ClassifiedBanner[]) {
    return blockRows.map((row, index) => (
      <SortableBannerRow
        key={row.banner.id}
        row={row}
        busy={isSavingOrder}
        draggingBlock={draggingBlock}
        canMoveUp={index > 0}
        canMoveDown={index < blockRows.length - 1}
        onMoveUp={() => moveWithinBlock(blockRows, index, -1)}
        onMoveDown={() => moveWithinBlock(blockRows, index, 1)}
        onDelete={() => setPendingDelete(row.banner)}
      />
    ))
  }

  if (banners.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-input px-4 py-10 text-center text-sm text-muted-foreground">
        Belum ada banner. Klik &quot;Tambah Banner&quot; untuk membuat slide pertama di beranda.
      </p>
    )
  }

  return (
    <>
      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">
            Tayang di beranda{" "}
            <span className="tabular-nums text-muted-foreground">({liveCount})</span>
          </h2>
          {isSavingOrder && (
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Menyimpan urutan…
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Urutan di bawah ini persis urutan yang dilihat pengunjung. Seret gagangnya untuk
          menukar posisi — atau pakai tombol panah.
        </p>

        {liveCount === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-input px-4 py-8 text-center text-sm text-muted-foreground">
            Tidak ada banner yang sedang tayang. Semuanya ada di bagian bawah.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            onDragStart={(event: DragStartEvent) => setDraggingId(String(event.active.id))}
            onDragCancel={() => setDraggingId(null)}
            onDragEnd={handleDragEnd}
          >
            <div className="mt-3 max-h-[60vh] space-y-4 overflow-y-auto rounded-xl border border-border bg-muted/20 p-3">
              {batchRows.length > 0 && (
                <div className="space-y-3">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold text-primary">
                    <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                    Kampanye — selalu paling depan
                    <span className="tabular-nums font-normal text-muted-foreground">
                      ({batchRows.length})
                    </span>
                  </p>
                  {renderSortableBlock(batchRows)}
                </div>
              )}

              {otherRows.length > 0 && (
                <div className="space-y-3">
                  {batchRows.length > 0 && (
                    <p className="flex items-center gap-1.5 border-t border-border pt-3 text-[11px] font-semibold text-muted-foreground">
                      Banner lain
                      <span className="tabular-nums font-normal">({otherRows.length})</span>
                    </p>
                  )}
                  {renderSortableBlock(otherRows)}
                </div>
              )}
            </div>
          </DndContext>
        )}
      </section>

      {inactiveRows.length > 0 && (
        <InactiveSection rows={inactiveRows} onDelete={(banner) => setPendingDelete(banner)} />
      )}

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus banner ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Banner <strong>{pendingDelete?.title}</strong> akan dihapus permanen dan langsung
              hilang dari beranda. Kalau cuma ingin menyembunyikannya sementara, matikan saklar
              Aktif lewat Edit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
            {/* Server action dipanggil langsung, bukan lewat <form> bersarang.
                Tombol base-ui memasang `type="button"` secara bawaan, sehingga
                mengandalkan submit formulir di sini bergantung pada urutan
                penimpaan prop — kalau meleset, tombol Hapus diam saja tanpa
                galat apa pun. Memanggil aksinya langsung menghilangkan
                ketergantungan itu. */}
            <AlertDialogAction
              variant="destructive"
              disabled={isDeleting}
              onClick={async () => {
                if (!pendingDelete) return
                setIsDeleting(true)
                const formData = new FormData()
                formData.append("id", pendingDelete.id)
                await deleteBanner(formData)
                setIsDeleting(false)
                setPendingDelete(null)
              }}
            >
              {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Ya, Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

type SortableBannerRowProps = {
  row: ClassifiedBanner
  busy: boolean
  draggingBlock: BlockId | null
  canMoveUp: boolean
  canMoveDown: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
}

/**
 * Satu baris yang bisa diseret DAN menjadi sasaran jatuhan.
 *
 * Dua kait dnd-kit dipasang pada elemen yang sama dengan id yang sama —
 * daftar draggable dan droppable memang terpisah di dalam pustakanya. Semua
 * urusan tampilan baris tetap di `banner-row.tsx`; berkas ini hanya menyalurkan
 * gagang, ref, dan transformnya.
 */
function SortableBannerRow({
  row,
  busy,
  draggingBlock,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onDelete,
}: SortableBannerRowProps) {
  const { banner, block } = row

  // Dibongkar di sini, bukan dipakai lewat `objek.properti` — pola yang sama
  // dengan `kategori/category-tree-dnd.tsx`. Aturan lint React menganggap akses
  // properti pada hasil kait ini sebagai membaca ref saat render.
  const {
    attributes,
    listeners,
    transform,
    isDragging,
    setNodeRef: setDragRef,
    setActivatorNodeRef,
  } = useDraggable({ id: banner.id })

  const { isOver, setNodeRef: setDropRef } = useDroppable({ id: banner.id })

  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      setDragRef(node)
      setDropRef(node)
    },
    [setDragRef, setDropRef]
  )

  const style: React.CSSProperties | undefined = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        position: "relative",
        zIndex: 20,
      }
    : undefined

  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...listeners}
      {...attributes}
      className="cursor-grab touch-none rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
      aria-label={`Seret untuk mengurutkan banner ${banner.title}`}
    >
      <GripVertical className="h-4 w-4" />
    </button>
  )

  return (
    <BannerRow
      banner={banner}
      state={row.state}
      heldByBatch={row.heldByBatch}
      gate={row.gate}
      onDelete={onDelete}
      innerRef={setRefs}
      style={style}
      dragging={isDragging}
      // Sasaran jatuhan hanya ditandai untuk baris sebalok — memindahkan antar
      // blok memang ditolak, jadi jangan menjanjikannya lewat sorotan.
      dropTarget={isOver && draggingBlock === block}
      reorder={{
        handle,
        canMoveUp,
        canMoveDown,
        onMoveUp,
        onMoveDown,
        busy,
      }}
    />
  )
}

/**
 * Bagian bawah: banner yang tidak sedang tayang.
 *
 * Tidak bisa diurutkan — urutan hanya berarti bagi yang muncul di beranda.
 * Isinya bertambah saat digulir sampai ke dasar, bukan dirender sekaligus.
 */
function InactiveSection({
  rows,
  onDelete,
}: {
  rows: ClassifiedBanner[]
  onDelete: (banner: BannerWithBatch) => void
}) {
  const [visibleCount, setVisibleCount] = React.useState(INACTIVE_CHUNK)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const sentinelRef = React.useRef<HTMLDivElement>(null)

  const total = rows.length
  const shown = rows.slice(0, Math.min(visibleCount, total))
  const remaining = total - shown.length

  React.useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        // Mengembalikan nilai yang sama tidak memicu render ulang, jadi aman
        // meski sentinel tetap terlihat setelah semuanya termuat.
        setVisibleCount((current) => (current >= total ? current : current + INACTIVE_CHUNK))
      },
      // Akarnya wadah gulir ini sendiri, bukan viewport — daftarnya punya
      // tinggi maksimum dan menggulir di dalam dirinya.
      { root: scrollRef.current, rootMargin: "200px" }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [total])

  return (
    <section className="mt-6 border-t border-dashed border-border pt-5">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
        <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
        Tidak tayang <span className="tabular-nums">({total})</span>
      </h2>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        Nonaktif, belum mulai, sudah berakhir, atau ditahan kampanyenya. Urutannya tidak
        berpengaruh selama tidak tayang.
      </p>

      <div
        ref={scrollRef}
        className="mt-3 max-h-[45vh] space-y-3 overflow-y-auto rounded-xl border border-border bg-muted/20 p-3"
      >
        {shown.map((row) => (
          <BannerRow
            key={row.banner.id}
            banner={row.banner}
            state={row.state}
            heldByBatch={row.heldByBatch}
            gate={row.gate}
            onDelete={() => onDelete(row.banner)}
          />
        ))}

        <div ref={sentinelRef} aria-hidden="true" className="h-px" />

        {remaining > 0 && (
          /* Tanpa pemintal: tidak ada yang diunduh di sini — barisnya memang
             sudah ada, hanya belum dirender. Tombolnya tetap ada sebagai jalan
             yang pasti kalau pengamat perpotongan tidak terpicu. */
          <div className="flex items-center justify-center gap-2 py-2 text-[11px] text-muted-foreground">
            <span className="tabular-nums">{remaining} banner lagi</span>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => setVisibleCount((current) => current + INACTIVE_CHUNK)}
            >
              Muat lagi
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}
