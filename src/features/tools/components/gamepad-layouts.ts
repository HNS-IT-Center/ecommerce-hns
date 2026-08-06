/**
 * Koordinat presisi tiap sprite tombol gamepad.
 *
 * ============================================================================
 * DARI MANA ANGKA INI BERASAL
 * ============================================================================
 *
 * BUKAN hasil kira-kira. Setiap nilai diturunkan dari berkas sumber GIMP
 * (`.xcf`) milik Gamepad-Asset-Pack (AL2009man) — berkas yang sama yang dipakai
 * meng-ekspor PNG di `public/gamepad/`. Layer di dalamnya menyimpan offset
 * absolut tiap sprite terhadap kanvas, jadi angkanya sama persis dengan posisi
 * sprite saat digambar.
 *
 * Kanvas sumber:
 *   Xbox  — 1102 x 686   (`XBSeries_base.xcf`)
 *   PS    — 1729 x 1042  (`DualSense Controller Layout VSCView.xcf`)
 *
 * Semua disimpan sebagai PERSEN terhadap kanvas, bukan piksel. Jadi pembungkus
 * boleh berukuran berapa pun dan sprite tetap menempel di tempatnya — itu juga
 * sebabnya nilai ini tidak perlu diubah walau nanti gambarnya diperbesar.
 *
 * CATATAN RESOLUSI: PNG Xbox di project ini 2x lebih besar daripada layer di
 * `.xcf` (mis. `XBSeries_A_Button.png` = 162x157, layernya 80x77). Karena semua
 * dinyatakan dalam persen, faktor 2x itu tidak berpengaruh — rasionya identik.
 * PNG PlayStation berskala 1:1 dengan kanvasnya.
 *
 * ============================================================================
 * KENAPA INI ADA
 * ============================================================================
 *
 * Versi sebelumnya menumpuk SEMUA sprite dengan `w-[550px]` lalu
 * `-translate-x-1/2 -translate-y-1/2`. Sprite-nya bukan layer sepenuh kanvas
 * melainkan potongan kecil dengan ukuran berbeda-beda (162x157 sampai 498x172),
 * jadi setiap tombol diregangkan seukuran kontroler DAN ditaruh di titik yang
 * sama persis di tengah. Akibatnya semua tombol muncul menumpuk di tengah alih-
 * alih di posisinya masing-masing.
 */

/** Kotak sprite dalam persen terhadap kanvas sumber. */
export type SpriteBox = {
  left: number
  top: number
  width: number
  height: number
}

export type StickGeometry = {
  /** Tutup analog yang ikut bergerak. */
  cap: SpriteBox
  /** Kotak sprite yang tampil saat stick DITEKAN (L3/R3). */
  click: SpriteBox
  /** Gambar khusus keadaan tertekan — beda dari `src` tutup yang bergerak. */
  clickSrc: string
  /**
   * Jarak gerak maksimum tutup analog.
   *
   * Dinyatakan relatif terhadap ukuran TUTUP, bukan kanvas: `translate(%)` pada
   * `<img>` dihitung dari elemen itu sendiri. Besarnya = (soket − tutup) / 2,
   * yaitu sisa ruang sebelum tutup menyentuh tepi cekungannya.
   */
  travelX: number
  travelY: number
}

export type GamepadLayout = {
  /** Rasio kanvas sumber — dipakai pembungkus agar proporsinya tepat. */
  aspectRatio: string
  base: string
  /** Sprite per indeks tombol Gamepad API standar. */
  buttons: Record<number, { src: string; box: SpriteBox }>
  sticks: {
    left: StickGeometry & { src: string }
    right: StickGeometry & { src: string }
  }
}

// ---------------------------------------------------------------------------
// XBOX — kanvas 1102 x 686
// ---------------------------------------------------------------------------

const XBOX_DIR = "/gamepad/xbox"

export const XBOX_LAYOUT: GamepadLayout = {
  aspectRatio: "1102 / 686",
  base: `${XBOX_DIR}/base.svg`,
  buttons: {
    0: { src: `${XBOX_DIR}/XBSeries_A_Button.png`, box: { left: 72.323, top: 47.959, width: 7.26, height: 11.224 } },
    1: { src: `${XBOX_DIR}/XBSeries_B_Button.png`, box: { left: 79.129, top: 37.026, width: 7.532, height: 11.516 } },
    2: { src: `${XBOX_DIR}/XBSeries_X_Button.png`, box: { left: 65.336, top: 38.047, width: 7.713, height: 11.662 } },
    3: { src: `${XBOX_DIR}/XBSeries_Y_Button.png`, box: { left: 72.323, top: 26.968, width: 7.895, height: 11.808 } },
    4: { src: `${XBOX_DIR}/XBSeries_LeftBumper_Active.png`, box: { left: 13.521, top: 7.143, width: 22.414, height: 12.536 } },
    5: { src: `${XBOX_DIR}/XBSeries_RightBumper_Active.png`, box: { left: 63.793, top: 7.289, width: 22.595, height: 12.391 } },
    6: { src: `${XBOX_DIR}/XBSeries_LeftTrigger_Active.png`, box: { left: 15.154, top: 1.02, width: 10.889, height: 13.557 } },
    7: { src: `${XBOX_DIR}/XBSeries_RightTrigger_Active.png`, box: { left: 72.958, top: 1.02, width: 10.889, height: 12.099 } },
    8: { src: `${XBOX_DIR}/XBSeries_ViewButton.png`, box: { left: 39.746, top: 40.233, width: 5.263, height: 7.726 } },
    9: { src: `${XBOX_DIR}/XBSeries_MenuButton.png`, box: { left: 54.628, top: 40.087, width: 5.263, height: 7.726 } },
    12: { src: `${XBOX_DIR}/XBSeries_D-PAD_Up.png`, box: { left: 34.12, top: 58.017, width: 4.9, height: 7.143 } },
    13: { src: `${XBOX_DIR}/XBSeries_D-PAD_Down.png`, box: { left: 34.211, top: 71.429, width: 4.809, height: 7.726 } },
    14: { src: `${XBOX_DIR}/XBSeries_D-PAD_Left.png`, box: { left: 28.857, top: 64.869, width: 5.626, height: 7.289 } },
    15: { src: `${XBOX_DIR}/XBSeries_D-PAD_Right.png`, box: { left: 38.838, top: 64.869, width: 5.535, height: 7.143 } },
    16: { src: `${XBOX_DIR}/XBSeries_HomeButton.png`, box: { left: 45.463, top: 21.72, width: 8.802, height: 13.265 } },
    17: { src: `${XBOX_DIR}/XBSeries_ShareButton.png`, box: { left: 46.824, top: 50.0, width: 5.989, height: 5.248 } },
  },
  sticks: {
    left: {
      src: `${XBOX_DIR}/XBSeries_LeftStick.png`,
      cap: { left: 17.967, top: 37.609, width: 11.252, height: 17.93 },
      click: { left: 16.878, top: 33.528, width: 13.43, height: 20.408 },
      clickSrc: `${XBOX_DIR}/XBSeries_LeftStick_Click.png`,
      travelX: 9.7,
      travelY: 6.9,
    },
    right: {
      src: `${XBOX_DIR}/XBSeries_RightStick.png`,
      cap: { left: 57.441, top: 61.079, width: 11.434, height: 17.347 },
      click: { left: 56.443, top: 56.997, width: 13.339, height: 20.408 },
      clickSrc: `${XBOX_DIR}/XBSeries_RightStick_Click.png`,
      travelX: 8.3,
      travelY: 8.8,
    },
  },
}

// ---------------------------------------------------------------------------
// PLAYSTATION (DualSense) — kanvas 1729 x 1042
// ---------------------------------------------------------------------------

const PS_DIR = "/gamepad/ps"

/**
 * PlayStation memakai sumber koordinat yang BERBEDA dari Xbox — dan itu perlu.
 *
 * Angka di bawah diukur langsung dari `ps/base.svg` (lewat label Inkscape yang
 * ada di dalamnya: "Triangle ", "Crosss", "D-PAD Up", "Left Stick", dst),
 * BUKAN dari kanvas `.xcf` seperti Xbox.
 *
 * Alasannya: kedua gambar itu di-crop berbeda.
 *
 *     ps/base.svg          rasio 1.798  (544.70661 x 302.91098)
 *     kanvas .xcf DualSense rasio 1.659  (1729 x 1042)
 *
 * Percobaan pertama memakai offset `.xcf` untuk PlayStation — sama seperti yang
 * berhasil untuk Xbox — dan hasilnya meleset di seluruh tombol, karena
 * persentase dari satu kanvas tidak berlaku di kanvas dengan rasio lain.
 * Xbox kebetulan selamat karena `base.svg`-nya memang sekanvas dengan `.xcf`.
 *
 * Dua sumber galat lain yang ikut hilang dengan mengukur dari SVG:
 *   - Di `.xcf`, tombol muka & D-pad PS hanya tersimpan sebagai GRUP
 *     ("Face Button", "D-PAD"), jadi posisi Triangle/Circle/Square/Cross dulu
 *     DITURUNKAN dengan mengasumsikan tata letak diamond, bukan dibaca.
 *   - `base.svg` punya label per tombol, jadi sekarang setiap kotak berasal
 *     dari bentuk yang benar-benar digambar di gambar yang dipakai.
 */
export const PS_LAYOUT: GamepadLayout = {
  // Rasio viewBox `ps/base.svg` — bukan rasio kanvas .xcf.
  aspectRatio: "544.70661 / 302.91098",
  base: `${PS_DIR}/base.svg`,
  buttons: {
    0: { src: `${PS_DIR}/DualSense_Cross.png`, box: { left: 78.538, top: 58.535, width: 6.927, height: 10.329 } },
    1: { src: `${PS_DIR}/DualSense_Circle.png`, box: { left: 86.307, top: 46.538, width: 6.886, height: 11.44 } },
    2: { src: `${PS_DIR}/DualSense_Square.png`, box: { left: 71.182, top: 47.317, width: 6.962, height: 10.921 } },
    3: { src: `${PS_DIR}/DualSense_Triangle.png`, box: { left: 78.955, top: 35.388, width: 6.96, height: 11.657 } },
    4: { src: `${PS_DIR}/DualSense_L1-Active.png`, box: { left: 10.415, top: 10.412, width: 14.805, height: 15.162 } },
    5: { src: `${PS_DIR}/DualSense_R1-Active.png`, box: { left: 74.726, top: 10.424, width: 14.946, height: 15.234 } },
    6: { src: `${PS_DIR}/DualSense_L2-Active.png`, box: { left: 11.601, top: 0.0, width: 13.727, height: 18.834 } },
    7: { src: `${PS_DIR}/DualSense_R2-Active.png`, box: { left: 74.714, top: 0.025, width: 13.702, height: 18.224 } },
    8: { src: `${PS_DIR}/DualSense_Create_Button.png`, box: { left: 24.073, top: 28.111, width: 3.232, height: 11.045 } },
    9: { src: `${PS_DIR}/DualSense_Option_Button.png`, box: { left: 72.817, top: 27.963, width: 3.214, height: 11.211 } },
    12: { src: `${PS_DIR}/DualSense_D-PAD_Up.png`, box: { left: 14.819, top: 39.283, width: 5.873, height: 12.069 } },
    13: { src: `${PS_DIR}/DualSense_D-PAD_Down.png`, box: { left: 14.874, top: 54.061, width: 5.867, height: 11.673 } },
    14: { src: `${PS_DIR}/DualSense_D-PAD_Left.png`, box: { left: 9.162, top: 47.791, width: 7.223, height: 9.752 } },
    15: { src: `${PS_DIR}/DualSense_D-PAD_Right.png`, box: { left: 19.213, top: 47.82, width: 7.222, height: 9.751 } },
    16: { src: `${PS_DIR}/DualSense_Home_Button.png`, box: { left: 46.97, top: 67.067, width: 6.563, height: 6.261 } },
    // Touchpad tidak punya label sendiri di SVG; "LED" adalah bidang terang di
    // tengah badan yang persis menempati area touchpad.
    17: { src: `${PS_DIR}/DualSense_Touchpad-Click.png`, box: { left: 28.269, top: 23.822, width: 43.514, height: 54.358 } },
  },
  sticks: {
    left: {
      src: `${PS_DIR}/DualSense_LeftAnalogStick.png`,
      cap: { left: 27.674, top: 68.677, width: 11.926, height: 18.132 },
      // "Joystick Zone Outline" = cekungan tempat tutup analog duduk.
      click: { left: 25.902, top: 61.862, width: 15.627, height: 23.187 },
      // DualSense hanya punya SATU aset klik yang dipakai kedua stick.
      clickSrc: `${PS_DIR}/DualSense_AnalogStick_Click.png`,
      travelX: 15.5,
      travelY: 27.9,
    },
    right: {
      src: `${PS_DIR}/DualSense_RightAnalogStick.png`,
      cap: { left: 60.504, top: 68.759, width: 11.927, height: 18.132 },
      click: { left: 58.587, top: 62.111, width: 15.591, height: 23.019 },
      clickSrc: `${PS_DIR}/DualSense_AnalogStick_Click.png`,
      travelX: 15.4,
      travelY: 26.9,
    },
  },
}
