"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Search, AlertTriangle, Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
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

/**
 * Ambang & jeda yang sama persis dengan pencarian di storefront
 * (`features/search/hooks/use-live-search.ts`) — diminta supaya rasanya sama di
 * kedua sisi. Satu huruf mencocokkan hampir seluruh katalog, dan mengirim
 * permintaan pada tiap ketukan tombol berarti belasan query untuk satu kata
 * yang belum selesai diketik.
 */
const MIN_QUERY_LENGTH = 2
const DEBOUNCE_MS = 300

/**
 * `STATUS` di Accurate menjawab "sudah dihentikan?", jadi YA berarti barangnya
 * TIDAK aktif — kebalikan dari bacaan pertama orang atas kata "ya".
 *
 * Dipastikan dari data sebelum dilabeli: seluruh 1.148 baris ber-STATUS YA
 * berstok nol dan hanya 31 yang punya harga, sedangkan barang yang jelas hidup
 * (Mouse Logitech, stok 127) justru ber-STATUS TIDAK. Menampilkan "YA" apa
 * adanya membuat staff menyaring terbalik tanpa sadar.
 */
function labelStatus(nilai: string): string {
  if (nilai === "YA") return "Tidak Aktif"
  if (nilai === "TIDAK") return "Aktif"
  return nilai
}

/**
 * Angka jadi "46.450.000" sambil diketik — pola yang sama persis dengan kolom
 * harga di Semua Produk (`produk/product-data-table.tsx`), termasuk membuang
 * awalan "Rp" karena labelnya sudah ada di sebelah kolom.
 */
function formatKetikan(teks: string): string {
  const angka = teks.replace(/[^0-9]/g, "")
  if (angka === "") return ""
  return formatRupiah(parseInt(angka, 10)).replace("Rp", "").trim()
}

/** Ambil angka dari apa pun yang diketik. null berarti dikosongkan. */
function bacaAngka(teks: string): number | null {
  const digit = teks.replace(/[^\d]/g, "")
  if (digit === "") return null
  const n = Number(digit)
  return Number.isFinite(n) ? n : null
}

/** Perubahan yang sedang menunggu jawaban dialog konfirmasi. */
type Konfirmasi = {
  kodeAccurate: string
  nama: string
  modalLama: number | null
  dealerLama: number | null
  modalBaru: number | null
  dealerBaru: number | null
}

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

  /**
   * Satu baris yang sedang disunting, bukan seluruh tabel sekaligus — pola yang
   * sama dengan kolom harga di Semua Produk. Harga disimpan begitu dikonfirmasi,
   * jadi tidak pernah ada suntingan yang menggantung: berpindah halaman atau
   * menutup tab tidak bisa membuang pekerjaan yang belum tersimpan.
   */
  const [menyunting, setMenyunting] = React.useState<string | null>(null)
  const [draftModal, setDraftModal] = React.useState("")
  const [draftDealer, setDraftDealer] = React.useState("")
  const [konfirmasi, setKonfirmasi] = React.useState<Konfirmasi | null>(null)

  const [pending, startTransition] = React.useTransition()
  const [pesan, setPesan] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  // Isi kotak cari dipegang di klien supaya huruf yang diketik muncul seketika;
  // pencariannya sendiri menyusul setelah jeda (lihat effect di bawah).
  const [teksCari, setTeksCari] = React.useState(filter.q)
  // Tanpa ini, effect di bawah ikut berjalan saat halaman pertama dimuat dan
  // langsung melakukan navigasi untuk kata yang sudah ada di alamat.
  const sudahMengetik = React.useRef(false)

  /**
   * Pencarian langsung — ambang & jeda menyamai storefront.
   *
   * Di bawah ambang diperlakukan sebagai KOSONG, bukan diabaikan: orang yang
   * menghapus kata pencariannya sampai tersisa satu huruf jelas sedang menuju
   * "tampilkan semua", dan membiarkan hasil lama tertahan di layar membuatnya
   * seperti macet.
   */
  React.useEffect(() => {
    if (!sudahMengetik.current) return
    const bersih = teksCari.trim()
    const sasaran = bersih.length >= MIN_QUERY_LENGTH ? bersih : ""
    if (sasaran === filter.q) return

    const timer = setTimeout(() => {
      navigasi(bangunUrl({ q: sasaran, page: 1 }))
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
    // `navigasi` & `bangunUrl` sengaja tidak masuk daftar: keduanya dibuat ulang
    // tiap render, dan memasukkannya membuat effect ini berjalan terus-menerus.
    // Yang benar-benar memicu pencarian hanya dua nilai di bawah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teksCari, filter.q])

  /**
   * Pindah pencarian/penyaring/halaman.
   *
   * `replace`, bukan `push`: mengetik "logitech" menghasilkan beberapa
   * perpindahan berdebounce, dan dengan `push` tombol Kembali harus ditekan
   * sekali untuk tiap potongan kata yang pernah singgah di alamat.
   */
  function navigasi(url: string) {
    router.replace(url)
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
    return `/admin/harga-accurate?tab=daftar${qs ? `&${qs}` : ""}`
  }

  function mulaiSunting(baris: BarisTabelHarga) {
    setDraftModal(baris.modal.nilai === null ? "" : formatKetikan(String(baris.modal.nilai)))
    setDraftDealer(baris.dealer.nilai === null ? "" : formatKetikan(String(baris.dealer.nilai)))
    setMenyunting(baris.kodeAccurate)
  }

  /**
   * Tutup penyuntingan. Kalau ada yang benar-benar berubah, tanyakan dulu —
   * kalau angkanya sama saja, tidak perlu mengganggu siapa pun dengan dialog
   * untuk perubahan yang tidak terjadi.
   */
  function selesaiSunting(baris: BarisTabelHarga) {
    const modalBaru = bacaAngka(draftModal)
    const dealerBaru = bacaAngka(draftDealer)
    setMenyunting(null)

    if (modalBaru === baris.modal.nilai && dealerBaru === baris.dealer.nilai) return

    setKonfirmasi({
      kodeAccurate: baris.kodeAccurate,
      nama: baris.namaBarang ?? baris.kodeAccurate,
      modalLama: baris.modal.nilai,
      dealerLama: baris.dealer.nilai,
      modalBaru,
      dealerBaru,
    })
  }

  function simpanTerkonfirmasi() {
    if (!konfirmasi) return
    const { kodeAccurate, modalBaru, dealerBaru } = konfirmasi
    setKonfirmasi(null)
    setError(null)
    setPesan(null)

    startTransition(async () => {
      const res = await simpanHargaInternalAction([
        { kodeAccurate, modal: modalBaru, dealer: dealerBaru },
      ])
      if (res.error || !res.hasil) {
        setError(res.error ?? "Gagal menyimpan harga.")
        return
      }
      if (res.hasil.gagal.length > 0) {
        setError(res.hasil.gagal.map((g) => `${g.kodeAccurate}: ${g.alasan}`).join(", "))
        return
      }
      setPesan("Harga tersimpan.")
      router.refresh()
    })
  }

  const awal = total === 0 ? 0 : (page - 1) * perPage + 1
  const akhir = Math.min(page * perPage, total)

  return (
    <div>
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={teksCari}
            onChange={(e) => {
              sudahMengetik.current = true
              setTeksCari(e.target.value)
            }}
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
            beriLabel={labelStatus}
            onPilih={(v) => navigasi(bangunUrl({ status: v, page: 1 }))}
          />
        </div>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        {total.toLocaleString("id-ID")} produk
        {pending && <span className="ml-2">· menyimpan…</span>}
      </p>

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
                  <div className="flex items-start justify-between gap-3">
                    <dt className="mt-1 shrink-0 text-xs text-muted-foreground">Modal &amp; Dealer</dt>
                    <dd className="w-44">
                      <SelHarga
                        baris={r}
                        bolehEdit={bolehEdit}
                        sedangDisunting={menyunting === r.kodeAccurate}
                        draftModal={draftModal}
                        draftDealer={draftDealer}
                        setDraftModal={setDraftModal}
                        setDraftDealer={setDraftDealer}
                        onMulai={() => mulaiSunting(r)}
                        onSelesai={() => selesaiSunting(r)}
                        onBatal={() => setMenyunting(null)}
                      />
                    </dd>
                  </div>
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
                  <th className="px-4 py-3 text-right font-semibold">Modal (CP) &amp; Dealer</th>
                  <th className="px-4 py-3 text-right font-semibold">Stok</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.kodeAccurate} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <Produk baris={r} />
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap align-top">
                      {r.srp.nilai === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        formatRupiah(r.srp.nilai)
                      )}
                    </td>
                    <td className="w-[190px] px-4 py-3 align-top">
                      <SelHarga
                        baris={r}
                        bolehEdit={bolehEdit}
                        sedangDisunting={menyunting === r.kodeAccurate}
                        draftModal={draftModal}
                        draftDealer={draftDealer}
                        setDraftModal={setDraftModal}
                        setDraftDealer={setDraftDealer}
                        onMulai={() => mulaiSunting(r)}
                        onSelesai={() => selesaiSunting(r)}
                        onBatal={() => setMenyunting(null)}
                      />
                    </td>
                    <td className="px-4 py-3 text-right align-top tabular-nums">{r.stok ?? "—"}</td>
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

      <ConfirmDialog
        open={konfirmasi !== null}
        onOpenChange={(open) => {
          if (!open) setKonfirmasi(null)
        }}
        confirmLabel="Simpan"
        title="Simpan perubahan harga?"
        description={
          konfirmasi ? (
            <span className="block space-y-1 text-left">
              <span className="block font-medium text-foreground">{konfirmasi.nama}</span>
              <span className="block">
                Modal: {konfirmasi.modalLama === null ? "—" : formatRupiah(konfirmasi.modalLama)} →{" "}
                <strong>
                  {konfirmasi.modalBaru === null ? "—" : formatRupiah(konfirmasi.modalBaru)}
                </strong>
              </span>
              <span className="block">
                Dealer: {konfirmasi.dealerLama === null ? "—" : formatRupiah(konfirmasi.dealerLama)} →{" "}
                <strong>
                  {konfirmasi.dealerBaru === null ? "—" : formatRupiah(konfirmasi.dealerBaru)}
                </strong>
              </span>
              <span className="block pt-1 text-xs">
                Keduanya angka internal — harga yang dilihat pelanggan tidak berubah.
              </span>
            </span>
          ) : null
        }
        onConfirm={simpanTerkonfirmasi}
      />
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

/**
 * Sel harga modal & dealer — klik untuk menyunting, pola yang sama dengan kolom
 * harga di Semua Produk: garis putus-putus sebagai tanda "ini bisa diklik",
 * pensil muncul saat disorot, lalu dua input berlabel dengan OK/Batal.
 *
 * Catatan dari `parseHargaAccurate` (mis. "mungkin ribuan terpotong") tampil di
 * bawah angkanya dan TIDAK menghalangi penyuntingan — data Accurate memang
 * memuat baris seperti 145 untuk barang ratusan ribu, dan staff yang sedang
 * membetulkannya justru yang paling butuh bisa mengubahnya.
 */
function SelHarga({
  baris,
  bolehEdit,
  sedangDisunting,
  draftModal,
  draftDealer,
  setDraftModal,
  setDraftDealer,
  onMulai,
  onSelesai,
  onBatal,
}: {
  baris: BarisTabelHarga
  bolehEdit: boolean
  sedangDisunting: boolean
  draftModal: string
  draftDealer: string
  setDraftModal: (v: string) => void
  setDraftDealer: (v: string) => void
  onMulai: () => void
  onSelesai: () => void
  onBatal: () => void
}) {
  const catatan = baris.modal.catatan ?? baris.dealer.catatan

  if (sedangDisunting) {
    return (
      <div className="flex w-full flex-col gap-1.5">
        <div className="flex flex-col gap-0.5">
          <label className="text-[9px] text-muted-foreground uppercase">Modal (CP)</label>
          <input
            type="text"
            autoFocus
            inputMode="numeric"
            value={draftModal}
            onChange={(e) => setDraftModal(formatKetikan(e.target.value))}
            className="w-full rounded border border-input bg-background px-2 py-1 text-right text-xs tabular-nums"
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-[9px] text-muted-foreground uppercase">Dealer</label>
          <input
            type="text"
            inputMode="numeric"
            value={draftDealer}
            onChange={(e) => setDraftDealer(formatKetikan(e.target.value))}
            className="w-full rounded border border-input bg-background px-2 py-1 text-right text-xs tabular-nums"
          />
        </div>
        <div className="mt-1 flex gap-1">
          <button
            type="button"
            onClick={onSelesai}
            className="flex-1 rounded bg-primary py-1 text-[10px] text-primary-foreground hover:bg-primary/90"
          >
            OK
          </button>
          <button
            type="button"
            onClick={onBatal}
            className="flex-1 rounded bg-muted py-1 text-[10px] text-muted-foreground hover:bg-muted/80"
          >
            Batal
          </button>
        </div>
      </div>
    )
  }

  const isi = (
    <div className="flex flex-col text-right">
      <span className="text-[10px] text-muted-foreground">
        Modal: {baris.modal.nilai === null ? "—" : formatRupiah(baris.modal.nilai)}
      </span>
      <span className="font-semibold">
        {baris.dealer.nilai === null ? "—" : formatRupiah(baris.dealer.nilai)}
      </span>
    </div>
  )

  if (!bolehEdit) return <div className="w-full">{isi}</div>

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={onMulai}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onMulai()
          }
        }}
        title="Klik untuk ubah harga modal & dealer"
        className="group -m-1 flex cursor-pointer items-center justify-between gap-1 rounded border-b border-dashed border-muted-foreground/50 p-1 transition-colors hover:bg-muted/50"
      >
        {isi}
        <Pencil className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      {catatan && (
        <p className="mt-1 flex items-start gap-1 text-[10px] text-warning">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          {catatan}
        </p>
      )}
    </div>
  )
}

/**
 * Satu penyaring. Nilai kosong = "semua".
 *
 * `beriLabel` mengubah tampilan pilihannya saja — yang dikirim ke server tetap
 * nilai asli dari Accurate. Dipakai kolom STATUS, yang menyimpan "YA"/"TIDAK"
 * tapi harus dibaca sebagai Tidak Aktif/Aktif.
 */
function Pilihan({
  label,
  nilai,
  opsi,
  onPilih,
  beriLabel,
}: {
  label: string
  nilai: string
  opsi: string[]
  onPilih: (v: string) => void
  beriLabel?: (v: string) => string
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
          {beriLabel ? beriLabel(o) : o}
        </option>
      ))}
    </select>
  )
}
