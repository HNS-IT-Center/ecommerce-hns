import { PolicyPageLayout } from "@/components/layout/policy-page-layout"

export const metadata = {
  title: "Kebijakan Pengembalian Dana — HNS IT Center",
  description: "Syarat, metode, dan waktu proses pengembalian dana (refund) di HNS IT Center.",
}

export default function PengembalianDanaPage() {
  return (
    <PolicyPageLayout title="Kebijakan Pengembalian Dana" breadcrumbLabel="Pengembalian Dana">
      <p>
        Pengembalian dana (refund) diproses setelah pengajuan pengembalian barang
        disetujui oleh tim kami, mengikuti{" "}
        <a href="/kebijakan/pengembalian-barang">Kebijakan Pengembalian Barang</a>.
      </p>

      <h2>Metode Refund</h2>
      <ul>
        <li>Refund ditransfer ke rekening bank atas nama pembeli.</li>
        <li>
          Untuk pembayaran yang belum diproses/dikirim (pesanan dibatalkan sebelum
          barang berangkat), refund dapat berupa transfer penuh sesuai metode
          pembayaran awal.
        </li>
      </ul>

      <h2>Waktu Proses</h2>
      <p>
        Dana dikembalikan dalam <strong>[KONFIRMASI: berapa hari kerja]</strong> setelah
        pengajuan disetujui dan barang diterima kembali oleh toko (jika berlaku).
      </p>

      <h2>Potongan Biaya</h2>
      <p>
        <strong>
          [KONFIRMASI: apakah biaya pengiriman/ongkir awal ikut dikembalikan, atau
          hanya harga barang]
        </strong>
      </p>

      <p>
        Untuk menanyakan status refund, silakan hubungi kami melalui halaman{" "}
        <a href="/contact">Kontak Kami</a> dengan menyertakan nomor invoice.
      </p>
    </PolicyPageLayout>
  )
}
