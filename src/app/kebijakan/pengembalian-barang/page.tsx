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

      <h2>Kelayakan Pengembalian</h2>
      <ul>
        <li>
          <strong>Produk cacat sejak awal</strong> (tidak menyala/tidak berfungsi): wajib
          dilaporkan maksimal <strong>3×24 jam</strong> sejak barang diterima, disertai
          foto/video kondisi barang (idealnya video unboxing).
        </li>
        <li>
          <strong>Kesalahan pengiriman atau kekurangan barang</strong>: wajib dilaporkan
          maksimal <strong>3×24 jam</strong> dengan bukti foto/video.
        </li>
        <li>
          <strong>Pengembalian non-cacat</strong> (berubah pikiran, salah pilih produk):
          dapat diajukan dalam <strong>5 hari kalender</strong> sejak tanggal pembelian,
          dengan syarat barang masih tersegel, belum digunakan, dan kemasan lengkap.
        </li>
      </ul>

      <h2>Syarat Barang yang Dikembalikan</h2>
      <ul>
        <li>Kondisi seperti baru — dus, segel, manual, kabel, aksesori, bonus, dan invoice lengkap.</li>
        <li>Tidak ada kerusakan fisik, goresan, bekas pemasangan, atau nomor seri yang hilang/tidak sesuai.</li>
      </ul>

      <h2>Barang yang Tidak Dapat Dikembalikan</h2>
      <ul>
        <li>Produk yang sudah dirakit khusus sesuai pesanan (Custom PC Builder) — kecuali cacat sejak awal.</li>
        <li>Lisensi software/aktivasi digital dan kode voucher yang sudah diaktifkan.</li>
        <li>Produk consumable yang kemasannya sudah dibuka (mis. tinta/toner printer, thermal paste, pelindung layar).</li>
        <li>Komponen yang sudah dipasang atau dimodifikasi (mis. prosesor dengan pin bengkok).</li>
        <li>Produk promo, clearance, atau yang ditandai sebagai final sale.</li>
      </ul>

      <h2>Custom PC Builder</h2>
      <p>
        Untuk PC rakitan yang sudah mulai dikerjakan, pengembalian non-cacat dikenakan
        biaya restocking sebesar <strong>10% dari nilai transaksi</strong> (menutup biaya
        perakitan dan pemeriksaan komponen). Penggantian komponen mengikuti ketersediaan
        stok saat itu.
      </p>

      <h2>Cara Mengajukan Pengembalian</h2>
      <ol>
        <li>Hubungi CS kami via WhatsApp dengan menyertakan nomor invoice, kronologi singkat, dan foto/video barang.</li>
        <li>Tim kami akan memverifikasi kelayakan pengembalian maksimal <strong>2 hari kerja</strong>.</li>
        <li>Barang hanya dikirim/dibawa ke toko setelah pengembalian disetujui oleh tim kami.</li>
      </ol>

      <h2>Biaya Pengiriman Pengembalian</h2>
      <ul>
        <li>Cacat sejak awal, salah kirim, atau kekurangan barang: ongkos kirim ditanggung HNS IT Center.</li>
        <li>Pengembalian non-cacat: ongkos kirim menjadi tanggung jawab pembeli.</li>
      </ul>

      <p>
        Untuk pertanyaan lebih lanjut, silakan hubungi kami melalui halaman{" "}
        <a href="/contact">Kontak Kami</a>.
      </p>
    </PolicyPageLayout>
  )
}
