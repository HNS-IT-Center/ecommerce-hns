import { SnowSpeck, SnowflakeTick } from "./christmas-assets"

/**
 * Turunnya salju di bawah navbar.
 *
 * DESAIN. Salju jatuh dari tepi bawah header dan memudar habis sekitar 180px
 * ke bawah — bukan menyelimuti seluruh halaman. Alasannya keterbacaan: partikel
 * yang melintas di atas daftar produk dan harga mengganggu orang yang sedang
 * membandingkan spesifikasi, dan itu menyalahi tujuan halamannya. Efeknya
 * dibiarkan hidup hanya di pita sempit tepat di bawah navbar, tempat ia terbaca
 * sebagai kelanjutan hiasan header.
 *
 * BENTUK. Memakai dua aset teringan dari kit: kepingan tiga garis (`snowflake-
 * dot`) untuk keping yang dekat, dan bulatan berkontur (`snow-speck`) untuk yang
 * jauh. Kepingan bercabang enam lengan sengaja TIDAK dipakai di sini — di ukuran
 * 6–12px cabangnya menyatu menjadi gumpalan, jadi detailnya hanya menambah beban
 * gambar tanpa terlihat.
 *
 * Kedalaman dibuat lewat tiga lapis: keping yang "dekat" berukuran besar,
 * lebih pekat, dan jatuh cepat; yang "jauh" kecil, pucat, dan lambat. Tanpa
 * pembedaan ini salju terlihat seperti satu bidang datar yang bergerak.
 *
 * JANGKAUAN. Pitanya setinggi sepertiga layar (`33vh`), diukur dari bawah
 * navbar. Nilai relatif, bukan piksel tetap, supaya perbandingannya sama di
 * ponsel maupun monitor lebar — 180px yang dulu dipakai adalah setengah layar
 * ponsel tapi hanya seperlima monitor desktop.
 *
 * Setengah layar sempat dipertimbangkan dan ditolak: di ponsel, salju setinggi
 * itu jatuh tepat di atas baris produk pertama, yang persis masalah yang
 * membuat efek ini dibatasi sejak awal. Sepertiga sudah cukup jauh untuk
 * terbaca sebagai cuaca sungguhan, dan berhenti sebelum daftar produk.
 *
 * `min()` menjaga batas atasnya di 320px: di layar pendek yang dipakai
 * mendatar, 33vh bisa jatuh di bawah 200px dan efeknya hilang; di layar sangat
 * tinggi, 33vh menjadi 400px lebih dan salju mulai menutupi terlalu banyak.
 *
 * Sebagian keping disembunyikan di bawah `sm` — 14 keping di lebar 360px
 * terbaca sebagai badai, bukan hiasan.
 *
 * Seluruh lapisan `pointer-events-none` + `aria-hidden`, dan berhenti total
 * saat pengguna meminta `prefers-reduced-motion` — gerakan berulang tanpa henti
 * adalah pemicu yang nyata bagi sebagian orang.
 */

type Flake = {
  /** Posisi mendatar, persen lebar layar. */
  left: number
  /** Ukuran dalam piksel. */
  size: number
  /** Lama satu kali jatuh. */
  duration: number
  /** Penundaan supaya tidak jatuh serempak. */
  delay: number
  /** Kepekatan — mengikat ukuran, menciptakan kesan kedalaman. */
  opacity: number
  /** Seberapa jauh melayang ke samping saat jatuh. */
  drift: number
  /** Keping "dekat" memakai kepingan bergaris; yang "jauh" memakai bulatan. */
  kind: "tick" | "speck"
  /** Keping yang hanya tampil dari `sm` ke atas. */
  wideOnly?: boolean
}

/**
 * Sebaran disusun manual, bukan acak.
 *
 * `Math.random()` di komponen server menghasilkan posisi berbeda antara render
 * server dan klien sehingga memicu hydration mismatch. Selain itu, sebaran acak
 * kerap menggumpal — sebaran yang ditulis tangan justru terlihat lebih alami
 * karena jaraknya bisa diatur supaya tidak ada yang bertumpuk.
 */
const FLAKES: Flake[] = [
  { left: 4, size: 10, duration: 9, delay: 0, opacity: 0.5, drift: 14, kind: "tick" },
  { left: 11, size: 6, duration: 13, delay: 2.4, opacity: 0.3, drift: -10, kind: "speck", wideOnly: true },
  { left: 18, size: 12, duration: 8, delay: 1.1, opacity: 0.55, drift: 18, kind: "tick" },
  { left: 25, size: 5, duration: 14, delay: 4.2, opacity: 0.26, drift: -8, kind: "speck", wideOnly: true },
  { left: 33, size: 9, duration: 10, delay: 0.6, opacity: 0.42, drift: 12, kind: "tick" },
  { left: 40, size: 13, duration: 7.5, delay: 3.1, opacity: 0.58, drift: -16, kind: "tick", wideOnly: true },
  { left: 47, size: 6, duration: 12.5, delay: 1.9, opacity: 0.3, drift: 9, kind: "speck" },
  { left: 55, size: 11, duration: 8.5, delay: 5, opacity: 0.5, drift: -13, kind: "tick" },
  { left: 62, size: 7, duration: 11, delay: 2.7, opacity: 0.36, drift: 15, kind: "speck", wideOnly: true },
  { left: 69, size: 13, duration: 7.8, delay: 0.3, opacity: 0.56, drift: -11, kind: "tick" },
  { left: 76, size: 5, duration: 13.5, delay: 3.8, opacity: 0.26, drift: 7, kind: "speck", wideOnly: true },
  { left: 83, size: 10, duration: 9.5, delay: 1.5, opacity: 0.46, drift: -14, kind: "tick" },
  { left: 90, size: 7, duration: 11.5, delay: 4.6, opacity: 0.34, drift: 10, kind: "speck", wideOnly: true },
  { left: 96, size: 11, duration: 8.2, delay: 2.1, opacity: 0.5, drift: -9, kind: "tick" },
]

export function ChristmasSnow() {
  return (
    <div
      aria-hidden="true"
      className="christmas-snow pointer-events-none fixed inset-x-0 top-16 z-40 overflow-hidden print:hidden"
    >
      {FLAKES.map((flake, i) => (
        <span
          key={i}
          className={`christmas-flake absolute top-0 block text-[#1f4d3a] ${
            flake.wideOnly ? "hidden sm:block" : ""
          }`}
          style={{
            left: `${flake.left}%`,
            width: `${flake.size}px`,
            height: `${flake.size}px`,
            opacity: flake.opacity,
            animationDuration: `${flake.duration}s`,
            animationDelay: `${flake.delay}s`,
            // Dipakai keyframe untuk melayang ke samping — tiap keping
            // punya arah & jarak sendiri.
            ["--drift" as string]: `${flake.drift}px`,
          }}
        >
          {flake.kind === "tick" ? (
            <SnowflakeTick className="h-full w-full" />
          ) : (
            <SnowSpeck className="h-full w-full" />
          )}
        </span>
      ))}
    </div>
  )
}
