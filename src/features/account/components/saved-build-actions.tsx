"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Loader2, RefreshCw, Trash2, Wrench } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { useToastManager } from "@/components/ui/toast"
import { deleteSavedBuildAction, refreshBuildPricesAction } from "@/features/builder/actions-save"

export function SavedBuildActions({ buildId, hasPriceChanges }: { buildId: string; hasPriceChanges: boolean }) {
  const router = useRouter()
  const toastManager = useToastManager()
  const [deleting, setDeleting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

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

    router.push("/profile")
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
      {/*
        Tautan biasa ke `/build-pc?build=<id>`, BUKAN lagi tombol yang memuat
        isinya lewat server action lalu mendorongnya ke store Zustand.

        Bedanya bukan sekadar cara: dengan jalur lama, builder menerima daftar
        komponen tanpa tahu rakitan MANA asalnya, sehingga satu-satunya cara
        menyimpan adalah membuat baris baru — mengedit rakitan sendiri selalu
        melahirkan salinan. Id yang ikut di URL-lah yang membuat "Simpan
        Perubahan" punya sasaran, dan yang membuat Mode Edit selamat dari
        refresh halaman.

        Kepemilikan tetap diperiksa di server (`getSavedBuildForBuilder`), jadi
        id di URL bukan kunci apa-apa buat orang lain.
      */}
      <Link href={`/build-pc?build=${encodeURIComponent(buildId)}`} className={buttonVariants()}>
        <Wrench className="h-4 w-4" />
        Lanjutkan di Builder
      </Link>
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
