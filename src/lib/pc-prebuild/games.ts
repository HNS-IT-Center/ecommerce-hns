/**
 * Daftar game yang dipakai grid estimasi FPS.
 *
 * Diatur staff lewat tab "Daftar Game" di `/admin/pc-prebuild`, bukan
 * dipatok di kode: game populer berganti tiap tahun, dan menunggu developer
 * untuk menambah satu baris membuat fiturnya usang lebih cepat daripada
 * dipakai.
 *
 * Sama seperti `limits.ts` dan `performance.ts`, berkas ini TIDAK mengimpor
 * apa pun — panel admin dan grid FPS dua-duanya Client Component. Getter yang
 * menyentuh Prisma ada di `config.ts`.
 *
 * ## Satu daftar untuk semua paket
 *
 * Bukan daftar per paket. Nilai grid ini justru pada perbandingan: pelanggan
 * yang membuka dua paket melihat game yang sama pada baris yang sama. Daftar
 * per paket akan membuat setiap halaman bercerita tentang game yang berbeda.
 */

export type PrebuildGame = {
  /** Dipakai `gameId` di entri FPS. Tidak boleh berubah setelah dipakai. */
  id: string
  name: string
  /** URL logo hasil unggah ke R2. Kosong = grid memakai inisial berwarna. */
  logo: string
  order: number
}

/**
 * Dua belas cukup. Grid ini menampilkan lima baris sekaligus dan sisanya
 * digulir; lebih dari dua belas, gulirannya berhenti terasa sebagai daftar
 * pendek dan setiap game tambahan ikut memperbesar prompt yang dikirim ke
 * Groq — yang jatah tokennya justru paling sempit di jalur ini.
 */
export const MAX_PREBUILD_GAMES = 12

/**
 * Isi awal, dipakai selama staff belum pernah menyimpan daftarnya sendiri.
 *
 * Tanpa logo: berkas gambarnya diunggah staff lewat jalur R2 yang sama dengan
 * foto paket (CLAUDE.md §2.2). Sampai itu terjadi, grid tetap tampil dengan
 * inisial — fitur ini tidak menunggu aset.
 *
 * Id-nya pendek dan tetap. JANGAN mengubah id yang sudah beredar: entri FPS
 * pada paket yang sudah dianalisis menunjuk ke sini, dan id yang berganti
 * membuat barisnya hilang diam-diam tanpa error.
 */
export const DEFAULT_PREBUILD_GAMES: PrebuildGame[] = [
  { id: "cs2", name: "Counter-Strike 2", logo: "", order: 0 },
  { id: "valorant", name: "Valorant", logo: "", order: 1 },
  { id: "dota2", name: "Dota 2", logo: "", order: 2 },
  { id: "lol", name: "League of Legends", logo: "", order: 3 },
  { id: "apex", name: "Apex Legends", logo: "", order: 4 },
  { id: "rdr2", name: "Red Dead Redemption 2", logo: "", order: 5 },
  { id: "minecraft", name: "Minecraft", logo: "", order: 6 },
  { id: "roblox", name: "Roblox", logo: "", order: 7 },
]

const MAX_NAME = 60
const MAX_ID = 40

/**
 * Nama game → id yang aman dipakai sebagai kunci.
 *
 * Dipakai saat staff menambah game baru. Hasil kosong (mis. nama yang seluruhnya
 * karakter non-latin) jatuh ke id berbasis waktu, supaya barisnya tetap punya
 * kunci yang unik alih-alih gagal tersimpan.
 */
export function slugifyGameId(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_ID)

  return slug || `game-${Date.now().toString(36)}`
}

function toGame(value: unknown, index: number): PrebuildGame | null {
  if (typeof value !== "object" || value === null) return null
  const raw = value as Record<string, unknown>

  const id = typeof raw.id === "string" ? raw.id.trim().slice(0, MAX_ID) : ""
  const name = typeof raw.name === "string" ? raw.name.trim().slice(0, MAX_NAME) : ""
  // Baris tanpa id atau tanpa nama tidak bisa dirender maupun dirujuk entri FPS.
  // Dibuang di sini, bukan diteruskan sebagai baris kosong ke grid.
  if (!id || !name) return null

  const logo = typeof raw.logo === "string" ? raw.logo.trim() : ""
  const order = typeof raw.order === "number" && Number.isFinite(raw.order) ? raw.order : index

  return { id, name, logo, order }
}

/**
 * Bentuk mentah dari kolom JSON `settings` → daftar yang aman dipakai.
 *
 * `null` berarti BELUM PERNAH disimpan — pemanggil memakai
 * `DEFAULT_PREBUILD_GAMES`. Beda dengan array kosong, yang berarti staff
 * sengaja mengosongkan daftarnya; itu dihormati apa adanya, dan grid FPS-nya
 * tidak dirender. Kalau keduanya disamakan, daftar yang sengaja dikosongkan
 * akan terisi ulang sendiri setiap kali halaman dimuat.
 */
export function parsePrebuildGames(value: unknown): PrebuildGame[] | null {
  if (!Array.isArray(value)) return null

  const sudahAda = new Set<string>()

  return value
    .map(toGame)
    .filter((g): g is PrebuildGame => g !== null)
    .filter((g) => {
      // Id kembar tidak bisa dibedakan entri FPS — yang kedua dibuang.
      if (sudahAda.has(g.id)) return false
      sudahAda.add(g.id)
      return true
    })
    .sort((a, b) => a.order - b.order)
    .slice(0, MAX_PREBUILD_GAMES)
    .map((game, index) => ({ ...game, order: index }))
}
