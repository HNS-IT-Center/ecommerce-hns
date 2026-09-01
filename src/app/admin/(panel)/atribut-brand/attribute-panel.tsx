"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, Loader2, Pencil, Plus, Trash2, X, Check } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useToastManager } from "@/components/ui/toast"
import type { AttributeRow, AttributeValueRow } from "@/lib/api/taxonomy"

import {
  createAttribute,
  createAttributeValue,
  deleteAttribute,
  deleteAttributeValue,
  renameAttribute,
  renameAttributeValue,
  type ActionResult,
} from "./actions"

/** Apa yang sedang menunggu konfirmasi hapus. */
type PendingDelete =
  | { kind: "attribute"; id: number; name: string; productCount: number }
  | { kind: "value"; id: number; name: string; productCount: number }

export function AttributePanel({ attributes }: { attributes: AttributeRow[] }) {
  const router = useRouter()
  const toastManager = useToastManager()

  const [expanded, setExpanded] = React.useState<Record<number, boolean>>({})
  const [pending, setPending] = React.useState<PendingDelete | null>(null)
  const [busy, setBusy] = React.useState(false)

  // Satu baris yang sedang disunting (atribut atau nilai) — hanya satu pada
  // satu waktu, supaya tidak ada dua kotak teks terbuka yang saling bersaing.
  const [editing, setEditing] = React.useState<{ kind: "attribute" | "value"; id: number } | null>(null)
  const [draft, setDraft] = React.useState("")

  const [newAttribute, setNewAttribute] = React.useState("")
  const [newValueFor, setNewValueFor] = React.useState<number | null>(null)
  const [newValue, setNewValue] = React.useState("")

  /**
   * Menjalankan server action lalu menyegarkan data.
   *
   * `router.refresh()` hanya dipanggil kalau aksinya BERHASIL — menyegarkan
   * setelah gagal akan membuang teks yang sedang diketik admin tanpa alasan.
   */
  async function run(action: () => Promise<ActionResult>, onSuccess?: () => void) {
    setBusy(true)
    try {
      const result = await action()
      if (!result.success) {
        toastManager.add({ title: "Gagal", description: result.error })
        return false
      }
      onSuccess?.()
      router.refresh()
      return true
    } catch {
      toastManager.add({
        title: "Gagal",
        description: "Terjadi kesalahan tak terduga. Coba lagi.",
      })
      return false
    } finally {
      setBusy(false)
    }
  }

  function toggleExpanded(id: number) {
    setExpanded((previous) => ({ ...previous, [id]: !previous[id] }))
  }

  function startEdit(kind: "attribute" | "value", id: number, current: string) {
    setEditing({ kind, id })
    setDraft(current)
  }

  function cancelEdit() {
    setEditing(null)
    setDraft("")
  }

  async function commitEdit() {
    if (!editing) return
    const value = draft.trim()
    if (!value) return

    const action =
      editing.kind === "attribute"
        ? () => renameAttribute(editing.id, value)
        : () => renameAttributeValue(editing.id, value)

    await run(action, cancelEdit)
  }

  async function confirmDelete() {
    if (!pending) return
    const action =
      pending.kind === "attribute"
        ? () => deleteAttribute(pending.id)
        : () => deleteAttributeValue(pending.id)

    const ok = await run(action)
    // Dialog hanya ditutup kalau berhasil; kalau gagal, pesannya sudah muncul
    // lewat toast dan admin bisa mencoba lagi tanpa membuka ulang dialog.
    if (ok) setPending(null)
  }

  const isEditing = (kind: "attribute" | "value", id: number) =>
    editing?.kind === kind && editing.id === id

  return (
    <div className="space-y-4">
      {/* Tambah atribut */}
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          if (!newAttribute.trim()) return
          await run(() => createAttribute(newAttribute), () => setNewAttribute(""))
        }}
        className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 sm:flex-row"
      >
        <Input
          value={newAttribute}
          onChange={(event) => setNewAttribute(event.target.value)}
          placeholder="Nama atribut baru — mis. Warna, Ukuran, Socket"
          className="flex-1"
          maxLength={191}
        />
        <Button type="submit" disabled={busy || !newAttribute.trim()} className="gap-2">
          <Plus className="h-4 w-4" />
          Tambah Atribut
        </Button>
      </form>

      {attributes.length === 0 && (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          Belum ada atribut. Tambahkan yang pertama lewat kotak di atas.
        </p>
      )}

      {/*
        Dua kolom mulai `md`: header atribut lebih padat daripada kartu brand
        (nama + dua badge + dua tombol ikon), jadi `sm` membuat isinya melipat.
        `items-start` supaya kartu yang accordion-nya terbuka tidak ikut
        memanjangkan kartu di sebelahnya menjadi kotak kosong.
      */}
      <div className="grid items-start gap-3 md:grid-cols-2">
        {attributes.map((attribute) => {
          const isOpen = Boolean(expanded[attribute.id])

          return (
            <div key={attribute.id} className="rounded-xl border border-border bg-card">
              <div className="flex flex-wrap items-center gap-2 p-3 sm:flex-nowrap">
                {isEditing("attribute", attribute.id) ? (
                  <div className="flex flex-1 items-center gap-2">
                    <Input
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault()
                          void commitEdit()
                        }
                        if (event.key === "Escape") cancelEdit()
                      }}
                      autoFocus
                      maxLength={191}
                      className="h-9"
                    />
                    <Button size="sm" onClick={commitEdit} disabled={busy || !draft.trim()} className="gap-1">
                      <Check className="h-4 w-4" />
                      Simpan
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={busy}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    {/*
                      Chevron dan nama satu tombol, bukan dua: keduanya memicu
                      aksi yang sama, dan menggabungkannya memberi target klik
                      selebar kolom tanpa menaruh dua perhentian tab berturut-turut
                      untuk satu aksi.
                    */}
                    <button
                      type="button"
                      onClick={() => toggleExpanded(attribute.id)}
                      aria-expanded={isOpen}
                      aria-controls={`attribute-values-${attribute.id}`}
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg py-1 pr-1 text-left transition-colors hover:text-primary"
                    >
                      <ChevronDown
                        className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
                        style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
                      />
                      <span className="truncate font-semibold">{attribute.name}</span>
                    </button>

                    <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                      {attribute.values.length} nilai
                    </span>
                    <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                      {attribute.productCount} produk
                    </span>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEdit("attribute", attribute.id, attribute.name)}
                      disabled={busy}
                      aria-label={`Ubah nama atribut ${attribute.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setPending({
                          kind: "attribute",
                          id: attribute.id,
                          name: attribute.name,
                          productCount: attribute.productCount,
                        })
                      }
                      disabled={busy}
                      aria-label={`Hapus atribut ${attribute.name}`}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>

              {isOpen && (
                <div id={`attribute-values-${attribute.id}`} className="border-t border-border p-3">
                  <div className="flex flex-wrap gap-2">
                    {attribute.values.length === 0 && (
                      <p className="text-sm text-muted-foreground">Belum ada nilai untuk atribut ini.</p>
                    )}

                    {attribute.values.map((value) => (
                      <ValueChip
                        key={value.id}
                        value={value}
                        busy={busy}
                        isEditing={isEditing("value", value.id)}
                        draft={draft}
                        onDraftChange={setDraft}
                        onStartEdit={() => startEdit("value", value.id, value.value)}
                        onCancelEdit={cancelEdit}
                        onCommitEdit={commitEdit}
                        onDelete={() =>
                          setPending({
                            kind: "value",
                            id: value.id,
                            name: value.value,
                            productCount: value.productCount,
                          })
                        }
                      />
                    ))}
                  </div>

                  {newValueFor === attribute.id ? (
                    <form
                      onSubmit={async (event) => {
                        event.preventDefault()
                        if (!newValue.trim()) return
                        await run(() => createAttributeValue(attribute.id, newValue), () => {
                          setNewValue("")
                          setNewValueFor(null)
                        })
                      }}
                      className="mt-3 flex gap-2"
                    >
                      <Input
                        value={newValue}
                        onChange={(event) => setNewValue(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") {
                            setNewValueFor(null)
                            setNewValue("")
                          }
                        }}
                        placeholder={`Nilai baru untuk ${attribute.name}`}
                        autoFocus
                        maxLength={191}
                        className="h-9 flex-1"
                      />
                      <Button type="submit" size="sm" disabled={busy || !newValue.trim()}>
                        Tambah
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setNewValueFor(null)
                          setNewValue("")
                        }}
                        disabled={busy}
                      >
                        Batal
                      </Button>
                    </form>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setNewValueFor(attribute.id)
                        setNewValue("")
                      }}
                      disabled={busy}
                      className="mt-3 gap-1"
                    >
                      <Plus className="h-4 w-4" />
                      Tambah Nilai
                    </Button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null)
        }}
        destructive
        confirmLabel="Hapus"
        title={
          pending?.kind === "attribute"
            ? `Hapus atribut "${pending.name}"?`
            : `Hapus nilai "${pending?.name}"?`
        }
        description={
          pending?.kind === "attribute"
            ? `Seluruh nilai di dalamnya ikut terhapus${
                pending.productCount > 0
                  ? `, dan atribut ini akan dilepas dari ${pending.productCount} produk`
                  : ""
              }. Tindakan ini tidak bisa dibatalkan.`
            : `Nilai ini akan dilepas dari ${pending?.productCount ?? 0} produk yang memakainya. Tindakan ini tidak bisa dibatalkan.`
        }
        onConfirm={confirmDelete}
      />

      {busy && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Menyimpan…
        </p>
      )}
    </div>
  )
}

function ValueChip({
  value,
  busy,
  isEditing,
  draft,
  onDraftChange,
  onStartEdit,
  onCancelEdit,
  onCommitEdit,
  onDelete,
}: {
  value: AttributeValueRow
  busy: boolean
  isEditing: boolean
  draft: string
  onDraftChange: (value: string) => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onCommitEdit: () => void
  onDelete: () => void
}) {
  if (isEditing) {
    return (
      <span className="flex items-center gap-1 rounded-full border border-primary bg-background px-2 py-1">
        <Input
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              onCommitEdit()
            }
            if (event.key === "Escape") onCancelEdit()
          }}
          autoFocus
          maxLength={191}
          className="h-6 w-36 border-0 px-1 py-0 text-sm shadow-none focus-visible:ring-0"
        />
        <button
          type="button"
          onClick={onCommitEdit}
          disabled={busy || !draft.trim()}
          aria-label="Simpan"
          className="cursor-pointer text-primary disabled:opacity-40"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onCancelEdit}
          disabled={busy}
          aria-label="Batal"
          className="cursor-pointer text-muted-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </span>
    )
  }

  return (
    <span className="group flex items-center gap-1.5 rounded-full border border-border bg-background py-1 pl-3 pr-1.5 text-sm">
      {value.value}
      <span className="text-[10px] tabular-nums text-muted-foreground">({value.productCount})</span>

      <button
        type="button"
        onClick={onStartEdit}
        disabled={busy}
        aria-label={`Ubah nilai ${value.value}`}
        className="cursor-pointer rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Pencil className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={busy}
        aria-label={`Hapus nilai ${value.value}`}
        className="cursor-pointer rounded-full p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </span>
  )
}
