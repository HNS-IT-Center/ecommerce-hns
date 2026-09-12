/**
 * Pemeriksa kewajaran matriks FPS.
 *
 * ## Kenapa perlu, padahal parser sudah menjepit angkanya
 *
 * `parsePrebuildPerformance` menjaga bentuk data: angka tetap di rentang 0-1000
 * dan 1% low tidak melebihi rata-rata. Itu menahan data rusak, tapi tidak
 * menahan data yang BENTUKNYA sah namun isinya mustahil — 1440p High lebih
 * tinggi daripada 720p Low, misalnya. Angka seperti itu lolos diam-diam, dan
 * angka FPS yang salah tidak punya gejala apa pun sampai ada pelanggan yang
 * mengeluh.
 *
 * Yang diperiksa di sini hanya yang bisa diputuskan mesin tanpa tahu perangkat
 * kerasnya: URUTAN antar sel, dan rasio yang di luar nalar. Apakah 87 FPS
 * angka yang tepat untuk paket tertentu — itu penilaian manusia, dan tetap
 * milik staff.
 *
 * ## Ini MENANDAI, bukan memperbaiki
 *
 * Tidak ada satu pun fungsi di sini yang mengubah angka. Membetulkan urutan
 * secara otomatis akan menyembunyikan bahwa modelnya sedang keliru, dan yang
 * tersimpan jadi angka yang tak seorang pun pernah putuskan. Temuan dibawa ke
 * panel admin supaya staff yang memutuskan.
 *
 * Berkas ini hanya mengimpor TIPE, jadi aman dipakai Client Component.
 */
import type { PrebuildGame } from "./games"
import {
  PREBUILD_FPS_QUALITIES,
  PREBUILD_FPS_RESOLUTIONS,
  type PrebuildFpsEntry,
  type PrebuildFpsQuality,
  type PrebuildFpsResolution,
} from "./performance"

export type FpsWarning = {
  gameId: string
  /** Nama game yang terbaca, untuk ditampilkan apa adanya di panel. */
  gameName: string
  message: string
}

/**
 * Rasio 1% low terhadap rata-rata yang menandakan ada yang salah.
 *
 * Di bawah 0,3 hampir selalu berarti model menulis angka asal — bahkan kasus
 * VRAM habis yang paling parah jarang di bawah itu. Di atas 0,95 berarti
 * sebaliknya: 1% low yang praktis sama dengan rata-rata tidak pernah terjadi
 * pada game sungguhan, dan biasanya muncul saat model menyalin satu angka ke
 * dua kolom.
 */
const MIN_LOW_RATIO = 0.3
const MAX_LOW_RATIO = 0.95

/** Di atas ini, angkanya hampir pasti bukan hasil penilaian. */
const IMPLAUSIBLE_AVG = 700

/** Batas temuan yang dilaporkan, supaya panel tidak dibanjiri satu daftar panjang. */
const MAX_WARNINGS = 12

/** Urutan yang benar: setelan makin ringan, FPS makin tinggi. */
const QUALITY_ORDER: readonly PrebuildFpsQuality[] = PREBUILD_FPS_QUALITIES

/** Urutan yang benar: resolusi makin kecil, FPS makin tinggi. */
const RESOLUTION_ORDER: readonly PrebuildFpsResolution[] = PREBUILD_FPS_RESOLUTIONS

function keyOf(resolution: string, quality: string): string {
  return `${resolution}|${quality}`
}

/**
 * Toleransi urutan.
 *
 * Selisih beberapa FPS antara dua sel bertetangga bukan tanda kesalahan — pada
 * game yang dibatasi prosesor, 720p dan 1080p memang bisa nyaris sama, dan
 * menandai itu sebagai galat justru melatih staff mengabaikan peringatan.
 * Yang ditandai adalah urutan yang benar-benar TERBALIK di luar toleransi.
 */
const ORDER_TOLERANCE = 2

/**
 * Berapa game yang boleh berbagi satu angka persis sebelum dianggap janggal.
 *
 * Dua game bernilai sama masih bisa kebetulan. Tiga ke atas hampir selalu
 * berarti angkanya tidak benar-benar dihitung per game — kecuali kalau
 * semuanya tertahan plafon prosesor yang sama, dan itu ikut disebut di pesannya
 * supaya staff bisa langsung menilai mana yang sedang terjadi.
 */
const MAX_GAMES_SHARING_VALUE = 2

/**
 * Rasio sebaran terendah yang masih wajar antar game di satu sel.
 *
 * Daftar game bawaan membentang dari Valorant sampai Red Dead Redemption 2 —
 * jarak sebenarnya di kartu yang sama bisa lima kali lipat. Sebaran di bawah
 * 1,5x berarti seluruh daftar diperlakukan seolah seberat game yang sama.
 */
const MIN_SPREAD_RATIO = 1.5
const MIN_GAMES_FOR_SPREAD = 4

/**
 * Angka yang seragam antar game — cacat paling halus dan paling merusak.
 *
 * Ini yang lolos pada versi pertama tabel acuan: Roblox keluar dengan angka
 * yang sama seperti Apex Legends, karena model tidak diberi bahan untuk
 * membedakan bobot game. Setiap sel-nya sendiri terlihat wajar, urutannya
 * benar, rasio 1% low-nya benar — tidak ada satu pun pemeriksaan per-game yang
 * bisa menangkapnya. Yang menyingkapnya hanya membandingkan ANTAR game.
 */
function checkCrossGame(
  fps: readonly PrebuildFpsEntry[],
  games: readonly PrebuildGame[]
): FpsWarning[] {
  const warnings: FpsWarning[] = []

  for (const resolution of RESOLUTION_ORDER) {
    for (const quality of QUALITY_ORDER) {
      const nilai = games
        .map((g) =>
          fps.find(
            (f) => f.gameId === g.id && f.resolution === resolution && f.quality === quality
          )
        )
        .filter((f): f is PrebuildFpsEntry => f !== undefined && f.avg > 0)
        .map((f) => f.avg)

      if (nilai.length < 3) continue

      const hitungan = new Map<number, number>()
      for (const angka of nilai) hitungan.set(angka, (hitungan.get(angka) ?? 0) + 1)

      for (const [angka, jumlah] of hitungan) {
        if (jumlah > MAX_GAMES_SHARING_VALUE) {
          warnings.push({
            gameId: "",
            gameName: "Antar game",
            message: `${resolution} ${quality}: ${jumlah} game punya angka yang sama persis (${angka} FPS). Wajar hanya kalau semuanya tertahan plafon prosesor — kalau tidak, bobot per game-nya tidak terpakai.`,
          })
        }
      }

      if (nilai.length >= MIN_GAMES_FOR_SPREAD) {
        const min = Math.min(...nilai)
        const max = Math.max(...nilai)
        if (min > 0 && max / min < MIN_SPREAD_RATIO) {
          warnings.push({
            gameId: "",
            gameName: "Antar game",
            message: `${resolution} ${quality}: sebaran antar game cuma ${min}-${max} FPS. Game ringan dan game berat seharusnya berjauhan, biasanya beberapa kali lipat.`,
          })
        }
      }
    }
  }

  return warnings
}

export function checkFpsPlausibility(
  fps: readonly PrebuildFpsEntry[],
  games: readonly PrebuildGame[]
): FpsWarning[] {
  const warnings: FpsWarning[] = []
  const namaGame = new Map(games.map((g) => [g.id, g.name]))

  for (const game of games) {
    const milikGame = fps.filter((f) => f.gameId === game.id)
    const nama = namaGame.get(game.id) ?? game.id

    const tambah = (message: string) => {
      warnings.push({ gameId: game.id, gameName: nama, message })
    }

    if (milikGame.length === 0) {
      tambah("Belum ada satu pun angka FPS untuk game ini.")
      continue
    }

    const sel = new Map(milikGame.map((f) => [keyOf(f.resolution, f.quality), f]))

    // Sel kosong ditandai, tapi TIDAK dianggap nol — "tidak dihitung" adalah
    // pernyataan yang berbeda dari "tidak sanggup menjalankan".
    const kosong = RESOLUTION_ORDER.length * QUALITY_ORDER.length - sel.size
    if (kosong > 0) {
      tambah(`${kosong} dari ${RESOLUTION_ORDER.length * QUALITY_ORDER.length} sel belum terisi.`)
    }

    for (const entry of milikGame) {
      if (entry.avg > IMPLAUSIBLE_AVG) {
        tambah(`${entry.resolution} ${entry.quality}: ${entry.avg} FPS tidak masuk akal.`)
      }

      if (entry.avg > 0) {
        const ratio = entry.low / entry.avg
        if (ratio < MIN_LOW_RATIO) {
          tambah(
            `${entry.resolution} ${entry.quality}: 1% low (${entry.low}) terlalu jauh di bawah rata-rata (${entry.avg}).`
          )
        } else if (ratio > MAX_LOW_RATIO) {
          tambah(
            `${entry.resolution} ${entry.quality}: 1% low (${entry.low}) hampir sama dengan rata-rata (${entry.avg}) — biasanya berarti angkanya disalin.`
          )
        }
      }
    }

    // Setelan makin berat harus makin rendah, pada resolusi yang sama.
    for (const resolution of RESOLUTION_ORDER) {
      for (let i = 1; i < QUALITY_ORDER.length; i += 1) {
        const ringan = sel.get(keyOf(resolution, QUALITY_ORDER[i - 1]))
        const berat = sel.get(keyOf(resolution, QUALITY_ORDER[i]))
        if (!ringan || !berat) continue

        if (berat.avg > ringan.avg + ORDER_TOLERANCE) {
          tambah(
            `${resolution}: setelan ${QUALITY_ORDER[i]} (${berat.avg}) lebih tinggi daripada ${QUALITY_ORDER[i - 1]} (${ringan.avg}).`
          )
        }
      }
    }

    // Resolusi makin besar harus makin rendah, pada setelan yang sama.
    for (const quality of QUALITY_ORDER) {
      for (let i = 1; i < RESOLUTION_ORDER.length; i += 1) {
        const kecil = sel.get(keyOf(RESOLUTION_ORDER[i - 1], quality))
        const besar = sel.get(keyOf(RESOLUTION_ORDER[i], quality))
        if (!kecil || !besar) continue

        if (besar.avg > kecil.avg + ORDER_TOLERANCE) {
          tambah(
            `Setelan ${quality}: ${RESOLUTION_ORDER[i]} (${besar.avg}) lebih tinggi daripada ${RESOLUTION_ORDER[i - 1]} (${kecil.avg}).`
          )
        }
      }
    }
  }

  // Temuan lintas-game DIDAHULUKAN, bukan sekadar digabung di belakang: ia
  // menyangkut seluruh matriks sekaligus, sementara temuan per-game menyangkut
  // satu sel. Kalau ia ikut antre di belakang, `MAX_WARNINGS` bisa memotongnya
  // habis justru pada matriks yang paling bermasalah — yang temuan per-game-nya
  // juga banyak.
  return [...checkCrossGame(fps, games), ...warnings].slice(0, MAX_WARNINGS)
}
