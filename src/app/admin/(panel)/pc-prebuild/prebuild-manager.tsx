"use client"

import { useState, useTransition } from "react"
import { EyeOff, Gamepad2, Package, Plus, Save, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { ComboboxOption } from "@/components/ui/combobox"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { PcBuilderStepConfig } from "@/lib/pc-builder/config"
import type { PrebuildGame } from "@/lib/pc-prebuild/games"
// TIPE dari config.ts aman karena terhapus saat kompilasi; mengimpor NILAI dari
// berkas itu akan menyeret getPrisma() ke bundle browser dan menggagalkan build.
import type {
  PcPrebuildConfig,
  PcPrebuildOption,
  PcPrebuildPreset,
} from "@/lib/pc-prebuild/config"

import { savePcPrebuildConfig } from "./actions"
import { GamesManager } from "./_components/games-manager"
import { PresetCard } from "./_components/preset-card"

type PilihanAwal = Record<string, ComboboxOption[]>

type Props = {
  initialConfig: PcPrebuildConfig
  steps: PcBuilderStepConfig[]
  /** Saran produk awal per stepId, dimuat di server supaya daftarnya tidak kosong saat dibuka. */
  initialOptions: PilihanAwal
  /** Nama produk yang sudah dipakai preset, supaya pickernya menampilkan pilihan tersimpan. */
  productNames: Record<number, string>
  /** Harga katalog produk yang sudah terpakai. Keterangan layar saja — tidak ikut tersimpan. */
  productPrices: Record<number, number>
  /** Daftar game untuk grid FPS — dipakai editor performa dan tab "Daftar Game". */
  games: PrebuildGame[]
}

function idBaru(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `preset-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function PrebuildManager({
  initialConfig,
  steps,
  initialOptions,
  productNames,
  productPrices,
  games,
}: Props) {
  const [enabled, setEnabled] = useState(initialConfig.enabled)
  const [presets, setPresets] = useState<PcPrebuildPreset[]>(initialConfig.presets)
  const [openId, setOpenId] = useState<string | null>(initialConfig.presets[0]?.id ?? null)
  const [nama, setNama] = useState<Record<number, string>>(productNames)
  const [harga, setHarga] = useState<Record<number, number>>(productPrices)
  const [flash, setFlash] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function ubahPreset(id: string, patch: Partial<PcPrebuildPreset>) {
    setPresets((lama) => lama.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  function tambahPreset() {
    const preset: PcPrebuildPreset = {
      id: idBaru(),
      name: "Paket baru",
      summary: "",
      images: [],
      order: presets.length,
      slots: [],
    }
    setPresets((lama) => [...lama, preset])
    setOpenId(preset.id)
  }

  function hapusPreset(id: string) {
    setPresets((lama) => lama.filter((p) => p.id !== id).map((p, i) => ({ ...p, order: i })))
    if (openId === id) setOpenId(null)
  }

  function geser(index: number, arah: -1 | 1) {
    const tujuan = index + arah
    if (tujuan < 0 || tujuan >= presets.length) return
    setPresets((lama) => {
      const salinan = [...lama]
      const [diambil] = salinan.splice(index, 1)
      salinan.splice(tujuan, 0, diambil)
      return salinan.map((p, i) => ({ ...p, order: i }))
    })
  }

  /** Ubah daftar pilihan satu slot. Daftar kosong = slotnya dibuang. */
  function ubahSlot(presetId: string, stepId: string, options: PcPrebuildOption[]) {
    setPresets((lama) =>
      lama.map((preset) => {
        if (preset.id !== presetId) return preset

        if (options.length === 0) {
          return { ...preset, slots: preset.slots.filter((slot) => slot.stepId !== stepId) }
        }

        const ada = preset.slots.some((slot) => slot.stepId === stepId)
        return ada
          ? {
              ...preset,
              slots: preset.slots.map((slot) =>
                slot.stepId === stepId ? { ...slot, options } : slot
              ),
            }
          : { ...preset, slots: [...preset.slots, { stepId, options }] }
      })
    )
  }

  /**
   * Berapa paket ini jatuhnya.
   *
   * `termurah` dipakai untuk paket yang punya komponen berpilihan — pelanggan
   * melihat "mulai dari", jadi staff perlu melihat angka yang sama.
   *
   * `lengkap: false` berarti ada komponen yang harganya belum diketahui layar
   * ini (produk baru dipilih dan daftarnya belum memuat harganya). Angkanya
   * ditandai, bukan disembunyikan — staff tetap butuh perkiraan.
   */
  function hitung(preset: PcPrebuildPreset, termurah: boolean) {
    let total = 0
    let lengkap = true

    for (const slot of preset.slots) {
      const kandidat = termurah ? slot.options : slot.options.slice(0, 1)
      const angka = kandidat
        .map((o) => (harga[o.productId] === undefined ? null : harga[o.productId] * o.quantity))
        .filter((n): n is number => n !== null)

      if (angka.length === 0) {
        lengkap = false
        continue
      }
      total += termurah ? Math.min(...angka) : angka[0]
    }

    return { total, lengkap }
  }

  function simpan() {
    setFlash(null)
    startTransition(async () => {
      const hasil = await savePcPrebuildConfig({
        enabled,
        presets: presets.map((p, i) => ({ ...p, order: i })),
      })
      setFlash(hasil.success ? `Tersimpan — ${hasil.presets} paket.` : "Gagal menyimpan.")
    })
  }

  const jumlahTayang = presets.filter((p) => p.performance?.published).length
  // Analisis yang sudah dihitung tapi sakelarnya masih mati. Dihitung di sini
  // supaya jumlahnya terlihat tanpa membuka satu per satu — inilah keadaan yang
  // membuat panel performa "hilang" di halaman paket padahal datanya ada.
  const jumlahDraf = presets.filter((p) => p.performance && !p.performance.published).length

  return (
    <Tabs defaultValue="paket">
      <TabsList>
        <TabsTrigger value="paket" className="gap-2">
          <Package className="h-4 w-4" />
          Paket
          <span className="ml-1 rounded-full bg-background px-2 py-0.5 text-[11px] font-semibold tabular-nums">
            {presets.length}
          </span>
        </TabsTrigger>
        <TabsTrigger value="game" className="gap-2">
          <Gamepad2 className="h-4 w-4" />
          Daftar Game
          <span className="ml-1 rounded-full bg-background px-2 py-0.5 text-[11px] font-semibold tabular-nums">
            {games.length}
          </span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="paket" className="mt-6 space-y-4">
        {/* Sakelar. Mematikan BUKAN menghapus: presetnya tetap tersimpan, hanya
            rute publiknya yang ditutup — pola yang sama dipakai
            REGISTER_MANUAL_ENABLED. */}
        <label className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3 shadow-sm">
          <span className="min-w-0">
            <span className="block text-sm font-bold">Tampilkan di situs</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Saat mati, <code className="text-[11px]">/pc-prebuild</code> melempar ke{" "}
              <code className="text-[11px]">/build-pc</code>. Paket di bawah tetap tersimpan.
            </span>
          </span>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </label>

        {steps.length === 0 && (
          <p className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            Belum ada langkah di PC Builder. Atur dulu di /admin/pc-builder — paket di sini
            menumpang langkah yang sama.
          </p>
        )}

        {presets.length === 0 ? (
          <p className="rounded-2xl border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
            Belum ada paket. Tambahkan satu, lalu pilih komponennya per langkah.
          </p>
        ) : (
          <div className="space-y-3">
            {presets.map((preset, index) => (
              <PresetCard
                key={preset.id}
                preset={preset}
                index={index}
                jumlahPreset={presets.length}
                terbuka={openId === preset.id}
                onToggle={() => setOpenId(openId === preset.id ? null : preset.id)}
                steps={steps}
                initialOptions={initialOptions}
                games={games}
                namaProduk={nama}
                hargaProduk={harga}
                onNamaProduk={(id, label) => setNama((l) => ({ ...l, [id]: label }))}
                onHargaProduk={(peta) => setHarga((l) => ({ ...l, ...peta }))}
                hitung={hitung}
                onUbah={(patch) => ubahPreset(preset.id, patch)}
                onUbahSlot={(stepId, opts) => ubahSlot(preset.id, stepId, opts)}
                onHapus={() => hapusPreset(preset.id)}
                onGeser={(arah) => geser(index, arah)}
              />
            ))}
          </div>
        )}

        {/* Baris aksi menempel di bawah layar: paket yang terbuka bisa jauh
            lebih tinggi dari satu layar — terutama setelah panel performa ikut
            di dalamnya — dan tombol simpan yang ikut tergulir ke bawah membuat
            perubahan gampang ditinggalkan tanpa disimpan. */}
        <div className="sticky bottom-4 flex flex-wrap items-center gap-2 rounded-2xl border bg-card/95 p-3 shadow-lg backdrop-blur">
          <Button type="button" variant="outline" onClick={tambahPreset}>
            <Plus className="h-4 w-4" />
            Tambah paket
          </Button>
          <Button type="button" onClick={simpan} disabled={pending}>
            <Save className="h-4 w-4" />
            {pending ? "Menyimpan…" : "Simpan"}
          </Button>

          {jumlahDraf > 0 && (
            <span className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary">
              <EyeOff className="h-3.5 w-3.5" />
              {jumlahDraf} analisis performa masih draf — belum dilihat pelanggan
            </span>
          )}
          {jumlahTayang > 0 && (
            <span className="text-xs text-muted-foreground">
              {jumlahTayang} paket menayangkan panel performa.
            </span>
          )}
          {flash && <span className="text-sm text-muted-foreground">{flash}</span>}
        </div>
      </TabsContent>

      <TabsContent value="game" className="mt-6">
        <GamesManager initialGames={games} />
      </TabsContent>
    </Tabs>
  )
}
