/**
 * Menyusun URL peta yang bisa disematkan (iframe) dari alamat toko.
 *
 * Kenapa alamat, bukan `mapsUrl` yang sudah tersimpan: `mapsUrl` berisi tautan
 * berbagi Google (`maps.app.goo.gl/…`), dan halaman di balik tautan itu MENOLAK
 * dibingkai — menaruhnya sebagai `src` iframe menghasilkan kotak kosong, bukan
 * peta. Tautan berbagi tetap berguna untuk tombol "buka di Google Maps", dan di
 * sanalah ia dipakai.
 *
 * Bentuk `?q=…&output=embed` sengaja dipilih karena tidak menuntut kunci API:
 * satu hal lagi yang harus dikelola, dibatasi kuotanya, dan bocor kalau salah
 * taruh. Titiknya berasal dari pencarian, jadi ketepatannya mengikuti ketepatan
 * alamat yang diketik staff — untuk alamat ruko yang rumit, titiknya bisa
 * meleset beberapa puluh meter.
 *
 * Nama toko ikut dikirim, tidak hanya alamatnya. Alamat saja menghasilkan pin
 * polos berlabel jalan; nama di depan membuat Google mencocokkannya dengan
 * profil bisnis yang sudah terdaftar, sehingga yang muncul adalah penanda milik
 * toko itu sendiri lengkap dengan namanya. Alamat tetap disertakan sebagai
 * penambat — tanpa itu, nama toko yang umum bisa tertaut ke cabang orang lain
 * di kota berbeda.
 *
 * Yang TIDAK bisa dilakukan lewat jalur ini: mewarnai penanda, menaruh beberapa
 * toko dalam satu peta, atau mengganti ikonnya. Google tidak membuka pengaturan
 * itu untuk iframe tanpa kunci. Kalau suatu saat dibutuhkan, jalannya adalah
 * peta sungguhan (Leaflet/OSM atau Maps JS API) dengan koordinat tiap toko
 * tersimpan di database — bukan menambal fungsi ini.
 */
export function buildMapEmbedUrl(name: string, address: string): string {
  const query = encodeURIComponent(`${name.trim()}, ${address.trim()}`)
  return `https://maps.google.com/maps?q=${query}&z=16&output=embed`
}
