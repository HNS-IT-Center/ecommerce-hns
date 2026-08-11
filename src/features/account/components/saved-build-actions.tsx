"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Loader2, RefreshCw, Trash2, Wrench } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useToastManager } from "@/components/ui/toast"
import { useNewBuilderStore } from "@/store/new-builder"
import {
  deleteSavedBuildAction,
  loadSavedBuildForBuilderAction,
  refreshBuildPricesAction,
} from "@/features/builder/actions-save"

export function SavedBuildActions({ buildId, hasPriceChanges }: { buildId: string; hasPriceChanges: boolean }) {
  const router = useRouter()
  const toastManager = useToastManager()
  const hydrateSelections = useNewBuilderStore((s) => s.hydrateSelections)
  const [loadingBuilder, setLoadingBuilder] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const handleContinueInBuilder = async () => {
    if (loadingBuilder) return
    setLoadingBuilder(true)

    const selections = await loadSavedBuildForBuilderAction(buildId)
    setLoadingBuilder(false)

    if (!selections || Object.keys(selections).length === 0) {
      toastManager.add({
        title: "Tidak bisa dimuat",
        description: "Semua komponen di rakitan ini sudah tidak tersedia.",
      })
      return
    }

    hydrateSelections(selections)
    router.push("/build-pc")
  }

  const handleDelete = async () => {
    if (deleting) return
    if (!window.confirm("Hapus rakitan ini? Tindakan ini tidak bisa dibatalkan.")) return

    setDeleting(true)
    const result = await deleteSavedBuildAction(buildId)
    setDeleting(false)

    if (!result.ok) {
      toastManager.add({ title: "Gagal menghapus", description: "Coba lagi sebentar lagi." })
      return
    }

    router.push("/akun")
    router.refresh()
  }

  const handleRefreshPrices = async () => {
    if (refreshing) return
    setRefreshing(true)
    const result = await refreshBuildPricesAction(buildId)
    setRefreshing(false)

    if (!result.ok) {
      toastManager.add({ title: "Gagal memperbarui", description: "Coba lagi sebentar lagi." })
      return
    }

    toastManager.add({
      title: "Harga acuan diperbarui",
      description: "Perbandingan sekarang dihitung dari harga saat ini.",
      data: { variant: "success" },
    })
    router.refresh()
  }

  return (
    <div className="flex flex-wrap gap-2">
      {hasPriceChanges && (
        <button
          onClick={handleRefreshPrices}
          disabled={refreshing}
          className="flex items-center justify-center gap-2 rounded-xl border border-input px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted disabled:opacity-60"
        >
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Perbarui Harga Acuan
        </button>
      )}
      <Button onClick={handleContinueInBuilder} disabled={loadingBuilder}>
        {loadingBuilder ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
        Lanjutkan di Builder
      </Button>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="flex items-center justify-center gap-2 rounded-xl border border-input px-4 py-2 text-sm font-semibold transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive disabled:opacity-60"
      >
        <Trash2 className="h-4 w-4" />
        Hapus
      </button>
    </div>
  )
}
