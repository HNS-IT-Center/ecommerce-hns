"use client"

import * as React from "react"
import { Search, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import type { PcBuilderStepConfig } from "@/lib/pc-builder/config"
import { PC_BUILDER_STEP_KINDS, isPcBuilderStepKind } from "@/lib/pc-builder/step-kind"
import { STEP_KIND_LABELS } from "./step-labels"
import { RequireRulesEditor, isRuleIncomplete, type RuleAttributeOption } from "./require-rules-editor"

/**
 * Batas baris daftar yang dirender sekaligus di tab Kategori/Kompatibilitas.
 * Kategori bisa ratusan; yang dicari staff hampir selalu ditemukan lewat
 * kotak cari, bukan dengan menggulir ratusan checkbox.
 */
const LIST_RENDER_LIMIT = 150

/**
 * Panel tab = satu-satunya area gulir di panel edit. Tingginya dikunci oleh
 * panel (`min-h-0` di dalam flex kolom setinggi layar), dan `scrollbar-gutter:
 * stable` menyisakan tempat scrollbar sejak awal — tanpa itu, isi yang
 * memanjang memunculkan scrollbar, lebar isi menyusut belasan piksel, dan
 * teks di seluruh tab mendadak berpindah baris.
 */
const TAB_PANEL_CLASS = "min-h-0 overflow-y-auto p-4 [scrollbar-gutter:stable] sm:p-5"

type TabId = "umum" | "kategori" | "kompat" | "aturan"

export type EditSession = {
  /** Kunci pemasangan ulang — sesi baru = draf baru. */
  key: string
  mode: "new" | "edit"
  /** Nomor urut yang ditampilkan di judul (1-based). */
  number: number
  step: PcBuilderStepConfig
}

/** Pengisi draf sebelum sesi pertama dibuka — tidak pernah tampil. */
const BLANK_STEP: PcBuilderStepConfig = {
  id: "",
  name: "",
  order: 0,
  categoryIds: [],
  dependSteps: [],
  dependAttributes: [],
}

interface StepEditSheetProps {
  open: boolean
  /** `null` sampai panel pertama kali dibuka. */
  session: EditSession | null
  /** Semua step yang sudah ada (untuk "bergantung pada" & tujuan aturan). */
  allSteps: PcBuilderStepConfig[]
  categories: { id: number; name: string; path: string }[]
  attributes: RuleAttributeOption[]
  onApply: (step: PcBuilderStepConfig) => void
  onDelete: (stepId: string) => void
  onClose: () => void
}

/**
 * Panel edit SATU step. Perubahan dikerjakan di draf dan baru masuk ke daftar
 * step saat "Terapkan" — "Batal" membuangnya. Menyimpan ke database tetap
 * lewat tombol "Simpan Perubahan" di halaman.
 *
 * # Sheet-nya SELALU terpasang — jangan dipasang ulang dalam keadaan terbuka
 *
 * Versi pertama memasang ulang seluruh komponen (lewat `key`) untuk setiap
 * sesi, dengan `open` sudah `true` sejak pemasangan. Di mode dev, React
 * StrictMode menjalankan efek dua kali saat pemasangan, dan `useBackToClose`
 * di dalam `Sheet` bereaksi begini: efek pertama mendorong entri riwayat,
 * pembersihannya memanggil `history.back()`, efek kedua mendorong lagi — lalu
 * `popstate` milik `history.back()` tadi tiba SETELAH pendengar efek kedua
 * terpasang, dan dibaca sebagai "pengguna menekan Back". Akibatnya panel
 * muncul sekejap lalu menutup sendiri.
 *
 * Karena itu yang diganti per sesi hanya DRAF-nya (lihat `draftKey` di bawah);
 * `Sheet` terpasang sekali dalam keadaan tertutup, persis seperti Sheet lain di
 * proyek ini.
 */
export function StepEditSheet({
  open,
  session,
  allSteps,
  categories,
  attributes,
  onApply,
  onDelete,
  onClose,
}: StepEditSheetProps) {
  const baseStep = session?.step ?? BLANK_STEP
  const [draft, setDraft] = React.useState<PcBuilderStepConfig>(baseStep)
  const [draftKey, setDraftKey] = React.useState(session?.key ?? null)
  const [tab, setTab] = React.useState<TabId>("umum")
  const [error, setError] = React.useState<string | null>(null)
  const [confirmDiscard, setConfirmDiscard] = React.useState(false)
  const [confirmDelete, setConfirmDelete] = React.useState(false)

  // Sesi baru → draf baru. Disesuaikan SAAT RENDER (pola resmi React untuk
  // state yang diturunkan dari prop), bukan lewat efek yang membuat satu
  // render sempat menampilkan draf sesi sebelumnya.
  if (session && session.key !== draftKey) {
    setDraftKey(session.key)
    setDraft(session.step)
    setTab("umum")
    setError(null)
  }

  const isDirty = JSON.stringify(draft) !== JSON.stringify(baseStep)

  const update = (patch: Partial<PcBuilderStepConfig>) => {
    setError(null)
    setDraft((d) => ({ ...d, ...patch }))
  }

  /** Step lain yang bisa ditunjuk: sudah bernama dan bukan step ini sendiri. */
  const otherSteps = allSteps.filter((s) => s.id !== draft.id && s.name.trim() !== "")

  const requestClose = () => {
    if (isDirty) setConfirmDiscard(true)
    else onClose()
  }

  const handleApply = () => {
    const name = draft.name.trim()
    if (name === "") {
      setTab("umum")
      setError("Nama step wajib diisi.")
      return
    }
    if ((draft.requireRules ?? []).some(isRuleIncomplete)) {
      setTab("aturan")
      setError("Ada aturan yang belum lengkap — lengkapi atau hapus dulu.")
      return
    }
    const rules = draft.requireRules ?? []
    onApply({ ...draft, name, requireRules: rules.length > 0 ? rules : undefined })
  }

  const mode = session?.mode ?? "edit"
  const displayName = draft.name.trim() || (mode === "new" ? "Step baru" : "Tanpa nama")

  return (
    <>
      <Sheet open={open} onOpenChange={(next) => { if (!next) requestClose() }}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
        >
          <div className="flex items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
            <div className="min-w-0 flex-1">
              <SheetDescription className="text-xs font-semibold">
                {mode === "new" ? "Step baru" : `Edit step ${String(session?.number ?? 0).padStart(2, "0")}`}
              </SheetDescription>
              <SheetTitle className="truncate text-lg font-bold">{displayName}</SheetTitle>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={requestClose}
              aria-label="Tutup panel"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as TabId)}
            className="min-h-0 flex-1 gap-0"
          >
            <div className="overflow-x-auto border-b border-border px-2 sm:px-3">
              <TabsList variant="line" className="h-11">
                <TabsTrigger value="umum" className="px-3">Umum</TabsTrigger>
                <TabsTrigger value="kategori" className="px-3">
                  Kategori
                  <Count n={(draft.categoryIds ?? []).length} />
                </TabsTrigger>
                <TabsTrigger value="kompat" className="px-3">
                  Kompatibilitas
                  <Count n={(draft.dependSteps ?? []).length + (draft.dependAttributes ?? []).length} />
                </TabsTrigger>
                <TabsTrigger value="aturan" className="px-3">
                  Aturan Wajib
                  <Count n={(draft.requireRules ?? []).length} />
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="umum" className={TAB_PANEL_CLASS}>
              <GeneralTab
                draft={draft}
                canDelete={mode === "edit"}
                onChange={update}
                onDelete={() => setConfirmDelete(true)}
              />
            </TabsContent>
            <TabsContent value="kategori" className={TAB_PANEL_CLASS}>
              <CategoriesTab
                selectedIds={draft.categoryIds ?? []}
                categories={categories}
                onChange={(categoryIds) => update({ categoryIds })}
              />
            </TabsContent>
            <TabsContent value="kompat" className={TAB_PANEL_CLASS}>
              <CompatibilityTab
                draft={draft}
                otherSteps={otherSteps}
                attributes={attributes}
                onChange={update}
              />
            </TabsContent>
            <TabsContent value="aturan" className={TAB_PANEL_CLASS}>
              <RequireRulesEditor
                step={draft}
                targetSteps={otherSteps}
                attributes={attributes}
                onChange={(requireRules) => update({ requireRules })}
              />
            </TabsContent>
          </Tabs>

          <div className="flex flex-col gap-2 border-t border-border bg-muted/30 px-4 py-3 sm:px-5">
            {error && (
              <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
              <Button type="button" variant="outline" className="h-11 sm:h-10" onClick={requestClose}>
                Batal
              </Button>
              <Button type="button" className="h-11 sm:h-10" onClick={handleApply}>
                Terapkan
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Buang perubahan di step ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Perubahan di panel ini belum diterapkan. Kalau ditutup sekarang, perubahannya hilang.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Lanjut mengedit</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setConfirmDiscard(false)
                onClose()
              }}
            >
              Buang perubahan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus step {displayName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Step ini hilang dari daftar, beserta ketergantungan dan aturan wajib yang menunjuknya.
              Belum tersimpan ke database sampai Anda menekan &quot;Simpan Perubahan&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setConfirmDelete(false)
                onDelete(draft.id)
              }}
            >
              Ya, hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function Count({ n }: { n: number }) {
  if (n === 0) return null
  return (
    <span className="rounded-full bg-muted px-1.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
      {n}
    </span>
  )
}

/* ------------------------------------------------------------------------- *
 * Tab: Umum
 * ------------------------------------------------------------------------- */

function GeneralTab({
  draft,
  canDelete,
  onChange,
  onDelete,
}: {
  draft: PcBuilderStepConfig
  canDelete: boolean
  onChange: (patch: Partial<PcBuilderStepConfig>) => void
  onDelete: () => void
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="step-name" className="text-sm font-semibold">Nama step</label>
        <Input
          id="step-name"
          value={draft.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="mis. Processor, Motherboard, RAM…"
          className="h-11 text-base"
        />
      </div>

      {/* Dibaca aplikasi Ticketing (docs/17 §20). Tidak memengaruhi storefront. */}
      <div className="space-y-1.5">
        <label htmlFor="step-kind" className="text-sm font-semibold">Jenis baris (untuk Ticketing)</label>
        <select
          id="step-kind"
          value={draft.kind ?? ""}
          onChange={(e) => {
            const value = e.target.value
            onChange({ kind: isPcBuilderStepKind(value) ? value : undefined })
          }}
          className="h-11 w-full rounded-lg border border-input bg-background px-2 text-sm"
        >
          <option value="">Belum diatur</option>
          {PC_BUILDER_STEP_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {STEP_KIND_LABELS[kind]}
            </option>
          ))}
        </select>
      </div>

      <div className="divide-y divide-border rounded-xl border border-border">
        <SwitchRow
          id="step-required"
          label="Wajib"
          description="Selalu wajib diisi. Untuk wajib bersyarat, pakai tab Aturan Wajib di step pemicunya."
          checked={draft.isRequired === true}
          onChange={(isRequired) => onChange({ isRequired })}
        />
        <SwitchRow
          id="step-multiple"
          label="Boleh lebih dari satu"
          description="Mis. RAM beberapa keping, atau lebih dari satu SSD."
          checked={draft.allowMultiple === true}
          onChange={(allowMultiple) => onChange({ allowMultiple })}
        />
      </div>

      {canDelete && (
        <Button
          type="button"
          variant="outline"
          onClick={onDelete}
          className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/60 dark:hover:bg-red-950/40"
        >
          <Trash2 className="h-4 w-4" /> Hapus step
        </Button>
      )}
    </div>
  )
}

function SwitchRow({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="cursor-pointer text-sm font-semibold">{label}</label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={(c) => onChange(c === true)} />
    </div>
  )
}

/* ------------------------------------------------------------------------- *
 * Tab: Kategori
 * ------------------------------------------------------------------------- */

function CategoriesTab({
  selectedIds,
  categories,
  onChange,
}: {
  selectedIds: number[]
  categories: { id: number; name: string; path: string }[]
  onChange: (ids: number[]) => void
}) {
  const [search, setSearch] = React.useState("")
  const selected = new Set(selectedIds)
  const q = search.trim().toLowerCase()

  const matches = q
    ? categories.filter((c) => c.name.toLowerCase().includes(q) || c.path.toLowerCase().includes(q))
    : categories
  const shown = matches.slice(0, LIST_RENDER_LIMIT)
  const selectedCategories = categories.filter((c) => selected.has(c.id))

  const toggle = (id: number, on: boolean) => {
    const next = new Set(selectedIds)
    if (on) next.add(id)
    else next.delete(id)
    onChange(Array.from(next))
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Produk dari kategori ini (beserta sub-kategorinya) yang tampil di step ini. Tanpa kategori,
        step menampilkan semua produk.
      </p>

      {selectedCategories.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">TERPILIH ({selectedCategories.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {selectedCategories.map((c) => (
              <span
                key={c.id}
                className="inline-flex h-8 items-center gap-1 rounded-full border border-primary/30 bg-primary/10 pl-3 pr-1 text-sm font-medium"
              >
                {c.name}
                <button
                  type="button"
                  onClick={() => toggle(c.id, false)}
                  aria-label={`Hapus kategori ${c.name}`}
                  className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-primary/20"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <SearchBox value={search} onChange={setSearch} label="Cari kategori" />

      <div className="divide-y divide-border rounded-xl border border-border">
        {shown.map((c) => {
          const parts = c.path.split(" > ")
          const parent = parts.slice(0, -1).join(" > ")
          const inputId = `cat-${c.id}`
          return (
            <div key={c.id} className="flex items-start gap-3 px-3 py-2.5">
              <Checkbox
                id={inputId}
                checked={selected.has(c.id)}
                onCheckedChange={(v) => toggle(c.id, v === true)}
                className="mt-0.5"
              />
              <label htmlFor={inputId} className="min-w-0 flex-1 cursor-pointer">
                <span className="block text-sm font-medium">{parts[parts.length - 1]}</span>
                {parent && <span className="block truncate text-xs text-muted-foreground">{parent}</span>}
              </label>
            </div>
          )
        })}
        {shown.length === 0 && <p className="p-3 text-sm text-muted-foreground">Kategori tidak ditemukan.</p>}
      </div>
      {matches.length > shown.length && (
        <p className="text-xs text-muted-foreground">
          Menampilkan {shown.length} dari {matches.length}. Persempit dengan kotak cari.
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------------- *
 * Tab: Kompatibilitas
 * ------------------------------------------------------------------------- */

function CompatibilityTab({
  draft,
  otherSteps,
  attributes,
  onChange,
}: {
  draft: PcBuilderStepConfig
  otherSteps: PcBuilderStepConfig[]
  attributes: RuleAttributeOption[]
  onChange: (patch: Partial<PcBuilderStepConfig>) => void
}) {
  const [search, setSearch] = React.useState("")
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const deps = new Set(draft.dependSteps ?? [])
  const attrs = new Set(draft.dependAttributes ?? [])
  const q = search.trim().toLowerCase()

  const toggleDep = (id: string) => {
    const next = new Set(deps)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange({ dependSteps: Array.from(next) })
  }
  const addAttr = (id: number) => {
    onChange({ dependAttributes: [...attrs, id] })
    setSearch("")
  }
  const removeAttr = (id: number) => {
    onChange({ dependAttributes: [...attrs].filter((a) => a !== id) })
  }

  const depNames = otherSteps.filter((s) => deps.has(s.id)).map((s) => s.name)
  const selectedAttrs = attributes.filter((a) => attrs.has(a.id))
  // Atribut lain tidak lagi tampil sebagai dinding chip. Daftarnya terbuka saat
  // kotak cari disentuh — langsung berisi SEMUA atribut, supaya staff yang
  // belum tahu namanya bisa menggulir, dan mengetik hanya mempersempit.
  const available = attributes.filter((a) => !attrs.has(a.id))
  const results = q ? available.filter((a) => a.name.toLowerCase().includes(q)) : available
  const shownResults = results.slice(0, LIST_RENDER_LIMIT)

  return (
    <div className="space-y-6">
      <CompatibilitySummary depNames={depNames} attrNames={selectedAttrs.map((a) => a.name)} />

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Bergantung pada step</h3>
        <p className="text-xs text-muted-foreground">
          Komponen yang dipilih di step ini menjadi acuan penyaring.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {otherSteps.map((s) => (
            <Chip key={s.id} on={deps.has(s.id)} onClick={() => toggleDep(s.id)}>
              {s.name}
            </Chip>
          ))}
          {otherSteps.length === 0 && <p className="text-sm text-muted-foreground">Belum ada step lain.</p>}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Atribut yang dicocokkan</h3>
        <p className="text-xs text-muted-foreground">
          Cukup satu nilai yang sama per atribut — mis. Socket processor dengan Socket motherboard.
        </p>

        {selectedAttrs.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {selectedAttrs.map((a) => (
              <span
                key={a.id}
                className="inline-flex h-9 items-center gap-1 rounded-full border border-primary bg-primary pl-3 pr-1 text-sm font-medium text-primary-foreground"
              >
                {a.name}
                <button
                  type="button"
                  onClick={() => removeAttr(a.id)}
                  aria-label={`Hapus atribut ${a.name}`}
                  className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-primary-foreground/20"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Belum ada atribut.</p>
        )}

        {/* Hasil cari dirender DI DALAM panel, bukan lewat `Combobox` (yang
            memortal daftarnya ke `document.body`): panel ini dialog modal, dan
            klik pada daftar di luar pohon DOM-nya terbaca sebagai klik di luar
            panel — panelnya ikut tertutup. */}
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            aria-label="Cari dan tambah atribut"
            aria-expanded={pickerOpen}
            aria-controls="compat-attr-options"
            placeholder="Tambah atribut — ketik untuk mencari…"
            value={search}
            onFocus={() => setPickerOpen(true)}
            onClick={() => setPickerOpen(true)}
            onBlur={() => setPickerOpen(false)}
            onChange={(e) => {
              setSearch(e.target.value)
              setPickerOpen(true)
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape" && pickerOpen) {
                // Tutup daftarnya saja, jangan panel edit di belakangnya.
                e.preventDefault()
                e.stopPropagation()
                setPickerOpen(false)
                return
              }
              if (e.key !== "Enter") return
              e.preventDefault()
              if (pickerOpen && results[0]) addAttr(results[0].id)
            }}
            className="h-10 pl-9"
          />
        </div>
        {pickerOpen && (
          // Tinggi dikunci di dua sisi: `min-h` supaya kotak tidak mengerut
          // jadi satu baris saat hasil cari tinggal sedikit, `max-h` supaya
          // ratusan atribut tidak mendorong seluruh panel memanjang. Gulirnya
          // di dalam kotak ini, dengan tempat scrollbar yang sudah disisakan.
          <div
            id="compat-attr-options"
            className="max-h-64 min-h-40 overflow-y-auto rounded-xl border border-border [scrollbar-gutter:stable]"
          >
            {shownResults.map((a) => (
              <button
                key={a.id}
                type="button"
                // `preventDefault` di mousedown menjaga fokus tetap di kotak
                // cari: tanpa itu blur menutup daftar sebelum klik terjadi,
                // dan staff bisa menambah beberapa atribut berturut-turut.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addAttr(a.id)}
                className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-muted"
              >
                <span className="min-w-0 truncate font-medium">{a.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">Tambah</span>
              </button>
            ))}
            {results.length === 0 && (
              <p className="px-3 py-2.5 text-sm text-muted-foreground">
                {available.length === 0 ? "Semua atribut sudah dipilih." : "Atribut tidak ditemukan."}
              </p>
            )}
            {results.length > shownResults.length && (
              <p className="px-3 py-2.5 text-xs text-muted-foreground">
                Menampilkan {shownResults.length} dari {results.length}. Persempit dengan mengetik.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

/** "a", "a dan b", "a, b, dan c" */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ""
  return `${names.slice(0, -1).join(", ")} dan ${names[names.length - 1]}`
}

/**
 * Akibat pengaturan tab ini, dalam satu kalimat. Aturannya sama dengan
 * `lib/pc-builder/compatibility.ts`: SEMUA atribut dicocokkan ke SETIAP step
 * acuan, cukup satu nilai yang sama per atribut.
 */
function CompatibilitySummary({ depNames, attrNames }: { depNames: string[]; attrNames: string[] }) {
  let text: string
  let tone: "ok" | "warn" | "muted"

  if (depNames.length > 0 && attrNames.length > 0) {
    text = `Produk di step ini harus punya ${joinNames(attrNames)} yang sama dengan ${joinNames(depNames)} yang dipilih.`
    tone = "ok"
  } else if (depNames.length > 0) {
    text = `Belum ada atribut yang dicocokkan — pilihan di ${joinNames(depNames)} belum menyaring produk step ini.`
    tone = "warn"
  } else if (attrNames.length > 0) {
    text = "Belum ada step acuan — atribut di bawah belum dipakai untuk menyaring."
    tone = "warn"
  } else {
    text = "Step ini tidak disaring oleh step lain."
    tone = "muted"
  }

  const toneClass = {
    ok: "border-primary/30 bg-primary/5 text-foreground",
    warn: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200",
    muted: "border-border bg-muted/40 text-muted-foreground",
  }[tone]

  return <p className={`rounded-xl border px-3.5 py-3 text-sm ${toneClass}`}>{text}</p>
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`h-9 rounded-full border px-3 text-sm font-medium transition-colors ${
        on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-muted"
      }`}
    >
      {children}
    </button>
  )
}

function SearchBox({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <Input
        aria-label={label}
        placeholder={`${label}…`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 pl-9"
      />
    </div>
  )
}
