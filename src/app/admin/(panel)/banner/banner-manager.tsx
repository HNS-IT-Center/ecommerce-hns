"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Images, Layers, Plus } from "lucide-react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
// Hanya TIPE — lihat catatan di `banner-list.tsx`.
import type { BannerWithBatch } from "@/lib/api/banners"
import type { BatchRow } from "@/lib/api/banner-batches"

import { BannerList } from "./banner-list"
import { BatchPanel } from "./batch-panel"
import { BatchFormDialog } from "./batch-form-dialog"

type BannerManagerProps = {
  banners: BannerWithBatch[]
  batches: BatchRow[]
}

/** Formulir kampanye yang sedang terbuka. */
type DialogState = { mode: "closed" } | { mode: "create" } | { mode: "edit"; batch: BatchRow }

/**
 * Dua tab: daftar banner dan daftar kampanye penaungnya.
 *
 * Tab yang aktif disimpan di `?tab=` — bukan state biasa. Setiap aksi di dalam
 * panel kampanye memanggil `router.refresh()` setelah server action berhasil,
 * dan tanpa penanda di URL, refresh itu melempar admin kembali ke tab banner
 * tiap kali mereka menyunting kampanye. Pola yang sama dipakai
 * `atribut-brand/taxonomy-manager.tsx`.
 */
export function BannerManager({ banners, batches }: BannerManagerProps) {
  const router = useRouter()

  const [tab, setTab] = React.useState<string>(() => {
    if (typeof window === "undefined") return "banner"
    return new URLSearchParams(window.location.search).get("tab") === "batch"
      ? "batch"
      : "banner"
  })
  const [dialog, setDialog] = React.useState<DialogState>({ mode: "closed" })

  function handleTabChange(next: string) {
    setTab(next)
    // `replaceState`, bukan navigasi Next: hanya menandai tab yang sedang
    // dibuka. Memakai router akan memicu render ulang server untuk sesuatu
    // yang murni tampilan.
    const url = new URL(window.location.href)
    url.searchParams.set("tab", next)
    window.history.replaceState(null, "", url)
  }

  function handleSaved() {
    // Daftar kampanye dirender di server; `refresh` yang menariknya ulang
    // berikut jumlah anggotanya, yang tidak bisa dihitung dari sini.
    setDialog({ mode: "closed" })
    router.refresh()
  }

  return (
    <>
      <Tabs value={tab} onValueChange={handleTabChange}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="banner" className="gap-2">
              <Images className="h-4 w-4" />
              Banner
              <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums">
                {banners.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="batch" className="gap-2">
              <Layers className="h-4 w-4" />
              Batch Kampanye
              <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums">
                {batches.length}
              </span>
            </TabsTrigger>
          </TabsList>

          {tab === "banner" ? (
            <Button render={<Link href="/admin/banner/baru" />} nativeButton={false}>
              <Plus className="h-4 w-4" />
              Tambah Banner
            </Button>
          ) : (
            <Button onClick={() => setDialog({ mode: "create" })}>
              <Plus className="h-4 w-4" />
              Tambah Kampanye
            </Button>
          )}
        </div>

        <TabsContent value="banner" className="mt-6">
          <BannerList banners={banners} />
        </TabsContent>

        <TabsContent value="batch" className="mt-6">
          <BatchPanel batches={batches} onEdit={(batch) => setDialog({ mode: "edit", batch })} />
        </TabsContent>
      </Tabs>

      {/* `key` memaksa isian formulir dibangun ulang tiap kali kampanye yang
          disunting berganti — lihat catatan di `batch-form-dialog.tsx`. */}
      <BatchFormDialog
        key={dialog.mode === "edit" ? dialog.batch.id : "create"}
        open={dialog.mode !== "closed"}
        onOpenChange={(open) => {
          if (!open) setDialog({ mode: "closed" })
        }}
        batch={dialog.mode === "edit" ? dialog.batch : null}
        onSaved={handleSaved}
      />
    </>
  )
}
