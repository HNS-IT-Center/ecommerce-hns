/**
 * Aset dekorasi tema Natal.
 *
 * SVG inline, bukan berkas PNG. Alasannya bukan sekadar ukuran: bentuknya tajam
 * di layar kepadatan berapa pun, warnanya ikut token tema lewat `currentColor`,
 * dan tidak ada permintaan jaringan tambahan yang menunda tampilan header.
 *
 * ASAL BENTUK. Bentuk di berkas ini diambil dari kit desain yang dikirim
 * desainer (`public/christmas-theme/`) dan ditulis ulang sebagai komponen React.
 * Berkas SVG aslinya tetap disimpan sebagai rujukan, tapi TIDAK dimuat lewat
 * `<img>`: warnanya dipatok di dalam berkas sehingga tidak bisa ikut token tema,
 * dan tiap aset menjadi satu permintaan jaringan yang membuat hiasan header
 * muncul terlambat setelah teksnya.
 *
 * ARAH DESAIN — "Natal versi toko komputer".
 * Hiasan Natal di situs ritel hampir selalu jatuh ke gambar kartun: manusia
 * salju, Sinterklas, mata besar. Itu justru yang dilarang panduan merek HNS
 * (lihat PROJECT_BRIEF §4.1: hindari tone kekanak-kanakan). Jadi sebagian
 * ornamen dibentuk dari kosakata tokonya sendiri — bola natal berbentuk die CPU,
 * kipas casing, dan kartu grafis — dan diselingi bentuk klasik dari kit desain
 * supaya tetap terbaca sebagai Natal, bukan sekadar pajangan komponen.
 *
 * PALET. Mengikuti kit desain, bukan tebakan sendiri:
 *
 *   #ec3013  accent  bola natal, pita, beri holly
 *   #1f4d3a  pine    untaian, pohon, kepingan salju
 *   #c8952a  gold    bintang, lonceng, aksen
 *   #201e1d  ink     garis, tutup bola, batang
 *
 * Ornamen bertangkai digambar di viewBox 0 0 24 24 supaya bisa ditukar-tukar
 * bebas di daftar hiasan tanpa mengubah ukurannya.
 */

type OrnamentProps = { className?: string }

/** Ink dari kit desain — dipakai untuk tutup bola dan batang, bukan hitam pekat. */
const INK = "#201e1d"

/* -------------------------------------------------------------------------- */
/* Ornamen bertangkai — menggantung dari untaian                              */
/* -------------------------------------------------------------------------- */

/**
 * Bola natal klasik dari kit desain.
 *
 * Badannya `currentColor` supaya satu komponen bisa dipakai untuk ketiga warna
 * kit (merah, emas, hijau) hanya dengan mengganti kelas warnanya. Pita gelap di
 * bawah garis tengah adalah satu-satunya penanda volume — kit ini datar dan
 * tanpa gradien, jadi kesan bulat datang dari potongan bentuk, bukan bayangan.
 */
export function BaubleOrnament({ className }: OrnamentProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      {/* tutup logam */}
      <rect x="9.5" y="1.5" width="5" height="3.6" fill={INK} />
      <circle cx="12" cy="14.5" r="9" fill="currentColor" />
      {/* pita melintang: versi lebih gelap dari badan, dibuat dari currentColor
          yang digelapkan lewat opacity ink supaya ikut warna apa pun */}
      <path
        d="M3.2 12.9h17.6a9 9 0 0 1-.2 3.3H3.4a9 9 0 0 1-.2-3.3z"
        fill={INK}
        opacity="0.28"
      />
    </svg>
  )
}

/** Bola natal berbentuk die prosesor, lengkap dengan kaki pin. */
export function CpuOrnament({ className }: OrnamentProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <rect x="9.5" y="1.5" width="5" height="3" fill={INK} />
      {/* badan die */}
      <rect x="5.5" y="6.5" width="13" height="13" fill="currentColor" />
      {/* substrat dalam, dibiarkan terang supaya terbaca sebagai chip */}
      <rect x="9" y="10" width="6" height="6" fill="#ffffff" opacity="0.92" />
      {/* pin di empat sisi */}
      <g stroke={INK} strokeWidth="1.3" strokeLinecap="butt" opacity="0.85">
        <path d="M8.5 6.5V4.8M12 6.5V4.8M15.5 6.5V4.8" />
        <path d="M8.5 21.2V19.5M12 21.2V19.5M15.5 21.2V19.5" />
        <path d="M5.5 9.5H3.8M5.5 13H3.8M5.5 16.5H3.8" />
        <path d="M20.2 9.5H18.5M20.2 13H18.5M20.2 16.5H18.5" />
      </g>
    </svg>
  )
}

/** Bola natal berbentuk kartu grafis — ornamen paling "toko komputer". */
export function GpuOrnament({ className }: OrnamentProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <rect x="9.5" y="1.5" width="5" height="3" fill={INK} />
      {/* badan kartu */}
      <rect x="2.5" y="7" width="19" height="11" fill="currentColor" />
      {/* dua kipas */}
      <circle cx="8" cy="12.5" r="3" fill="#ffffff" opacity="0.92" />
      <circle cx="16" cy="12.5" r="3" fill="#ffffff" opacity="0.92" />
      <circle cx="8" cy="12.5" r="0.9" fill="currentColor" />
      <circle cx="16" cy="12.5" r="0.9" fill="currentColor" />
      {/* konektor PCIe */}
      <g stroke={INK} strokeWidth="1.3" opacity="0.85">
        <path d="M6 18v2M9.5 18v2" />
      </g>
    </svg>
  )
}

/** Bola natal berbentuk kipas casing. */
export function FanOrnament({ className }: OrnamentProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <rect x="9.5" y="1.5" width="5" height="3" fill={INK} />
      {/* bingkai kipas: persegi, mengikuti bahasa kit yang bersudut tegas */}
      <rect x="3.5" y="6" width="17" height="17" fill="currentColor" />
      <circle cx="12" cy="14.5" r="7" fill="#ffffff" opacity="0.16" />
      {/* tiga bilah, diputar 120° satu sama lain */}
      <g fill="#ffffff" opacity="0.92">
        <path d="M12 14.5c0-3 1.1-4.7 3.2-5.3 1.1 1.1 0 3.7-3.2 5.3z" />
        <path d="M12 14.5c2.6 1.5 3.2 3.3 2.4 5.3-1.3-.6-2.8-3-2.4-5.3z" />
        <path d="M12 14.5c-2.6 1.5-4.3 1.1-5.6-.6 1.1-1.7 3.6-1.3 5.6.6z" />
      </g>
      <circle cx="12" cy="14.5" r="1.6" fill="#ffffff" />
    </svg>
  )
}

/**
 * Tongkat permen dari kit desain.
 *
 * Digambar dengan teknik kit aslinya: satu lengkung ditumpuk tiga kali — garis
 * ink paling tebal sebagai kontur, putih di atasnya, lalu merah putus-putus
 * (`strokeDasharray`) yang menghasilkan garis serong tanpa perlu menggambar
 * tiap garis satu per satu.
 */
export function CandyCaneOrnament({ className }: OrnamentProps) {
  const curve = "M8.5 22.5V11.5A4.6 4.6 0 0 1 17.7 11.5V16"
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <g strokeLinecap="butt">
        <path d={curve} stroke={INK} strokeWidth="7.4" />
        <path d={curve} stroke="#ffffff" strokeWidth="5.6" />
        <path
          d={curve}
          stroke="currentColor"
          strokeWidth="5.6"
          strokeDasharray="3 4.6"
          strokeDashoffset="1.6"
        />
      </g>
    </svg>
  )
}

/** Bintang lima sudut dari kit — dipakai sebagai aksen tunggal, bukan diulang. */
export function StarOrnament({ className }: OrnamentProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
      <path
        d="M32 3l8.6 18.4L60 24.2 45.6 38.1 49.4 58 32 48.2 14.6 58l3.8-19.9L4 24.2l19.4-2.8z"
        fill="currentColor"
      />
    </svg>
  )
}

/** Pohon mini dari kit: dua segitiga bertumpuk di atas batang ink. */
export function TreeMini({ className }: OrnamentProps) {
  return (
    <svg viewBox="0 0 24 28" className={className} fill="none" aria-hidden="true">
      <rect x="10.5" y="21" width="3" height="5" fill={INK} />
      <path d="M12 2 19 12H5zM12 9l9 12H3z" fill="currentColor" />
    </svg>
  )
}

/**
 * Holly dari kit: tiga daun dan tiga beri.
 *
 * Daunnya memakai `currentColor` (hijau) sementara berinya dipatok merah aksen —
 * holly dengan beri hijau tidak terbaca sebagai holly.
 */
export function Holly({ className }: OrnamentProps) {
  return (
    <svg viewBox="0 0 64 48" className={className} fill="none" aria-hidden="true">
      <path d="M4 24c8-12 20-16 28-6-8 10-20 10-28 6z" fill="currentColor" />
      <path d="M60 24c-8-12-20-16-28-6 8 10 20 10 28 6z" fill="currentColor" opacity="0.75" />
      <path d="M20 40c6-10 16-12 22-4-8 8-16 8-22 4z" fill="currentColor" />
      <circle cx="32" cy="20" r="6" fill="#ec3013" />
      <circle cx="43" cy="26" r="5" fill="#b5240e" />
      <circle cx="24" cy="28" r="5" fill="#ec3013" />
    </svg>
  )
}

/* -------------------------------------------------------------------------- */
/* Kepingan salju — tiga bobot, dari kit                                       */
/* -------------------------------------------------------------------------- */

/**
 * Kepingan enam lengan bercabang.
 *
 * Kit menggambarnya dengan satu lengan yang diputar enam kali lewat `<use>`.
 * Cara itu dipertahankan di sini, tapi `id`-nya HARUS unik per instance: dua
 * SVG dengan `id="a"` di satu halaman membuat `<use href="#a">` yang kedua
 * merujuk ke lengan milik SVG pertama. Karena itu id-nya dioper sebagai prop.
 */
export function Snowflake({ className, uid = "sf" }: OrnamentProps & { uid?: string }) {
  const armId = `${uid}-arm`
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
      <g id={armId} stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M32 32V5" />
        <path d="M32 12l-6.5-6.5M32 12l6.5-6.5M32 21l-5.5-5.5M32 21l5.5-5.5" />
      </g>
      {[60, 120, 180, 240, 300].map((deg) => (
        <use key={deg} href={`#${armId}`} transform={`rotate(${deg} 32 32)`} />
      ))}
      <circle cx="32" cy="32" r="3" fill="currentColor" />
    </svg>
  )
}

/** Kepingan padat untuk hiasan besar — bentuk kristal, bukan garis. */
export function SnowflakeCrystal({ className, uid = "sc" }: OrnamentProps & { uid?: string }) {
  const armId = `${uid}-arm`
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
      <g fill="currentColor">
        <g id={armId}>
          <path d="M32 4l5 14-5 6-5-6z" />
          <path d="M32 26l3.5 10-3.5 4-3.5-4z" />
        </g>
        {[60, 120, 180, 240, 300].map((deg) => (
          <use key={deg} href={`#${armId}`} transform={`rotate(${deg} 32 32)`} />
        ))}
        <circle cx="32" cy="32" r="4.5" />
      </g>
    </svg>
  )
}

/**
 * Kepingan tiga garis, 24px.
 *
 * Bentuk termurah di kit — dipakai untuk lapisan salju yang jatuh, tempat
 * puluhan salinan hidup sekaligus. Kepingan bercabang di ukuran 8px hanya
 * menjadi gumpalan, jadi detailnya justru mubazir di sana.
 */
export function SnowflakeTick({ className }: OrnamentProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9" />
      </g>
    </svg>
  )
}

/** Bulatan salju terjauh: putih dengan kontur tipis supaya terlihat di latar putih. */
export function SnowSpeck({ className }: OrnamentProps) {
  return (
    <svg viewBox="0 0 12 12" className={className} fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="3" fill="#ffffff" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

/* -------------------------------------------------------------------------- */
/* Aset struktural — meregang mengikuti lebar                                  */
/* -------------------------------------------------------------------------- */

/**
 * Untaian pita natal yang melengkung di bawah tepi header.
 *
 * Dari kit desain, dengan satu perubahan penting: bola natal yang di kit
 * digambar menempel di untaian DIHILANGKAN. Bola di halaman ini digantung
 * terpisah lewat `ChristmasHeaderDecor` supaya jumlah dan posisinya bisa
 * berubah per breakpoint — bola yang ikut tergambar di dalam SVG akan ikut
 * meregang melar saat untaiannya melebar.
 *
 * `preserveAspectRatio="none"` membuat lengkungannya meregang mengikuti lebar
 * layar, bukan diulang seperti pola yang akan terlihat terpotong di lebar
 * ganjil. Jarumnya digambar dengan `vector-effect="non-scaling-stroke"` supaya
 * tebalnya tetap sama saat SVG-nya dipipihkan.
 */
export function GarlandSwag({ className }: { className?: string }) {
  // Jarum cemara di sepanjang lengkung. Dihitung di sini, bukan ditulis tangan
  // seperti di berkas kit: 42 pasang garis akan menjadi 84 baris yang tidak
  // mungkin diperiksa saat review.
  const needles = Array.from({ length: 41 }, (_, i) => {
    const t = i / 40
    const x = 20 + t * 760
    // Titik pada kurva kuadratik Q400,112 → tinggi lengkung di tengah.
    const y = (1 - t) * (1 - t) * 20 + 2 * (1 - t) * t * 112 + t * t * 20
    // Arah jarum ikut kemiringan kurva supaya tidak semuanya menghadap sama.
    const slope = 2 * (1 - t) * (112 - 20) + 2 * t * (20 - 112)
    const tilt = (slope / 760) * 11
    return { x, y, tilt }
  })

  return (
    <svg
      viewBox="0 0 800 140"
      preserveAspectRatio="none"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M20 20Q400 112 780 20"
        stroke="currentColor"
        strokeWidth="6"
        vectorEffect="non-scaling-stroke"
      />
      <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.72">
        {needles.map((n, i) => (
          <path
            key={i}
            d={`M${n.x.toFixed(1)} ${n.y.toFixed(1)}l${(-13 - n.tilt).toFixed(1)} -11M${n.x.toFixed(
              1
            )} ${n.y.toFixed(1)}l${(5 - n.tilt).toFixed(1)} 11`}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>
    </svg>
  )
}

/**
 * Dahan cemara lurus dari kit — versi datar dari untaian.
 *
 * Dipakai di tepi dock mobile, tempat tinggi yang tersedia hanya belasan piksel
 * dan lengkungan untaian akan tenggelam menjadi garis bergelombang samar.
 */
export function GarlandBranch({ className }: { className?: string }) {
  const needles = Array.from({ length: 24 }, (_, i) => 12 + i * 9.5)
  return (
    <svg
      viewBox="0 0 240 48"
      preserveAspectRatio="none"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <path d="M6 24h228" stroke="currentColor" strokeWidth="5" vectorEffect="non-scaling-stroke" />
      <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.72">
        {needles.map((x, i) => (
          <path key={i} d={`M${x} 24l-6-13M${x} 24l6 13`} vectorEffect="non-scaling-stroke" />
        ))}
      </g>
    </svg>
  )
}

/**
 * Es menggantung di bawah navbar.
 *
 * Dari kit, `preserveAspectRatio="none"` — lebarnya penuh, tingginya bebas.
 * Warnanya `currentColor` supaya bisa dipakai putih di atas header terang
 * maupun sebaliknya.
 */
export function IcicleStrip({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 60"
      preserveAspectRatio="none"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M0 0H320V10L310 54 300 10 290 36 280 10 270 46 260 10 250 24 240 10 230 32 220 10 210 52 200 10 190 40 180 10 170 26 160 10 150 62 140 10 130 30 120 10 110 48 100 10 90 22 80 10 70 34 60 10 50 56 40 10 30 28 20 10 10 44 0 10Z"
        fill="currentColor"
      />
    </svg>
  )
}

/**
 * Gundukan salju yang menumpuk di tepi bawah sebuah bidang.
 *
 * Dari kit (`snowdrift-divider`), `preserveAspectRatio="none"` — lebarnya penuh,
 * tingginya bebas. Dipakai terbalik di tepi ATAS footer supaya salju terlihat
 * menumpuk di perbatasannya, bukan sekadar garis pemisah bergelombang.
 *
 * Dua lapis: bidang padat, lalu satu garis tipis sedikit di bawah puncaknya yang
 * memberi kesan permukaan salju bergelombang. Warna keduanya diserahkan ke
 * pemanggil lewat `currentColor` dan `--drift-line`, karena aset ini harus bisa
 * duduk di atas latar putih maupun abu.
 */
export function SnowdriftDivider({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1440 120"
      preserveAspectRatio="none"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M0 62c90-30 170 8 250-6s130-42 230-28 150 46 250 40 180-46 300-34 250 44 410 22V120H0z"
        fill="currentColor"
      />
      <path
        d="M0 74c90-28 170 10 250-4s130-40 230-26 150 44 250 38 180-44 300-32 250 42 410 20"
        stroke="var(--drift-line, rgba(31,77,58,0.10))"
        strokeWidth="3"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

/**
 * Kaus kaki Natal dari kit — digantung di untaian kartu produk.
 *
 * Badannya `currentColor` supaya bisa ikut warna ornamen di sekitarnya; hanya
 * pinggiran putih dan bayangan tumitnya yang dipatok, karena kaus kaki tanpa
 * pinggiran putih tidak terbaca sebagai kaus kaki Natal.
 */
export function Stocking({ className }: OrnamentProps) {
  return (
    <svg viewBox="0 0 64 72" className={className} fill="none" aria-hidden="true">
      <path
        d="M20 16v26c0 8-14 10-14 20 0 6 6 10 14 10 16 0 24-12 24-24V16z"
        fill="currentColor"
      />
      <path d="M6 58c0 6 6 10 14 10 8 0 14-4 18-10z" fill={INK} opacity="0.25" />
      <rect x="14" y="6" width="36" height="12" fill="#ffffff" />
    </svg>
  )
}

/**
 * Kereta belanja Sinterklas — ikon keranjang versi Natal.
 *
 * Dari kit, dipakai menggantikan ikon keranjang di navbar saat tema Natal
 * menyala. Bentuknya memakai kosakata toko sendiri (kereta belanja) yang
 * dimuati kado dan diberi topi, jadi tetap terbaca sebagai keranjang meskipun
 * berdandan.
 *
 * Garisnya `currentColor` supaya ikut warna teks navbar — termasuk saat
 * di-hover, ketika `text-muted-foreground` berubah jadi `text-foreground`.
 * Isi kado dan topinya tetap berwarna: keranjang yang seluruhnya satu warna
 * kehilangan yang membuatnya terbaca sebagai kereta Natal.
 */
export function SantaCart({ className }: OrnamentProps) {
  return (
    <svg viewBox="0 0 100 74" className={className} fill="none" aria-hidden="true">
      {/* gagang */}
      <path
        d="M4 6h9l7 16"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* dua kado di dalam keranjang */}
      <rect x="36" y="8" width="16" height="14" fill="#ec3013" />
      <rect x="41.5" y="8" width="5" height="14" fill="#ffffff" />
      <rect x="56" y="10" width="14" height="12" fill="#1f4d3a" />
      <rect x="56" y="14" width="14" height="4" fill="#ffffff" />
      {/* badan keranjang */}
      <path
        d="M20 22h68L78 46H30z"
        fill="#ffffff"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <g stroke="currentColor" strokeWidth="2.5">
        <path d="M36 24v20M52 24v20M68 24v20M24 32h60M27 39h54" />
      </g>
      {/* kaki dan roda */}
      <g stroke="currentColor" strokeWidth="4" strokeLinecap="round">
        <path d="M33 46v8M75 46v8" />
      </g>
      <circle cx="33" cy="62" r="7" fill="currentColor" />
      <circle cx="75" cy="62" r="7" fill="currentColor" />
      {/* topi Sinterklas menyampir di tepi keranjang */}
      <path d="M92 2C79 2 70 9 68 15h28c2-5 0-13-4-13z" fill="#ec3013" />
      <rect x="66" y="14" width="32" height="7" fill="#ffffff" stroke="currentColor" strokeWidth="2" />
      <circle cx="92" cy="2" r="5" fill="#ffffff" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

/**
 * Untaian tipis untuk kartu produk.
 *
 * Versi `GarlandSwag` yang jauh lebih ramping: kartu produk berukuran seperempat
 * lebar layar, dan untaian setebal versi header terbaca sebagai batang hijau
 * gemuk yang menutupi foto produk, bukan hiasan.
 *
 * Tanpa `preserveAspectRatio="none"`. Untaian header sengaja dipipihkan
 * mengikuti lebar layar, tapi di kartu produk pemipihan itu justru yang membuat
 * lengkungnya terasa kaku — bentuknya berubah-ubah mengikuti rasio kartu.
 * Di sini lengkungnya dibiarkan menjaga bentuk aslinya.
 */
export function GarlandSwagThin({ className }: { className?: string }) {
  const needles = Array.from({ length: 27 }, (_, i) => {
    const t = i / 26
    const x = 20 + t * 760
    const y = (1 - t) * (1 - t) * 20 + 2 * (1 - t) * t * 120 + t * t * 20
    const slope = 2 * (1 - t) * (120 - 20) + 2 * t * (20 - 120)
    const tilt = (slope / 760) * 13
    return { x, y, tilt }
  })

  return (
    <svg
      viewBox="0 0 800 150"
      preserveAspectRatio="xMidYMid meet"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <path d="M20 20Q400 120 780 20" stroke="currentColor" strokeWidth="7" />
      <g stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.75">
        {needles.map((n, i) => (
          <path
            key={i}
            d={`M${n.x.toFixed(1)} ${n.y.toFixed(1)}l${(-15 - n.tilt).toFixed(1)} -13M${n.x.toFixed(
              1
            )} ${n.y.toFixed(1)}l${(6 - n.tilt).toFixed(1)} 13`}
          />
        ))}
      </g>
    </svg>
  )
}

/**
 * Manusia salju dari kit — dipakai di sudut kanan kartu produk.
 *
 * Satu-satunya aset di kit yang berbentuk figur. Dipakai di sini karena
 * konteksnya hiasan hover yang muncul sesaat di atas foto produk, bukan
 * elemen tetap yang membentuk nada seluruh situs — pengecualian yang tidak
 * menyalahi larangan "tone kekanak-kanakan" di panduan merek.
 *
 * `viewBox` sengaja dimulai dari -4, bukan 0 seperti berkas aslinya: topinya
 * digambar mulai `y="-2"` sehingga bagian atasnya terpotong bingkai di berkas
 * kit. Empat satuan ruang tambahan membuatnya utuh.
 */
export function Snowman({ className }: OrnamentProps) {
  return (
    <svg viewBox="0 -4 56 80" className={className} fill="none" aria-hidden="true">
      {/* badan */}
      <circle cx="28" cy="56" r="18" fill="#ffffff" stroke={INK} strokeWidth="3" />
      <circle cx="28" cy="26" r="12" fill="#ffffff" stroke={INK} strokeWidth="3" />
      {/* topi */}
      <rect x="14" y="8" width="28" height="5" fill={INK} />
      <rect x="19" y="-2" width="18" height="12" fill={INK} />
      <rect x="19" y="6" width="18" height="3" fill="#ec3013" />
      {/* wajah */}
      <circle cx="24" cy="24" r="2" fill={INK} />
      <circle cx="32" cy="24" r="2" fill={INK} />
      <path d="M28 28l10 3-10 3z" fill="#ec3013" />
      {/* kancing */}
      <circle cx="28" cy="50" r="2.5" fill={INK} />
      <circle cx="28" cy="60" r="2.5" fill={INK} />
      {/* tangan ranting */}
      <g stroke={INK} strokeWidth="3" strokeLinecap="round">
        <path d="M11 50L0 42M45 50l11-8" />
      </g>
    </svg>
  )
}

/**
 * Ubin pola salju yang bisa diulang tanpa sambungan terlihat.
 *
 * Kepingan di keempat sudut sengaja diletakkan di 0,0 / 200,0 / 0,200 / 200,200
 * — potongan yang tersisa di satu tepi bertemu potongan pasangannya di tepi
 * seberang saat ubinnya diulang, sehingga sambungannya hilang.
 *
 * Dipakai lewat `background-image` sebagai data URI, BUKAN elemen `<img>` yang
 * diulang: satu elemen yang menutupi hero jauh lebih murah dilukis peramban
 * daripada puluhan node DOM, dan `background-repeat` menangani pengulangannya
 * tanpa kita menghitung berapa ubin yang muat.
 */
export function snowPatternDataUri(): string {
  const flake = "M12 2v20M4.2 6.5l15.6 9M19.8 6.5l-15.6 9"

  /**
   * Posisi, skala, dan warna tiap keping.
   *
   * Sebelas keping pertama disalin dari ubin kit. Delapan sisanya ditambahkan
   * di sini karena ubin aslinya terlalu renggang untuk dipakai sebagai latar
   * seluruh situs: dengan sebelas keping per ubin, sebagian besar bidangnya
   * kosong, dan polanya baru terlihat kalau opacity-nya dinaikkan sampai
   * kepingnya jadi mencolok. Menambah kerapatan membuat polanya TERBACA sebagai
   * pola pada saturasi yang jauh lebih rendah — cara yang benar untuk menjawab
   * "terlalu samar", bukan sekadar menaikkan opacity.
   *
   * Keping tambahan sengaja kecil (skala 0.22–0.35) dan hijau: yang mengisi
   * ruang kosong harus jadi latar bagi yang besar, bukan bersaing dengannya.
   */
  const spots: [number, number, number, string][] = [
    // — ubin asli kit —
    [0, 0, 0.55, "#ec3013"],
    [100, 60, 0.4, "#2f6b50"],
    [40, 120, 0.3, "#2f6b50"],
    [160, 40, 0.55, "#2f6b50"],
    [130, 150, 0.4, "#ec3013"],
    [70, 180, 0.3, "#2f6b50"],
    [200, 200, 0.55, "#2f6b50"],
    [0, 200, 0.4, "#2f6b50"],
    [200, 0, 0.3, "#ec3013"],
    [20, 70, 0.55, "#2f6b50"],
    [180, 110, 0.4, "#2f6b50"],
    // — pengisi, ditambahkan untuk pemakaian sebagai latar situs —
    [60, 30, 0.26, "#2f6b50"],
    [145, 95, 0.22, "#2f6b50"],
    [95, 115, 0.3, "#ec3013"],
    [30, 165, 0.24, "#2f6b50"],
    [170, 175, 0.28, "#2f6b50"],
    [115, 15, 0.24, "#2f6b50"],
    [10, 110, 0.22, "#2f6b50"],
    [75, 75, 0.35, "#2f6b50"],
  ]

  const groups = spots
    .map(
      ([x, y, s, color]) =>
        `<g transform="translate(${x} ${y}) scale(${s}) translate(-12 -12)" stroke="${color}" stroke-width="2.4" stroke-linecap="round"><path d="${flake}"/></g>`
    )
    .join("")

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="none">${groups}</svg>`
  // `encodeURIComponent`, bukan base64: hasilnya lebih pendek untuk SVG dan
  // tetap terbaca saat men-debug CSS yang dihasilkan.
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

/**
 * Dahan cemara yang menyembul dari sudut.
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
        <path d="M-4 8C24 12 52 22 78 40" strokeWidth="2.8" />
        {/* jarum, makin pendek makin ke ujung */}
        <g strokeWidth="1.9" opacity="0.95">
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
