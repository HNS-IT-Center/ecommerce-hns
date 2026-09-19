import Link from "next/link"
import { AlertTriangle } from "lucide-react"

import { requirePageView } from "@/lib/auth"
import { bisaAkses } from "@/lib/auth/permissions"
import {
  listHargaAccurate,
  ambilOpsiFilter,
  isKolomUrut,
  type ArahUrut,
  type FilterTautan,
} from "@/lib/api/accurate/price-table"
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
    urut?: string
    arah?: string
    tautan?: string
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
          Harga jual ditetapkan di sini; Accurate adalah salinan yang menyusul.
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
  // `tautan` bertipe sempit sejak awal — nilai dari alamat divalidasi di sini,
  // dan "" berarti "semua" (bukan penyaring yang gagal dibaca).
  const tautan: FilterTautan | "" =
    searchParams.tautan === "tertaut" ||
    searchParams.tautan === "belum" ||
    searchParams.tautan === "belum-aktif" ||
    searchParams.tautan === "diabaikan"
      ? searchParams.tautan
      : ""

  const filter = {
    q: searchParams.q?.trim() ?? "",
    kategori: searchParams.kategori ?? "",
    brand: searchParams.brand ?? "",
    status: searchParams.status ?? "",
    tautan,
  }
  const page = Number(searchParams.page ?? 1) || 1

  // Nilai urut dari alamat divalidasi di sini, bukan diteruskan mentah: ia
  // berakhir di `ORDER BY`, satu-satunya bagian query yang tidak bisa
  // diparameterkan. `?urut=apa-saja` jatuh ke urutan bawaan, bukan melempar.
  const urut = searchParams.urut && isKolomUrut(searchParams.urut) ? searchParams.urut : undefined
  const arah: ArahUrut | undefined =
    searchParams.arah === "desc" ? "desc" : searchParams.arah === "asc" ? "asc" : undefined

  const [hasil, opsi] = await Promise.all([
    listHargaAccurate({ ...filter, tautan: tautan || undefined, page, urut, arah }),
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
      urut={urut}
      arah={arah}
    />
  )
}

/**
 * Tab Sinkronisasi — PENERAPAN HARGA DIMATIKAN (19 September 2026).
 *
 * Arah datanya sudah terbalik. Dulu Accurate dianggap sumber harga dan web
 * salinannya; sekarang harga ditetapkan di panel web, dan Google Sheet gudang
 * SENGAJA tidak memuat kolom harga (keputusan pemilik project). Akibatnya
 * `accurate_products.SP` tidak punya jalur pembaruan sama sekali — angkanya
 * beku sejak snapshot 28 Agustus 2026.
 *
 * Menerapkannya ke katalog berarti menimpa harga hidup dengan angka tiga pekan
 * lalu. Diukur 18 September 2026 terhadap 527 baris tertaut yang punya SP
 * terbaca: 298 produk harganya akan TURUN (jumlah selisih Rp 378.842.000) dan
 * 71 naik. Sebagian besar produk terbit yang dilihat pelanggan.
 *
 * `HargaAccurateView` di `./view.tsx` beserta `terapkanHargaAction` SENGAJA
 * TIDAK DIHAPUS. Untuk menghidupkan kembali: kembalikan dua baris import
 * (`buildAccuratePricePreview` dan `HargaAccurateView`), ganti blok
 * pemberitahuan di bawah dengan `<HargaAccurateView initial={preview} />`, dan
 * balik `PENERAPAN_SP_AKTIF` di `./actions.ts` — penjaga server tetap menolak
 * selama tanda itu mati, walau UI-nya sudah kembali.
 *
 * Sebelum menghidupkannya, yang harus benar lebih dulu adalah hulunya: harus
 * ada jalur yang membuat SP Accurate menyusul harga web, bukan sebaliknya.
 */
async function TabSinkronisasi() {
  return (
    <div className="rounded-xl border border-warning/40 bg-warning/5 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <div className="min-w-0 space-y-3">
          <h2 className="text-base font-semibold">Penerapan harga Accurate dimatikan</h2>

          <p className="text-sm text-muted-foreground">
            Harga jual sekarang ditetapkan di panel web ini.{" "}
            <strong className="text-foreground">Accurate adalah salinannya</strong> — angka di
            sana perlu disusulkan mengikuti web, bukan sebaliknya.
          </p>

          <p className="text-sm text-muted-foreground">
            Karena Google Sheet gudang tidak memuat kolom harga, angka SRP di Accurate tidak
            pernah diperbarui sejak <strong className="text-foreground">28 Agustus 2026</strong>.
            Menerapkannya ke katalog berarti mengembalikan harga pelanggan ke angka lama —
            pada pengukuran terakhir, 298 produk akan turun harganya tanpa ada yang bermaksud
            menurunkannya.
          </p>

          <div className="rounded-lg border border-border bg-background p-3">
            <p className="text-xs font-medium">Yang dipakai sebagai gantinya:</p>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              <li>
                &middot;{" "}
                <Link
                  href="/admin/harga-accurate?tab=daftar"
                  className="text-primary underline-offset-2 hover:underline"
                >
                  Daftar Harga
                </Link>{" "}
                — menetapkan harga jual, modal, dan dealer
              </li>
              <li>
                &middot;{" "}
                <Link
                  href="/admin/produk"
                  className="text-primary underline-offset-2 hover:underline"
                >
                  Semua Produk
                </Link>{" "}
                — mengubah harga satu produk beserta detailnya
              </li>
            </ul>
          </div>

          <p className="text-xs text-muted-foreground">
            Kodenya masih utuh. Kalau suatu saat ada jalur yang membuat harga Accurate benar-benar
            mutakhir, tab ini bisa dihidupkan lagi tanpa menulis ulang apa pun.
          </p>
        </div>
      </div>
    </div>
  )
}
