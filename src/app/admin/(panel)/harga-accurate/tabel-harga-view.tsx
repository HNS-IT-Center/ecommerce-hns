"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Search, AlertTriangle, Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import { formatRupiah } from "@/lib/utils"
import type { BarisTabelHarga, OpsiFilter } from "@/lib/api/accurate/price-table"
import { simpanHargaInternalAction } from "./actions"

type Props = {
  rows: BarisTabelHarga[]
  opsi: OpsiFilter
  filter: { q: string; kategori: string; brand: string; status: string }
  page: number
  pageCount: number
  total: number
  perPage: number
  /** Dari server (peran akun). Server action memeriksa ulang sendiri. */
  bolehEdit: boolean
}

/** Angka jadi "46.450.000" untuk ditampilkan di dalam input. */
function formatAngka(n: number | null): string {
  if (n === null) return ""
  return n.toLocaleString("id-ID")
}

/** Ambil angka dari apa pun yang diketik. "" berarti dikosongkan. */
function bacaAngka(teks: string): number | null {
  const digit = teks.replace(/[^\d]/g, "")
  if (digit === "") return null
  const n = Number(digit)
  return Number.isFinite(n) ? n : null
}

type Suntingan = { modal: number | null; dealer: number | null }

export function TabelHargaView({
  rows,
  opsi,
  filter,
  page,
  pageCount,
  total,
  perPage,
  bolehEdit,
}: Props) {
  const router = useRouter()
  // Hanya baris yang BENAR-BENAR diubah yang masuk peta ini — dasar tombol
  // Simpan, dan dasar peringatan saat orang beranjak dari halaman.
  const [suntingan, setSuntingan] = React.useState<Map<string, Suntingan>>(new Map())
  const [pending, startTransition] = React.useTransition()
  const [pesan, setPesan] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const adaPerubahan = suntingan.size > 0

  /**
   * Peringatan bawaan peramban saat menutup/menyegarkan tab dengan suntingan
   * yang belum disimpan. Perpindahan di dalam aplikasi (filter, halaman)
   * dijaga terpisah lewat `navigasi()` — `beforeunload` tidak menangkapnya.
   */
  React.useEffect(() => {
    if (!adaPerubahan) return
    const jaga = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", jaga)
    return () => window.removeEventListener("beforeunload", jaga)
  }, [adaPerubahan])

  function ubah(kode: string, medan: keyof Suntingan, teks: string, asli: Suntingan) {
    setSuntingan((prev) => {
      const next = new Map(prev)
      const sekarang = next.get(kode) ?? { ...asli }
      const diubah = { ...sekarang, [medan]: bacaAngka(teks) }
      // Kembali ke nilai asli = bukan lagi perubahan. Tanpa ini, mengetik lalu
      // membatalkan sendiri tetap menyalakan tombol Simpan dan peringatan
      // "belum disimpan" untuk sesuatu yang sebenarnya tidak berubah.
      if (diubah.modal === asli.modal && diubah.dealer === asli.dealer) next.delete(kode)
      else next.set(kode, diubah)
      return next
    })
  }

  /** Pindah halaman/filter — menahan langkah kalau ada yang belum disimpan. */
  function navigasi(url: string) {
    if (adaPerubahan) {
      const lanjut = window.confirm(
        `Ada ${suntingan.size} harga yang belum disimpan. Tinggalkan halaman ini dan buang perubahannya?`,
      )
      if (!lanjut) return
    }
    setSuntingan(new Map())
    router.push(url)
  }

  function bangunUrl(ubahan: Partial<typeof filter & { page: number }>) {
    const sp = new URLSearchParams()
    const gabung = { ...filter, page, ...ubahan }
    if (gabung.q) sp.set("q", gabung.q)
    if (gabung.kategori) sp.set("kategori", gabung.kategori)
    if (gabung.brand) sp.set("brand", gabung.brand)
    if (gabung.status) sp.set("status", gabung.status)
    if (gabung.page && gabung.page > 1) sp.set("page", String(gabung.page))
    const qs = sp.toString()
    return `/admin/harga-accurate${qs ? `?${qs}` : ""}`
  }

  function simpan() {
    setError(null)
    setPesan(null)
    const perubahan = [...suntingan.entries()].map(([kodeAccurate, v]) => ({
      kodeAccurate,
      modal: v.modal,
      dealer: v.dealer,
    }))

    startTransition(async () => {
      const res = await simpanHargaInternalAction(perubahan)
      if (res.error || !res.hasil) {
        setError(res.error ?? "Gagal menyimpan harga.")
        return
      }
      const { tersimpan, gagal } = res.hasil
      setSuntingan(new Map())
      setPesan(
        gagal.length === 0
          ? `${tersimpan} harga tersimpan.`
          : `${tersimpan} tersimpan, ${gagal.length} gagal: ${gagal.map((g) => `${g.kodeAccurate} (${g.alasan})`).join(", ")}`,
      )
      router.refresh()
    })
  }

  const awal = total === 0 ? 0 : (page - 1) * perPage + 1
  const akhir = Math.min(page * perPage, total)

  return (
    <div>
      {/* Pencarian & penyaring. Form GET biasa: hasilnya jadi alamat yang bisa
          disalin & dibagikan ke rekan ("cek yang kategori LAPTOP ini"). */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const data = new FormData(e.currentTarget)
          navigasi(bangunUrl({ q: String(data.get("q") ?? ""), page: 1 }))
        }}
        className="space-y-3"
      >
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            name="q"
            defaultValue={filter.q}
            placeholder="Cari kode, nama produk..."
            aria-label="Cari kode atau nama produk"
            className="w-full rounded-lg border border-input bg-background py-2 pr-3 pl-9 text-sm"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Pilihan
            label="Semua Kategori"
            nilai={filter.kategori}
            opsi={opsi.kategori}
            onPilih={(v) => navigasi(bangunUrl({ kategori: v, page: 1 }))}
          />
          <Pilihan
            label="Semua Brand"
            nilai={filter.brand}
            opsi={opsi.brand}
            onPilih={(v) => navigasi(bangunUrl({ brand: v, page: 1 }))}
          />
          <Pilihan
            label="Semua Status"
            nilai={filter.status}
            opsi={opsi.status}
            onPilih={(v) => navigasi(bangunUrl({ status: v, page: 1 }))}
          />
          <button type="submit" className="sr-only">
            Cari
          </button>
        </div>
      </form>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {total.toLocaleString("id-ID")} produk
          {adaPerubahan && (
            <span className="ml-2 font-medium text-warning">
              · {suntingan.size} belum disimpan
            </span>
          )}
        </p>
        {bolehEdit && (
          <Button size="sm" onClick={simpan} disabled={!adaPerubahan || pending}>
            <Save className="mr-2 h-4 w-4" />
            {pending ? "Menyimpan…" : "Simpan"}
          </Button>
        )}
      </div>

      {pesan && (
        <p className="mt-3 rounded-lg border border-success/30 bg-success/10 p-3 text-sm">{pesan}</p>
      )}
      {error && (
        <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Tidak ada barang yang cocok dengan pencarian ini.
        </p>
      ) : (
        <>
          {/* Kartu sampai <lg, tabel di >=lg — alasan sama seperti daftar
              pelanggan: baris ini punya tiga harga, dan menggulir ke samping
              sambil membandingkan angka justru paling rawan salah baca. */}
          <ul className="mt-4 space-y-3 lg:hidden">
            {rows.map((r) => (
              <li key={r.kodeAccurate} className="rounded-2xl border border-border bg-background p-4">
                <Produk baris={r} />
                <dl className="mt-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-xs text-muted-foreground">Harga SRP</dt>
                    <dd className="text-sm font-medium">
                      {r.srp.nilai === null ? "—" : formatRupiah(r.srp.nilai)}
                    </dd>
                  </div>
                  <MedanHarga
                    label="Harga Modal (CP)"
                    baris={r}
                    medan="modal"
                    suntingan={suntingan}
                    bolehEdit={bolehEdit}
                    onUbah={ubah}
                  />
                  <MedanHarga
                    label="Harga Dealer"
                    baris={r}
                    medan="dealer"
                    suntingan={suntingan}
                    bolehEdit={bolehEdit}
                    onUbah={ubah}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-xs text-muted-foreground">Stok</dt>
                    <dd className="text-sm tabular-nums">{r.stok ?? "—"}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>

          <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-border bg-background lg:block">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-3 font-semibold">Produk</th>
                  <th className="px-4 py-3 text-right font-semibold">Harga SRP</th>
                  <th className="px-4 py-3 text-right font-semibold">Harga Modal (CP)</th>
                  <th className="px-4 py-3 text-right font-semibold">Harga Dealer</th>
                  <th className="px-4 py-3 text-right font-semibold">Stok</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.kodeAccurate} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <Produk baris={r} />
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {r.srp.nilai === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        formatRupiah(r.srp.nilai)
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <InputHarga
                        baris={r}
                        medan="modal"
                        suntingan={suntingan}
                        bolehEdit={bolehEdit}
                        onUbah={ubah}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <InputHarga
                        baris={r}
                        medan="dealer"
                        suntingan={suntingan}
                        bolehEdit={bolehEdit}
                        onUbah={ubah}
                      />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.stok ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Menampilkan {awal.toLocaleString("id-ID")} – {akhir.toLocaleString("id-ID")} dari{" "}
          {total.toLocaleString("id-ID")} produk
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => navigasi(bangunUrl({ page: page - 1 }))}
          >
            Sebelumnya
          </Button>
          <span className="text-sm text-muted-foreground">
            Hal {page} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pageCount}
            onClick={() => navigasi(bangunUrl({ page: page + 1 }))}
          >
            Berikutnya
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Kolom produk: kode, kategori, nama, brand. */
function Produk({ baris }: { baris: BarisTabelHarga }) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
          {baris.kodeAccurate}
        </span>
        {baris.kategori && (
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
            {baris.kategori}
          </span>
        )}
      </div>
      <p className="mt-1 font-medium break-words">{baris.namaBarang ?? "(tanpa nama)"}</p>
      {baris.brand && <p className="text-xs text-muted-foreground">{baris.brand}</p>}
    </div>
  )
}

type UbahFn = (
  kode: string,
  medan: keyof Suntingan,
  teks: string,
  asli: Suntingan,
) => void

/**
 * Input satu harga internal.
 *
 * Catatan dari `parseHargaAccurate` (mis. "mungkin ribuan terpotong") tampil
 * sebagai peringatan di bawah kolomnya — TIDAK menghalangi pengetikan. Data
 * Accurate memang memuat baris seperti itu, dan staff yang sedang membetulkannya
 * justru orang yang paling butuh bisa mengubah angkanya.
 */
function InputHarga({
  baris,
  medan,
  suntingan,
  bolehEdit,
  onUbah,
}: {
  baris: BarisTabelHarga
  medan: keyof Suntingan
  suntingan: Map<string, Suntingan>
  bolehEdit: boolean
  onUbah: UbahFn
}) {
  const asli: Suntingan = { modal: baris.modal.nilai, dealer: baris.dealer.nilai }
  const disunting = suntingan.get(baris.kodeAccurate)
  const nilai = disunting ? disunting[medan] : asli[medan]
  const berubah = disunting !== undefined && disunting[medan] !== asli[medan]
  const catatan = medan === "modal" ? baris.modal.catatan : baris.dealer.catatan

  if (!bolehEdit) {
    return (
      <div className="text-right">
        {nilai === null ? <span className="text-muted-foreground">—</span> : formatRupiah(nilai)}
      </div>
    )
  }

  return (
    <div>
      <input
        inputMode="numeric"
        value={formatAngka(nilai)}
        onChange={(e) => onUbah(baris.kodeAccurate, medan, e.target.value, asli)}
        placeholder="—"
        aria-label={`${medan === "modal" ? "Harga modal" : "Harga dealer"} untuk ${baris.namaBarang ?? baris.kodeAccurate}`}
        className={`w-full rounded-md border px-2 py-1.5 text-right text-sm tabular-nums ${
          berubah ? "border-warning bg-warning/10" : "border-input bg-background"
        }`}
      />
      {catatan && (
        <p className="mt-1 flex items-start gap-1 text-xs text-warning">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          {catatan}
        </p>
      )}
    </div>
  )
}

/** Versi baris kartu (mobile) — label di kiri, input di kanan. */
function MedanHarga({
  label,
  baris,
  medan,
  suntingan,
  bolehEdit,
  onUbah,
}: {
  label: string
  baris: BarisTabelHarga
  medan: keyof Suntingan
  suntingan: Map<string, Suntingan>
  bolehEdit: boolean
  onUbah: UbahFn
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="mt-2 shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="w-40">
        <InputHarga
          baris={baris}
          medan={medan}
          suntingan={suntingan}
          bolehEdit={bolehEdit}
          onUbah={onUbah}
        />
      </dd>
    </div>
  )
}

/** Satu penyaring. Nilai kosong = "semua". */
function Pilihan({
  label,
  nilai,
  opsi,
  onPilih,
}: {
  label: string
  nilai: string
  opsi: string[]
  onPilih: (v: string) => void
}) {
  return (
    <select
      value={nilai}
      onChange={(e) => onPilih(e.target.value)}
      aria-label={label}
      className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
    >
      <option value="">{label}</option>
      {opsi.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  )
}
