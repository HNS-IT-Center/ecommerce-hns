import { BaubleOrnament, GarlandSwagThin, Stocking } from "./christmas-assets"

/**
 * Untaian Natal yang turun saat kursor menyapu kartu produk.
 *
 * GERAKANNYA. Untaian menggantung di atas bingkai gambar, TURUN ke posisinya
 * saat di-hover, lalu NAIK kembali ke tempat semula saat kursor pergi. Jalur
 * pergi dan pulangnya sama — persis seperti hiasan yang benar-benar
 * diturunkan dari atas.
 *
 * Karena jalurnya simetris, gerakannya dinyatakan sebagai `transition`, bukan
 * `@keyframes`. Itu bukan sekadar lebih ringkas: animasi yang dipasang sebagai
 * keadaan diam akan ikut berjalan sekali saat halaman dimuat — di semua kartu
 * sekaligus, tanpa ada yang menyentuh kursornya. Transition hanya berjalan
 * kalau nilainya berubah, jadi masalah itu tidak bisa terjadi.
 *
 * GERBANG. Seluruh lapisan hanya hidup kalau `--card-decor` bernilai `1`, dan
 * variabel itu HANYA diset tema kartu Natal (lihat `lib/theme/css.ts`). Tanpa
 * tema aktif nilainya 0, dan seluruh hiasan tidak terlihat. Perangkat sentuh
 * ditangani `@media (hover: hover)` di CSS.
 */

/** Ornamen yang menggantung dari untaian, diposisikan mengikuti lengkungnya. */
type CardOrnament = {
  /** Posisi mendatar, persen lebar kartu. */
  left: number
  /**
   * Jarak turun dari tepi atas, persen tinggi lapisan.
   *
   * Nilainya mengikuti lengkung untaian: paling kecil di tepi dan paling besar
   * di tengah, karena untaiannya melengkung turun ke tengah. Ornamen dengan
   * jarak seragam akan terlihat menggantung di udara jauh di bawah talinya.
   */
  top: number
  /**
   * Panjang tali gantungan, dalam piksel.
   *
   * Piksel, bukan persen: `height` berpersen pada elemen ini dihitung terhadap
   * tinggi kotak ornamennya sendiri, bukan terhadap jarak ke untaian — dan itu
   * membuat talinya memendek justru saat ornamennya mengecil.
   */
  cord: number
  size: number
  tone: string
  Icon: typeof BaubleOrnament
  /**
   * Perbandingan lebar:tinggi bentuknya.
   *
   * Bola natal digambar di kotak 24×24 (rasio 1), sedangkan kaus kaki di 64×72
   * (rasio 0.89). Tanpa nilai ini kaus kaki akan dipaksa jadi bujur sangkar dan
   * bentuknya penyok.
   */
  ratio: number
}

const RED = "text-[#ec3013]"
const GOLD = "text-[#c8952a]"

/**
 * Lima ornamen: tiga bola dan dua kaus kaki, diselang-seling.
 *
 * Sengaja tidak lebih. Kartu produk hanya selebar seperempat layar, dan
 * ornamen yang lebih rapat menutupi foto produk — yang justru jadi alasan
 * orang mengarahkan kursor ke sana.
 */
const CARD_ORNAMENTS: CardOrnament[] = [
  { left: 14, top: 21, cord: 7, size: 9, tone: RED, Icon: BaubleOrnament, ratio: 1 },
  { left: 31, top: 31, cord: 9, size: 7.5, tone: GOLD, Icon: Stocking, ratio: 64 / 72 },
  { left: 50, top: 37, cord: 10, size: 9.5, tone: RED, Icon: BaubleOrnament, ratio: 1 },
  { left: 69, top: 31, cord: 9, size: 7.5, tone: GOLD, Icon: Stocking, ratio: 64 / 72 },
  { left: 86, top: 21, cord: 7, size: 9, tone: RED, Icon: BaubleOrnament, ratio: 1 },
]

export function ChristmasCardDecor() {
  return (
    <div
      aria-hidden="true"
      /* `z-[15]`: di atas foto produk tapi DI BAWAH lapisan Quickview (z-20).
         Hiasan yang menutupi tombol Quickview akan menghalangi fungsinya
         justru pada saat ia muncul — keduanya dipicu hover yang sama. */
      className="christmas-card-decor pointer-events-none absolute inset-0 z-[15] select-none overflow-hidden"
    >
      {/* Pembungkus yang dianimasikan. Untaian DAN ornamennya harus bergerak
          sebagai satu benda — kalau masing-masing dianimasikan sendiri,
          ornamennya tertinggal di belakang talinya. */}
      <div className="christmas-card-garland absolute inset-x-0 top-0 h-[46%]">
        <GarlandSwagThin className="absolute inset-x-[-6%] top-0 h-[62%] w-[112%] text-[#1f4d3a]" />

        {CARD_ORNAMENTS.map((o, i) => (
          <span
            key={i}
            className={`absolute block ${o.tone}`}
            style={{
              left: `${o.left}%`,
              top: `${o.top}%`,
              /* Ukurannya dipatok ke SATU sumbu (lebar) lalu tingginya
                 mengikuti lewat `aspect-ratio`. Kalau `width` dan `height`
                 sama-sama persen, masing-masing dihitung terhadap sumbu yang
                 berbeda — bola natal jadi lonjong di kartu yang tidak persegi. */
              width: `${o.size}%`,
              aspectRatio: `${o.ratio}`,
              transform: "translateX(-50%)",
            }}
          >
            {/* tali gantungan menuju untaian di atasnya */}
            <span
              className="absolute left-1/2 w-px -translate-x-1/2 bg-current opacity-50"
              style={{ height: `${o.cord}px`, bottom: "100%" }}
            />
            <o.Icon className="h-full w-full" />
          </span>
        ))}
      </div>
    </div>
  )
}
