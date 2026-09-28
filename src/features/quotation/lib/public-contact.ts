import { normalizePhone } from "@/features/stores/lib/maps"

import { MIN_DIGIT_NOMOR } from "./customer-edit"

/**
 * Ke mana tombol "Tanya via WhatsApp" di halaman penawaran publik mengarah, dan
 * apa bunyinya.
 *
 * Dua tujuan, dan yang menentukan bukan preferensi melainkan KETERSEDIAAN:
 *
 *  - **Nomor sales terisi** → pelanggan langsung sampai ke orang yang melayani
 *    dia. Inilah yang diinginkan: ia sudah pernah bicara dengan orang itu, dan
 *    diminta mengulang seluruh ceritanya ke orang lain adalah alasan paling
 *    sering pelanggan berhenti membalas.
 *  - **Nomor sales kosong** → jatuh ke Customer Service, dan pesannya
 *    MENYEBUTKAN nama sales-nya. Dua hal sekaligus: CS tahu siapa yang sedang
 *    menangani pelanggan ini sebelum menjawab, dan tahu bahwa sales tersebut
 *    belum mengisi nomor WhatsApp-nya di profil. Tanpa kalimat itu, CS menerima
 *    pertanyaan tentang penawaran yang tidak pernah ia buat, tanpa petunjuk
 *    harus dioper ke siapa.
 *
 * Fungsi murni tanpa efek samping: ia tidak membaca database dan tidak
 * menyentuh harga. Yang dikirim pemanggil sudah berupa nilai jadi.
 */

export type PublicContactTarget = {
  /** Nomor tujuan, sudah dinormalisasi ke format 62…. */
  number: string
  message: string
  /** `true` kalau pesannya jatuh ke CS karena nomor sales belum diisi. */
  keCs: boolean
}

export function buildPublicContactTarget(input: {
  code: string
  revision: number
  customerName: string | null
  salesName: string | null
  /** `users.phone_number` milik pemilik quotation, apa adanya. */
  salesPhone: string | null
  /** Nomor CS toko — selalu ada, ia yang menjadi jaring terakhir. */
  csNumber: string
}): PublicContactTarget {
  const { code, revision, customerName, salesName, salesPhone, csNumber } = input

  const nomorDokumen = revision > 1 ? `${code} (Rev. ${revision})` : code
  // Pelanggan anonim tidak punya nama tersimpan; kalimatnya tetap harus utuh.
  const perkenalan = customerName?.trim() ? `saya ${customerName.trim()}` : "saya"

  /**
   * Nomor sales dinilai dengan ambang yang sama dengan nomor pelanggan: kolom
   * yang sama, teks bebas yang sama, dan kegagalan yang sama kalau diloloskan —
   * wa.me tetap terbuka, lalu berbunyi "nomor tidak valid" di depan pelanggan.
   * Lebih baik jatuh ke CS daripada mendarat di halaman buntu.
   */
  const nomorSales = salesPhone ? normalizePhone(salesPhone) : ""

  if (nomorSales.length >= MIN_DIGIT_NOMOR) {
    const sapaan = salesName?.trim() ? `Halo Kak ${salesName.trim()}` : "Halo HNS IT Center"
    return {
      number: nomorSales,
      keCs: false,
      message:
        `${sapaan}, ${perkenalan}. Saya ingin menanyakan penawaran rakitan PC ` +
        `dengan nomor ${nomorDokumen}.`,
    }
  }

  const sebutSales = salesName?.trim()
    ? `Penawaran ini dibuat oleh Sales ${salesName.trim()}, tapi nomor WhatsApp-nya belum ` +
      `terdaftar di sistem sehingga pesan saya masuk ke sini.`
    : ""

  return {
    number: normalizePhone(csNumber),
    keCs: true,
    message:
      `Halo HNS IT Center, ${perkenalan}. Saya ingin menanyakan penawaran rakitan PC ` +
      `dengan nomor ${nomorDokumen}.` +
      (sebutSales ? `\n\n${sebutSales}` : ""),
  }
}
