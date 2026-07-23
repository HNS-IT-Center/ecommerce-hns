import { PolicyPageLayout } from "@/components/layout/policy-page-layout"

export const metadata = {
  title: "Kebijakan Pembatalan Pesanan — HNS IT Center",
  description: "Ketentuan pembatalan pesanan di HNS IT Center.",
}

export default function PembatalanPesananPage() {
  return (
    <PolicyPageLayout title="Kebijakan Pembatalan Pesanan" breadcrumbLabel="Pembatalan Pesanan">
      <p>
        Karena pemesanan saat ini diproses secara manual melalui WhatsApp, pembatalan
        pesanan juga dilakukan melalui komunikasi langsung dengan tim CS kami. Dana yang
        sudah dibayarkan dikembalikan mengikuti{" "}
        <a href="/kebijakan/pengembalian-dana">Kebijakan Pengembalian Dana</a>.
      </p>

      <h2>Kapan Pesanan Bisa Dibatalkan</h2>
      <ul>
        <li><strong>Belum dibayar:</strong> pesanan otomatis dianggap batal jika tidak ada konfirmasi pembayaran setelah dihubungi CS.</li>
        <li><strong>Sudah dibayar, belum diproses/dirakit:</strong> dapat dibatalkan penuh.</li>
        <li><strong>Sudah mulai diproses/dirakit (khusus Custom PC Builder):</strong> lihat bagian di bawah.</li>
        <li><strong>Barang jadi (bukan rakitan) yang sudah dikemas tapi belum dikirim:</strong> masih dapat dibatalkan tanpa biaya tambahan.</li>
        <li>
          <strong>Sudah dikirim:</strong> pesanan tidak dapat dibatalkan — ajukan{" "}
          <a href="/kebijakan/pengembalian-barang">pengembalian barang</a> setelah barang diterima.
        </li>
      </ul>

      <h2>Pesanan Custom PC Builder</h2>
      <p>
        Untuk pesanan rakitan PC custom yang sudah mulai dirakit, pembatalan tetap bisa
        dilakukan namun dikenakan <strong>biaya restocking 10% dari nilai transaksi</strong>{" "}
        untuk menutup biaya komponen yang sudah dipesan/dirakit dan waktu perakitan —
        konsisten dengan{" "}
        <a href="/kebijakan/pengembalian-barang">Kebijakan Pengembalian Barang</a>.
      </p>

      <h2>Pembatalan oleh Kami</h2>
      <p>
        Kami dapat membatalkan pesanan bila stok ternyata tidak tersedia, komponen
        gagal pemeriksaan kualitas, atau ada kesalahan harga/informasi produk. Dalam
        kondisi ini, pembeli akan dihubungi untuk memilih refund penuh atau penggantian
        produk setara.
      </p>

      <h2>Cara Membatalkan Pesanan</h2>
      <ol>
        <li>Hubungi CS via WhatsApp dengan menyertakan nomor invoice/pesanan.</li>
        <li>Sampaikan alasan pembatalan.</li>
        <li>Tim kami memverifikasi status pesanan maksimal <strong>2 hari kerja</strong>.</li>
        <li>
          Jika sudah ada pembayaran, proses pengembalian dana mengikuti{" "}
          <a href="/kebijakan/pengembalian-dana">Kebijakan Pengembalian Dana</a>.
        </li>
      </ol>

      <p>
        Untuk membatalkan pesanan, silakan hubungi kami melalui halaman{" "}
        <a href="/contact">Kontak Kami</a>.
      </p>
    </PolicyPageLayout>
  )
}
