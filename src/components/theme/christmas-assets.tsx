/**
 * Aset dekorasi tema Natal.
 *
 * SVG inline, bukan berkas PNG. Alasannya bukan sekadar ukuran: bentuknya tajam
 * di layar kepadatan berapa pun, warnanya ikut token tema lewat `currentColor`,
 * dan tidak ada permintaan jaringan tambahan yang menunda tampilan header.
 *
 * ARAH DESAIN — "Natal versi toko komputer".
 * Hiasan Natal di situs ritel hampir selalu jatuh ke gambar kartun: manusia
 * salju, Sinterklas, mata besar. Itu justru yang dilarang panduan merek HNS
 * (lihat PROJECT_BRIEF §4.1: hindari tone kekanak-kanakan). Jadi ornamen di
 * sini dibentuk dari kosakata tokonya sendiri — bola natal berbentuk die CPU,
 * kipas casing, dan kartu grafis. Meriah, tapi tetap terbaca sebagai toko yang
 * menjual RTX 5090.
 *
 * Semua bentuk digambar di viewBox 0 0 24 24 supaya bisa ditukar-tukar bebas.
 */

type OrnamentProps = { className?: string }

/** Bola natal berbentuk die prosesor, lengkap dengan kaki pin. */
export function CpuOrnament({ className }: OrnamentProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      {/* gantungan */}
      <path d="M12 1v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="12" cy="5" r="1.4" fill="currentColor" />
      {/* badan die */}
      <rect x="6" y="7" width="12" height="12" rx="2" fill="currentColor" />
      {/* substrat dalam, dibiarkan tembus supaya terbaca sebagai chip */}
      <rect x="9" y="10" width="6" height="6" rx="1" fill="#ffffff" opacity="0.9" />
      {/* pin di empat sisi */}
      <g stroke="currentColor" strokeWidth="1.1" strokeLinecap="round">
        <path d="M9 7V5.5M12 7V5.5M15 7V5.5" />
        <path d="M9 20.5V19M12 20.5V19M15 20.5V19" />
        <path d="M5.5 10H4M5.5 13H4M5.5 16H4" />
        <path d="M20 10h-1.5M20 13h-1.5M20 16h-1.5" />
      </g>
    </svg>
  )
}

/** Bola natal berbentuk kipas casing. */
export function FanOrnament({ className }: OrnamentProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M12 1v2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="12" cy="4.6" r="1.3" fill="currentColor" />
      <circle cx="12" cy="14" r="8" fill="currentColor" />
      {/* tiga bilah, diputar 120° satu sama lain */}
      <g fill="#ffffff" opacity="0.92">
        <path d="M12 14c0-3.2 1.2-5 3.4-5.6C16.6 9.6 15.4 12.4 12 14z" />
        <path d="M12 14c2.8 1.6 3.4 3.5 2.6 5.6C13.2 19 11.6 16.4 12 14z" />
        <path d="M12 14c-2.8 1.6-4.6 1.2-6-.6C7.2 11.6 9.8 12 12 14z" />
      </g>
      <circle cx="12" cy="14" r="1.7" fill="#ffffff" />
    </svg>
  )
}

/** Bola natal klasik dengan garis pita — penyeimbang di antara ornamen teknis. */
export function BaubleOrnament({ className }: OrnamentProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M12 1v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      {/* tutup logam */}
      <rect x="10" y="3" width="4" height="2.6" rx="0.6" fill="currentColor" />
      <circle cx="12" cy="14" r="8.2" fill="currentColor" />
      {/* sorot cahaya: memberi kesan bulat tanpa gradient */}
      <ellipse cx="9.2" cy="10.6" rx="2" ry="2.6" fill="#ffffff" opacity="0.35" />
      {/* pita melingkar */}
      <path
        d="M4.2 15.4c5-1.6 10.6-1.6 15.6 0"
        stroke="#ffffff"
        strokeWidth="1.3"
        opacity="0.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Bintang puncak pohon, dipakai sebagai aksen tunggal. */
export function StarOrnament({ className }: OrnamentProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M12 2.5l2.4 6.1 6.6.4-5.1 4.2 1.7 6.4L12 16.1l-5.6 3.5 1.7-6.4-5.1-4.2 6.6-.4z"
        fill="currentColor"
      />
    </svg>
  )
}

/** Bola natal berbentuk kartu grafis — ornamen paling "toko komputer". */
export function GpuOrnament({ className }: OrnamentProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M12 1v2.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="12" cy="4.6" r="1.3" fill="currentColor" />
      {/* badan kartu */}
      <rect x="3" y="8" width="18" height="10" rx="1.6" fill="currentColor" />
      {/* dua kipas */}
      <circle cx="8.5" cy="13" r="2.6" fill="#ffffff" opacity="0.92" />
      <circle cx="15.5" cy="13" r="2.6" fill="#ffffff" opacity="0.92" />
      <circle cx="8.5" cy="13" r="0.8" fill="currentColor" />
      <circle cx="15.5" cy="13" r="0.8" fill="currentColor" />
      {/* konektor PCIe */}
      <path d="M6 18v1.6M9 18v1.6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  )
}

/** Tongkat permen — ornamen Natal klasik, penyeimbang yang hangat. */
export function CandyCaneOrnament({ className }: OrnamentProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M8 21V11a4.5 4.5 0 019 0"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      {/* garis serong putih, memberi ciri khas tongkat permen */}
      <g stroke="#ffffff" strokeWidth="1.1" strokeLinecap="round" opacity="0.9">
        <path d="M6.8 19.2l2.4-1.4M6.8 15.6l2.4-1.4M7.4 12.2l2.2-1.6M10.4 8.6l1.6-2M14 8.2l1 -2.2" />
      </g>
    </svg>
  )
}

/**
 * Kepingan salju. Enam lengan dengan cabang kecil — bentuk heksagonal yang
 * benar, bukan bintang enam sudut yang sering dipakai sebagai jalan pintas.
 */
export function Snowflake({ className }: OrnamentProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        {/* tiga sumbu utama, saling 60° */}
        <path d="M12 2v20M3.3 7l17.4 10M3.3 17l17.4-10" />
        {/* cabang di tiap ujung */}
        <g strokeWidth="1.2">
          <path d="M12 5.4l-2 -2M12 5.4l2 -2M12 18.6l-2 2M12 18.6l2 2" />
          <path d="M6.4 8.8l-2.7 .3M6.4 8.8l-.4-2.7M17.6 15.2l2.7-.3M17.6 15.2l.4 2.7" />
          <path d="M6.4 15.2l-2.7-.3M6.4 15.2l-.4 2.7M17.6 8.8l2.7.3M17.6 8.8l.4-2.7" />
        </g>
      </g>
    </svg>
  )
}

/**
 * Untaian pita natal yang menggantung di bawah tepi header.
 *
 * Digambar sebagai satu SVG selebar penuh dengan `preserveAspectRatio="none"`
 * supaya lengkungannya meregang mengikuti lebar layar — bukan diulang seperti
 * pola, yang akan terlihat terpotong di lebar ganjil.
 */
export function GarlandSwag({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1200 28"
      preserveAspectRatio="none"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      {/* dua lengkung dengan fase berbeda: yang belakang lebih pucat sehingga
          untaiannya terbaca punya kedalaman, bukan satu garis datar */}
      <path
        d="M0 2c150 22 300 22 450 4s300-18 450 4 300 18 300 4"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.35"
        strokeLinecap="round"
      />
      <path
        d="M0 0c150 20 300 20 450 2s300-20 450 2 300 20 300 2"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * Dahan cemara yang menyembul dari sudut header.
 *
 * Sengaja asimetris dan dipotong bingkai: dahan yang utuh dan tersusun rapi
 * terbaca sebagai stiker yang ditempel, sedangkan yang terpotong terbaca
 * sebagai dahan yang menjulur masuk ke dalam bidang.
 */
export function PineSprig({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 60" className={className} fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeLinecap="round">
        {/* batang utama */}
        <path d="M-4 8C24 12 52 22 78 40" strokeWidth="2.4" />
        {/* jarum, makin pendek makin ke ujung */}
        <g strokeWidth="1.7" opacity="0.95">
          <path d="M10 10L4 0M10 10L2 20" />
          <path d="M24 14L19 3M24 14L15 23" />
          <path d="M38 19L34 8M38 19L29 28" />
          <path d="M52 26L49 15M52 26L43 34" />
          <path d="M64 33L62 23M64 33L56 40" />
          <path d="M74 39L73 30M74 39L67 45" />
        </g>
      </g>
    </svg>
  )
}
