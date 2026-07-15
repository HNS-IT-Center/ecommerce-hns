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
        pesanan juga dilakukan melalui komunikasi langsung dengan tim CS kami.
      </p>

      <h2>Kapan Pesanan Bisa Dibatalkan</h2>
      <ul>
        <li>Pesanan dapat dibatalkan selama barang belum diproses/dikemas untuk pengiriman.</li>
        <li>
          Setelah barang dikirim, pembatalan mengikuti{" "}
          <a href="/kebijakan/pengembalian-barang">Kebijakan Pengembalian Barang</a>.
        </li>
      </ul>

      <h2>Pesanan Custom PC Builder</h2>
      <p>
        Untuk pesanan rakitan PC custom yang sudah mulai dirakit, pembatalan{" "}
        <strong>
          [KONFIRMASI: apakah tetap bisa dibatalkan penuh, atau kena biaya komponen yang
          sudah dipesan/dirakit]
        </strong>
        .
      </p>

      <h2>Cara Membatalkan Pesanan</h2>
      <ol>
        <li>Hubungi CS via WhatsApp dengan menyertakan nomor invoice/pesanan.</li>
        <li>Sampaikan alasan pembatalan.</li>
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
