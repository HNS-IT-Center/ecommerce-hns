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
import { ImportSheetButton } from "./import-sheet-button"

/**
 * Halaman harga Accurate — satu layar: daftar seluruh barang Accurate beserta
 * tiga harganya. SRP hanya dibaca; harga jual, modal (CP) & dealer disunting di
 * sini. Modal & dealer angka internal, tidak pernah tampil ke pelanggan.
 *
 * Tab kedua ("Sinkronisasi") DIHAPUS 20 September 2026. Isinya sudah cuma kotak
 * pemberitahuan sejak penerapan harga Accurate dimatikan sehari sebelumnya —
 * tab yang diklik lalu tidak menghasilkan apa pun. Mesinnya sendiri utuh:
 * `HargaAccurateView` di ./view.tsx, `terapkanHargaAction` di ./actions.ts,
 * dan penjaga `PENERAPAN_SP_AKTIF` yang menolak di sisi server. Cara
 * menghidupkannya kembali ada di docs/13 §3 — dan yang harus benar lebih dulu
 * adalah hulunya: harus ada jalur yang membuat SP Accurate menyusul harga web,
 * bukan sebaliknya.
 *
 * Alamat lama `?tab=sinkronisasi` tidak lagi dibaca. Parameternya diabaikan
 * dan halaman tampil apa adanya, jadi bookmark lama tidak patah.
 *
 * Impor data dari Google Sheet TIDAK ikut mati bersama tab itu — ia sekarang
 * berdiri sendiri sebagai tombol di kepala halaman (./import-sheet-button.tsx).
 * Ia mengisi data barang, bukan harga, jadi memang tidak punya urusan dengan
 * penerapan SP yang dimatikan.
 */
export const metadata = {
  title: "Update Harga",
}

// Selalu segar: harga di Accurate berubah, dan pratinjau basi menyesatkan.
export const dynamic = "force-dynamic"

type Props = {
  searchParams: Promise<{
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

  return (
    <div className="mx-auto max-w-6xl">
      {/* Judul & tombol impor berdampingan di layar lebar, bertumpuk di ponsel
          — tombolnya tidak boleh mendesak judul sampai terpotong. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Update Harga</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Harga modal &amp; dealer adalah angka internal — tidak pernah tampil ke pelanggan.
            Harga jual ditetapkan di sini; Accurate adalah salinan yang menyusul.
          </p>
          {/* Sisa tab Sinkronisasi yang dihapus. Staff yang dulu rutin
              menerapkan harga dari Accurate perlu tahu fiturnya DIMATIKAN, bukan
              rusak — tanpa itu yang dicari berikutnya adalah jalan lain yang
              tidak terpantau. Sengaja menyebut PENERAPAN HARGA, bukan
              "sinkronisasi" polos: impor data dari Sheet justru masih jalan. */}
          <p className="mt-1 text-xs text-muted-foreground">
            Penerapan harga otomatis dari Accurate dimatikan 19 September 2026.
          </p>
        </div>
        {/* Menulis ke accurate_products, jadi ikut izin edit halaman ini —
            peran yang cuma boleh melihat tidak diberi tombolnya. */}
        {bolehEdit && <ImportSheetButton />}
      </div>

      <div className="mt-6">
        <TabDaftar
          searchParams={sp}
          bolehEdit={bolehEdit}
          bolehLihatModal={bolehLihatModal}
          bolehEditModal={bolehEditModal}
        />
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
