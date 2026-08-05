"use client"

import * as React from "react"
import { Check, ExternalLink, Loader2, Palette } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { PRESET_THEMES } from "@/lib/theme/presets"
import { themeToStyle } from "@/lib/theme/css"
import type { Theme, ThemeSettings } from "@/lib/theme/types"
import { applyTheme, type ThemeScope } from "./actions"
import { ChromePreview } from "./chrome-preview"
import { CardPreview } from "./card-preview"

type Props = { settings: ThemeSettings }

/**
 * Kotak warna kecil sebagai ringkasan visual sebuah preset.
 *
 * Tema yang tidak mengubah warna sama sekali (mis. Natal, yang kemeriahannya
 * datang dari aset hiasan dan bukan dari pengecatan latar) tetap perlu ringkasan
 * — dipakai warna hiasannya supaya barisnya tidak terlihat kosong seperti gagal
 * render.
 */
const DECOR_SWATCHES: Record<string, string[]> = {
  christmas: ["#c1121f", "#0b6b4f", "#c9992e"],
}

function ThemeSwatches({ theme, scope }: { theme: Theme; scope: ThemeScope }) {
  const surface = scope === "chrome" ? theme.tokens.chrome : theme.tokens.card
  const colors = (
    [
      surface?.bg,
      surface?.fg,
      surface?.accent,
      scope === "card" ? theme.tokens.cardBadgeSale : surface?.border,
    ].filter(Boolean) as string[]
  ).concat(surface ? [] : DECOR_SWATCHES[theme.id] ?? [])

  if (colors.length === 0) {
    return (
      <div className="flex h-5 w-5 items-center justify-center rounded-full border border-border">
        <Palette className="h-3 w-3 text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex gap-1">
      {colors.map((color, i) => (
        <span
          key={i}
          className="h-5 w-5 rounded-full border border-black/10"
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  )
}

function ThemePanel({
  scope,
  activeId,
  onApplied,
}: {
  scope: ThemeScope
  activeId: string
  onApplied: (id: string) => void
}) {
  // Tema yang sedang dilihat di pratinjau — belum tentu yang aktif.
  const [selectedId, setSelectedId] = React.useState(activeId)
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [isApplying, setIsApplying] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const selected = PRESET_THEMES.find((t) => t.id === selectedId) ?? PRESET_THEMES[0]
  const isDirty = selectedId !== activeId

  async function handleApply() {
    setIsApplying(true)
    setError(null)
    try {
      const result = await applyTheme(scope, selectedId)
      if (result.success) {
        onApplied(selectedId)
      } else {
        setError(result.error)
      }
    } catch {
      setError("Gagal menyimpan tema. Coba lagi.")
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_420px]">
      {/* --- Daftar preset --- */}
      <div className="space-y-2">
        {PRESET_THEMES.map((theme) => {
          const isActive = theme.id === activeId
          const isSelected = theme.id === selectedId

          return (
            <button
              key={theme.id}
              onClick={() => setSelectedId(theme.id)}
              className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <ThemeSwatches theme={theme} scope={scope} />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold">{theme.name}</span>
                  {isActive && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-green/10 px-2 py-0.5 text-[10px] font-bold text-brand-green">
                      <Check className="h-3 w-3" />
                      Sedang aktif
                    </span>
                  )}
                </div>
                {theme.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{theme.description}</p>
                )}
              </div>
            </button>
          )
        })}

        {/* Penanda fitur iterasi berikutnya. Dinonaktifkan, bukan disembunyikan,
            supaya arah pengembangannya terlihat. */}
        <button
          disabled
          className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border p-3 text-left opacity-60"
        >
          <div className="flex h-5 w-5 items-center justify-center rounded-full border border-border">
            <Palette className="h-3 w-3 text-muted-foreground" />
          </div>
          <div>
            <span className="text-sm font-bold">Tambah Tema Baru</span>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Racik warna sendiri — segera hadir.
            </p>
          </div>
        </button>
      </div>

      {/* --- Pratinjau --- */}
      <div className="space-y-3">
        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Pratinjau
            </h3>
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              Buka toko
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/*
            Wrapper ber-scope dengan variabel di-set inline — mekanisme yang
            SAMA PERSIS dengan produksi (lihat root layout). Karena itu, yang
            terlihat di kotak ini benar-benar mewakili hasil akhirnya, dan
            tampilan panel admin di sekitarnya tidak ikut terpengaruh.
          */}
          <div
            className={scope === "chrome" ? "theme-chrome" : "theme-card"}
            style={themeToStyle(selected, scope)}
          >
            {scope === "chrome" ? (
              <ChromePreview themeId={selected.id} />
            ) : (
              <CardPreview />
            )}
          </div>
        </div>

        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            {error}
          </p>
        )}

        <Button
          className="w-full"
          disabled={!isDirty || isApplying}
          onClick={() => setConfirmOpen(true)}
        >
          {isApplying && <Loader2 className="h-4 w-4 animate-spin" />}
          {isDirty ? `Terapkan "${selected.name}"` : "Tema ini sedang aktif"}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Terapkan tema "${selected.name}"?`}
        description="Tema akan langsung tampil untuk semua pengunjung toko."
        confirmLabel="Terapkan"
        onConfirm={handleApply}
      />
    </div>
  )
}

export function ThemeEditor({ settings }: Props) {
  // Disalin ke state supaya penanda "Sedang aktif" berpindah seketika setelah
  // action berhasil, tanpa menunggu router refresh.
  const [chromeId, setChromeId] = React.useState(settings.activeChromeThemeId)
  const [cardId, setCardId] = React.useState(settings.activeCardThemeId)

  return (
    <Tabs defaultValue="chrome" className="space-y-6">
      <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
        <TabsTrigger value="chrome">Header &amp; Footer</TabsTrigger>
        <TabsTrigger value="card">Frame Produk</TabsTrigger>
      </TabsList>

      <TabsContent value="chrome">
        <ThemePanel scope="chrome" activeId={chromeId} onApplied={setChromeId} />
      </TabsContent>

      <TabsContent value="card">
        <ThemePanel scope="card" activeId={cardId} onApplied={setCardId} />
      </TabsContent>
    </Tabs>
  )
}
