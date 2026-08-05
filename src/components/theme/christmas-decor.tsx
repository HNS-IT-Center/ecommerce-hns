import {
  BaubleOrnament,
  CandyCaneOrnament,
  CpuOrnament,
  FanOrnament,
  GarlandSwag,
  GpuOrnament,
  PineSprig,
  StarOrnament,
} from "./christmas-assets"

/**
 * Lapisan hiasan Natal untuk header.
 *
 * KOMPOSISI. Ornamen digantung dari untaian pita di tepi bawah header, dengan
 * panjang tali yang sengaja tidak seragam — hiasan sungguhan tidak pernah rata.
 * Posisinya dinyatakan dalam persen supaya jaraknya tetap proporsional di lebar
 * layar mana pun, bukan menumpuk di satu sisi saat layar melebar.
 *
 * Yang paling ramai ditaruh di sisi kanan atas (dahan cemara + bintang), jauh
 * dari logo di kiri: hiasan tidak boleh berebut perhatian dengan identitas
 * toko. Di bawah `md` sebagian besar disembunyikan — ruang header mobile sudah
 * habis untuk kolom cari dan keranjang.
 *
 * AKSESIBILITAS & KINERJA. Seluruh lapisan `pointer-events-none` dan
 * `aria-hidden`, jadi tidak pernah menghalangi klik maupun terbaca pembaca
 * layar. Animasinya halus dan berhenti total saat pengguna meminta
 * `prefers-reduced-motion`.
 */

type Ornament = {
  /** Posisi mendatar dalam persen lebar header. */
  left: number
  /** Panjang tali gantungan dalam piksel. */
  drop: number
  size: number
  Icon: typeof CpuOrnament
  /** Kelas warna — bergantian antara merah, emas, dan hijau tua. */
  tone: string
  /** Ornamen yang disembunyikan di layar sempit. */
  hideOnMobile?: boolean
  /** Penunda animasi ayunan supaya tidak berayun serempak. */
  delay: string
}

/**
 * Palet hiasan: merah Natal, emas, dan hijau cemara.
 *
 * Dipakai bergantian dengan merah paling dominan. Di atas latar PUTIH, merah
 * dan emas punya kontras jauh lebih baik daripada hijau — hijau dipakai
 * secukupnya sebagai penyeimbang, bukan warna utama.
 */
const RED = "text-[#c1121f]"
const GOLD = "text-[#c9992e]"
const PINE = "text-[#0b6b4f]"

const ORNAMENTS: Ornament[] = [
  { left: 8, drop: 18, size: 17, Icon: CpuOrnament, tone: RED, delay: "0s", hideOnMobile: true },
  { left: 16, drop: 27, size: 13, Icon: BaubleOrnament, tone: GOLD, delay: "0.9s", hideOnMobile: true },
  { left: 24, drop: 14, size: 15, Icon: CandyCaneOrnament, tone: RED, delay: "1.7s", hideOnMobile: true },
  { left: 33, drop: 24, size: 18, Icon: GpuOrnament, tone: PINE, delay: "0.4s", hideOnMobile: true },
  { left: 41, drop: 16, size: 14, Icon: BaubleOrnament, tone: RED, delay: "1.3s", hideOnMobile: true },
  { left: 49, drop: 28, size: 15, Icon: FanOrnament, tone: GOLD, delay: "2.1s", hideOnMobile: true },
  { left: 57, drop: 15, size: 13, Icon: BaubleOrnament, tone: PINE, delay: "0.7s", hideOnMobile: true },
  { left: 65, drop: 25, size: 16, Icon: CpuOrnament, tone: RED, delay: "1.5s", hideOnMobile: true },
  { left: 73, drop: 17, size: 14, Icon: CandyCaneOrnament, tone: GOLD, delay: "0.2s", hideOnMobile: true },
  { left: 81, drop: 26, size: 15, Icon: FanOrnament, tone: RED, delay: "1.9s", hideOnMobile: true },
  { left: 88, drop: 15, size: 13, Icon: BaubleOrnament, tone: GOLD, delay: "1.1s", hideOnMobile: true },
  { left: 95, drop: 22, size: 14, Icon: GpuOrnament, tone: RED, delay: "0.5s", hideOnMobile: true },
]

export function ChristmasHeaderDecor() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 z-0 select-none"
    >
      {/* Dahan cemara di KEDUA sudut, saling cermin. Dengan latar putih,
          hiasan di satu sisi saja membuat header terasa berat sebelah.
          Yang kiri dibuat lebih kecil dan diberi jarak dari logo. */}
      <PineSprig className="absolute -top-2 left-0 hidden h-[38px] w-[76px] text-[#0b6b4f] opacity-90 lg:block" />
      <PineSprig className="absolute -top-1 right-0 hidden h-[46px] w-[92px] -scale-x-100 text-[#0b6b4f] opacity-90 md:block" />
      <StarOrnament className="absolute right-[74px] top-[6px] hidden h-3.5 w-3.5 text-[#c9992e] md:block" />

      {/* Untaian pita menggantung tepat di garis bawah header. */}
      <GarlandSwag className="absolute inset-x-0 top-[calc(4rem-10px)] h-[22px] w-full text-[#0b6b4f]" />

      {/* Ornamen yang menggantung dari untaian. Ukurannya diatur lewat `style`
          pada pembungkusnya, bukan kelas Tailwind, karena tiap ornamen punya
          ukuran sendiri — kelas dinamis seperti `h-[${n}px]` tidak terbaca
          pemindai Tailwind dan akan hilang saat build. */}
      {ORNAMENTS.map((o, i) => (
        <span
          key={i}
          className={`christmas-ornament absolute block ${o.tone} ${
            o.hideOnMobile ? "hidden md:block" : ""
          }`}
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
 * Hiasan footer: pita cemara di tepi ATAS.
 *
 * Cerminan dari header — kalau navbar menggantungkan hiasan ke bawah, footer
 * menumbuhkannya ke atas. Ornamennya jauh lebih sedikit (tiga saja) karena
 * footer adalah tempat orang mencari nomor telepon dan tautan kebijakan, bukan
 * tempat untuk dimeriahkan.
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
      {/* Pita dibalik: lengkungnya menghadap ke atas mengikuti tepi footer. */}
      <GarlandSwag className="absolute inset-x-0 -top-[6px] h-[20px] w-full rotate-180 text-[#0b6b4f] opacity-80" />

      <PineSprig className="absolute -top-3 left-0 hidden h-[34px] w-[68px] text-[#0b6b4f] opacity-70 md:block" />
      <PineSprig className="absolute -top-3 right-0 hidden h-[34px] w-[68px] -scale-x-100 text-[#0b6b4f] opacity-70 md:block" />

      <BaubleOrnament className="absolute left-[22%] top-[10px] hidden h-3.5 w-3.5 text-[#c1121f] md:block" />
      <StarOrnament className="absolute left-1/2 top-[6px] h-3 w-3 -translate-x-1/2 text-[#c9992e]" />
      <BaubleOrnament className="absolute right-[22%] top-[10px] hidden h-3.5 w-3.5 text-[#c9992e] md:block" />
    </div>
  )
}

/**
 * Hiasan dock mobile: pita tipis di tepi atas.
 *
 * Dock hanya setinggi 60px dan memuat lima target sentuh — tidak ada ruang
 * untuk ornamen menggantung. Cukup satu untaian setipis mungkin plus dua
 * kepingan kecil di sudut, supaya tetap terasa senada dengan header tanpa
 * memakan area yang harus tetap bisa ditekan.
 */
export function ChristmasDockDecor() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 -top-[7px] z-0 select-none"
    >
      <GarlandSwag className="h-[14px] w-full rotate-180 text-[#0b6b4f] opacity-75" />
      <BaubleOrnament className="absolute left-[10%] top-[3px] h-2.5 w-2.5 text-[#c1121f]" />
      <BaubleOrnament className="absolute right-[10%] top-[3px] h-2.5 w-2.5 text-[#c9992e]" />
    </div>
  )
}
