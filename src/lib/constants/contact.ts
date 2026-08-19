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
