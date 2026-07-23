import { PolicyPageLayout } from "@/components/layout/policy-page-layout"

export const metadata = {
  title: "Kebijakan Pengembalian Dana — HNS IT Center",
  description: "Syarat, metode, dan waktu proses pengembalian dana (refund) di HNS IT Center.",
}

export default function PengembalianDanaPage() {
  return (
    <PolicyPageLayout title="Kebijakan Pengembalian Dana" breadcrumbLabel="Pengembalian Dana">
      <p>
        Pengembalian dana (refund) diproses setelah pengajuan pengembalian barang atau
        pembatalan pesanan disetujui oleh tim kami, mengikuti{" "}
        <a href="/kebijakan/pengembalian-barang">Kebijakan Pengembalian Barang</a> dan{" "}
        <a href="/kebijakan/pembatalan-pesanan">Kebijakan Pembatalan Pesanan</a>.
      </p>

      <h2>Kapan Refund Berlaku</h2>
      <ul>
        <li>Pembatalan pesanan sebelum barang diproses/dikirim.</li>
        <li>Pengajuan pengembalian barang yang sudah disetujui (cacat sejak awal, salah kirim, kurang kirim, atau non-cacat sesuai ketentuan).</li>
        <li>Pembayaran ganda atau transfer yang sudah masuk namun pesanan gagal diproses.</li>
      </ul>

      <h2>Nilai Pengembalian</h2>
      <ul>
        <li><strong>Kesalahan dari kami</strong> (cacat sejak awal, salah kirim, kurang kirim): nilai barang <em>dan</em> ongkos kirim dikembalikan penuh.</li>
        <li><strong>Pengembalian non-cacat</strong>: hanya nilai barang yang dikembalikan (ongkos kirim tidak termasuk), dan dapat dikenakan biaya restocking untuk Custom PC Builder sesuai Kebijakan Pengembalian Barang.</li>
        <li>Voucher atau kode promo yang sudah dipakai tidak dapat dikonversi menjadi uang tunai.</li>
      </ul>

      <h2>Metode Refund</h2>
      <p>
        Karena pemesanan diproses secara manual melalui WhatsApp (belum ada pembayaran
        kartu/online), dana dikembalikan lewat <strong>transfer bank</strong> ke rekening
        atas nama pembeli — rekening yang sama dengan yang digunakan untuk pembayaran,
        kecuali pembeli menyampaikan rekening pengganti atas nama yang sama.
      </p>

      <h2>Waktu Proses</h2>
      <ul>
        <li>Verifikasi dan persetujuan: maksimal <strong>2×24 jam kerja</strong> setelah dokumen/bukti lengkap kami terima.</li>
        <li>Transfer dana: <strong>3–7 hari kerja</strong> setelah pengajuan disetujui.</li>
      </ul>

      <h2>Dokumen yang Diperlukan</h2>
      <ul>
        <li>Nomor invoice/pesanan dan bukti pembayaran.</li>
        <li>Untuk pengembalian barang: bukti pengiriman balik dan hasil pemeriksaan tim kami.</li>
        <li>Untuk pembayaran ganda/gagal: bukti mutasi atau bukti potong dari bank.</li>
      </ul>

      <p>
        Untuk menanyakan status refund, silakan hubungi kami melalui halaman{" "}
        <a href="/contact">Kontak Kami</a> dengan menyertakan nomor invoice.
      </p>
    </PolicyPageLayout>
  )
}
