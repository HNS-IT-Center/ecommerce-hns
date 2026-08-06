import {
  BaubleOrnament,
  CandyCaneOrnament,
  CpuOrnament,
  FanOrnament,
  GarlandBranch,
  GarlandSwag,
  GpuOrnament,
  Holly,
  IcicleStrip,
  PineSprig,
  SnowdriftDivider,
  StarOrnament,
  TreeMini,
  snowPatternDataUri,
} from "./christmas-assets"

/**
 * Lapisan hiasan Natal untuk header, footer, dan dock mobile.
 *
 * KOMPOSISI. Ornamen digantung dari untaian pita di tepi bawah header, dengan
 * panjang tali yang sengaja tidak seragam — hiasan sungguhan tidak pernah rata.
 * Posisinya dinyatakan dalam persen supaya jaraknya tetap proporsional di lebar
 * layar mana pun, bukan menumpuk di satu sisi saat layar melebar.
 *
 * Yang paling ramai ditaruh di sisi kanan atas (dahan cemara + bintang), jauh
 * dari logo di kiri: hiasan tidak boleh berebut perhatian dengan identitas
 * toko.
 *
 * TIGA BREAKPOINT. Header mobile setinggi 64px sudah habis untuk kolom cari,
 * tombol unduh, dan keranjang — hiasan di sana harus menggantung DI BAWAH garis
 * header, bukan di dalamnya. Karena itu tiap ornamen punya `tier`:
 *
 *   "all"      tampil di semua lebar — tiga bola yang jadi tulang punggung mobile
 *   "sm"       menyala dari 640px, saat lebar mulai memberi ruang di antaranya
 *   "lg"       menyala dari 1024px, mengisi sisa untaian di layar lebar
 *
 * Jumlahnya naik 3 → 7 → 12. Kenaikan bertahap ini disengaja: melompat dari 3
 * ke 12 membuat tablet terlihat seperti versi desktop yang kepadatannya salah.
 *
 * AKSESIBILITAS & KINERJA. Seluruh lapisan `pointer-events-none` dan
 * `aria-hidden`, jadi tidak pernah menghalangi klik maupun terbaca pembaca
 * layar. Animasinya halus dan berhenti total saat pengguna meminta
 * `prefers-reduced-motion`.
 */

/**
 * Palet kit desain (`public/christmas-theme/`).
 *
 * Merah dan emas dipakai paling sering: di atas latar PUTIH keduanya punya
 * kontras jauh lebih baik daripada hijau. Hijau dipakai untuk untaian dan
 * sebagian bola sebagai penyeimbang, bukan sebagai warna utama.
 */
const RED = "text-[#ec3013]"
const GOLD = "text-[#c8952a]"
const PINE = "text-[#1f4d3a]"

/** Kelas visibilitas per tingkat kepadatan. */
const TIER_CLASS = {
  all: "",
  sm: "hidden sm:block",
  lg: "hidden lg:block",
} as const

type Ornament = {
  /** Posisi mendatar dalam persen lebar header. */
  left: number
  /** Panjang tali gantungan dalam piksel. */
  drop: number
  size: number
  Icon: typeof CpuOrnament
  /** Kelas warna — bergantian antara merah, emas, dan hijau tua. */
  tone: string
  /** Mulai lebar berapa ornamen ini ikut tampil. */
  tier: keyof typeof TIER_CLASS
  /** Penunda animasi ayunan supaya tidak berayun serempak. */
  delay: string
}

/**
 * Urutan warna dan bentuk diselang-seling supaya tidak ada dua tetangga yang
 * sama. Yang bertingkat `all` sengaja disebar jauh (18%, 50%, 82%) — di layar
 * sempit ketiganya harus terbaca sebagai komposisi yang seimbang, bukan
 * kelompok yang menggerombol di satu sisi.
 */
const ORNAMENTS: Ornament[] = [
  { left: 7, drop: 20, size: 17, Icon: CpuOrnament, tone: RED, tier: "lg", delay: "0s" },
  { left: 14, drop: 30, size: 14, Icon: BaubleOrnament, tone: GOLD, tier: "sm", delay: "0.9s" },
  { left: 18, drop: 16, size: 15, Icon: BaubleOrnament, tone: RED, tier: "all", delay: "1.7s" },
  { left: 25, drop: 26, size: 18, Icon: GpuOrnament, tone: PINE, tier: "lg", delay: "0.4s" },
  { left: 32, drop: 18, size: 15, Icon: CandyCaneOrnament, tone: RED, tier: "sm", delay: "1.3s" },
  { left: 39, drop: 31, size: 15, Icon: FanOrnament, tone: GOLD, tier: "lg", delay: "2.1s" },
  { left: 46, drop: 17, size: 14, Icon: BaubleOrnament, tone: PINE, tier: "sm", delay: "0.7s" },
  { left: 50, drop: 28, size: 16, Icon: BaubleOrnament, tone: GOLD, tier: "all", delay: "1.5s" },
  { left: 57, drop: 19, size: 16, Icon: CpuOrnament, tone: RED, tier: "lg", delay: "0.2s" },
  { left: 64, drop: 29, size: 15, Icon: TreeMini, tone: PINE, tier: "sm", delay: "1.9s" },
  { left: 71, drop: 16, size: 14, Icon: CandyCaneOrnament, tone: RED, tier: "lg", delay: "1.1s" },
  { left: 76, drop: 27, size: 14, Icon: BaubleOrnament, tone: GOLD, tier: "sm", delay: "0.5s" },
  { left: 82, drop: 18, size: 15, Icon: BaubleOrnament, tone: RED, tier: "all", delay: "2.3s" },
  { left: 89, drop: 30, size: 15, Icon: FanOrnament, tone: PINE, tier: "lg", delay: "0.8s" },
  { left: 95, drop: 20, size: 14, Icon: GpuOrnament, tone: RED, tier: "lg", delay: "1.6s" },
]

export function ChristmasHeaderDecor() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 z-0 select-none"
    >
      {/* Dahan cemara di KEDUA sudut, saling cermin. Dengan latar putih,
          hiasan di satu sisi saja membuat header terasa berat sebelah.
          Keduanya baru muncul di `md` — di bawah itu sudut kiri ditempati
          kolom cari yang melebar penuh. */}
      <PineSprig className="absolute -top-2 left-0 hidden h-[38px] w-[76px] text-[#1f4d3a] opacity-90 lg:block" />
      <PineSprig className="absolute -top-1 right-0 hidden h-[46px] w-[92px] -scale-x-100 text-[#1f4d3a] opacity-90 md:block" />
      <StarOrnament className="absolute right-[74px] top-[6px] hidden h-3.5 w-3.5 text-[#c8952a] md:block" />

      {/* Es menggantung tepat di garis bawah header, di belakang untaian.
          Putih di atas header putih tidak akan terlihat, jadi yang dipakai
          adalah pine tipis — terbaca sebagai bayangan es, bukan gumpalan. */}
      <IcicleStrip className="absolute inset-x-0 top-16 h-[14px] w-full text-[#1f4d3a] opacity-[0.13] sm:h-[18px]" />

      {/* Untaian pita menggantung tepat di garis bawah header. Tingginya naik
          bersama lebar layar: lengkungan setinggi 22px yang diregangkan ke
          1440px menjadi nyaris garis lurus. */}
      <GarlandSwag className="absolute inset-x-0 top-[calc(4rem-9px)] h-[18px] w-full text-[#1f4d3a] sm:h-[22px] lg:h-[26px]" />

      {/* Ornamen yang menggantung dari untaian. Ukurannya diatur lewat `style`
          pada pembungkusnya, bukan kelas Tailwind, karena tiap ornamen punya
          ukuran sendiri — kelas dinamis seperti `h-[${n}px]` tidak terbaca
          pemindai Tailwind dan akan hilang saat build. */}
      {ORNAMENTS.map((o, i) => (
        <span
          key={i}
          className={`christmas-ornament absolute block ${o.tone} ${TIER_CLASS[o.tier]}`}
          style={{
            left: `${o.left}%`,
            top: `calc(4rem - 8px + ${o.drop}px)`,
            width: `${o.size}px`,
            height: `${o.size}px`,
            animationDelay: o.delay,
          }}
        >
          {/* tali gantungan, memanjang ke atas menuju untaian */}
          <span
            className="absolute left-1/2 w-px -translate-x-1/2 bg-current opacity-45"
            style={{ height: `${o.drop}px`, bottom: "100%" }}
          />
          <o.Icon className="h-full w-full" />
        </span>
      ))}
    </div>
  )
}

/**
 * Pola salju yang mengisi bidang footer.
 *
 * Footer adalah tempat yang tepat untuk pola ini: isinya tautan pendek dan
 * alamat, bukan paragraf panjang atau tabel spesifikasi, jadi tekstur di
 * belakangnya tidak memperlambat siapa pun yang sedang membaca. Ia juga bidang
 * berwarna sendiri yang sudah terpisah dari isi halaman, sehingga pola di
 * dalamnya terbaca sebagai bagian dari bingkai situs.
 *
 * MEMUDAR KE ATAS. Polanya paling pekat di dasar halaman dan menipis menuju
 * tepi atas footer, jadi pertemuannya dengan isi halaman di atasnya tidak
 * berupa garis tegas. Tanpa ini, batas footer terlihat seperti dua gambar yang
 * ditempel bersebelahan.
 */
export function ChristmasFooterPattern() {
  return (
    <div
      aria-hidden="true"
      className="christmas-pattern pointer-events-none absolute inset-0 z-0 select-none print:hidden"
      style={{
        backgroundImage: snowPatternDataUri(),
        backgroundRepeat: "repeat",
        maskImage: "linear-gradient(to bottom, transparent 0%, #000 38%, #000 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, #000 38%, #000 100%)",
      }}
    />
  )
}

/**
 * Setrip pola pendek tepat di bawah navbar.
 *
 * "Sedikit di navbar" berarti persis itu: satu pita setinggi ~120px yang
 * menyambung dari tepi bawah header lalu memudar habis. Pola yang dipasang DI
 * DALAM navbar akan berada di belakang logo, kolom cari, dan menu kategori —
 * tempat yang paling tidak boleh berisik di seluruh situs.
 *
 * Duduk di `-z-10` relatif terhadap `<main>` halaman, bukan `fixed`: ia bagian
 * dari halaman dan ikut tergulung naik saat halaman digulung, sehingga tidak
 * pernah menempel di belakang isi yang sedang dibaca.
 */
export function ChristmasHeaderPattern() {
  return (
    <div
      aria-hidden="true"
      className="christmas-pattern pointer-events-none absolute inset-x-0 top-0 -z-10 h-[120px] select-none sm:h-[150px] print:hidden"
      style={{
        backgroundImage: snowPatternDataUri(),
        backgroundRepeat: "repeat",
        maskImage: "linear-gradient(to bottom, #000 0%, #000 30%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, #000 0%, #000 30%, transparent 100%)",
      }}
    />
  )
}

/**
 * Ornamen yang menggantung di untaian footer.
 *
 * Untaian footer diputar 180°, jadi lengkungnya berlawanan dengan yang di
 * header: paling TINGGI di tengah dan turun ke kedua tepi. Panjang tali karena
 * itu dibuat mengikuti bentuk tersebut — paling panjang di tengah (sekitar
 * 16px) dan makin pendek ke arah tepi (sekitar 7px). Kalau semuanya dibuat sama
 * panjang, ornamen di tepi akan menggantung di udara jauh di bawah untaiannya.
 *
 * Jumlahnya naik 5 → 9 → 13 mengikuti lebar layar, dengan aturan tier yang sama
 * seperti header. Lebih sedikit daripada header (yang sampai 15) karena footer
 * tetap tempat orang mencari nomor telepon dan tautan kebijakan — meriah, tapi
 * tidak sampai menuntut perhatian.
 */
const FOOTER_ORNAMENTS: Ornament[] = [
  { left: 6, drop: 7, size: 13, Icon: BaubleOrnament, tone: RED, tier: "lg", delay: "0.3s" },
  { left: 13, drop: 9, size: 14, Icon: BaubleOrnament, tone: GOLD, tier: "sm", delay: "1.2s" },
  { left: 20, drop: 11, size: 13, Icon: TreeMini, tone: PINE, tier: "lg", delay: "0.7s" },
  { left: 27, drop: 12, size: 15, Icon: BaubleOrnament, tone: RED, tier: "all", delay: "1.9s" },
  { left: 34, drop: 14, size: 13, Icon: CandyCaneOrnament, tone: RED, tier: "lg", delay: "0.5s" },
  { left: 41, drop: 15, size: 14, Icon: BaubleOrnament, tone: GOLD, tier: "sm", delay: "1.5s" },
  { left: 46, drop: 16, size: 13, Icon: BaubleOrnament, tone: PINE, tier: "all", delay: "0.9s" },
  { left: 54, drop: 16, size: 13, Icon: BaubleOrnament, tone: GOLD, tier: "all", delay: "2.1s" },
  { left: 59, drop: 15, size: 14, Icon: BaubleOrnament, tone: RED, tier: "sm", delay: "0.4s" },
  { left: 66, drop: 14, size: 13, Icon: CandyCaneOrnament, tone: GOLD, tier: "lg", delay: "1.7s" },
  { left: 73, drop: 12, size: 15, Icon: BaubleOrnament, tone: PINE, tier: "all", delay: "0.8s" },
  { left: 80, drop: 11, size: 13, Icon: TreeMini, tone: PINE, tier: "lg", delay: "2.3s" },
  { left: 87, drop: 9, size: 14, Icon: BaubleOrnament, tone: GOLD, tier: "sm", delay: "1.1s" },
  { left: 94, drop: 7, size: 13, Icon: BaubleOrnament, tone: RED, tier: "lg", delay: "0.6s" },
]

/**
 * Hiasan footer: pita cemara di tepi ATAS.
 *
 * Cerminan dari header — kalau navbar menggantungkan hiasan ke bawah, footer
 * menumbuhkannya ke atas. Ornamennya jauh lebih sedikit karena footer adalah
 * tempat orang mencari nomor telepon dan tautan kebijakan, bukan tempat untuk
 * dimeriahkan.
 *
 * Teks footer TIDAK disentuh sama sekali. Hiasan menempel di bingkainya, warna
 * teks tetap seperti hari biasa.
 */
export function ChristmasFooterDecor() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 z-0 select-none"
    >
      {/* Gundukan salju menumpuk di perbatasan footer.

          Diputar 180° dan ditempel di tepi ATAS: bentuk aslinya menumpuk ke
          bawah, sedangkan yang dibutuhkan di sini adalah salju yang menumpuk
          NAIK dari garis footer. Warnanya putih — sama dengan latar halaman di
          atasnya — sehingga yang terlihat adalah footer yang termakan lengkung
          salju, bukan bidang putih yang ditempelkan di atasnya.

          `-translate-y-full` menaruhnya seluruhnya di atas garis footer, jadi
          tidak satu piksel pun menutupi teks di dalamnya. */}
      <div className="absolute inset-x-0 top-0 h-[26px] w-full -translate-y-full overflow-hidden sm:h-[34px] lg:h-[44px]">
        <SnowdriftDivider className="h-full w-full text-background" />
      </div>

      {/* Pita dibalik: lengkungnya menghadap ke atas mengikuti tepi footer.
          Duduk DI ATAS gundukan supaya untaiannya terbaca menempel di
          perbatasan, bukan tenggelam di balik salju. */}
      <GarlandSwag className="absolute inset-x-0 -top-[7px] h-[16px] w-full rotate-180 text-[#1f4d3a] opacity-80 sm:h-[20px] lg:h-[24px]" />

      <PineSprig className="absolute -top-3 left-0 hidden h-[34px] w-[68px] text-[#1f4d3a] opacity-70 md:block" />
      <PineSprig className="absolute -top-3 right-0 hidden h-[34px] w-[68px] -scale-x-100 text-[#1f4d3a] opacity-70 md:block" />

      {/* Holly di sudut kanan hanya di layar lebar — di tablet ia jatuh tepat
          di atas kolom "Metode Pembayaran" dan terbaca seperti noda. */}
      <Holly className="absolute right-[6%] top-[2px] hidden h-[26px] w-[34px] text-[#1f4d3a] opacity-90 lg:block" />

      {/* Ornamen yang menggantung di sepanjang untaian. */}
      {FOOTER_ORNAMENTS.map((o, i) => (
        <span
          key={i}
          className={`christmas-ornament absolute block ${o.tone} ${TIER_CLASS[o.tier]}`}
          style={{
            left: `${o.left}%`,
            top: `${o.drop}px`,
            width: `${o.size}px`,
            height: `${o.size}px`,
            animationDelay: o.delay,
          }}
        >
          <span
            className="absolute left-1/2 w-px -translate-x-1/2 bg-current opacity-40"
            style={{ height: `${o.drop}px`, bottom: "100%" }}
          />
          <o.Icon className="h-full w-full" />
        </span>
      ))}

      {/* Bintang di puncak untaian — satu-satunya ornamen yang tidak
          menggantung, jadi ditulis terpisah dari daftar di atas. */}
      <StarOrnament className="absolute left-1/2 top-[4px] h-3.5 w-3.5 -translate-x-1/2 text-[#c8952a]" />
    </div>
  )
}

/**
 * Hiasan dock mobile: dahan lurus di tepi atas.
 *
 * Dock hanya setinggi 60px dan memuat lima target sentuh — tidak ada ruang
 * untuk ornamen menggantung, dan apa pun yang menjorok ke dalam akan menutupi
 * ikon. Yang dipakai adalah `GarlandBranch` (dahan LURUS), bukan untaian
 * melengkung: di tinggi 12px lengkungannya tidak terbaca sebagai lengkungan,
 * hanya sebagai garis yang tebalnya tidak rata.
 *
 * Semuanya duduk di ATAS garis dock (`-top-[9px]`), jadi tidak satu piksel pun
 * memakan area yang harus tetap bisa ditekan.
 */
export function ChristmasDockDecor() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 -top-[9px] z-0 select-none"
    >
      <GarlandBranch className="h-[12px] w-full text-[#1f4d3a] opacity-85" />
      <BaubleOrnament className="absolute left-[12%] top-[4px] h-3 w-3 text-[#ec3013]" />
      <BaubleOrnament className="absolute left-1/2 top-[3px] h-2.5 w-2.5 -translate-x-1/2 text-[#1f4d3a]" />
      <BaubleOrnament className="absolute right-[12%] top-[4px] h-3 w-3 text-[#c8952a]" />
    </div>
  )
}
