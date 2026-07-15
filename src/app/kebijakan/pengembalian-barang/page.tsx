import { PolicyPageLayout } from "@/components/layout/policy-page-layout"

export const metadata = {
  title: "Kebijakan Pengembalian Barang — HNS IT Center",
  description: "Syarat dan ketentuan pengembalian barang di HNS IT Center.",
}

export default function PengembalianBarangPage() {
  return (
    <PolicyPageLayout title="Kebijakan Pengembalian Barang" breadcrumbLabel="Pengembalian Barang">
      <p>
        HNS IT Center menerima pengembalian barang untuk kasus tertentu, dengan syarat
        dan ketentuan berikut.
      </p>

      <h2>Syarat Pengembalian</h2>
      <ul>
        <li>
          Pengajuan pengembalian dilakukan paling lambat{" "}
          <strong>[KONFIRMASI: berapa hari sejak barang diterima]</strong> setelah barang
          diterima.
        </li>
        <li>Barang belum digunakan, dalam kondisi dan kemasan asli (dus, aksesori, label).</li>
        <li>Melampirkan bukti pembelian (nomor invoice/struk) dan foto/video kondisi barang.</li>
        <li>
          Kerusakan yang diklaim adalah cacat produksi/tidak sesuai pesanan — bukan
          kerusakan akibat pemakaian, kesalahan pemasangan, atau kecelakaan di luar
          tanggung jawab toko.
        </li>
      </ul>

      <h2>Barang yang Tidak Dapat Dikembalikan</h2>
      <ul>
        <li>Produk yang sudah dirakit khusus sesuai pesanan (Custom PC Builder).</li>
        <li>Lisensi software/aktivasi digital yang sudah diaktifkan.</li>
        <li>
          <strong>[KONFIRMASI: kategori lain yang tidak bisa diretur, mis. consumable
          seperti tinta printer]</strong>
        </li>
      </ul>

      <h2>Cara Mengajukan Pengembalian</h2>
      <ol>
        <li>Hubungi CS kami via WhatsApp dengan menyertakan nomor invoice dan foto/video barang.</li>
        <li>Tim kami akan memverifikasi kelayakan pengembalian dalam <strong>[KONFIRMASI: berapa hari kerja]</strong>.</li>
        <li>Jika disetujui, barang dikirim/dibawa ke toko untuk pemeriksaan lebih lanjut.</li>
      </ol>

      <p>
        Untuk pertanyaan lebih lanjut, silakan hubungi kami melalui halaman{" "}
        <a href="/contact">Kontak Kami</a>.
      </p>
    </PolicyPageLayout>
  )
}
