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
        <li>Dalam kota Batam: <strong>1–2 hari kerja</strong>.</li>
        <li>Luar kota/pulau: <strong>2–7 hari kerja</strong>, tergantung tujuan dan layanan ekspedisi yang dipilih.</li>
      </ul>
      <p>
        Pesanan yang dikonfirmasi setelah jam operasional toko akan diproses pada hari
        kerja berikutnya.
      </p>

      <h2>Ekspedisi</h2>
      <p>
        Dalam kota Batam menggunakan kurir kami sendiri. Untuk luar kota/pulau, kami
        bekerja sama dengan jasa ekspedisi seperti JNE, J&amp;T, dan sejenisnya — pilihan
        ekspedisi dikonfirmasi bersama CS saat pemesanan.
      </p>

      <h2>Biaya Pengiriman</h2>
      <p>
        Biaya pengiriman dihitung berdasarkan berat/dimensi barang dan tujuan
        pengiriman, dikonfirmasi oleh CS kami sebelum pesanan diproses.
      </p>

      <h2>Kendala Pelacakan Pengiriman</h2>
      <p>
        Jika nomor resi belum bisa dilacak, ini bisa terjadi karena sistem kurir belum
        memperbarui data, kesalahan input nomor resi, atau kendala pengiriman ke area
        tertentu. Jika sudah dipastikan data benar namun resi tetap tidak terlacak,
        silakan hubungi CS kami.
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
