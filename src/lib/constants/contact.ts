/**
 * Alamat kontak yang ditampilkan ke pelanggan.
 *
 * SATU tempat, bukan literal yang disalin. Alasannya konkret: alamat
 * sebelumnya — `cs@hnsitcenter.co.id` — hidup sebagai tiga salinan terpisah
 * (footer, halaman kontak, JSON-LD di layout), dan domain `.co.id` itu **tidak
 * pernah terdaftar**. `nslookup` menjawab "Non-existent domain".
 *
 * Artinya setiap pelanggan yang mengirim email ke sana merasa sudah
 * menghubungi HNS, lalu menunggu balasan yang tidak akan pernah datang — dan
 * tidak ada seorang pun di HNS yang tahu itu terjadi. Alamat itu juga
 * tercantum di JSON-LD, jadi Google ikut menyajikannya sebagai kontak resmi.
 *
 * Tiga salinan berarti tiga kesempatan untuk memperbaiki sebagian lalu lupa
 * sisanya. Karena itu sekarang satu.
 *
 * **Harus sama dengan `EMAIL_REPLY_TO` di env.** Env itu menentukan ke mana
 * balasan atas email verifikasi & reset password diarahkan; kalau keduanya
 * berbeda, pelanggan melihat satu alamat di situs dan membalas ke alamat lain.
 *
 * **Mailbox-nya harus benar-benar ada di hPanel Hostinger.** MX domain ini
 * menunjuk mx1/mx2.hostinger.com, jadi surat masuk ditampung Hostinger — bukan
 * Gmail, dan tidak butuh akun Google. Tapi mailbox yang tidak dibuat, atau
 * dibuat tapi tidak pernah dibaca, menghasilkan kegagalan diam yang sama
 * seperti domain yang tidak ada. Meneruskannya (forwarder) ke alamat yang
 * memang dibuka setiap hari adalah cara termurah menutup risiko itu.
 */
export const CS_EMAIL = "support@hnsitcenter.id"

/**
 * Akun media sosial resmi HNS.
 *
 * Ditaruh di sini dengan alasan yang sama seperti `CS_EMAIL`: sebelumnya
 * tautannya `href="#"` di DUA tempat — footer dan halaman Tentang Kami — dan
 * dua salinan berarti dua kesempatan memperbaiki sebagian lalu lupa sisanya.
 * Yang di footer bahkan menyebut Facebook & Twitter, dua kanal yang tidak
 * dipakai HNS sama sekali.
 *
 * WhatsApp TIDAK ikut di sini: nomornya sudah hidup sebagai
 * `NEXT_PUBLIC_WHATSAPP_CS_NUMBER` di env dan dirakit `buildWhatsAppUrl()`.
 * Menyalinnya ke sini akan membuat nomor yang sama punya dua sumber, dan yang
 * satu pasti tertinggal saat nomornya berganti.
 */
export const SOCIAL_LINKS = {
  instagram: "https://www.instagram.com/hns.itcenter/",
  tiktok: "https://www.tiktok.com/@hns.itcenter",
} as const

/**
 * Rekening resmi HNS untuk pembayaran.
 *
 * Satu sumber, dengan alasan yang persis sama seperti `CS_EMAIL` di atas —
 * dan di sini taruhannya lebih tinggi: nomor rekening yang salah satu digit
 * mengirim uang pelanggan ke tempat lain, dan tidak seorang pun di HNS yang
 * tahu sampai pelanggannya mengeluh.
 *
 * Daftar ini HANYA boleh memuat metode yang benar-benar bisa dipakai. Footer
 * pernah mencantumkan BNI dan QRIS padahal HNS tidak menerima keduanya;
 * pelanggan bisa sampai ke tahap membayar sebelum CS terpaksa menolaknya —
 * pola yang sama dengan "Harga Member" di CLAUDE.md §2.7. Jangan tambahkan
 * bank ke daftar ini sebelum rekeningnya ada.
 *
 * `nomor` disimpan tanpa spasi/pemisah, karena inilah yang disalin pelanggan
 * ke m-banking. Pemformatan untuk dibaca mata adalah urusan tampilan.
 */
export const BANK_ACCOUNTS = [
  { bank: "BCA", nomor: "0617751333" },
  { bank: "BRI", nomor: "033101557788306" },
  { bank: "Mandiri", nomor: "1090001772227" },
] as const

/**
 * Pemilik seluruh rekening di `BANK_ACCOUNTS`.
 *
 * Ditampilkan bersama nomornya, bukan sekadar keterangan: pelanggan yang
 * melihat nama PT di layar punya cara memastikan ia tidak sedang ditipu
 * seseorang yang menyamar sebagai HNS dan menyodorkan rekening pribadi.
 */
export const BANK_ACCOUNT_HOLDER = "PT. Sentral Berkat Teknologi"
