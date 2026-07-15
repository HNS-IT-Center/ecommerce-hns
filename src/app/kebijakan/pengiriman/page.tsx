import { PolicyPageLayout } from "@/components/layout/policy-page-layout"

export const metadata = {
  title: "Kebijakan Pengiriman — HNS IT Center",
  description: "Area, estimasi waktu, dan opsi pengiriman/pengambilan barang di HNS IT Center.",
}

export default function PengirimanPage() {
  return (
    <PolicyPageLayout title="Kebijakan Pengiriman" breadcrumbLabel="Pengiriman">
      <h2>Area Pengiriman</h2>
      <p>Kami melayani pengiriman ke seluruh Batam dan seluruh Indonesia.</p>

      <h2>Estimasi Waktu</h2>
      <ul>
        <li>Dalam kota Batam: <strong>[KONFIRMASI: berapa hari/jam]</strong>.</li>
        <li>Luar kota/pulau: <strong>[KONFIRMASI: berapa hari, tergantung ekspedisi]</strong>.</li>
      </ul>

      <h2>Ekspedisi</h2>
      <p>
        <strong>
          [KONFIRMASI: kurir/ekspedisi yang dipakai — kurir toko sendiri untuk dalam
          kota Batam, dan/atau jasa ekspedisi seperti JNE/J&amp;T/dst untuk luar kota]
        </strong>
      </p>

      <h2>Biaya Pengiriman</h2>
      <p>
        Biaya pengiriman dihitung berdasarkan berat/dimensi barang dan tujuan
        pengiriman, dikonfirmasi oleh CS kami sebelum pesanan diproses.
      </p>

      <h2>Ambil di Toko (Self Pickup)</h2>
      <p>
        Pesanan juga dapat diambil langsung di salah satu toko kami tanpa biaya
        pengiriman. Lihat lokasi toko di halaman{" "}
        <a href="/stores">Toko Fisik</a>.
      </p>

      <p>
        Untuk pertanyaan lebih lanjut, silakan hubungi kami melalui halaman{" "}
        <a href="/contact">Kontak Kami</a>.
      </p>
    </PolicyPageLayout>
  )
}
