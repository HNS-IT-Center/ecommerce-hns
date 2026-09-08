"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Search,
  AlertTriangle,
  Pencil,
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
  Check,
  X,
  Unlink as LinkOff,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { formatRupiah } from "@/lib/utils"
import type {
  BarisTabelHarga,
  OpsiFilter,
  KolomUrut,
  ArahUrut,
  CalonProdukWeb,
} from "@/lib/api/accurate/price-table"
import {
  simpanHargaInternalAction,
  cariProdukWebAction,
  tautkanKodeAction,
} from "./actions"

/** Kolom harga internal yang bisa disunting di halaman ini. */
type Medan = "modal" | "dealer"

const LABEL: Record<Medan, string> = { modal: "Harga Modal (CP)", dealer: "Harga Dealer" }

type Props = {
  rows: BarisTabelHarga[]
  opsi: OpsiFilter
  filter: { q: string; kategori: string; brand: string; status: string; tautan: string }
  page: number
  pageCount: number
  total: number
  perPage: number
  /** Izin mengubah harga di halaman ini. Server action memeriksa ulang sendiri. */
  bolehEdit: boolean
  /** Izin MELIHAT harga modal — kolomnya hilang sama sekali kalau false. */
  bolehLihatModal: boolean
  /** Izin MENGUBAH harga modal. */
  bolehEditModal: boolean
  /** Kolom yang sedang dipakai mengurutkan (undefined = urutan bawaan). */
  urut?: KolomUrut
  /** Arah urut yang sedang aktif. */
  arah?: ArahUrut
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
 * (Mouse Logitech, stok 127) justru ber-STATUS TIDAK.
 */
function labelStatus(nilai: string): string {
  if (nilai === "YA") return "Tidak Aktif"
  if (nilai === "TIDAK") return "Aktif"
  return nilai
}

/**
 * Angka jadi "46.450.000" sambil diketik — pola yang sama persis dengan kolom
 * harga di Semua Produk (`produk/product-data-table.tsx`), termasuk membuang
 * awalan "Rp" karena nama kolomnya sudah ada di kepala tabel.
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

/** Sel yang sedang terbuka untuk disunting. */
type Sunting = { kode: string; medan: Medan }

/** Perubahan yang menunggu jawaban dialog konfirmasi. */
type Konfirmasi = {
  kode: string
  nama: string
  medan: Medan
  lama: number | null
  baru: number | null
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
  bolehLihatModal,
  bolehEditModal,
  urut,
  arah,
}: Props) {
  const router = useRouter()

  /**
   * Satu SEL yang terbuka, bukan seluruh baris — kolom modal dan dealer berdiri
   * sendiri, dan orang yang membetulkan harga dealer tidak perlu kotak modal
   * ikut terbuka di depannya.
   */
  const [menyunting, setMenyunting] = React.useState<Sunting | null>(null)
  const [draft, setDraft] = React.useState("")
  const [konfirmasi, setKonfirmasi] = React.useState<Konfirmasi | null>(null)

  const [pending, startTransition] = React.useTransition()
  const [pesan, setPesan] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  /** Baris yang sedang dicarikan pasangan produk webnya (null = dialog tutup). */
  const [menautkan, setMenautkan] = React.useState<BarisTabelHarga | null>(null)

  const [teksCari, setTeksCari] = React.useState(filter.q)
  const sudahMengetik = React.useRef(false)

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teksCari, filter.q])

  /** `replace`, bukan `push`: satu kata yang diketik menghasilkan beberapa
   *  perpindahan berdebounce, dan tombol Kembali tidak seharusnya menelusuri
   *  tiap potongan kata yang sempat singgah di alamat. */
  function navigasi(url: string) {
    router.replace(url)
  }

  function bangunUrl(
    ubahan: Partial<
      typeof filter & { page: number; urut: KolomUrut | undefined; arah: ArahUrut | undefined }
    >,
  ) {
    const sp = new URLSearchParams()
    const gabung = { ...filter, page, urut, arah, ...ubahan }
    if (gabung.q) sp.set("q", gabung.q)
    if (gabung.kategori) sp.set("kategori", gabung.kategori)
    if (gabung.brand) sp.set("brand", gabung.brand)
    if (gabung.status) sp.set("status", gabung.status)
    if (gabung.tautan) sp.set("tautan", gabung.tautan)
    if (gabung.page && gabung.page > 1) sp.set("page", String(gabung.page))
    // Urutan ikut terbawa ke tautan halaman & penyaring — tanpa itu, berpindah
    // halaman diam-diam mengembalikan tabel ke urutan bawaan.
    if (gabung.urut) sp.set("urut", gabung.urut)
    if (gabung.urut && gabung.arah) sp.set("arah", gabung.arah)
    const qs = sp.toString()
    return `/admin/harga-accurate?tab=daftar${qs ? `&${qs}` : ""}`
  }

  /**
   * Klik kepala kolom: naik → turun → kembali ke urutan bawaan.
   *
   * Tiga langkah, bukan dua. Dengan dua langkah tidak ada jalan pulang — sekali
   * mengurutkan menurut harga, tabel tidak pernah bisa kembali ke urutan
   * abjadnya tanpa memuat ulang halaman dari menu.
   *
   * Selalu balik ke halaman 1: baris di halaman 7 urutan lama tidak ada
   * hubungannya dengan baris di halaman 7 urutan baru.
   */
  function urutkan(kolom: KolomUrut) {
    if (urut !== kolom) return navigasi(bangunUrl({ urut: kolom, arah: "asc", page: 1 }))
    if (arah === "asc") return navigasi(bangunUrl({ urut: kolom, arah: "desc", page: 1 }))
    navigasi(bangunUrl({ urut: undefined, arah: undefined, page: 1 }))
  }

  function nilaiAsli(baris: BarisTabelHarga, medan: Medan): number | null {
    return medan === "modal" ? baris.modal.nilai : baris.dealer.nilai
  }

  function mulaiSunting(baris: BarisTabelHarga, medan: Medan) {
    const asli = nilaiAsli(baris, medan)
    setDraft(asli === null ? "" : formatKetikan(String(asli)))
    setMenyunting({ kode: baris.kodeAccurate, medan })
  }

  /** Tutup sel. Dialog hanya muncul kalau angkanya benar-benar berubah. */
  function selesaiSunting(baris: BarisTabelHarga, medan: Medan) {
    const baru = bacaAngka(draft)
    const lama = nilaiAsli(baris, medan)
    setMenyunting(null)
    if (baru === lama) return

    setKonfirmasi({
      kode: baris.kodeAccurate,
      nama: baris.namaBarang ?? baris.kodeAccurate,
      medan,
      lama,
      baru,
    })
  }

  function simpanTerkonfirmasi() {
    if (!konfirmasi) return
    const { kode, medan, baru } = konfirmasi
    const baris = rows.find((r) => r.kodeAccurate === kode)
    setKonfirmasi(null)
    setError(null)
    setPesan(null)
    if (!baris) return

    /**
     * Kolom yang TIDAK disunting dikirim apa adanya, bukan null.
     *
     * `simpanHargaInternal` menulis kedua kolom sekaligus, jadi mengirim null
     * untuk yang tidak disentuh akan mengosongkannya — harga dealer lenyap
     * hanya karena seseorang membetulkan harga modal.
     */
    startTransition(async () => {
      const res = await simpanHargaInternalAction([
        {
          kodeAccurate: kode,
          modal: medan === "modal" ? baru : baris.modal.nilai,
          dealer: medan === "dealer" ? baru : baris.dealer.nilai,
        },
      ])
      if (res.error || !res.hasil) {
        setError(res.error ?? "Gagal menyimpan harga.")
        return
      }
      if (res.hasil.gagal.length > 0) {
        setError(res.hasil.gagal.map((g) => `${g.kodeAccurate}: ${g.alasan}`).join(", "))
        return
      }
      setPesan(`${LABEL[medan]} tersimpan.`)
      router.refresh()
    })
  }

  const awal = total === 0 ? 0 : (page - 1) * perPage + 1
  const akhir = Math.min(page * perPage, total)

  /** Sel harga siap pakai, dipakai tabel maupun kartu. */
  const sel = (baris: BarisTabelHarga, medan: Medan, bolehUbah: boolean) => (
    <SelHarga
      baris={baris}
      medan={medan}
      bolehEdit={bolehEdit && bolehUbah}
      sedangDisunting={menyunting?.kode === baris.kodeAccurate && menyunting.medan === medan}
      draft={draft}
      setDraft={setDraft}
      onMulai={() => mulaiSunting(baris, medan)}
      onSelesai={() => selesaiSunting(baris, medan)}
      onBatal={() => setMenyunting(null)}
    />
  )

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
          {/* Penyaring keterkaitan dengan katalog. "Belum ada di web" adalah
              antrean kerja penautan — itu gunanya penyaring ini ada. */}
          <Pilihan
            label="Semua (web)"
            nilai={filter.tautan}
            opsi={["tertaut", "belum"]}
            beriLabel={(v) => (v === "tertaut" ? "Sudah ada di web" : "Belum ada di web")}
            onPilih={(v) => navigasi(bangunUrl({ tautan: v, page: 1 }))}
          />
        </div>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        {total.toLocaleString("id-ID")} produk
        {pending && <span className="ml-2">· menyimpan…</span>}
        {!bolehLihatModal && (
          <span className="ml-2">· harga modal disembunyikan untuk peran Anda</span>
        )}
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
          {/* Kartu sampai <lg, tabel di >=lg — baris ini punya tiga harga, dan
              menggulir ke samping sambil membandingkan angka justru paling rawan
              salah baca. */}
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
                  {bolehLihatModal && (
                    <div className="flex items-start justify-between gap-3">
                      <dt className="mt-1 shrink-0 text-xs text-muted-foreground">Harga Modal (CP)</dt>
                      <dd className="w-36">{sel(r, "modal", bolehEditModal)}</dd>
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-3">
                    <dt className="mt-1 shrink-0 text-xs text-muted-foreground">Harga Dealer</dt>
                    <dd className="w-36">{sel(r, "dealer", true)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-xs text-muted-foreground">Stok</dt>
                    <dd className="text-sm tabular-nums">{r.stok ?? "—"}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-3 border-t border-border pt-2">
                    <dt className="mt-0.5 shrink-0 text-xs text-muted-foreground">Produk Web</dt>
                    <dd className="min-w-0 flex-1">
                      <SelProdukWeb
                        baris={r}
                        bolehEdit={bolehEdit}
                        onTautkan={() => setMenautkan(r)}
                      />
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>

          <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-border bg-background lg:block">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50 text-left">
                <tr>
                  <KepalaUrut kolom="nama" urut={urut} arah={arah} onUrut={urutkan}>
                    Produk
                  </KepalaUrut>
                  <KepalaUrut kolom="srp" urut={urut} arah={arah} onUrut={urutkan} kanan>
                    Harga SRP
                  </KepalaUrut>
                  {bolehLihatModal && (
                    <KepalaUrut kolom="modal" urut={urut} arah={arah} onUrut={urutkan} kanan>
                      Harga Modal (CP)
                    </KepalaUrut>
                  )}
                  <KepalaUrut kolom="dealer" urut={urut} arah={arah} onUrut={urutkan} kanan>
                    Harga Dealer
                  </KepalaUrut>
                  <KepalaUrut kolom="stok" urut={urut} arah={arah} onUrut={urutkan} kanan>
                    Stok
                  </KepalaUrut>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    Produk Web
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.kodeAccurate} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <Produk baris={r} />
                    </td>
                    <td className="px-4 py-3 text-right align-top whitespace-nowrap">
                      {r.srp.nilai === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        formatRupiah(r.srp.nilai)
                      )}
                    </td>
                    {bolehLihatModal && (
                      <td className="w-[150px] px-4 py-3 align-top">
                        {sel(r, "modal", bolehEditModal)}
                      </td>
                    )}
                    <td className="w-[150px] px-4 py-3 align-top">{sel(r, "dealer", true)}</td>
                    <td className="px-4 py-3 text-right align-top tabular-nums">{r.stok ?? "—"}</td>
                    <td className="w-[220px] px-4 py-3 align-top">
                      <SelProdukWeb
                        baris={r}
                        bolehEdit={bolehEdit}
                        onTautkan={() => setMenautkan(r)}
                      />
                    </td>
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

      {menautkan && (
        <PemilihProdukWeb
          baris={menautkan}
          onTutup={() => setMenautkan(null)}
          onSelesai={(kabar) => {
            setMenautkan(null)
            setError(null)
            setPesan(kabar)
            router.refresh()
          }}
          onGagal={(alasan) => {
            setPesan(null)
            setError(alasan)
          }}
        />
      )}

      <ConfirmDialog
        open={konfirmasi !== null}
        onOpenChange={(open) => {
          if (!open) setKonfirmasi(null)
        }}
        confirmLabel="Simpan"
        title={konfirmasi ? `Ubah ${LABEL[konfirmasi.medan]}?` : "Ubah harga?"}
        description={
          konfirmasi ? (
            <span className="block space-y-1 text-left">
              <span className="block font-medium text-foreground">{konfirmasi.nama}</span>
              <span className="block">
                {konfirmasi.lama === null ? "—" : formatRupiah(konfirmasi.lama)} →{" "}
                <strong>{konfirmasi.baru === null ? "—" : formatRupiah(konfirmasi.baru)}</strong>
              </span>
              <span className="block pt-1 text-xs">
                Angka internal — harga yang dilihat pelanggan tidak ikut berubah.
              </span>
            </span>
          ) : null
        }
        onConfirm={simpanTerkonfirmasi}
      />
    </div>
  )
}

/**
 * Pemilih produk web untuk satu barang Accurate.
 *
 * Kotak carinya terisi lebih dulu dengan nama barang Accurate-nya — itu tebakan
 * pertama yang paling sering benar, dan mengetik ulang nama sepanjang belasan
 * kata adalah pekerjaan yang tidak perlu ada. Pencariannya tetap bisa
 * disempitkan atau diganti sepenuhnya.
 *
 * Produk yang SUDAH tertaut ke kode lain tetap ditampilkan, dengan tombolnya
 * dimatikan dan kodenya disebut — menyembunyikannya membuat orang mencari-cari
 * produk yang jelas ada lalu menyimpulkan pencariannya rusak.
 */
function PemilihProdukWeb({
  baris,
  onTutup,
  onSelesai,
  onGagal,
}: {
  baris: BarisTabelHarga
  onTutup: () => void
  onSelesai: (kabar: string) => void
  onGagal: (alasan: string) => void
}) {
  const [teks, setTeks] = React.useState(baris.namaBarang ?? baris.kodeAccurate)
  const [pending, startTransition] = React.useTransition()

  /**
   * Hasil pencarian TERAKHIR YANG SELESAI, beserta kata yang menghasilkannya.
   *
   * Menyimpan pasangannya, bukan cuma daftarnya, supaya "sedang memuat" bisa
   * DITURUNKAN saat render alih-alih disetel di dalam effect — pola yang sama
   * dengan `useLiveSearch` di storefront, dan alasan yang sama: memanggil
   * setState di badan effect memicu render bertingkat, dan aturan lint project
   * ini melarangnya.
   */
  const [selesai, setSelesai] = React.useState<{ q: string; hasil: CalonProdukWeb[] } | null>(null)

  const bersih = teks.trim()
  const terlaluPendek = bersih.length < MIN_QUERY_LENGTH
  const cocok = selesai !== null && selesai.q === bersih
  const memuat = !terlaluPendek && !cocok
  const hasil = !terlaluPendek && cocok ? selesai.hasil : []

  // Pencarian pertama berjalan sendiri saat dialog dibuka; sesudahnya mengikuti
  // ketikan dengan jeda yang sama seperti pencarian tabel.
  React.useEffect(() => {
    if (terlaluPendek || cocok) return
    let basi = false
    const timer = setTimeout(async () => {
      const res = await cariProdukWebAction(bersih)
      // Jawaban yang datang setelah kata berikutnya diketik harus dibuang —
      // tanpa penjaga ini, hasil lama bisa menimpa hasil baru yang lebih cepat.
      if (!basi) setSelesai({ q: bersih, hasil: res.hasil })
    }, DEBOUNCE_MS)
    return () => {
      basi = true
      clearTimeout(timer)
    }
  }, [bersih, terlaluPendek, cocok])

  function pilih(p: CalonProdukWeb) {
    startTransition(async () => {
      const res = await tautkanKodeAction({ wooId: p.wooId, kode: baris.kodeAccurate })
      if (res.ok) onSelesai(`Ditautkan ke "${p.nama}".`)
      else onGagal(res.alasan)
    })
  }

  function lepas() {
    if (!baris.produkWeb) return
    startTransition(async () => {
      const res = await tautkanKodeAction({ wooId: baris.produkWeb!.wooId, kode: null })
      if (res.ok) onSelesai("Tautan dilepas.")
      else onGagal(res.alasan)
    })
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tautkan ke produk web"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[8vh]"
      onClick={onTutup}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-2xl border border-border bg-background p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base font-bold">Tautkan ke produk web</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono">{baris.kodeAccurate}</span>{" "}
              <span className="break-words">{baris.namaBarang ?? "(tanpa nama)"}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onTutup}
            aria-label="Tutup"
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {baris.produkWeb && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-xs">
            <span className="min-w-0 break-words">
              Sekarang tertaut ke <strong>{baris.produkWeb.nama}</strong>
            </span>
            <button
              type="button"
              onClick={lepas}
              disabled={pending}
              className="shrink-0 rounded border border-destructive/40 px-2 py-1 font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              Lepas tautan
            </button>
          </div>
        )}

        <div className="relative mt-4">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            autoFocus
            value={teks}
            onChange={(e) => setTeks(e.target.value)}
            placeholder="Cari nama atau SKU produk web…"
            aria-label="Cari produk web"
            className="w-full rounded-lg border border-input bg-background py-2 pr-3 pl-9 text-sm"
          />
        </div>

        <div className="mt-3 max-h-[45vh] overflow-y-auto rounded-lg border border-border">
          {memuat && (
            <p className="p-4 text-center text-xs text-muted-foreground">Mencari…</p>
          )}
          {!memuat && hasil.length === 0 && (
            <p className="p-4 text-center text-xs text-muted-foreground">
              {teks.trim().length < MIN_QUERY_LENGTH
                ? `Ketik minimal ${MIN_QUERY_LENGTH} huruf.`
                : "Tidak ada produk web yang cocok. Coba kata yang lebih sedikit."}
            </p>
          )}
          {!memuat &&
            hasil.map((p) => {
              const terpakaiLain = p.sudahTertaut !== null && p.sudahTertaut !== baris.kodeAccurate
              return (
                <div
                  key={p.wooId}
                  className="flex items-center justify-between gap-3 border-b border-border p-3 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium break-words">{p.nama}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                      {p.sku ? `SKU ${p.sku}` : "tanpa SKU"}
                      {terpakaiLain && ` · sudah tertaut ke ${p.sudahTertaut}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={pending || terpakaiLain}
                    onClick={() => pilih(p)}
                    title={terpakaiLain ? "Lepaskan dari kode itu dulu" : undefined}
                    className="shrink-0 rounded bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Tautkan
                  </button>
                </div>
              )
            })}
        </div>
      </div>
    </div>
  )
}

/**
 * Sel "Produk Web": penanda ada/belum, sekaligus pintu ke pemilih penautan.
 *
 * Keadaannya dibedakan bentuk, bukan cuma kata — lencana hijau bertanda centang
 * untuk yang sudah tertaut, lencana pudar bergaris untuk yang belum. Di tabel
 * 7.041 baris, "sudah" dan "belum" harus terbaca sekilas tanpa membaca teksnya.
 */
function SelProdukWeb({
  baris,
  bolehEdit,
  onTautkan,
}: {
  baris: BarisTabelHarga
  bolehEdit: boolean
  onTautkan: () => void
}) {
  if (baris.produkWeb) {
    return (
      <div className="min-w-0">
        <p className="flex items-start gap-1.5 text-xs">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
          <span className="break-words">{baris.produkWeb.nama}</span>
        </p>
        {bolehEdit && (
          <button
            type="button"
            onClick={onTautkan}
            className="mt-1 text-[10px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Ubah tautan
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <LinkOff className="h-3.5 w-3.5 shrink-0" />
        Belum ada di web
      </p>
      {bolehEdit && (
        <button
          type="button"
          onClick={onTautkan}
          className="mt-1 text-[10px] font-medium text-primary underline-offset-2 hover:underline"
        >
          Tautkan…
        </button>
      )}
    </div>
  )
}

/**
 * Kepala kolom yang bisa diklik untuk mengurutkan.
 *
 * Ikonnya menyatakan keadaan, bukan sekadar menghias: panah naik/turun untuk
 * kolom yang sedang dipakai, dan panah ganda pudar untuk yang bisa diklik tapi
 * belum aktif — supaya terlihat mana yang bisa diurutkan tanpa harus mencoba
 * satu per satu.
 *
 * `aria-sort` memberi tahu pembaca layar hal yang sama, dan judul tetap
 * `<th scope="col">` — tombolnya di dalam sel, bukan menggantikannya.
 */
function KepalaUrut({
  kolom,
  urut,
  arah,
  onUrut,
  kanan = false,
  children,
}: {
  kolom: KolomUrut
  urut?: KolomUrut
  arah?: ArahUrut
  onUrut: (k: KolomUrut) => void
  kanan?: boolean
  children: React.ReactNode
}) {
  const aktif = urut === kolom
  const naik = aktif && arah !== "desc"

  return (
    <th
      scope="col"
      aria-sort={aktif ? (naik ? "ascending" : "descending") : "none"}
      className={`px-4 py-3 font-semibold ${kanan ? "text-right" : "text-left"}`}
    >
      <button
        type="button"
        onClick={() => onUrut(kolom)}
        title={
          !aktif
            ? "Urutkan menaik"
            : naik
              ? "Urutkan menurun"
              : "Kembalikan ke urutan bawaan"
        }
        className={`group inline-flex items-center gap-1.5 rounded transition-colors hover:text-primary ${
          kanan ? "flex-row-reverse" : ""
        } ${aktif ? "text-primary" : ""}`}
      >
        {children}
        {aktif ? (
          naik ? (
            <ArrowUp className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 shrink-0" />
          )
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-30 transition-opacity group-hover:opacity-70" />
        )}
      </button>
    </th>
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
 * Satu sel harga — klik untuk menyunting, pola yang sama dengan kolom harga di
 * Semua Produk: garis putus-putus sebagai tanda bisa diklik, pensil muncul saat
 * disorot, lalu satu input dengan OK/Batal.
 *
 * Catatan dari `parseHargaAccurate` (mis. "mungkin ribuan terpotong") tampil di
 * bawah angkanya dan TIDAK menghalangi penyuntingan — data Accurate memang
 * memuat baris seperti 145 untuk barang ratusan ribu, dan staff yang sedang
 * membetulkannya justru yang paling butuh bisa mengubahnya.
 */
function SelHarga({
  baris,
  medan,
  bolehEdit,
  sedangDisunting,
  draft,
  setDraft,
  onMulai,
  onSelesai,
  onBatal,
}: {
  baris: BarisTabelHarga
  medan: Medan
  bolehEdit: boolean
  sedangDisunting: boolean
  draft: string
  setDraft: (v: string) => void
  onMulai: () => void
  onSelesai: () => void
  onBatal: () => void
}) {
  const harga = medan === "modal" ? baris.modal : baris.dealer

  if (sedangDisunting) {
    return (
      <div className="flex w-full flex-col gap-1">
        <input
          type="text"
          autoFocus
          inputMode="numeric"
          aria-label={`${LABEL[medan]} untuk ${baris.namaBarang ?? baris.kodeAccurate}`}
          value={draft}
          onChange={(e) => setDraft(formatKetikan(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSelesai()
            if (e.key === "Escape") onBatal()
          }}
          className="w-full rounded border border-input bg-background px-2 py-1 text-right text-xs tabular-nums"
        />
        <div className="flex gap-1">
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

  const angka =
    harga.nilai === null ? (
      <span className="text-muted-foreground">—</span>
    ) : (
      <span className="font-medium tabular-nums">{formatRupiah(harga.nilai)}</span>
    )

  if (!bolehEdit) {
    return (
      <div className="text-right">
        {angka}
        {harga.catatan && <Catatan teks={harga.catatan} />}
      </div>
    )
  }

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
        title={`Klik untuk ubah ${LABEL[medan]}`}
        className="group -m-1 flex cursor-pointer items-center justify-end gap-1 rounded border-b border-dashed border-muted-foreground/50 p-1 transition-colors hover:bg-muted/50"
      >
        {angka}
        <Pencil className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      {harga.catatan && <Catatan teks={harga.catatan} />}
    </div>
  )
}

function Catatan({ teks }: { teks: string }) {
  return (
    <p className="mt-1 flex items-start gap-1 text-left text-[10px] text-warning">
      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
      {teks}
    </p>
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
