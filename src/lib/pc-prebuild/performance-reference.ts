/**
 * Batas wajar yang disisipkan ke prompt analisis performa.
 *
 * ## Ini ALAT PERIKSA, bukan resep penurunan — dan itu koreksi
 *
 * Versi 28 Agustus 2026 memakai blok ini sebagai RUMUS: model disuruh mengambil
 * angka tangga GPU, lalu mengalikannya berturut-turut dengan bobot game,
 * penskalaan resolusi, penskalaan setelan, lalu menjepitnya dengan plafon
 * prosesor. Lima langkah, dan setiap langkah punya rentang.
 *
 * Rentang yang berlipat itu yang merusaknya. Untuk satu sel yang sama, ujung
 * bawah dan ujung atas rantai bisa berjarak tiga kali lipat — dua-duanya "sah"
 * menurut tabel, jadi tabel yang seharusnya menambatkan justru MELEBARKAN
 * ruang jawaban. Hasilnya dilaporkan pemilik produk sebagai lebih tidak masuk
 * akal daripada sebelum tabel ini ada.
 *
 * Yang terlewat: model sudah tahu RTX 4060 di Valorant kira-kira berapa. Itu
 * angka yang banyak dibahas publik. Menyuruhnya menurunkan lewat lima
 * perkalian justru membuang pengetahuan yang sudah dimilikinya dan
 * menggantinya dengan galat yang menumpuk.
 *
 * Sekarang urutannya dibalik: **model menjawab dari pengetahuannya per game,
 * lalu MEMERIKSA jawabannya terhadap batas di bawah.** Yang di luar batas
 * diperbaiki. Batas ini menangkap jawaban yang ngawur; ia tidak lagi
 * berpura-pura bisa menghasilkan jawaban.
 *
 * ## Statusnya: perkiraan, bukan pengukuran
 *
 * Angka di bawah adalah rentang kasar hasil rangkuman benchmark yang
 * dipublikasikan, BUKAN pengukuran HNS atas unit yang dijualnya. Ia cukup untuk
 * menahan model tetap pada skala yang masuk akal; ia tidak cukup untuk
 * dijanjikan ke pelanggan sebagai angka pasti. Karena itu hasil analisis tetap
 * masuk sebagai draf yang disunting dan disetujui staff lebih dulu.
 *
 * Kalau suatu hari teknisi HNS mengukur rakitan sungguhan, angka ukur itu
 * masuk ke sini — dan seluruh analisis berikutnya ikut terkalibrasi ulang.
 *
 * ## Kenapa RENTANG, bukan angka tunggal
 *
 * Angka tunggal mengundang model menyalinnya bulat-bulat sebagai jawaban.
 * Cacat itu pernah terjadi di endpoint ini: contoh JSON dulu berisi nilai yang
 * terlihat masuk akal, dan model menyalinnya sebagai fakta alih-alih membaca
 * daftar komponen. Rentang memaksa model tetap menimbang.
 *
 * Berkas ini TIDAK mengimpor apa pun, mengikuti konvensi `limits.ts` dan
 * `component-roles.ts`.
 */

/**
 * Titik periksa GPU pada 1080p Medium, **game AAA berat**.
 *
 * Kata "berat" menanggung beban besar dan sengaja ditulis eksplisit. Versi
 * pertama cuma menyebut "game AAA modern" tanpa pembeda per game, dan seluruh
 * game keluar dengan angka nyaris sama — Roblox disamakan dengan Apex Legends.
 * Ini lantai terberat, BUKAN rata-rata semua game.
 *
 * Dipakai untuk MEMERIKSA, bukan sebagai titik awal perkalian berantai — lihat
 * catatan di kepala berkas soal kenapa rantai itu dibuang.
 */
const GPU_LADDER = `TITIK PERIKSA GPU — FPS rata-rata di 1080p Medium untuk GAME AAA BERAT (Cyberpunk 2077, Red Dead Redemption 2), tanpa ray tracing, tanpa upscaling.
Ini titik TERBERAT. Game lain lebih tinggi, sebagian jauh lebih tinggi — jangan pakai angka ini untuk semua game.
- RTX 4090 / 5090: 180-220
- RTX 4080 / 4070 Ti Super / 5070 Ti: 140-175
- RTX 4070 / 4070 Super / 3080 / RX 7800 XT: 100-135
- RTX 4060 Ti / 3070 / RX 7700 XT: 80-105
- RTX 4060 / 3060 Ti / RX 7600 / RX 6650 XT: 65-88
- RTX 3060 12GB / RX 6600 XT / Arc A750: 55-72
- RTX 3050 / GTX 1660 Super / RX 6600: 45-62
- GTX 1650 / RX 6400 / Arc A380: 30-44
- iGPU Radeon 780M (Ryzen 8000G): 25-36
- iGPU Radeon Vega 7/8 (Ryzen 5000G): 18-28
- iGPU Intel UHD 730/770: 8-16`

/**
 * Plafon prosesor — inti perbaikan 28 Agustus 2026.
 *
 * Aturan prompt yang lama menyuruh angka "turun secara masuk akal saat resolusi
 * naik", yang memaksa kurva GPU-bound untuk SEMUA game. Itu keliru justru di
 * judul yang paling banyak dimainkan pelanggan HNS: CS2 dan Valorant di 720p
 * dibatasi prosesor, bukan kartu grafis, jadi menurunkan resolusi hampir tidak
 * menambah FPS. Tanpa plafon ini, paket ber-prosesor lemah tampil seolah
 * sanggup ratusan FPS hanya karena resolusinya diturunkan.
 */
const CPU_CEILING = `PLAFON PROSESOR — FPS rata-rata TERTINGGI yang bisa dicapai apa pun kartu grafisnya.
Ini BATAS ATAS, bukan pengurang: kalau kemampuan GPU lebih rendah dari plafon ini, yang dipakai angka GPU dan prosesornya tidak mengurangi apa pun.

Game esports (CS2, Valorant, Dota 2, LoL, Minecraft, Roblox) di 1080p:
- Ryzen 7 7800X3D / i9-13900K / i9-14900K: 450-700
- Ryzen 7 7700 / i7-12700 / i5-13600K: 350-500
- Ryzen 5 7600 / i5-13400 / i5-12600: 300-420
- Ryzen 5 5600 / Ryzen 5 5600G / i5-12400: 260-360
- Ryzen 5 3600 / i5-10400 / i3-12100: 200-290
- Ryzen 3 / i3-10100 / Athlon / Pentium: 120-200

Game AAA (plafonnya jauh lebih rendah karena bebannya beda):
- Kelas teratas di atas: 140-200
- Ryzen 5 5600 / i5-12400: 90-135
- Ryzen 5 3600 / i5-10400: 70-105
- Ryzen 3 / i3 / Athlon: 50-80`

/**
 * Perbandingan berat antar game.
 *
 * Ada karena tanpanya seluruh game keluar dengan angka yang sama. Tapi ia
 * **perbandingan**, bukan pengali yang wajib dipakai: begitu ia dijadikan
 * langkah perkalian, rentangnya bertumpuk dengan rentang langkah lain dan
 * ruang jawaban justru melebar (lihat kepala berkas).
 *
 * Jaraknya memang jauh — Valorant terhadap Cyberpunk bisa lima kali lipat pada
 * kartu yang sama — dan angka di sini cuma perlu cukup tepat untuk menangkap
 * jawaban yang urutannya terbalik atau jaraknya runtuh.
 */
const GAME_WEIGHT = `BERAT GAME — perbandingan kasar terhadap TITIK PERIKSA GPU di atas. Dipakai untuk MEMERIKSA apakah jawabanmu untuk satu game masuk akal dibanding game lain, bukan untuk menghitungnya.

- sekitar 5-6x lebih tinggi : Valorant, League of Legends, CS:GO
- sekitar 4-5x lebih tinggi : Counter-Strike 2, Minecraft (vanilla), Roblox, Rocket League
- sekitar 3x lebih tinggi   : Dota 2, Overwatch 2, Genshin Impact
- sekitar 2x lebih tinggi   : Apex Legends, Fortnite, GTA V, Rainbow Six Siege
- sekitar 1,5x lebih tinggi : PUBG, Call of Duty Warzone, Battlefield
- sekitar sama             : Elden Ring, God of War, Horizon, Hogwarts Legacy
- sekitar sama atau sedikit di bawah : Red Dead Redemption 2, Cyberpunk 2077, Starfield, Alan Wake 2

Perbandingan ini berlaku saat kartu grafis yang jadi penentu. Pada game ringan, yang lebih sering menentukan adalah PLAFON PROSESOR di bawah — dan di situ perbandingan ini berhenti berlaku.`

/** VRAM dan RAM: dua sebab paling sering angka rata-rata bagus tapi terasa patah. */
const MEMORY_RULES = `BATAS VRAM — kalau VRAM kurang, rata-rata turun DAN 1% low anjlok jauh lebih dalam (inilah yang terasa sebagai patah-patah):
- 4GB: sudah kurang di 1080p Medium game AAA modern → turun 20-40%
- 6GB: kurang di 1080p High dan di 1440p Medium ke atas → turun 15-30%
- 8GB: kurang di 1440p High game AAA modern → turun 15-35%
- 12GB ke atas: aman sampai 1440p High
Game esports di daftar TIDAK terpengaruh batas ini; kebutuhannya jauh di bawah 4GB.

RAM SISTEM:
- Total 8GB: game AAA modern turun 10-25% dan 1% low anjlok. Esports relatif tahan.
- Total 16GB ke atas: cukup untuk seluruh game di daftar.
- Single channel (1 keping): turun 10-20% pada VGA diskrit, tapi 30-45% pada grafis terintegrasi — karena iGPU memakai RAM sistem sebagai VRAM.
- DDR4-2666 vs DDR4-3200: selisih kecil, 2-5%.
- DDR5 vs DDR4 pada prosesor sama: 3-8%, dan hanya terasa di game yang dibatasi prosesor.`

/**
 * Penskalaan antar sel matriks.
 *
 * Sengaja dipisah antara game GPU-bound dan esports: kurva keduanya berbeda
 * jauh, dan menyamakannya adalah cacat yang paling sering muncul di hasil lama.
 */
const SCALING_RULES = `ARAH ANTAR SEL — untuk memeriksa bentuk jawabanmu, bukan untuk menghitungnya:

- Turun ke 720p menaikkan FPS; naik ke 1440p menurunkannya. Pada game yang dibatasi kartu grafis, perubahannya besar. Pada game esports yang sudah menyentuh PLAFON PROSESOR, perubahannya kecil sampai hampir tidak ada — dan itu benar, jangan dipaksa berubah.
- Setelan Low lebih tinggi daripada Medium, Medium lebih tinggi daripada High. Sama seperti di atas: pada game yang tertahan plafon prosesor, ketiganya bisa berdekatan.

1% LOW terhadap rata-rata:
- Game yang optimasinya baik: sekitar 0,70-0,82x
- AAA dunia terbuka: sekitar 0,62-0,78x
- Saat VRAM atau RAM kurang: 0,35-0,55x — pakai rentang ini, karena di situlah kekurangan memori terlihat.`

/**
 * Blok kalibrasi utuh, siap disisipkan ke prompt.
 *
 * Diperkirakan ~700 token. Anggaran input endpoint ini 3.500 token
 * (`inputTokenBudget` pada `openai/gpt-oss-120b` dengan `max_tokens` 4.000),
 * dan prompt tanpa blok ini sekitar 700 token — jadi masih lapang. Kalau blok
 * ini diperpanjang, ukur ulang: `checkInputFits` akan menolak lebih dulu dengan
 * pesan yang jelas, tapi itu berarti staff tidak bisa menganalisis paket
 * berkomponen banyak.
 */
export const PERFORMANCE_REFERENCE = [
  GPU_LADDER,
  GAME_WEIGHT,
  CPU_CEILING,
  MEMORY_RULES,
  SCALING_RULES,
].join("\n\n")

/* ------------------------------------------------------------------------- *
 * Bobot per game di daftar paket
 * ------------------------------------------------------------------------- */

/**
 * Bobot yang ditempelkan langsung ke setiap baris DAFTAR GAME di prompt.
 *
 * Daftar kelas di `GAME_WEIGHT` saja ternyata tidak cukup: model membacanya
 * sebagai keterangan, lalu tetap mengeluarkan angka yang seragam. Menempelkan
 * bobotnya pada baris game yang bersangkutan jauh lebih sulit diabaikan —
 * angkanya ada di tempat model sedang bekerja, bukan di paragraf terpisah.
 *
 * Dicocokkan dengan KATA KUNCI, bukan id, karena daftar game diatur staff dan
 * id-nya hasil `slugifyGameId` dari nama yang mereka ketik. Paket yang menulis
 * "Apex Legends Season 20" harus tetap mendapat bobot Apex.
 *
 * Urutan penting: pola yang lebih spesifik didahulukan. "CS:GO" diuji sebelum
 * "CS2" karena keduanya memuat "cs", dan "Fortnite" sebelum pola umum.
 */
const GAME_WEIGHT_PATTERNS: Array<[RegExp, string]> = [
  [/valorant/i, "~5-6x"],
  [/league\s*of\s*legends|\blol\b|\bwild\s*rift\b/i, "~5-6x"],
  [/cs\s*:?\s*go|counter.?strike\s*:?\s*global/i, "~5-6x"],
  [/counter.?strike|\bcs\s*2\b/i, "~4-5x"],
  [/minecraft/i, "~4-5x"],
  [/roblox/i, "~4-5x"],
  [/rocket\s*league/i, "~4-5x"],
  [/mobile\s*legends|\bml\s*bb\b|free\s*fire/i, "~5-6x"],
  [/dota/i, "~3x"],
  [/overwatch/i, "~3x"],
  [/genshin|honkai|zenless/i, "~3x"],
  [/point\s*blank|\bpb\b/i, "~4-5x"],
  [/fortnite/i, "~2x"],
  [/apex/i, "~2x"],
  [/\bgta\b|grand\s*theft\s*auto/i, "~2x"],
  [/rainbow\s*six|\br6\b/i, "~2x"],
  [/pubg|playerunknown|battlegrounds/i, "~1,5x"],
  [/warzone|call\s*of\s*duty|\bcod\b/i, "~1,5x"],
  [/battlefield/i, "~1,5x"],
  [/forza/i, "~1,5x"],
  [/elden\s*ring|god\s*of\s*war|horizon|last\s*of\s*us|hogwarts/i, "~1x"],
  [/red\s*dead|\brdr\s*2?\b/i, "~0,95x"],
  [/cyberpunk/i, "~0,95x"],
  [/starfield/i, "~0,95x"],
  [/black\s*myth|wukong|alan\s*wake/i, "~0,85x"],
]

/**
 * Bobot untuk satu game, dari id dan namanya. `null` = tidak dikenali.
 *
 * Yang tidak dikenali TIDAK diberi bobot bawaan. Menambal dengan 1,0x justru
 * mengembalikan cacat yang sedang diperbaiki — 1,0x adalah kelas game paling
 * berat, dan memakainya sebagai jalan aman membuat game ringan tampil jauh
 * lebih lambat daripada kenyataannya. Model diminta menempatkannya sendiri.
 */
export function gameWeightHint(gameId: string, gameName: string): string | null {
  const teks = `${gameName} ${gameId}`

  for (const [pattern, weight] of GAME_WEIGHT_PATTERNS) {
    if (pattern.test(teks)) return weight
  }

  return null
}
