/**
 * Menaikkan satu akun menjadi OWNER, berdasarkan email.
 *
 * Pakai:
 *   npx tsx scripts/jadikan-owner.mts <email>            # dry run
 *   npx tsx scripts/jadikan-owner.mts <email> --apply
 *
 * ## Kenapa lewat skrip, bukan panel
 *
 * Panel sengaja TIDAK punya tombol "angkat jadi owner" untuk pelanggan:
 * `setCustomerRole()` hanya menulis "staff" atau "pelanggan", dengan alasan
 * bahwa menaikkan seseorang ke kuasa penuh tidak pantas dilakukan dari daftar
 * pelanggan. Jadi kasus ini — akun yang lahir sebagai pelanggan tapi memang
 * pemilik sistem — tidak punya jalur di antarmuka, dan memang tidak seharusnya
 * punya.
 *
 * Kasus nyatanya: alamat developer ikut dipakai belanja, jadi barisnya berperan
 * "pelanggan". Ia tetap bisa masuk panel lewat `MASTER_ADMIN_EMAIL`, tapi semua
 * yang masih membaca kolom `role` lama memperlakukannya sebagai bukan-owner —
 * termasuk daftar admin, yang menyaring `role != 'pelanggan'` sehingga akunnya
 * tidak terlihat sama sekali.
 *
 * ## Yang berubah pada barisnya
 *
 * `role` → "owner", dan `roleId` → NULL. Keduanya sepasang: owner memakai jalur
 * fallback (kuasa penuh), bukan peran dinamis, dan meninggalkan `roleId` terisi
 * akan membuat izinnya dibaca dari `role_permissions` — yang justru MEMBATASI
 * owner. `sessionsRevokedAt` tidak disentuh: yang dinaikkan tidak perlu diusir
 * dari sesinya sendiri.
 *
 * Efek samping yang disengaja: akunnya keluar dari tab Pelanggan (daftar itu
 * menyaring `role = 'pelanggan'`) dan masuk ke daftar Admin.
 *
 * Idempoten, dan menolak menaikkan akun yang sudah owner.
 */
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

const APPLY = process.argv.includes("--apply")
const email = process.argv.slice(2).find((a) => !a.startsWith("--"))?.trim().toLowerCase()
const tag = APPLY ? "[APPLY]" : "[DRY RUN]"

if (!email) {
  console.error("Pakai: npx tsx scripts/jadikan-owner.mts <email> [--apply]")
  process.exit(1)
}

const { getPrisma } = await import("../src/lib/prisma/client")
const p = getPrisma()

const user = await p.user.findUnique({
  where: { email },
  select: { id: true, email: true, name: true, username: true, role: true, roleId: true },
})

if (!user) {
  console.error(`${tag} Akun dengan email ${email} tidak ada.`)
  process.exit(1)
}

console.log(`${tag} ${user.email}`)
console.log(`  nama     : ${user.name}`)
console.log(`  username : ${user.username ?? "(kosong)"}`)
console.log(`  sekarang : role=${user.role}  roleId=${user.roleId ?? "-"}`)

if (user.role === "owner" && user.roleId === null) {
  console.log("\nSudah owner — tidak ada yang diubah.")
  await p.$disconnect()
  process.exit(0)
}

console.log(`  menjadi  : role=owner  roleId=-`)

if (user.username === null) {
  console.log(
    "\nCatatan: akun ini belum punya username. Daftar admin menampilkan kolom\n" +
      "username, jadi ia akan tampil kosong sampai diisi lewat /admin/akun.",
  )
}

if (APPLY) {
  await p.user.update({ where: { id: user.id }, data: { role: "owner", roleId: null } })
  console.log("\nSelesai. Muat ulang panel untuk melihat perubahannya.")
} else {
  console.log("\nJalankan ulang dengan --apply untuk menulis.")
}

await p.$disconnect()
