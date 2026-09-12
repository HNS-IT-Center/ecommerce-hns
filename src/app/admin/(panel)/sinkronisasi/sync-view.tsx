"use client"

import { useState } from "react"
import { AlertTriangle, CheckCircle2, PackagePlus, RefreshCw, ShieldAlert, Tag } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatRupiah } from "@/lib/utils"
import type {
  ApplyPriceResult,
  ImportResult,
  NewProduct,
  PriceChange,
  SyncConflict,
  SyncPreviewResult,
} from "@/lib/api/woocommerce/sync/types"

type ScanMode = "penuh" | "sejak"

type Phase =
  | { name: "idle" }
  | { name: "memuat" }
  | { name: "selesai"; plan: SyncPreviewResult }
  | { name: "galat"; message: string }

type ImportPhase =
  | { name: "idle" }
  | { name: "mengimpor" }
  | { name: "selesai"; result: ImportResult }
  | { name: "galat"; message: string }

type ApplyPhase =
  | { name: "idle" }
  | { name: "menerapkan" }
  | { name: "selesai"; result: ApplyPriceResult }
  | { name: "galat"; message: string }

/** `YYYY-MM-DD` untuk isian tanggal, default seminggu ke belakang. */
function defaultSince(): string {
  const date = new Date()
  date.setDate(date.getDate() - 7)
  return date.toISOString().slice(0, 10)
}

function harga(value: number | null): string {
  return value === null ? "—" : formatRupiah(value)
}

function waktu(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })
}

/** Pesan galat dari respons JSON, tanpa mempercayai bentuknya. */
function pesanGalat(body: unknown, bawaan: string): string {
  if (typeof body === "object" && body !== null) {
    const error = (body as { error?: unknown }).error
    if (typeof error === "string" && error.trim() !== "") return error
  }
  return bawaan
}

function Kosong({ pesan }: { pesan: string }) {
  return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{pesan}</p>
}

function Hitungan({ nilai }: { nilai: number }) {
  return (
    <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums">
      {nilai}
    </span>
  )
}

function BarisHargaItem({
  item,
  dipilih,
  onToggle,
  terkunci,
}: {
  item: PriceChange
  dipilih: boolean
  onToggle: () => void
  terkunci: boolean
}) {
  return (
    <li className="rounded-lg border p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <Checkbox
          checked={dipilih}
          onCheckedChange={onToggle}
          disabled={terkunci}
          className="mt-1"
          aria-label={`Pilih ${item.name}`}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="min-w-0 flex-1 text-sm font-medium break-words">{item.name}</p>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">#{item.wooId}</span>
          </div>

          {item.editedInPanel && (
            <Badge variant="outline" className="mt-2 border-amber-500/50 text-amber-700 dark:text-amber-400">
              <AlertTriangle />
              Pernah disunting di panel
            </Badge>
          )}

          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <div className="flex items-center justify-between gap-3 sm:justify-start">
              <dt className="text-muted-foreground">Harga normal</dt>
              <dd className="tabular-nums">
                <span className="text-muted-foreground line-through">{harga(item.local.regularPrice)}</span>
                <span className="mx-1.5">→</span>
                <span className="font-semibold">{harga(item.remote.regularPrice)}</span>
              </dd>
            </div>
            {(item.local.salePrice !== null || item.remote.salePrice !== null) && (
              <div className="flex items-center justify-between gap-3 sm:justify-start">
                <dt className="text-muted-foreground">Harga obral</dt>
                <dd className="tabular-nums">
                  <span className="text-muted-foreground line-through">{harga(item.local.salePrice)}</span>
                  <span className="mx-1.5">→</span>
                  <span className="font-semibold">{harga(item.remote.salePrice)}</span>
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </li>
  )
}

function BarisProdukBaru({
  item,
  dipilih,
  onToggle,
  terkunci,
}: {
  item: NewProduct
  dipilih: boolean
  onToggle: () => void
  terkunci: boolean
}) {
  return (
    <li className="rounded-lg border p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <Checkbox
          checked={dipilih}
          onCheckedChange={onToggle}
          disabled={terkunci}
          className="mt-1"
          aria-label={`Pilih ${item.name}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="min-w-0 flex-1 text-sm font-medium break-words">{item.name}</p>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">#{item.wooId}</span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{item.type}</Badge>
            <Badge variant="secondary">{item.status}</Badge>
            {item.variationCount > 0 && <Badge variant="secondary">{item.variationCount} varian</Badge>}
            {item.matchedCategory ? (
              <Badge variant="outline">{item.matchedCategory}</Badge>
            ) : (
              <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-400">
                <AlertTriangle />
                Kategori tidak cocok
              </Badge>
            )}
          </div>

          <p className="mt-2 text-sm tabular-nums">
            {harga(item.regularPrice)}
            {item.salePrice !== null && (
              <span className="ml-2 text-muted-foreground">obral {harga(item.salePrice)}</span>
            )}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Dibuat {waktu(item.createdAt)}</p>
        </div>
      </div>
    </li>
  )
}

function BarisKonflik({ item }: { item: SyncConflict }) {
  return (
    <li className="rounded-lg border border-destructive/40 p-3 sm:p-4">
      <p className="text-sm font-medium">Nomor #{item.wooId} dipakai dua produk berbeda</p>
      <dl className="mt-2 space-y-1 text-sm">
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-muted-foreground">Di WooCommerce:</dt>
          <dd className="break-words">{item.remoteName}</dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-muted-foreground">Di katalog kita:</dt>
          <dd className="break-words">{item.localName}</dd>
        </div>
      </dl>
    </li>
  )
}

export function SyncView() {
  const [mode, setMode] = useState<ScanMode>("penuh")
  const [since, setSince] = useState<string>(defaultSince)
  const [phase, setPhase] = useState<Phase>({ name: "idle" })

  async function periksa() {
    setPhase({ name: "memuat" })
    try {
      const response = await fetch("/api/admin/sync/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modifiedAfter: mode === "sejak" ? `${since}T00:00:00` : null }),
      })
      const body: unknown = await response.json()
      if (!response.ok) {
        setPhase({ name: "galat", message: pesanGalat(body, "Gagal menyusun pratinjau.") })
        return
      }
      setPhase({ name: "selesai", plan: body as SyncPreviewResult })
    } catch {
      setPhase({ name: "galat", message: "Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi." })
    }
  }

  const memuat = phase.name === "memuat"

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={mode === "penuh" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("penuh")}
              >
                Sapuan penuh
              </Button>
              <Button
                type="button"
                variant={mode === "sejak" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("sejak")}
              >
                Sejak tanggal
              </Button>
            </div>

            {mode === "sejak" ? (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="date"
                  value={since}
                  onChange={(event) => setSince(event.target.value)}
                  className="w-auto"
                  aria-label="Periksa perubahan sejak tanggal"
                />
                <p className="text-xs text-muted-foreground">
                  Cepat, tapi hanya melihat produk yang tersentuh sejak tanggal itu.
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Memeriksa seluruh katalog WooCommerce. Perlu belasan detik.
              </p>
            )}
          </div>

          <Button type="button" onClick={periksa} disabled={memuat}>
            <RefreshCw className={memuat ? "animate-spin" : undefined} />
            {memuat ? "Memeriksa…" : "Periksa Perubahan"}
          </Button>
        </div>
      </div>

      {phase.name === "galat" && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {phase.message}
        </div>
      )}

      {phase.name === "selesai" && (
        // `key` memaksa komponen dibangun ulang tiap pemindaian, sehingga
        // pilihan centang dan hasil penerapan sebelumnya tidak terbawa ke
        // daftar yang isinya sudah berbeda.
        <HasilPratinjau key={phase.plan.scannedAt} plan={phase.plan} onSelesaiTerapkan={periksa} />
      )}
    </div>
  )
}

function HasilPratinjau({
  plan,
  onSelesaiTerapkan,
}: {
  plan: SyncPreviewResult
  onSelesaiTerapkan: () => void
}) {
  const baru = plan.newProducts.filter((item) => item.group === "baru")
  const tertinggal = plan.newProducts.filter((item) => item.group === "tertinggal")

  // Bawaan: semua tercentang. Keputusan yang berlaku di project ini adalah
  // "harga WooCommerce yang menang", jadi mencentang satu per satu untuk
  // ratusan baris justru menambah peluang salah tekan. Yang perlu dilihat
  // staff — baris yang pernah disunting orang — ditandai kuning dan diurutkan
  // ke atas, dan konfirmasi tetap menyebut jumlahnya sebelum apa pun ditulis.
  const [dipilih, setDipilih] = useState<Set<number>>(
    () => new Set(plan.priceChanges.map((item) => item.wooId)),
  )
  const [apply, setApply] = useState<ApplyPhase>({ name: "idle" })
  const [konfirmasi, setKonfirmasi] = useState(false)

  // Berbeda dari daftar harga, import TIDAK mencentang apa pun secara bawaan.
  // Menerapkan harga mengubah baris yang sudah ada dan nilai lamanya tercatat
  // di log; import membuat ratusan baris baru sekaligus. Dua kelompoknya juga
  // memang keputusan terpisah — "baru" dan "tertinggal" — jadi masing-masing
  // punya tombol pilih sendiri.
  const [dipilihBaru, setDipilihBaru] = useState<Set<number>>(() => new Set())
  const [importPhase, setImportPhase] = useState<ImportPhase>({ name: "idle" })
  const [konfirmasiImport, setKonfirmasiImport] = useState(false)
  const importTerkunci = importPhase.name === "mengimpor" || importPhase.name === "selesai"

  const sedangMenerapkan = apply.name === "menerapkan"
  const sudahDiterapkan = apply.name === "selesai"

  function toggle(wooId: number) {
    setDipilih((sebelum) => {
      const berikut = new Set(sebelum)
      if (berikut.has(wooId)) berikut.delete(wooId)
      else berikut.add(wooId)
      return berikut
    })
  }

  function toggleBaru(wooId: number) {
    setDipilihBaru((sebelum) => {
      const berikut = new Set(sebelum)
      if (berikut.has(wooId)) berikut.delete(wooId)
      else berikut.add(wooId)
      return berikut
    })
  }

  function pilihKelompok(kelompok: NewProduct[]) {
    setDipilihBaru((sebelum) => {
      const berikut = new Set(sebelum)
      for (const item of kelompok) berikut.add(item.wooId)
      return berikut
    })
  }

  async function impor() {
    setImportPhase({ name: "mengimpor" })
    try {
      const response = await fetch("/api/admin/sync/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wooIds: [...dipilihBaru] }),
      })
      const body: unknown = await response.json()
      if (!response.ok) {
        setImportPhase({ name: "galat", message: pesanGalat(body, "Gagal mengimpor produk.") })
        return
      }
      setImportPhase({ name: "selesai", result: body as ImportResult })
    } catch {
      setImportPhase({
        name: "galat",
        message: "Tidak bisa menghubungi server. Sebagian produk mungkin sudah terlanjur masuk — periksa ulang sebelum mencoba lagi.",
      })
    }
  }

  async function terapkan() {
    setApply({ name: "menerapkan" })
    try {
      const response = await fetch("/api/admin/sync/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Hanya nomor produk. Harganya diambil ulang di server dari
        // WooCommerce — browser tidak pernah menentukan harga.
        body: JSON.stringify({ wooIds: [...dipilih] }),
      })
      const body: unknown = await response.json()
      if (!response.ok) {
        setApply({ name: "galat", message: pesanGalat(body, "Gagal menerapkan perubahan.") })
        return
      }
      setApply({ name: "selesai", result: body as ApplyPriceResult })
    } catch {
      setApply({ name: "galat", message: "Tidak bisa menghubungi server. Perubahan mungkin belum tersimpan." })
    }
  }

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Produk di WooCommerce", value: plan.remoteCount },
          { label: "Produk di katalog kita", value: plan.localCount },
          { label: "Belum ada di kita", value: plan.newProducts.length },
          { label: "Harga berbeda", value: plan.priceChanges.length },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border p-3">
            <dt className="text-xs text-muted-foreground">{item.label}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">{item.value}</dd>
          </div>
        ))}
      </dl>

      <p className="text-xs text-muted-foreground">
        Dipindai {waktu(plan.scannedAt)} · {plan.pagesFetched} halaman
        {plan.importBoundary && ` · batas import terakhir ${waktu(plan.importBoundary)}`}
      </p>

      {plan.partial && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
          <p className="font-medium">Hasil ini sebagian saja.</p>
          <p className="mt-1 text-muted-foreground">
            Pemindaian dibatasi tanggal, jadi produk yang tidak tersentuh sejak saat itu tidak ikut
            diperiksa — selisih harga yang lebih lama tidak akan muncul di sini.
          </p>
        </div>
      )}

      {plan.truncated && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="font-medium">Katalog WooCommerce lebih besar dari batas pengambilan.</p>
          <p className="mt-1 text-muted-foreground">
            Sebagian halaman tidak diambil. Naikkan batasnya sebelum hasil ini dipakai sebagai dasar
            keputusan.
          </p>
        </div>
      )}

      {plan.skippedVariableParents > 0 && (
        <div className="rounded-lg border bg-muted/40 p-4 text-sm">
          <p className="font-medium">
            {plan.skippedVariableParents} produk variable tidak ikut dibandingkan harganya.
          </p>
          <p className="mt-1 text-muted-foreground">
            Di WooCommerce, induk produk variable tidak menyimpan harga sendiri — harganya ada di
            masing-masing varian. Membandingkannya akan mengusulkan pengosongan harga, jadi
            sengaja dilewati. Harga varian ditangani terpisah.
          </p>
        </div>
      )}

      <Tabs defaultValue="harga">
        <TabsList>
          <TabsTrigger value="harga" className="gap-2">
            <Tag className="h-4 w-4" />
            Perubahan Harga
            <Hitungan nilai={plan.priceChanges.length} />
          </TabsTrigger>
          <TabsTrigger value="baru" className="gap-2">
            <PackagePlus className="h-4 w-4" />
            Produk Baru
            <Hitungan nilai={plan.newProducts.length} />
          </TabsTrigger>
          {plan.conflicts.length > 0 && (
            <TabsTrigger value="konflik" className="gap-2">
              <ShieldAlert className="h-4 w-4" />
              Konflik
              <Hitungan nilai={plan.conflicts.length} />
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="harga" className="mt-6 space-y-4">
          {apply.name === "galat" && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              {apply.message}
            </div>
          )}

          {apply.name === "selesai" && <HasilPenerapan result={apply.result} onPeriksaUlang={onSelesaiTerapkan} />}

          {plan.priceChanges.length === 0 ? (
            <Kosong pesan="Tidak ada selisih harga." />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={sedangMenerapkan || sudahDiterapkan}
                    onClick={() => setDipilih(new Set(plan.priceChanges.map((item) => item.wooId)))}
                  >
                    Pilih semua
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={sedangMenerapkan || sudahDiterapkan}
                    onClick={() => setDipilih(new Set())}
                  >
                    Kosongkan
                  </Button>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {dipilih.size} dari {plan.priceChanges.length} dipilih
                  </span>
                </div>

                <Button
                  type="button"
                  disabled={dipilih.size === 0 || sedangMenerapkan || sudahDiterapkan}
                  onClick={() => setKonfirmasi(true)}
                >
                  {sedangMenerapkan ? "Menerapkan…" : "Terapkan Harga"}
                </Button>
              </div>

              <ul className="space-y-2">
                {plan.priceChanges.map((item) => (
                  <BarisHargaItem
                    key={item.wooId}
                    item={item}
                    dipilih={dipilih.has(item.wooId)}
                    onToggle={() => toggle(item.wooId)}
                    terkunci={sedangMenerapkan || sudahDiterapkan}
                  />
                ))}
              </ul>
            </>
          )}
        </TabsContent>

        <TabsContent value="baru" className="mt-6 space-y-6">
          {importPhase.name === "galat" && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              {importPhase.message}
            </div>
          )}

          {importPhase.name === "selesai" && (
            <HasilImport result={importPhase.result} onPeriksaUlang={onSelesaiTerapkan} />
          )}

          {plan.newProducts.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={importTerkunci}
                  onClick={() => setDipilihBaru(new Set())}
                >
                  Kosongkan
                </Button>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {dipilihBaru.size} dari {plan.newProducts.length} dipilih
                </span>
              </div>

              <Button
                type="button"
                disabled={dipilihBaru.size === 0 || importTerkunci}
                onClick={() => setKonfirmasiImport(true)}
              >
                {importPhase.name === "mengimpor" ? "Mengimpor…" : "Import Produk"}
              </Button>
            </div>
          )}

          <section>
            <h2 className="text-sm font-semibold">
              Produk baru <span className="text-muted-foreground">({baru.length})</span>
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Dibuat di WooCommerce setelah katalog terakhir diimpor.
            </p>
            {baru.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                disabled={importTerkunci}
                onClick={() => pilihKelompok(baru)}
              >
                Pilih semua di kelompok ini
              </Button>
            )}
            <div className="mt-3">
              {baru.length === 0 ? (
                <Kosong pesan="Tidak ada produk baru." />
              ) : (
                <ul className="space-y-2">
                  {baru.map((item) => (
                    <BarisProdukBaru
                      key={item.wooId}
                      item={item}
                      dipilih={dipilihBaru.has(item.wooId)}
                      onToggle={() => toggleBaru(item.wooId)}
                      terkunci={importTerkunci}
                    />
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold">
              Tertinggal dari import <span className="text-muted-foreground">({tertinggal.length})</span>
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Sudah ada di WooCommerce sebelum import, tapi tidak pernah masuk ke katalog kita.
            </p>
            {tertinggal.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                disabled={importTerkunci}
                onClick={() => pilihKelompok(tertinggal)}
              >
                Pilih semua di kelompok ini
              </Button>
            )}
            <div className="mt-3">
              {tertinggal.length === 0 ? (
                <Kosong pesan="Tidak ada yang tertinggal." />
              ) : (
                <ul className="space-y-2">
                  {tertinggal.map((item) => (
                    <BarisProdukBaru
                      key={item.wooId}
                      item={item}
                      dipilih={dipilihBaru.has(item.wooId)}
                      onToggle={() => toggleBaru(item.wooId)}
                      terkunci={importTerkunci}
                    />
                  ))}
                </ul>
              )}
            </div>
          </section>
        </TabsContent>

        {plan.conflicts.length > 0 && (
          <TabsContent value="konflik" className="mt-6">
            <p className="mb-3 text-sm text-muted-foreground">
              Nomor produk ini dipakai produk buatan panel admin. Tidak boleh diimpor maupun ditimpa —
              keduanya menghancurkan salah satu sisi.
            </p>
            <ul className="space-y-2">
              {plan.conflicts.map((item) => (
                <BarisKonflik key={item.wooId} item={item} />
              ))}
            </ul>
          </TabsContent>
        )}
      </Tabs>

      <ConfirmDialog
        open={konfirmasiImport}
        onOpenChange={setKonfirmasiImport}
        title={`Import ${dipilihBaru.size} produk dari WooCommerce?`}
        description="Produk yang kategorinya tidak ketemu di taksonomi kita akan masuk sebagai draft, bukan langsung tayang. Gambar tetap menunjuk ke server WordPress lama."
        confirmLabel="Import"
        onConfirm={impor}
      />

      <ConfirmDialog
        open={konfirmasi}
        onOpenChange={setKonfirmasi}
        title={`Terapkan harga WooCommerce ke ${dipilih.size} produk?`}
        description="Harga yang tampil ke pelanggan akan berubah begitu tersimpan. Setiap perubahan tercatat di halaman Logs beserta nilai lamanya, jadi bisa ditelusuri kalau ada yang keliru."
        confirmLabel="Terapkan"
        onConfirm={terapkan}
      />
    </div>
  )
}

function HasilImport({
  result,
  onPeriksaUlang,
}: {
  result: ImportResult
  onPeriksaUlang: () => void
}) {
  return (
    <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-medium">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          {result.imported} produk diimpor
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onPeriksaUlang}>
          <RefreshCw />
          Periksa Ulang
        </Button>
      </div>

      {result.draftedWithoutCategory > 0 && (
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
          {result.draftedWithoutCategory} di antaranya masuk sebagai draft karena kategorinya tidak
          ketemu. Lengkapi kategorinya di Semua Produk sebelum diterbitkan.
        </p>
      )}

      <p className="mt-2 text-xs text-muted-foreground">
        Daftar di bawah ini sekarang sudah usang. Tekan Periksa Ulang untuk melihat keadaan terbaru.
      </p>

      {result.skipped.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm">{result.skipped.length} dilewati</summary>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {result.skipped.map((item) => (
              <li key={item.wooId}>
                #{item.wooId} — {item.reason}
              </li>
            ))}
          </ul>
        </details>
      )}

      {result.failed.length > 0 && (
        <details className="mt-3" open>
          <summary className="cursor-pointer text-sm text-destructive">
            {result.failed.length} gagal
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-destructive">
            {result.failed.map((item) => (
              <li key={item.wooId}>
                #{item.wooId} — {item.message}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function HasilPenerapan({
  result,
  onPeriksaUlang,
}: {
  result: ApplyPriceResult
  onPeriksaUlang: () => void
}) {
  return (
    <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-medium">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          {result.applied} harga diterapkan
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onPeriksaUlang}>
          <RefreshCw />
          Periksa Ulang
        </Button>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Daftar di bawah ini sekarang sudah usang. Tekan Periksa Ulang untuk melihat keadaan terbaru.
      </p>

      {!result.cacheInvalidated && (
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
          Harga sudah tersimpan, tapi cache halaman gagal dibuang — halaman publik bisa menampilkan
          angka lama untuk sementara.
        </p>
      )}

      {result.skipped.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm">{result.skipped.length} dilewati</summary>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {result.skipped.map((item) => (
              <li key={item.wooId}>
                #{item.wooId} — {item.reason}
              </li>
            ))}
          </ul>
        </details>
      )}

      {result.failed.length > 0 && (
        <details className="mt-3" open>
          <summary className="cursor-pointer text-sm text-destructive">
            {result.failed.length} gagal
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-destructive">
            {result.failed.map((item) => (
              <li key={item.wooId}>
                #{item.wooId} — {item.message}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
