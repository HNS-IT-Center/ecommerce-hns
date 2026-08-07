"use client"

import { useState } from "react"
import { useBuilderStore, BuilderSlotId } from "@/store/builder"
import { formatRupiah } from "@/lib/utils"
import { Trash2, MessageCircle, Printer, Plus, AlertCircle, ShoppingBag } from "lucide-react"
import Image from "next/image"
import { ComponentSelectionModal } from "./component-selection-modal"
import { prepareBuildWhatsApp } from "../actions-whatsapp"

/**
 * Nomor WhatsApp tidak lagi dioper: tujuan dan harga sama-sama dibaca di server.
 */
export function BuilderView() {
  const { slots, removeItem, getTotalPrice } = useBuilderStore()
  const [sendingWA, setSendingWA] = useState(false)
  
  // Modal state
  const [activeSlot, setActiveSlot] = useState<BuilderSlotId | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const openModal = (slotId: BuilderSlotId) => {
    setActiveSlot(slotId)
    setIsModalOpen(true)
  }

  const handlePrint = () => {
    window.print()
  }

  /**
   * Pesan disusun di server, dari harga katalog — sama seperti
   * `dynamic-builder-view.tsx`.
   *
   * Sebelumnya dirangkai di sini dari `slot.selectedItem.price` dan
   * `getTotalPrice()`, yang berasal dari `hns-builder-storage` di localStorage.
   * Lihat CLAUDE.md §2.7.
   */
  const handleCheckoutWA = async () => {
    if (sendingWA) return

    const lines = Object.values(slots)
      .filter((slot) => slot.selectedItem !== null)
      .map((slot) => ({
        productId: Number(slot.selectedItem!.id),
        quantity: 1,
        stepName: slot.title,
      }))

    if (lines.length === 0) return

    setSendingWA(true)
    try {
      const hasil = await prepareBuildWhatsApp(lines)
      if (hasil.ok) window.open(hasil.waUrl, "_blank", "noopener,noreferrer")
    } finally {
      setSendingWA(false)
    }
  }

  const slotEntries = Object.values(slots)
  const selectedCount = slotEntries.filter(s => s.selectedItem !== null).length
  const isReady = selectedCount >= 6 // Basic assumption: CPU, Mobo, RAM, VGA, Storage, PSU selected

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl print:text-black">
          PC Builder Custom
        </h1>
        <p className="mt-2 text-muted-foreground print:hidden">
          Pilih komponen PC Anda. Sistem kami akan menampilkan estimasi harga secara real-time.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Left: Component Slots (70%) */}
        <div className="lg:col-span-8">
          <div className="rounded-xl border bg-card shadow-sm print:border-none print:shadow-none">
            <div className="divide-y print:divide-black/20">
              {slotEntries.map((slot, index) => (
                <div key={slot.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-6 print:p-2 print:border-b">
                  {/* Step Number & Title */}
                  <div className="flex w-full shrink-0 items-center gap-3 sm:w-1/3 print:w-1/4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted font-bold text-muted-foreground print:hidden">
                      {index + 1}
                    </div>
                    <h3 className="font-semibold text-foreground print:text-sm">
                      {slot.title}
                    </h3>
                  </div>

                  {/* Selected Item or Placeholder */}
                  <div className="flex flex-1 items-center justify-between gap-4">
                    {slot.selectedItem ? (
                      <div className="flex flex-1 items-center gap-4">
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border bg-muted print:hidden">
                          {slot.selectedItem.image ? (
                            <Image
                              src={slot.selectedItem.image}
                              alt={slot.selectedItem.name}
                              fill
                              // Wadahnya tetap 64px (h-16 w-16) di semua layar.
                              sizes="64px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <ShoppingBag className="h-6 w-6 text-muted-foreground/30" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="line-clamp-2 text-sm font-medium print:text-xs print:line-clamp-none">
                            {slot.selectedItem.name}
                          </p>
                          <p className="mt-1 text-sm font-bold text-foreground print:text-xs">
                            {formatRupiah(slot.selectedItem.price)}
                          </p>
                        </div>
                        <button
                          onClick={() => removeItem(slot.id)}
                          className="p-2 text-muted-foreground hover:text-sale-red print:hidden"
                          title="Hapus komponen"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-1 items-center justify-between gap-4 rounded-lg border border-dashed p-3 print:hidden">
                        <span className="text-sm text-muted-foreground italic">
                          Belum dipilih
                        </span>
                        <button
                          onClick={() => openModal(slot.id)}
                          className="flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-foreground/90"
                        >
                          <Plus className="h-4 w-4" />
                          Pilih
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Summary (30%) */}
        <div className="lg:col-span-4">
          <div className="sticky top-24 rounded-xl border bg-card p-6 shadow-sm print:border-none print:shadow-none print:p-0 print:mt-8">
            <h2 className="text-xl font-bold print:text-lg">Estimasi Harga</h2>
            
            <div className="mt-6 flex justify-between items-baseline border-b pb-6 print:pb-2">
              <span className="font-semibold text-muted-foreground print:text-black">Total</span>
              <span className="text-3xl font-extrabold text-sale-red print:text-xl print:text-black">
                {formatRupiah(getTotalPrice())}
              </span>
            </div>

            <div className="mt-6 space-y-3 print:hidden">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Komponen Terpilih</span>
                <span className="font-medium">{selectedCount} / {slotEntries.length}</span>
              </div>

              {!isReady && (
                <div className="flex items-start gap-2 rounded-lg bg-yellow-500/10 p-3 text-sm text-yellow-600 dark:text-yellow-500">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>Silakan lengkapi komponen dasar (CPU, Mobo, RAM, VGA, Storage, PSU) sebelum melakukan checkout.</p>
                </div>
              )}
            </div>

            <div className="mt-8 flex flex-col gap-3 print:hidden">
              <button
                onClick={handlePrint}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-input bg-background font-bold transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <Printer className="h-5 w-5" />
                Cetak / Simpan PDF
              </button>
              <button
                onClick={handleCheckoutWA}
                disabled={!isReady}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] font-bold text-white shadow-lg shadow-[#25D366]/20 transition-colors hover:bg-[#25D366]/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <MessageCircle className="h-5 w-5" />
                Lanjut WA / Konsultasi
              </button>
            </div>
          </div>
        </div>
      </div>

      {activeSlot && (
        <ComponentSelectionModal
          key={activeSlot}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          slot={slots[activeSlot]}
        />
      )}
    </>
  )
}
