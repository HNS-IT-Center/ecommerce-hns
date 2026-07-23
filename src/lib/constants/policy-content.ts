// Konten kebijakan/FAQ yang sudah difinalisasi user (lihat PRE-DEPLOY-CHECKLIST.md,
// item "5 halaman kebijakan/FAQ" 2026-07-23). Dipakai di 2 tempat:
//   1. prisma/seed.ts — isi awal tabel policy_pages/faq_items.
//   2. src/lib/api/policy.ts — fallback kalau database belum dikonfigurasi/gagal,
//      supaya halaman publik tidak pernah kosong/rusak untuk pengunjung asli.

export type PolicyPageContent = {
  slug: string
  title: string
  content: string // HTML
}

export const POLICY_PAGES: PolicyPageContent[] = [
  {
    slug: "pengembalian-barang",
    title: "Kebijakan Pengembalian Barang",
    content: `
<p>HNS IT Center menerima pengembalian barang untuk kasus tertentu, dengan syarat dan ketentuan berikut.</p>
<h2>Kelayakan Pengembalian</h2>
<ul>
<li><strong>Produk cacat sejak awal</strong> (tidak menyala/tidak berfungsi): wajib dilaporkan maksimal <strong>3×24 jam</strong> sejak barang diterima, disertai foto/video kondisi barang (idealnya video unboxing).</li>
<li><strong>Kesalahan pengiriman atau kekurangan barang</strong>: wajib dilaporkan maksimal <strong>3×24 jam</strong> dengan bukti foto/video.</li>
<li><strong>Pengembalian non-cacat</strong> (berubah pikiran, salah pilih produk): dapat diajukan dalam <strong>5 hari kalender</strong> sejak tanggal pembelian, dengan syarat barang masih tersegel, belum digunakan, dan kemasan lengkap.</li>
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
<p>Untuk PC rakitan yang sudah mulai dikerjakan, pengembalian non-cacat dikenakan biaya restocking sebesar <strong>10% dari nilai transaksi</strong> (menutup biaya perakitan dan pemeriksaan komponen). Penggantian komponen mengikuti ketersediaan stok saat itu.</p>
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
<p>Untuk pertanyaan lebih lanjut, silakan hubungi kami melalui halaman <a href="/contact">Kontak Kami</a>.</p>
`.trim(),
  },
  {
    slug: "pengembalian-dana",
    title: "Kebijakan Pengembalian Dana",
    content: `
<p>Pengembalian dana (refund) diproses setelah pengajuan pengembalian barang atau pembatalan pesanan disetujui oleh tim kami, mengikuti <a href="/kebijakan/pengembalian-barang">Kebijakan Pengembalian Barang</a> dan <a href="/kebijakan/pembatalan-pesanan">Kebijakan Pembatalan Pesanan</a>.</p>
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
<p>Karena pemesanan diproses secara manual melalui WhatsApp (belum ada pembayaran kartu/online), dana dikembalikan lewat <strong>transfer bank</strong> ke rekening atas nama pembeli — rekening yang sama dengan yang digunakan untuk pembayaran, kecuali pembeli menyampaikan rekening pengganti atas nama yang sama.</p>
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
<p>Untuk menanyakan status refund, silakan hubungi kami melalui halaman <a href="/contact">Kontak Kami</a> dengan menyertakan nomor invoice.</p>
`.trim(),
  },
  {
    slug: "pembatalan-pesanan",
    title: "Kebijakan Pembatalan Pesanan",
    content: `
<p>Karena pemesanan saat ini diproses secara manual melalui WhatsApp, pembatalan pesanan juga dilakukan melalui komunikasi langsung dengan tim CS kami. Dana yang sudah dibayarkan dikembalikan mengikuti <a href="/kebijakan/pengembalian-dana">Kebijakan Pengembalian Dana</a>.</p>
<h2>Kapan Pesanan Bisa Dibatalkan</h2>
<ul>
<li><strong>Belum dibayar:</strong> pesanan otomatis dianggap batal jika tidak ada konfirmasi pembayaran setelah dihubungi CS.</li>
<li><strong>Sudah dibayar, belum diproses/dirakit:</strong> dapat dibatalkan penuh.</li>
<li><strong>Sudah mulai diproses/dirakit (khusus Custom PC Builder):</strong> lihat bagian di bawah.</li>
<li><strong>Barang jadi (bukan rakitan) yang sudah dikemas tapi belum dikirim:</strong> masih dapat dibatalkan tanpa biaya tambahan.</li>
<li><strong>Sudah dikirim:</strong> pesanan tidak dapat dibatalkan — ajukan <a href="/kebijakan/pengembalian-barang">pengembalian barang</a> setelah barang diterima.</li>
</ul>
<h2>Pesanan Custom PC Builder</h2>
<p>Untuk pesanan rakitan PC custom yang sudah mulai dirakit, pembatalan tetap bisa dilakukan namun dikenakan <strong>biaya restocking 10% dari nilai transaksi</strong> untuk menutup biaya komponen yang sudah dipesan/dirakit dan waktu perakitan — konsisten dengan <a href="/kebijakan/pengembalian-barang">Kebijakan Pengembalian Barang</a>.</p>
<h2>Pembatalan oleh Kami</h2>
<p>Kami dapat membatalkan pesanan bila stok ternyata tidak tersedia, komponen gagal pemeriksaan kualitas, atau ada kesalahan harga/informasi produk. Dalam kondisi ini, pembeli akan dihubungi untuk memilih refund penuh atau penggantian produk setara.</p>
<h2>Cara Membatalkan Pesanan</h2>
<ol>
<li>Hubungi CS via WhatsApp dengan menyertakan nomor invoice/pesanan.</li>
<li>Sampaikan alasan pembatalan.</li>
<li>Tim kami memverifikasi status pesanan maksimal <strong>2 hari kerja</strong>.</li>
<li>Jika sudah ada pembayaran, proses pengembalian dana mengikuti <a href="/kebijakan/pengembalian-dana">Kebijakan Pengembalian Dana</a>.</li>
</ol>
<p>Untuk membatalkan pesanan, silakan hubungi kami melalui halaman <a href="/contact">Kontak Kami</a>.</p>
`.trim(),
  },
  {
    slug: "pengiriman",
    title: "Kebijakan Pengiriman",
    content: `
<h2>Area Pengiriman</h2>
<p>Kami melayani pengiriman ke seluruh Batam dan seluruh Indonesia.</p>
<h2>Estimasi Waktu</h2>
<ul>
<li>Dalam kota Batam: <strong>1–2 hari kerja</strong>.</li>
<li>Luar kota/pulau: <strong>2–7 hari kerja</strong>, tergantung tujuan dan layanan ekspedisi yang dipilih.</li>
</ul>
<p>Pesanan yang dikonfirmasi setelah jam operasional toko akan diproses pada hari kerja berikutnya.</p>
<h2>Ekspedisi</h2>
<p>Dalam kota Batam menggunakan kurir kami sendiri. Untuk luar kota/pulau, kami bekerja sama dengan jasa ekspedisi seperti JNE, J&amp;T, dan sejenisnya — pilihan ekspedisi dikonfirmasi bersama CS saat pemesanan.</p>
<h2>Biaya Pengiriman</h2>
<p>Biaya pengiriman dihitung berdasarkan berat/dimensi barang dan tujuan pengiriman, dikonfirmasi oleh CS kami sebelum pesanan diproses.</p>
<h2>Kendala Pelacakan Pengiriman</h2>
<p>Jika nomor resi belum bisa dilacak, ini bisa terjadi karena sistem kurir belum memperbarui data, kesalahan input nomor resi, atau kendala pengiriman ke area tertentu. Jika sudah dipastikan data benar namun resi tetap tidak terlacak, silakan hubungi CS kami.</p>
<h2>Ambil di Toko (Self Pickup)</h2>
<p>Pesanan juga dapat diambil langsung di salah satu toko kami tanpa biaya pengiriman. Lihat lokasi toko di halaman <a href="/stores">Toko Fisik</a>.</p>
<p>Untuk pertanyaan lebih lanjut, silakan hubungi kami melalui halaman <a href="/contact">Kontak Kami</a>.</p>
`.trim(),
  },
]

export type FaqItemContent = {
  question: string
  answer: string
  sortOrder: number
}

export const FAQ_ITEMS: FaqItemContent[] = [
  {
    question: "Bagaimana cara memesan produk?",
    answer:
      'Cari produk yang diinginkan di katalog, lalu klik tombol "Tambah ke Keranjang" atau "Beli via WhatsApp". Untuk saat ini, semua pesanan dikonfirmasi langsung oleh tim CS kami melalui WhatsApp.',
    sortOrder: 0,
  },
  {
    question: "Apakah bisa bayar di tempat (COD)?",
    answer:
      "COD tersedia untuk area tertentu di Batam — konfirmasikan dengan CS kami via WhatsApp saat pemesanan. Untuk pembelian langsung di toko, pembayaran bisa dilakukan tunai atau transfer di tempat.",
    sortOrder: 1,
  },
  {
    question: "Metode pembayaran apa saja yang diterima?",
    answer:
      "Transfer bank (BCA, Mandiri, BRI, BNI) dan QRIS. Detail rekening akan diinformasikan oleh CS saat konfirmasi pesanan.",
    sortOrder: 2,
  },
  {
    question: "Apakah produk yang dijual bergaransi?",
    answer:
      "Ya, produk laptop dan komponen bergaransi resmi hingga 2 tahun (mengikuti ketentuan distributor masing-masing merek). Detail masa garansi per produk dapat ditanyakan ke CS kami sebelum membeli.",
    sortOrder: 3,
  },
  {
    question: "Bagaimana jika produk yang diterima rusak atau tidak sesuai pesanan?",
    answer:
      "Hubungi CS kami sesegera mungkin melalui WhatsApp dengan bukti foto/video. Lihat detail lengkap di halaman Kebijakan Pengembalian Barang.",
    sortOrder: 4,
  },
  {
    question: "Apakah bisa custom rakit PC (Custom PC Builder)?",
    answer:
      "Bisa. Gunakan fitur PC Builder untuk memilih komponen, atau konsultasi langsung dengan tim kami via WhatsApp untuk rekomendasi sesuai kebutuhan dan budget.",
    sortOrder: 5,
  },
  {
    question: "Apakah HNS IT Center menerima servis laptop/PC?",
    answer:
      "Ya, kami menerima servis dan upgrade hardware. Untuk info lebih lanjut, silakan hubungi CS atau kunjungi toko kami langsung.",
    sortOrder: 6,
  },
  {
    question: "Di mana lokasi toko dan jam operasionalnya?",
    answer:
      "Kami memiliki 2 toko di Batam: Nagoya Gateway dan Nagoya Hill Mall. Lihat alamat dan jam operasional lengkap di halaman Toko Fisik.",
    sortOrder: 7,
  },
]
