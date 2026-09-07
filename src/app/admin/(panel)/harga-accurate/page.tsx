import Link from "next/link"

import { buildAccuratePricePreview } from "@/lib/services/accurate-price"
import { requirePageView } from "@/lib/auth"
import { bisaAkses } from "@/lib/auth/permissions"
import { listHargaAccurate, ambilOpsiFilter } from "@/lib/api/accurate/price-table"
import { HargaAccurateView } from "./view"
import { TabelHargaView } from "./tabel-harga-view"

/**
 * Halaman harga Accurate, dua tab dengan dua urusan berbeda:
 *
 * - **Daftar Harga** — seluruh barang Accurate beserta tiga harganya. SRP hanya
 *   dibaca; modal (CP) & dealer disunting di sini. Keduanya angka internal.
 * - **Sinkronisasi** — pratinjau selisih harga Accurate vs katalog lalu
 *   menerapkannya. Inilah satu-satunya tab yang menyentuh harga pelanggan.
 *
 * Dipisah karena dipakai orang berbeda pada waktu berbeda: mengisi harga modal
 * barang yang baru datang adalah pekerjaan harian, sedangkan menerapkan harga
 * ke katalog adalah keputusan yang ditinjau. Menaruh keduanya dalam satu layar
 * membuat tombol yang mengubah harga pelanggan berada sejengkal dari kolom yang
 * diketik ratusan kali sehari.
 */
export const metadata = {
  title: "Update Harga",
}

// Selalu segar: harga di Accurate berubah, dan pratinjau basi menyesatkan.
export const dynamic = "force-dynamic"

const TABS = [
  { key: "daftar", label: "Daftar Harga" },
  { key: "sinkronisasi", label: "Sinkronisasi" },
] as const

type Props = {
  searchParams: Promise<{
    tab?: string
    q?: string
    kategori?: string
    brand?: string
    status?: string
    page?: string
  }>
}

export default async function HargaAccuratePage({ searchParams }: Props) {
  const { izin } = await requirePageView("harga-accurate")
  const bolehEdit = bisaAkses(izin, "harga-accurate", "edit")
  // Harga modal punya izinnya sendiri — lihat catatan pada "harga-modal" di
  // lib/auth/permissions.ts. Kasir boleh mengisi harga dealer tanpa ikut
  // melihat margin tiap barang.
  const bolehLihatModal = bisaAkses(izin, "harga-modal", "view")
  const bolehEditModal = bisaAkses(izin, "harga-modal", "edit")

  const sp = await searchParams
  const tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as (typeof TABS)[number]["key"]) : "daftar"

  return (
    <div className="mx-auto max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold">Update Harga</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Harga modal &amp; dealer adalah angka internal — tidak pernah tampil ke pelanggan.
          Harga jual (SRP) hanya berubah lewat tab Sinkronisasi.
        </p>
      </div>

      <div className="mt-6 flex items-center gap-2 border-b border-border">
        {TABS.map((t) => {
          // Penyaring & halaman sengaja TIDAK dibawa saat berpindah tab: keduanya
          // milik daftar harga, dan menyeretnya ke tab sinkronisasi hanya
          // menyisakan parameter yang tak berarti di alamat.
          const aktif = tab === t.key
          return (
            <Link
              key={t.key}
              href={`/admin/harga-accurate?tab=${t.key}`}
              className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                aktif
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
              }`}
            >
              {t.label}
            </Link>
          )
        })}
      </div>

      <div className="mt-6">
        {tab === "daftar" ? (
          <TabDaftar
            searchParams={sp}
            bolehEdit={bolehEdit}
            bolehLihatModal={bolehLihatModal}
            bolehEditModal={bolehEditModal}
          />
        ) : (
          <TabSinkronisasi />
        )}
      </div>
    </div>
  )
}

async function TabDaftar({
  searchParams,
  bolehEdit,
  bolehLihatModal,
  bolehEditModal,
}: {
  searchParams: Awaited<Props["searchParams"]>
  bolehEdit: boolean
  bolehLihatModal: boolean
  bolehEditModal: boolean
}) {
  const filter = {
    q: searchParams.q?.trim() ?? "",
    kategori: searchParams.kategori ?? "",
    brand: searchParams.brand ?? "",
    status: searchParams.status ?? "",
  }
  const page = Number(searchParams.page ?? 1) || 1

  const [hasil, opsi] = await Promise.all([
    listHargaAccurate({ ...filter, page }),
    ambilOpsiFilter(),
  ])

  /**
   * Harga modal yang tidak boleh dilihat TIDAK ikut dikirim ke browser.
   *
   * Menyembunyikan kolomnya di komponen saja tidak cukup: angkanya tetap ada di
   * muatan yang diterima peramban dan bisa dibaca siapa pun yang membuka
   * devtools. Yang tidak dikirim tidak bisa dibaca.
   *
   * Menghapusnya di sini aman TANPA risiko menimpa data, dan itu bergantung
   * pada satu invarian: "edit" selalu mencakup "view". Saat menyimpan, klien
   * mengirim balik kolom yang tidak disunting apa adanya — jadi yang tidak
   * boleh melihat modal akan mengirim null untuknya. Yang menahan null itu
   * adalah izin yang sama: tanpa hak edit modal, `simpanHargaInternal` tidak
   * menyebut kolom `CP` sama sekali dalam perintah UPDATE-nya. Kalau suatu
   * saat "edit" bisa ada tanpa "view", kombinasi itu akan mengosongkan CP dan
   * bagian ini harus ditinjau ulang.
   */
  const rows = bolehLihatModal
    ? hasil.rows
    : hasil.rows.map((r) => ({ ...r, modal: { nilai: null, catatan: null } }))

  return (
    <TabelHargaView
      rows={rows}
      opsi={opsi}
      filter={filter}
      page={hasil.page}
      pageCount={hasil.pageCount}
      total={hasil.total}
      perPage={hasil.perPage}
      bolehEdit={bolehEdit}
      bolehLihatModal={bolehLihatModal}
      bolehEditModal={bolehEditModal}
    />
  )
}

async function TabSinkronisasi() {
  const preview = await buildAccuratePricePreview()
  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">
        Membandingkan harga jual di Accurate dengan katalog. Centang baris yang ingin diterapkan,
        lalu simpan — hanya yang kamu pilih yang berubah.
      </p>
      <HargaAccurateView initial={preview} />
    </>
  )
}
