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
 * Kedalaman dibuat lewat tiga lapis: keping yang "dekat" berukuran besar,
 * lebih pekat, dan jatuh cepat; yang "jauh" kecil, pucat, dan lambat. Tanpa
 * pembedaan ini salju terlihat seperti satu bidang datar yang bergerak.
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
  { left: 4, size: 9, duration: 9, delay: 0, opacity: 0.5, drift: 14 },
  { left: 11, size: 6, duration: 13, delay: 2.4, opacity: 0.3, drift: -10 },
  { left: 18, size: 11, duration: 8, delay: 1.1, opacity: 0.55, drift: 18 },
  { left: 25, size: 5, duration: 14, delay: 4.2, opacity: 0.26, drift: -8 },
  { left: 33, size: 8, duration: 10, delay: 0.6, opacity: 0.42, drift: 12 },
  { left: 40, size: 12, duration: 7.5, delay: 3.1, opacity: 0.58, drift: -16 },
  { left: 47, size: 6, duration: 12.5, delay: 1.9, opacity: 0.3, drift: 9 },
  { left: 55, size: 10, duration: 8.5, delay: 5, opacity: 0.5, drift: -13 },
  { left: 62, size: 7, duration: 11, delay: 2.7, opacity: 0.36, drift: 15 },
  { left: 69, size: 12, duration: 7.8, delay: 0.3, opacity: 0.56, drift: -11 },
  { left: 76, size: 5, duration: 13.5, delay: 3.8, opacity: 0.26, drift: 7 },
  { left: 83, size: 9, duration: 9.5, delay: 1.5, opacity: 0.46, drift: -14 },
  { left: 90, size: 7, duration: 11.5, delay: 4.6, opacity: 0.34, drift: 10 },
  { left: 96, size: 10, duration: 8.2, delay: 2.1, opacity: 0.5, drift: -9 },
]

export function ChristmasSnow() {
  return (
    <div
      aria-hidden="true"
      className="christmas-snow pointer-events-none fixed inset-x-0 top-16 z-40 h-[180px] overflow-hidden print:hidden"
    >
      {FLAKES.map((flake, i) => (
        <span
          key={i}
          className="christmas-flake absolute top-0 block rounded-full bg-white"
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
            // Bayangan tipis supaya keping putih tetap terlihat di atas
            // latar yang juga putih.
            boxShadow: "0 0 0 1px rgba(11,61,46,0.10), 0 1px 2px rgba(11,61,46,0.08)",
          }}
        />
      ))}
    </div>
  )
}
