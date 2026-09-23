"use client"

import WhatsappIcon from "@/components/icons/whatsapp-icon"
import { normalizePhone } from "@/features/stores/lib/maps"
import { buildWhatsAppUrl } from "@/lib/api/whatsapp"

import { buildFollowUpMessage } from "../lib/follow-up-message"

type Props = {
  customerName: string | null
  /** Nomor apa adanya seperti diketik staff. Dinormalisasi di sini. */
  customerPhone: string | null
  salesName: string
  code: string
  revision: number
  /** Total yang SUDAH diformat rupiah di server (CLAUDE.md §2.7). */
  totalText: string
}

/**
 * Nomor yang terlalu pendek untuk bisa jadi nomor HP Indonesia.
 *
 * Kolomnya teks bebas — staff bisa terlanjur menyimpan "-", "0812" setengah
 * jadi, atau nomor telepon rumah. wa.me tetap membuka halaman untuk nomor
 * seperti itu, hanya saja isinya "nomor tidak valid" setelah aplikasi WhatsApp
 * terbuka. Lebih baik tombolnya tidak ada sama sekali daripada ada tapi selalu
 * berakhir buntu.
 */
const MIN_DIGIT_NOMOR = 10

/**
 * Tombol "Follow up via WhatsApp" di halaman detail quotation.
 *
 * Komponen KLIEN, dan itu keseluruhan alasannya ada: sapaan "pagi/siang/sore/
 * malam" dihitung saat tombol DITEKAN, bukan saat halaman dirender. Halaman
 * detailnya `force-dynamic` tapi tetap bisa dibiarkan terbuka berjam-jam di
 * tab sales — pesan yang menyapa "Selamat pagi" pada pukul dua siang adalah
 * hal pertama yang dibaca pelanggan.
 *
 * `window.open` dipanggil LANGSUNG di dalam gestur klik, tanpa `await` apa pun
 * sebelumnya, jadi tidak tersangkut popup blocker (docs/17 §11.5).
 *
 * Sengaja tidak dipasang di `/verify` (kasir tidak pernah melihat nomor HP,
 * docs/17 §6) maupun di daftar `/profile/quotation` (nomornya disamarkan di
 * sana, dan tiap kartunya sudah terbungkus tautan ke detail).
 */
export function FollowUpWaButton({
  customerName,
  customerPhone,
  salesName,
  code,
  revision,
  totalText,
}: Props) {
  const nomor = customerPhone ? normalizePhone(customerPhone) : ""
  if (nomor.length < MIN_DIGIT_NOMOR) return null

  const handleClick = () => {
    const pesan = buildFollowUpMessage(
      { customerName, salesName, code, revision, totalText },
      new Date(),
    )
    window.open(buildWhatsAppUrl(nomor, pesan), "_blank", "noopener,noreferrer")
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1EBE5A] active:bg-[#17A74C]"
    >
      <WhatsappIcon size={16} />
      Follow up via WhatsApp
    </button>
  )
}
