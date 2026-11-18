/**
 * Uji lapisan data Dokumentasi Rakitan — docs/17 §21:
 *   src/lib/api/ticketing-builds.ts
 *   src/lib/api/ticketing-build-downloads.ts (penomoran, unduh per foto, ZIP)
 *   src/lib/utils/zip-store.ts
 *
 *   npx tsx --tsconfig scripts/tsconfig.uji.json scripts/uji-dokumentasi-rakitan.mts
 *
 * Tanpa jaringan dan tanpa database: `fetch` diganti tiruan, jadi setiap
 * jawaban Ticketing (200/400/401/404/503/500/timeout/bukan JSON) bisa diuji.
 * Opsional `--langsung=<kode>` memanggil Ticketing lokal sungguhan
 * (HNS_TICKETING_URL + TICKETING_INTEGRATION_TOKEN dari .env.local).
 */
try {
  process.loadEnvFile(".env.local")
} catch {
  // CI
}

const langsung = process.argv.find((a) => a.startsWith("--langsung="))?.slice("--langsung=".length)

if (!langsung) {
  process.env.HNS_TICKETING_URL = "http://ticketing.uji/"
  process.env.TICKETING_INTEGRATION_TOKEN = "uji-token-dokumentasi-0123456789abcdef0123456789"
}

const { getBuildDocumentation, parseBuildDocumentation, groupBuildPhotos } = await import(
  "../src/lib/api/ticketing-builds.ts"
)
const { numberBuildPhotos, normalizeQuoteCodeParam, getBuildPhotoDownload, getBuildDocumentationZip, photoKey } =
  await import("../src/lib/api/ticketing-build-downloads.ts")
const { crc32 } = await import("../src/lib/utils/zip-store.ts")

if (langsung) {
  const hasil = await getBuildDocumentation(langsung)
  console.log(JSON.stringify(hasil, null, 2))
  process.exit(0)
}

let lolos = 0
const gagal: string[] = []
function cek(nama: string, kondisi: boolean, detail = "") {
  if (kondisi) {
    lolos += 1
    console.log(`  ✓ ${nama}`)
  } else {
    gagal.push(nama)
    console.log(`  ✗ ${nama}${detail ? ` — ${detail}` : ""}`)
  }
}

const KODE = "HNSPC-20261116-0171"
const contoh = {
  quoteCode: KODE,
  ticket: {
    code: "NGW-000400",
    status: "done",
    stage: "finished",
    stageLabel: "Selesai, belum diserahkan",
    store: "Nagoya Gateway",
    technician: "Budi",
    finishedAt: "2026-11-17T08:12:00.000Z",
  },
  photos: [
    { group: "first_build", title: "Rakitan jadi", fileName: "a.jpg", url: "https://files.uji/a.jpg" },
    { group: "first_build", title: "Rakitan jadi 2", fileName: "b.jpg", url: "https://files.uji/b.jpg" },
    { group: "work_proof", title: "Bukti selesai", fileName: null, url: "http://127.0.0.1:9000/c.jpg" },
    { group: "kelompok_baru", title: "Judul Baru", fileName: "d.jpg", url: "https://files.uji/d.jpg" },
    { group: "components", title: "Komponen", fileName: "e.jpg", url: "javascript:alert(1)" },
    { group: "components", title: "Tanpa url" },
  ],
}

type Panggilan = { url: string; init: RequestInit | undefined }
let terakhir: Panggilan | null = null
function tiru(jawab: () => Promise<Response>) {
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    terakhir = { url: String(input), init }
    return jawab()
  }) as typeof fetch
}
const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }))

console.log("\n1. Parser murni")
{
  const doc = parseBuildDocumentation(contoh)
  cek("jawaban contoh sah", doc !== null)
  cek("4 foto sah, 2 dibuang (javascript: & tanpa url)", doc?.photos.length === 4 && doc?.skippedPhotos === 2, JSON.stringify(doc?.photos.map((p) => p.url)))
  cek("fileName null tetap sah", doc?.photos.some((p) => p.fileName === null) === true)
  cek("bentuk salah → null", parseBuildDocumentation({ quoteCode: KODE }) === null)
  cek("bukan objek → null", parseBuildDocumentation("teks") === null)
  cek("photos tidak ada → daftar kosong", parseBuildDocumentation({ ...contoh, photos: undefined })?.photos.length === 0)

  const groups = groupBuildPhotos(doc?.photos ?? [])
  cek("urutan kelompok dipertahankan", groups.map((g) => g.key).join(",") === "first_build,work_proof,kelompok_baru", groups.map((g) => g.key).join(","))
  cek("label kelompok dikenal", groups[0]?.label === "Rakitan jadi" && groups[1]?.label === "Bukti selesai")
  cek("kelompok baru pakai judul foto pertama", groups[2]?.label === "Judul Baru")
  cek("first_build berisi 2 foto", groups[0]?.photos.length === 2)
}

console.log("\n2. Panggilan ke Ticketing")
{
  tiru(() => json(200, contoh))
  const hasil = await getBuildDocumentation(KODE)
  cek("200 → ok", hasil.kind === "ok")
  const p = terakhir as Panggilan | null
  cek("URL benar (garis miring akhir dibuang)", p?.url === `http://ticketing.uji/api/integrations/ecommerce/pc-builds/${KODE}`, p?.url)
  const headers = new Headers(p?.init?.headers)
  cek("Authorization Bearer", headers.get("authorization") === `Bearer ${process.env.TICKETING_INTEGRATION_TOKEN}`)
  cek("cache no-store", p?.init?.cache === "no-store")
  cek("ada signal timeout", p?.init?.signal instanceof AbortSignal)
}
{
  tiru(() => json(200, { ...contoh, quoteCode: "HNSPC-20261116-0172" }))
  const hasil = await getBuildDocumentation(KODE)
  cek("quoteCode lain → unavailable", hasil.kind === "unavailable")
}
{
  tiru(() => json(200, { ...contoh, quoteCode: KODE.toLowerCase() }))
  cek("quoteCode beda huruf besar-kecil tetap ok", (await getBuildDocumentation(KODE)).kind === "ok")
}
for (const [status, harap] of [
  [404, "no-ticket"],
  [400, "invalid-code"],
  [401, "unavailable"],
  [503, "unavailable"],
  [500, "unavailable"],
] as const) {
  tiru(() => json(status, { error: "x" }))
  const hasil = await getBuildDocumentation(KODE)
  cek(`${status} → ${harap}`, hasil.kind === harap, hasil.kind)
}
{
  tiru(() => Promise.resolve(new Response("<html>", { status: 200 })))
  const hasil = await getBuildDocumentation(KODE)
  cek("200 bukan JSON → unavailable", hasil.kind === "unavailable" && hasil.reason === "bad-response")
}
{
  tiru(() => Promise.reject(new DOMException("timeout", "TimeoutError")))
  const hasil = await getBuildDocumentation(KODE)
  cek("timeout → unavailable/timeout", hasil.kind === "unavailable" && hasil.reason === "timeout")
}
{
  tiru(() => Promise.reject(new TypeError("fetch failed")))
  const hasil = await getBuildDocumentation(KODE)
  cek("gagal terhubung → unavailable/network", hasil.kind === "unavailable" && hasil.reason === "network")
}

console.log("\n3. Penomoran & nama berkas")
{
  const doc = parseBuildDocumentation(contoh)!
  const groups = numberBuildPhotos(doc.photos)
  const flat = groups.flatMap((g) => g.photos)
  cek("nomor berurutan menurut urutan tampil", flat.map((p) => p.number).join(",") === "1,2,3,4")
  cek("nama berkas 01-rakitan-jadi", flat[0]?.fileBase === "01-rakitan-jadi", flat[0]?.fileBase)
  cek("kelompok baru → slug judulnya", flat[3]?.fileBase === "04-judul-baru", flat[3]?.fileBase)
  cek("sidik 12 heksadesimal & sesuai URL", /^[0-9a-f]{12}$/.test(flat[0]!.key) && flat[0]!.key === photoKey(flat[0]!.url))
  cek("kode dinormalkan", normalizeQuoteCodeParam("hnspc-20261116-0171") === KODE)
  cek("kode bukan quotation → null", normalizeQuoteCodeParam("..%2Fetc") === null && normalizeQuoteCodeParam("%E0%A4%A") === null)
}

console.log("\n4. Unduh per foto")
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 0xff, 0xd9])
function tiruTicketingDanFoto(fotoGagal: string[] = []) {
  const diambil: string[] = []
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input)
    if (url.startsWith("http://ticketing.uji/")) return json(200, contoh)
    diambil.push(url)
    if (fotoGagal.includes(url)) return new Response("x", { status: 500 })
    return new Response(JPEG, { status: 200, headers: { "content-type": "image/jpeg" } })
  }) as typeof fetch
  return diambil
}
{
  const flat = numberBuildPhotos(parseBuildDocumentation(contoh)!.photos).flatMap((g) => g.photos)
  const diambil = tiruTicketingDanFoto()
  const ok = await getBuildPhotoDownload(KODE, 3, flat[2]!.key)
  cek("nomor 3 → foto ketiga", ok.kind === "ok" && diambil[0] === flat[2]!.url)
  cek("nama berkas ber-kode", ok.kind === "ok" && ok.fileName === `${KODE}-03-bukti-selesai.jpg`, ok.kind === "ok" ? ok.fileName : "")
  const salahSidik = await getBuildPhotoDownload(KODE, 3, flat[0]!.key)
  cek("sidik tidak cocok → 409, foto tidak diambil", salahSidik.kind === "error" && salahSidik.status === 409 && diambil.length === 1)
  const tidakAda = await getBuildPhotoDownload(KODE, 99, flat[0]!.key)
  cek("nomor di luar daftar → 404", tidakAda.kind === "error" && tidakAda.status === 404)
  tiru(() => json(404, {}))
  const tanpaTiket = await getBuildPhotoDownload(KODE, 1, flat[0]!.key)
  cek("tiket tidak ada → 404", tanpaTiket.kind === "error" && tanpaTiket.status === 404)
  globalThis.fetch = (async (input: string | URL | Request) =>
    String(input).startsWith("http://ticketing.uji/")
      ? json(200, contoh)
      : new Response("<html>", { status: 200, headers: { "content-type": "text/html" } })) as typeof fetch
  const bukanGambar = await getBuildPhotoDownload(KODE, 1, flat[0]!.key)
  cek("storage membalas bukan gambar → 502", bukanGambar.kind === "error" && bukanGambar.status === 502)
}

console.log("\n5. ZIP")
async function bacaSemua(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  return new Uint8Array(await new Response(stream).arrayBuffer())
}
function bacaDaftarZip(zip: Uint8Array): { names: string[]; datas: Uint8Array[]; crcOk: boolean } {
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength)
  const eocd = zip.length - 22
  if (v.getUint32(eocd, true) !== 0x06054b50) throw new Error("EOCD tidak ada")
  const count = v.getUint16(eocd + 10, true)
  let p = v.getUint32(eocd + 16, true)
  const names: string[] = []
  const datas: Uint8Array[] = []
  let crcOk = true
  for (let i = 0; i < count; i++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error("central directory rusak")
    const crc = v.getUint32(p + 16, true)
    const size = v.getUint32(p + 20, true)
    const nameLen = v.getUint16(p + 28, true)
    const off = v.getUint32(p + 42, true)
    names.push(new TextDecoder().decode(zip.subarray(p + 46, p + 46 + nameLen)))
    if (v.getUint32(off, true) !== 0x04034b50) throw new Error("header lokal rusak")
    const localNameLen = v.getUint16(off + 26, true)
    const data = zip.subarray(off + 30 + localNameLen, off + 30 + localNameLen + size)
    datas.push(data)
    if (crc32(data) !== crc) crcOk = false
    p += 46 + nameLen
  }
  return { names, datas, crcOk }
}
{
  cek("crc32 vektor baku", crc32(new TextEncoder().encode("123456789")) === 0xcbf43926)
  tiruTicketingDanFoto()
  const hasil = await getBuildDocumentationZip(KODE)
  cek("ZIP ok + nama berkas", hasil.kind === "ok" && hasil.fileName === `${KODE}-dokumentasi.zip`)
  if (hasil.kind === "ok") {
    const zip = await bacaSemua(hasil.stream)
    const isi = bacaDaftarZip(zip)
    cek("ZIP datar, 4 foto berurutan", isi.names.join(",") === "01-rakitan-jadi.jpg,02-rakitan-jadi.jpg,03-bukti-selesai.jpg,04-judul-baru.jpg", isi.names.join(","))
    cek("CRC semua entri cocok", isi.crcOk)
    cek("isi foto utuh", isi.datas.every((d) => d.length === JPEG.length && d.every((b, i) => b === JPEG[i])))
    // Opsional: simpan supaya bisa diuji pembuka ZIP lain (python -m zipfile -t, unzip -t).
    const out = process.argv.find((a) => a.startsWith("--simpan-zip="))?.slice("--simpan-zip=".length)
    if (out) {
      const { writeFileSync } = await import("node:fs")
      writeFileSync(out, zip)
    }
  }
}
{
  tiruTicketingDanFoto(["https://files.uji/b.jpg"])
  const hasil = await getBuildDocumentationZip(KODE)
  if (hasil.kind === "ok") {
    const isi = bacaDaftarZip(await bacaSemua(hasil.stream))
    const catatan = new TextDecoder().decode(isi.datas[isi.names.length - 1])
    cek(
      "foto gagal tidak dilewati diam-diam",
      isi.names.length === 4 && isi.names.at(-1) === "FOTO-GAGAL-DIUNDUH.txt" && catatan.includes("02-rakitan-jadi") && catatan.includes("1 dari 4"),
      isi.names.join(","),
    )
  } else cek("foto gagal tidak dilewati diam-diam", false, hasil.message)
}
{
  globalThis.fetch = (async () => json(200, { ...contoh, photos: [] })) as typeof fetch
  const kosong = await getBuildDocumentationZip(KODE)
  cek("tanpa foto → 404, bukan ZIP kosong", kosong.kind === "error" && kosong.status === 404)
}

console.log(`\nHasil: ${lolos}/${lolos + gagal.length} lolos`)
if (gagal.length > 0) process.exit(1)
