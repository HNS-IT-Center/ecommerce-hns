/**
 * Mengisi dua izin BARU ke peran yang sudah ada, supaya aksesnya tidak berubah
 * diam-diam saat kode baru tayang.
 *
 * Pakai:
 *   npx tsx scripts/isi-izin-baru-peran.mts            # dry run
 *   npx tsx scripts/isi-izin-baru-peran.mts --apply
 *
 * ## Kenapa perlu
 *
 * `muatIzinUser()` bersifat aman-tertutup: halaman tanpa baris di
 * `role_permissions` berarti "tak ada akses". Itu benar untuk izin yang memang
 * baru dibuat — tapi dua kunci di bawah bukan kemampuan baru, melainkan
 * kemampuan LAMA yang baru punya nama:
 *
 * - `overview` — dasbor `/admin` dulu terbuka untuk siapa pun yang punya urusan
 *   DI DALAM panel. Tanpa pengisian ini, setiap peran yang sudah ada kehilangan
 *   berandanya pada deploy pertama, dan orangnya mendarat di halaman lain tanpa
 *   pernah diberi tahu kenapa.
 *
 *   Syarat "di dalam panel" itu ikut ditiru, bukan diabaikan: peran seperti
 *   Kasir yang seluruh izinnya di luar `/admin` memang SUDAH ditolak dasbor
 *   sebelum ini. Memberinya `overview` bukan mempertahankan perilaku lama,
 *   melainkan membuka pintu yang selama ini tertutup untuknya.
 *
 * - `quotation-oper` — kemampuan mengoper quotation ke sales lain dulu TERSIRAT
 *   dari "boleh menerbitkan TAPI bukan sales". Aturan itu sekarang jadi izin
 *   tersendiri. Tanpa pengisian ini, peran CS yang sudah ada tiba-tiba tidak
 *   bisa mengoper — dan gejalanya bukan pesan galat, melainkan pilihan "Oper ke
 *   Sales" yang hilang dari dialog.
 *
 * Aturan pengisiannya sengaja MENIRU perilaku lama persis, bukan menebak:
 * `overview` hanya untuk peran yang punya minimal satu izin di dalam panel,
 * dan `quotation-oper` hanya untuk peran yang punya `quotation-terbit` DAN
 * tidak punya `quotation-sales`.
 *
 * Idempoten: peran yang sudah punya barisnya dilewati, jadi aman dijalankan
 * ulang. Tidak pernah menimpa nilai yang sudah ada — kalau seseorang sudah
 * sengaja menyetelnya ke "Tak ada", pilihannya dihormati.
 *
 * Jalankan di database lokal Docker dulu (docs/16), baru produksi (docs/10).
 */
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

const APPLY = process.argv.includes("--apply")
const { getPrisma } = await import("../src/lib/prisma/client")
const p = getPrisma()
const tag = APPLY ? "[APPLY]" : "[DRY RUN]"

console.log(`${tag} isi izin baru (overview, quotation-oper) ke peran yang ada\n`)

/**
 * Kunci yang TIDAK dihitung sebagai "punya urusan di dalam panel".
 *
 * Salinan dari `PAGES_BUKAN_PANEL` + `PAGES_SELALU_BOLEH` di
 * `src/lib/auth/permissions.ts`, dan disalin dengan terpaksa: berkas itu
 * `server-only`, jadi tidak bisa diimpor dari skrip biasa. Skrip ini sekali
 * jalan lalu dibuang, jadi salinannya tidak akan sempat menua — tapi kalau
 * daftar di sana berubah sebelum skrip ini dijalankan, perbarui juga yang ini.
 */
const BUKAN_PANEL = new Set([
  "verify",
  "harga-modal",
  "quotation-terbit",
  "quotation-sales",
  "quotation-oper",
  "akun",
  "overview",
])

const roles = await p.role.findMany({
  select: { id: true, name: true, permissions: { select: { page: true, access: true } } },
  orderBy: { name: "asc" },
})

if (roles.length === 0) {
  console.log("Tidak ada peran sama sekali — tidak ada yang perlu diisi.")
  process.exit(0)
}

let ditambah = 0

for (const role of roles) {
  const punya = new Map(role.permissions.map((x) => [x.page, x.access]))
  const rencana: { page: string; access: string; alasan: string }[] = []

  const punyaUrusanPanel = role.permissions.some(
    (x) => x.access !== "none" && !BUKAN_PANEL.has(x.page),
  )
  if (punyaUrusanPanel && !punya.has("overview")) {
    rencana.push({
      page: "overview",
      access: "view",
      alasan: "dulu dasbor terbuka untuk yang punya urusan di panel",
    })
  }

  const bolehTerbit = punya.get("quotation-terbit") === "edit"
  const adalahSales = punya.get("quotation-sales") === "edit"
  if (bolehTerbit && !adalahSales && !punya.has("quotation-oper")) {
    rencana.push({
      page: "quotation-oper",
      access: "edit",
      alasan: "boleh terbit tapi bukan sales = CS, dulu otomatis boleh mengoper",
    })
  }

  if (rencana.length === 0) {
    if (!punyaUrusanPanel) {
      console.log(`  ${role.name}: seluruh izinnya di luar panel — Overview dilewati`)
      continue
    }
    console.log(`  ${role.name}: sudah lengkap`)
    continue
  }

  for (const r of rencana) {
    console.log(`  ${role.name}: + ${r.page} = ${r.access}   (${r.alasan})`)
    ditambah++
    if (APPLY) {
      await p.rolePermission.create({
        data: { roleId: role.id, page: r.page, access: r.access },
      })
    }
  }
}

console.log(
  `\n${tag} ${ditambah} baris izin ${APPLY ? "ditambahkan" : "akan ditambahkan"} untuk ${roles.length} peran.`,
)
if (!APPLY && ditambah > 0) console.log("Jalankan ulang dengan --apply untuk menulis.")

await p.$disconnect()
