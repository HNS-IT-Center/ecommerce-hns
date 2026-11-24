"use client"

import * as React from "react"
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core"
import { Plus, Save, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  savePcBuilderConfig,
  savePcBuilderDisplayConfig,
} from "../actions"
import {
  type PcBuilderDisplayConfig,
  type PcBuilderStepConfig,
} from "@/lib/pc-builder/config"
import { StepCard } from "./step-card"
import { StepEditSheet, type EditSession } from "./step-edit-sheet"
import { MATCH_LABELS, isRuleIncomplete, type RuleAttributeOption } from "./require-rules-editor"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToastManager } from "@/components/ui/toast"

interface PcBuilderFormProps {
  initialSteps: PcBuilderStepConfig[]
  initialDisplay: PcBuilderDisplayConfig
  categories: { id: number, name: string, path: string }[]
  attributes: RuleAttributeOption[]
}

/** Bentuk pembanding "sudah berubah?" — `order` diabaikan, urutan dihitung terpisah. */
function fingerprint(step: PcBuilderStepConfig): string {
  const { order: _order, ...rest } = step
  void _order
  return JSON.stringify(rest)
}

/** Memindahkan `id` ke posisi `targetId` — sama dengan `banner/banner-list.tsx`. */
function moveTo<T extends { id: string }>(items: T[], id: string, targetId: string): T[] {
  const from = items.findIndex((s) => s.id === id)
  const to = items.findIndex((s) => s.id === targetId)
  if (from < 0 || to < 0 || from === to) return items
  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

function newStepId() {
  return Math.random().toString(36).substring(2, 9)
}

export function PcBuilderForm({ initialSteps, initialDisplay, categories, attributes }: PcBuilderFormProps) {
  const [steps, setSteps] = React.useState<PcBuilderStepConfig[]>(initialSteps || [])
  const [showItemPrices, setShowItemPrices] = React.useState(initialDisplay.showItemPrices)
  // Titik banding penanda "belum disimpan" — digeser setiap kali simpan berhasil.
  const [baseline, setBaseline] = React.useState({ steps: initialSteps || [], showItemPrices: initialDisplay.showItemPrices })
  const [isSaving, setIsSaving] = React.useState(false)
  const [session, setSession] = React.useState<EditSession | null>(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [overId, setOverId] = React.useState<string | null>(null)
  const toastManager = useToastManager()

  /**
   * Ambang 6 piksel sebelum seretan dimulai — tanpa itu klik pada tombol di
   * dalam card terbaca sebagai awal seretan (catatan yang sama di banner-list).
   * Gagangnya hanya tampil mulai `md`; di layar sentuh urutan diubah lewat panah.
   */
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  /* ---------------------------------------------------------------------- *
   * Ringkasan card — dihitung sekali di sini, card hanya menampilkan teks.
   * ---------------------------------------------------------------------- */

  const categoryNameById = React.useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])
  const attributeNameById = React.useMemo(() => new Map(attributes.map((a) => [a.id, a.name])), [attributes])

  const summaries = React.useMemo(() => {
    const stepNameById = new Map(steps.map((s) => [s.id, s.name.trim() || "Tanpa nama"]))
    const names = <K,>(ids: K[], lookup: Map<K, string>) =>
      ids.map((id) => lookup.get(id)).filter((n): n is string => Boolean(n))

    const listText = (items: string[], max = 2) =>
      items.length === 0 ? "—" : items.length <= max ? items.join(", ") : `${items.slice(0, max).join(", ")} +${items.length - max}`

    // Aturan milik step LAIN yang menunjuk step ini → catatan di card tujuannya.
    const inboundById = new Map<string, string[]>()
    for (const s of steps) {
      for (const rule of s.requireRules ?? []) {
        const trigger = s.name.trim() || "step tanpa nama"
        const attr = attributeNameById.get(rule.attributeId) ?? "atribut"
        const text = `Wajib bila ${trigger} ${MATCH_LABELS[rule.match]} ${attr} — diatur di step ${trigger}`
        const list = inboundById.get(rule.targetStepId) ?? []
        if (!list.includes(text)) list.push(text)
        inboundById.set(rule.targetStepId, list)
      }
    }

    return new Map(
      steps.map((s) => {
        const deps = names(s.dependSteps ?? [], stepNameById)
        const attrs = names(s.dependAttributes ?? [], attributeNameById)
        const compatText =
          deps.length && attrs.length
            ? `${attrs.join(", ")} dengan ${deps.join(", ")}`
            : deps.length
              ? `Dari ${deps.join(", ")} (belum ada atribut)`
              : attrs.length
                ? `${attrs.join(", ")} (belum ada step acuan)`
                : "—"

        const rules = s.requireRules ?? []
        const targets = [...new Set(names(rules.map((r) => r.targetStepId), stepNameById))]
        const rulesText = rules.length === 0 ? "—" : `${rules.length} aturan → ${targets.join(", ")}`

        return [
          s.id,
          {
            categoriesText: listText(names(s.categoryIds ?? [], categoryNameById)),
            compatText,
            rulesText,
            inbound: inboundById.get(s.id) ?? [],
          },
        ]
      })
    )
  }, [steps, categoryNameById, attributeNameById])

  /** Jumlah perubahan yang belum disimpan: step berubah/baru/terhapus, urutan, tampilan PDF. */
  const pendingChanges = React.useMemo(() => {
    const before = new Map(baseline.steps.map((s) => [s.id, fingerprint(s)]))
    const nowIds = new Set(steps.map((s) => s.id))
    let count = steps.filter((s) => before.get(s.id) !== fingerprint(s)).length
    count += baseline.steps.filter((s) => !nowIds.has(s.id)).length

    const keptBefore = baseline.steps.map((s) => s.id).filter((id) => nowIds.has(id))
    const keptNow = steps.map((s) => s.id).filter((id) => before.has(id))
    if (keptBefore.join("|") !== keptNow.join("|")) count += 1

    if (baseline.showItemPrices !== showItemPrices) count += 1
    return count
  }, [steps, baseline, showItemPrices])

  /* ---------------------------------------------------------------------- *
   * Aksi daftar
   * ---------------------------------------------------------------------- */

  const openEditor = (step: PcBuilderStepConfig, index: number) => {
    setSession({ key: newStepId(), mode: "edit", number: index + 1, step })
    setSheetOpen(true)
  }

  const openNew = () => {
    setSession({
      key: newStepId(),
      mode: "new",
      number: steps.length + 1,
      step: { id: newStepId(), name: "", order: steps.length, categoryIds: [], dependSteps: [], dependAttributes: [] },
    })
    setSheetOpen(true)
  }

  const applyStep = (step: PcBuilderStepConfig) => {
    setSteps((current) =>
      current.some((s) => s.id === step.id)
        ? current.map((s) => (s.id === step.id ? step : s))
        : [...current, step]
    )
    setSheetOpen(false)
  }

  const deleteStep = (stepId: string) => {
    // Ketergantungan & aturan yang menunjuk step yang dihapus ikut dibuang
    // (server juga membuang aturannya saat simpan, lewat `parsePcBuilderSteps`).
    setSteps((current) =>
      current
        .filter((s) => s.id !== stepId)
        .map((s) => ({
          ...s,
          dependSteps: (s.dependSteps || []).filter((dep) => dep !== stepId),
          requireRules: s.requireRules?.filter((rule) => rule.targetStepId !== stepId),
        }))
    )
    setSheetOpen(false)
  }

  const moveStep = (index: number, direction: -1 | 1) => {
    const target = steps[index + direction]
    if (!target) return
    setSteps((current) => moveTo(current, current[index].id, target.id))
  }

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over ? String(event.over.id) : null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setOverId(null)
    const id = String(event.active.id)
    const targetId = event.over ? String(event.over.id) : null
    if (!targetId || targetId === id) return
    setSteps((current) => moveTo(current, id, targetId))
  }

  const handleSave = async () => {
    // Server membuang aturan yang belum lengkap tanpa suara. Menolak di sini
    // supaya staff tidak mengira aturannya tersimpan padahal hilang. (Panel
    // edit sudah menolaknya saat Terapkan; ini jaring untuk data lama.)
    const stepWithIncompleteRule = steps.find(s => (s.requireRules ?? []).some(isRuleIncomplete))
    if (stepWithIncompleteRule) {
      toastManager.add({
        title: "Aturan belum lengkap",
        description: `Lengkapi atau hapus aturan wajib di step ${stepWithIncompleteRule.name || "tanpa nama"}.`,
      })
      return
    }

    setIsSaving(true)
    try {
      // Re-assign order based on array position before saving
      const orderedSteps = steps.map((s, i) => ({ ...s, order: i }))
      const serializedSteps = JSON.parse(JSON.stringify(orderedSteps))
      await savePcBuilderConfig(serializedSteps)
      await savePcBuilderDisplayConfig({ showItemPrices })
      setBaseline({ steps: orderedSteps, showItemPrices })
      setSteps(orderedSteps)
      toastManager.add({ title: "Konfigurasi tersimpan", description: "Perubahan langsung berlaku di /build-pc." })
    } catch (error) {
      // Galat aslinya ikut dicatat, bukan cuma diganti pesan ramah: tanpa ini
      // kegagalan menyimpan konfigurasi tidak meninggalkan jejak apa pun untuk
      // ditelusuri.
      console.error("Gagal menyimpan konfigurasi PC builder:", error)
      toastManager.add({ title: "Gagal menyimpan", description: "Konfigurasi belum tersimpan. Coba lagi." })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="sticky top-20 z-20 flex flex-col gap-3 rounded-2xl border border-border bg-background/95 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-lg font-bold">Langkah PC Builder</h3>
          <p className="text-sm text-muted-foreground">
            Klik Edit untuk mengubah step. Seret gagang (desktop) atau pakai panah untuk mengurutkan.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pendingChanges > 0 && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
              {pendingChanges} perubahan belum disimpan
            </span>
          )}
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
            <Button onClick={openNew} variant="outline" className="h-10 gap-2">
              <Plus className="h-4 w-4" /> Tambah Step
            </Button>
            <Button onClick={handleSave} disabled={isSaving || pendingChanges === 0} className="h-10 gap-2">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Simpan Perubahan
            </Button>
          </div>
        </div>
      </div>

      {/* Pengaturan tampilan dokumen quotation. */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <h4 className="text-base font-bold">Tampilan PDF Quotation</h4>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Atur apa yang terlihat oleh pelanggan pada dokumen yang dicetak.
        </p>

        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold">Harga per item</p>
          <RadioGroup
            value={showItemPrices ? "show" : "hide"}
            onValueChange={(v) => setShowItemPrices(v === "show")}
            className="flex flex-col gap-2 sm:flex-row sm:gap-3"
          >
            <label
              className={`flex flex-1 cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors ${
                showItemPrices ? "border-primary bg-primary/5" : "border-input hover:bg-muted/40"
              }`}
            >
              <RadioGroupItem value="show" className="mt-0.5" />
              <span>
                <span className="block text-sm font-semibold">Tampilkan</span>
                <span className="block text-xs text-muted-foreground">
                  Kolom Harga &amp; Subtotal tiap komponen ikut tercetak.
                </span>
              </span>
            </label>
            <label
              className={`flex flex-1 cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors ${
                !showItemPrices ? "border-primary bg-primary/5" : "border-input hover:bg-muted/40"
              }`}
            >
              <RadioGroupItem value="hide" className="mt-0.5" />
              <span>
                <span className="block text-sm font-semibold">Sembunyikan</span>
                <span className="block text-xs text-muted-foreground">
                  Hanya daftar komponen &amp; Total. Rincian harga tetap bisa dilihat staf
                  lewat kode quotation.
                </span>
              </span>
            </label>
          </RadioGroup>
        </div>
      </div>

      <div className="pb-20">
        {steps.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border bg-muted/20 py-16 text-center">
            <h3 className="text-lg font-bold text-muted-foreground">Belum ada step</h3>
            <p className="mb-6 mt-1 text-sm text-muted-foreground">
              Buat step pertama untuk mulai menyusun alur PC Builder.
            </p>
            <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Buat Step Pertama</Button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            onDragOver={handleDragOver}
            onDragCancel={() => setOverId(null)}
            onDragEnd={handleDragEnd}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {steps.map((step, index) => {
                const summary = summaries.get(step.id)
                return (
                  <StepCard
                    key={step.id}
                    step={step}
                    index={index}
                    total={steps.length}
                    categoriesText={summary?.categoriesText ?? "—"}
                    compatText={summary?.compatText ?? "—"}
                    rulesText={summary?.rulesText ?? "—"}
                    inbound={summary?.inbound ?? []}
                    onEdit={() => openEditor(step, index)}
                    onMove={(direction) => moveStep(index, direction)}
                    dropTarget={overId === step.id}
                  />
                )
              })}
            </div>
          </DndContext>
        )}
      </div>

      {/* SELALU terpasang, tanpa `key` — alasannya di puncak step-edit-sheet.tsx. */}
      <StepEditSheet
        open={sheetOpen}
        session={session}
        allSteps={steps}
        categories={categories}
        attributes={attributes}
        onApply={applyStep}
        onDelete={deleteStep}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  )
}
