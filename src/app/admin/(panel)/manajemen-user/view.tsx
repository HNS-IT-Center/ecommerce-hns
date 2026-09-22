"use client"

import * as React from "react"

import { useRouter } from "next/navigation"
import { CircleQuestionMark, Pencil, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { RoleTag } from "@/components/admin/role-tag"
import type { RoleRow } from "@/lib/api/roles"
import type { AccessLevel } from "@/lib/auth/permissions"
import { levelSahUntukMode, type LevelMode } from "@/lib/auth/permission-levels"
import { createRoleAction, updateRoleAction, deleteRoleAction } from "./actions"

/**
 * Satu simpul di pohon izin, sudah jadi data biasa (lihat `keIzinNode` di
 * `page.tsx`). Komponen ini sengaja tidak tahu satu pun ATURAN izin — ia hanya
 * menampilkan apa yang diberikan server.
 */
export type IzinNode = {
  /** Kunci izin, atau null kalau ia grup murni — label tanpa izin sendiri. */
  key: string | null
  label: string
  description: string | null
  /** Pekerjaan yang biasanya memegang halaman ini — saran, bukan aturan. */
  audience: string | null
  mode: LevelMode | null
  /** Izinnya membuka sesuatu di luar panel `/admin` (mis. `/verify`). */
  luarPanel: boolean
  children?: IzinNode[]
}

const LEVELS: AccessLevel[] = ["none", "view", "edit"]
const LEVEL_LABEL: Record<AccessLevel, string> = { none: "Tak ada", view: "Lihat", edit: "Edit" }

type Daun = { key: string; label: string; mode: LevelMode; luarPanel: boolean }

/** Semua simpul berizin di bawah sebuah cabang, termasuk cabang itu sendiri. */
function daunDari(nodes: IzinNode[]): Daun[] {
  const out: Daun[] = []
  for (const n of nodes) {
    if (n.key && n.mode) {
      out.push({ key: n.key, label: n.label, mode: n.mode, luarPanel: n.luarPanel })
    }
    if (n.children) out.push(...daunDari(n.children))
  }
  return out
}

/**
 * Bentuk kontrol yang pantas untuk satu cabang.
 *
 * Cabang yang SELURUH isinya ya-tidak tidak perlu tiga tombol — menampilkannya
 * berarti menawarkan "Lihat" yang, sesampainya di tiap anak, ternyata sama
 * dengan "Tak ada". Cabang campuran tetap tiga tombol, karena di situ "Lihat"
 * memang berarti sesuatu untuk sebagian anaknya.
 */
function modeKontrol(daun: Daun[]): LevelMode {
  if (daun.length > 0 && daun.every((d) => d.mode === "edit-only")) return "edit-only"
  if (daun.length > 0 && daun.every((d) => d.mode === "view-only")) return "view-only"
  return "view-edit"
}

/**
 * Level yang sedang berlaku untuk SEBUAH CABANG, kalau seragam.
 *
 * Inilah aturan yang diminta: induk ikut tercentang hanya kalau SELURUH anaknya
 * ada di tingkat itu; satu saja berbeda, induknya tidak tercentang dan barisnya
 * ditandai "sebagian". Perbandingannya lewat `levelSahUntukMode` — anak yang
 * cuma bisa dibaca (`logs`) tetap terhitung seragam dengan saudaranya yang
 * "Edit", karena "Lihat" memang tingkat tertingginya.
 */
function levelSeragam(
  daun: { key: string; mode: LevelMode }[],
  levels: Record<string, AccessLevel>,
): AccessLevel | null {
  for (const lv of LEVELS) {
    if (daun.every((d) => (levels[d.key] ?? "none") === levelSahUntukMode(d.mode, lv))) return lv
  }
  return null
}

type DraftForm = {
  id: string | null // null = buat baru
  name: string
  description: string
  levels: Record<string, AccessLevel>
}

/**
 * Kelola peran RBAC: daftar peran, buat/edit dengan matriks izin per halaman,
 * hapus. Halaman "manajemen-user" itu sendiri sengaja bisa diatur seperti yang
 * lain — tapi server tetap menjaga tiap perubahan (requirePermission), jadi
 * melepas izinnya di UI tidak membuka pintu apa pun di server.
 */
export function ManajemenUserView({
  roles,
  tree,
  bolehEdit,
}: {
  roles: RoleRow[]
  tree: IzinNode[]
  bolehEdit: boolean
}) {
  const router = useRouter()
  const [draft, setDraft] = React.useState<DraftForm | null>(null)
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)
  /** Peran yang sedang ditanyakan penghapusannya (null = dialog tertutup). */
  const [akanDihapus, setAkanDihapus] = React.useState<RoleRow | null>(null)

  /** Semua kunci izin yang ada, sekali hitung — dipakai menyiapkan draft. */
  const semuaDaun = React.useMemo(() => daunDari(tree), [tree])

  function kosong(): Record<string, AccessLevel> {
    const levels: Record<string, AccessLevel> = {}
    for (const d of semuaDaun) levels[d.key] = "none"
    return levels
  }

  function mulaiBuat() {
    setError(null)
    setDraft({ id: null, name: "", description: "", levels: kosong() })
  }

  function mulaiEdit(role: RoleRow) {
    setError(null)
    const levels = kosong()
    // Baris untuk kunci yang sudah tidak ada di pohon sengaja diabaikan: ia
    // peninggalan izin yang dihapus, dan menyalinnya kembali ke draft berarti
    // menuliskannya lagi ke database setiap kali peran ini disunting.
    for (const perm of role.permissions) {
      if (perm.page in levels) levels[perm.page] = perm.access
    }
    setDraft({ id: role.id, name: role.name, description: role.description ?? "", levels })
  }

  /** Setel sekumpulan izin sekaligus — satu baris, atau seluruh isi cabang. */
  function setelBanyak(
    daun: { key: string; mode: LevelMode }[],
    diminta: AccessLevel,
  ) {
    setDraft((d) => {
      if (!d) return d
      const levels = { ...d.levels }
      for (const x of daun) levels[x.key] = levelSahUntukMode(x.mode, diminta)
      return { ...d, levels }
    })
  }

  function simpan() {
    if (!draft) return
    setError(null)
    const permissions = Object.entries(draft.levels).map(([page, access]) => ({ page, access }))
    startTransition(async () => {
      const res = draft.id
        ? await updateRoleAction(draft.id, { name: draft.name, description: draft.description, permissions })
        : await createRoleAction({ name: draft.name, description: draft.description, permissions })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setDraft(null)
      /**
       * `router.refresh()`, bukan `window.location.reload()`.
       *
       * Action-nya sudah memanggil `revalidatePath("/admin/manajemen-user")`,
       * jadi yang dibutuhkan cuma mengambil ulang pohon RSC-nya. Muat ulang
       * penuh ikut membuang tab yang sedang terbuka (kembali ke "Peran") dan
       * posisi gulir — mahal untuk sesuatu yang cuma mengubah satu daftar.
       */
      router.refresh()
    })
  }

  /**
   * Hapus peran. Dijalankan dari `ConfirmDialog`, bukan `window.confirm`.
   *
   * Yang bawaan peramban tidak bisa menampilkan angka pemakainya dengan tebal,
   * tidak bisa mewarnai tombolnya merah, tidak mengunci diri saat permintaannya
   * berjalan (klik ganda = dua permintaan hapus), dan di sebagian peramban bisa
   * dibungkam permanen oleh kotak "jangan tampilkan lagi" — persis pada dialog
   * yang paling perlu muncul.
   */
  async function jalankanHapus() {
    if (!akanDihapus) return
    setError(null)
    const res = await deleteRoleAction(akanDihapus.id)
    if (!res.ok) {
      setError(res.error)
      return
    }
    router.refresh()
  }

  return (
    <div className="space-y-5">
      {bolehEdit && (
        <Button size="sm" onClick={mulaiBuat}>
          + Peran Baru
        </Button>
      )}

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Daftar peran */}
      <div className="rounded-2xl border border-border bg-background overflow-hidden">
        {roles.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Belum ada peran. {bolehEdit && "Buat peran pertama dengan tombol di atas."}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {roles.map((role) => (
              <li key={role.id} className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0">
                  {/* Tag berwarna, bukan teks biasa: warna yang sama dipakai di
                      kartu admin dan tabel pelanggan, jadi satu peran bisa
                      dikenali lintas tab tanpa membaca namanya lagi. */}
                  <RoleTag roleId={role.id} className="text-sm">
                    {role.name}
                  </RoleTag>
                  {role.description && (
                    <div className="mt-1 text-sm text-muted-foreground">{role.description}</div>
                  )}
                  <div className="mt-1 text-xs text-muted-foreground">
                    {role.jumlahUser} admin · {role.permissions.length} halaman berizin
                  </div>
                </div>
                {bolehEdit && (
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="outline" onClick={() => mulaiEdit(role)} disabled={pending}>
                      <Pencil className="h-3.5 w-3.5" />
                      <span className="max-sm:sr-only">Edit</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAkanDihapus(role)}
                      disabled={pending}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="max-sm:sr-only">Hapus</span>
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/*
        Editor peran sebagai DIALOG, bukan panel yang menyelip di atas daftar.

        Sebelumnya matriks izinnya — dua puluhan baris — muncul inline dan
        mendorong daftar peran jauh ke bawah, sehingga mengedit satu peran
        terasa seperti berpindah halaman: daftar yang jadi acuan hilang dari
        pandangan, dan tidak ada yang menandai bahwa ini keadaan "sedang
        menyunting". Dialog menutup rapat keduanya — daftarnya tetap di
        belakang, dan Escape membatalkan.
      */}
      <Dialog
        open={draft !== null}
        onOpenChange={(open) => {
          // Jangan biarkan dialog tertutup di tengah penyimpanan: pekerjaannya
          // tetap jalan di server, tapi orangnya kehilangan pesan kegagalan.
          if (!open && !pending) setDraft(null)
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit Peran" : "Peran Baru"}</DialogTitle>
            <DialogDescription>
              Tentukan apa yang boleh diakses peran ini — per halaman, dengan tingkat lihat, edit,
              atau tak ada.
            </DialogDescription>
          </DialogHeader>

          {draft && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium">Nama peran</span>
                  <input
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="mis. Editor Harga"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    disabled={pending}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Deskripsi (opsional)</span>
                  <input
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="mis. Hanya kelola harga"
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    disabled={pending}
                  />
                </label>
              </div>

              {/* Pohon izin. Satu TooltipProvider membungkus seluruhnya —
                  memasangnya per baris berarti 20-an provider untuk satu layar. */}
              <TooltipProvider delay={150}>
                <div>
                  <span className="text-sm font-medium">Izin</span>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Susunannya mengikuti menu panel. Mengatur <span className="font-medium">induk</span>{" "}
                    sekaligus mengatur seluruh isinya; induk ikut tersorot hanya kalau semua isinya
                    sama. Arahkan kursor (atau Tab lalu Enter) pada tanda{" "}
                    <span className="font-semibold">?</span> untuk melihat apa yang dibuka tiap izin.
                  </p>

                  <PeringatanLuarPanel tree={tree} levels={draft.levels} />

                  <div className="mt-2 overflow-hidden rounded-lg border">
                    {tree.map((node, i) => (
                      <BarisIzin
                        key={node.key ?? node.label}
                        node={node}
                        depth={0}
                        pertama={i === 0}
                        levels={draft.levels}
                        disabled={pending}
                        onSetel={setelBanyak}
                      />
                    ))}
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground">
                    Halaman <span className="font-medium">Akun Saya</span> tidak ada di daftar ini —
                    ia selalu terbuka untuk setiap admin dan tidak bisa dicabut.
                  </p>
                </div>
              </TooltipProvider>
            </div>
          )}

          <DialogFooter>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDraft(null)}
              disabled={pending}
            >
              Batal
            </Button>
            <Button size="sm" onClick={simpan} disabled={pending || (draft?.name.trim().length ?? 0) < 2}>
              {pending ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={akanDihapus !== null}
        onOpenChange={(open) => {
          if (!open) setAkanDihapus(null)
        }}
        destructive
        confirmLabel="Hapus peran"
        title={`Hapus peran "${akanDihapus?.name ?? ""}"?`}
        description={
          akanDihapus?.jumlahUser
            ? `${akanDihapus.jumlahUser} akun yang memakai peran ini akan kembali ke perilaku owner/staff lama — izin per halamannya hilang, dan mereka perlu diberi peran lagi satu per satu. Akunnya sendiri tidak dihapus.`
            : "Peran ini belum dipakai akun mana pun, jadi tidak ada akses siapa pun yang berubah."
        }
        onConfirm={jalankanHapus}
      />
    </div>
  )
}

/**
 * Tanda "?" di samping nama izin, berisi penjelasan apa yang dibuka izin itu.
 *
 * Sebuah `<button>`, bukan `<span>`. Tooltip yang hanya muncul saat hover tidak
 * pernah sampai ke dua kelompok yang justru paling butuh: orang yang memakai
 * keyboard, dan orang yang membuka panel dari tablet di meja kasir — di layar
 * sentuh tidak ada "hover". Sebagai tombol, ia bisa di-Tab dan ditekan.
 *
 * `type="button"` wajib: komponen ini duduk di dalam matriks izin yang berada
 * dalam sebuah form, dan tombol tanpa tipe akan men-submit form itu.
 */
function PenjelasanIzin({ label, description }: { label: string; description: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={`Apa itu izin ${label}?`}
            className="inline-flex cursor-help text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
          >
            <CircleQuestionMark className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        }
      />
      <TooltipContent side="top" className="max-w-xs text-left leading-relaxed">
        {description}
      </TooltipContent>
    </Tooltip>
  )
}

/** Seberapa dalam sebuah baris menjorok. Kelas statis, bukan gaya sebaris —
 *  Tailwind hanya menghasilkan kelas yang benar-benar tertulis di kode. */
const INDENT: Record<number, string> = { 0: "pl-3", 1: "pl-8", 2: "pl-14" }

/**
 * Satu baris izin — daun, grup, atau keduanya sekaligus.
 *
 * Tiga bentuk yang mungkin, dan ketiganya nyata di pohon ini:
 *
 * 1. Daun biasa (`PC Builder`) — kontrolnya izinnya sendiri.
 * 2. Grup murni (`Produk`) — TIDAK punya izin sendiri; kontrolnya menyetel
 *    seluruh isinya, dan sorotannya cerminan anak-anaknya.
 * 3. Daun yang punya anak (`Update Harga` → `Harga Modal`) — kontrolnya tetap
 *    izinnya sendiri, anaknya berdiri sebagai baris tersendiri di bawahnya.
 *    Sengaja TIDAK diperlakukan sebagai grup: harga modal punya arti sendiri,
 *    dan tidak boleh ikut tersetel hanya karena halaman induknya dibuka.
 */
function BarisIzin({
  node,
  depth,
  pertama,
  levels,
  disabled,
  onSetel,
}: {
  node: IzinNode
  depth: number
  pertama: boolean
  levels: Record<string, AccessLevel>
  disabled: boolean
  onSetel: (daun: Daun[], level: AccessLevel) => void
}) {
  const grup = node.key === null
  const daunSendiri = React.useMemo(
    () =>
      node.key && node.mode
        ? [{ key: node.key, label: node.label, mode: node.mode, luarPanel: node.luarPanel }]
        : [],
    [node],
  )
  const daunCabang = React.useMemo(() => daunDari(node.children ?? []), [node])

  // Grup disetel sebagai satu kesatuan; daun (walau punya anak) hanya dirinya.
  const sasaran = grup ? daunCabang : daunSendiri
  const aktif = grup ? levelSeragam(daunCabang, levels) : (levels[node.key ?? ""] ?? "none")
  const mode = grup ? modeKontrol(daunCabang) : (node.mode ?? "view-edit")

  return (
    <>
      <div
        className={[
          "flex items-start justify-between gap-3 py-2 pr-2",
          INDENT[depth] ?? "pl-3",
          pertama ? "" : "border-t",
          grup ? "bg-muted/40" : "",
        ].join(" ")}
      >
        <div className="min-w-0">
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <span className={grup ? "text-sm font-semibold" : "text-sm"}>{node.label}</span>
            {node.description && (
              <PenjelasanIzin label={node.label} description={node.description} />
            )}
            {node.luarPanel && (
              <span
                className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400"
                title="Halamannya ada di luar /admin, jadi izin ini sendiri tidak membuka panel admin."
              >
                di luar panel
              </span>
            )}
            {grup && aktif === null && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                sebagian
              </span>
            )}
          </span>
          {node.audience && (
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Cocok untuk {node.audience}
            </span>
          )}
        </div>

        <KontrolLevel
          mode={mode}
          aktif={aktif}
          disabled={disabled}
          onPilih={(lv) => onSetel(sasaran, lv)}
        />
      </div>

      {node.children?.map((anak) => (
        <BarisIzin
          key={anak.key ?? anak.label}
          node={anak}
          depth={depth + 1}
          pertama={false}
          levels={levels}
          disabled={disabled}
          onSetel={onSetel}
        />
      ))}
    </>
  )
}

/**
 * Pemilih tingkat: tiga tombol, atau satu saklar kalau izinnya cuma ya-tidak.
 *
 * `aktif === null` hanya terjadi pada grup yang isinya campur — tidak ada
 * tombol yang tersorot, dan barisnya sudah ditandai "sebagian" di sebelah
 * namanya. Menyorot salah satunya di keadaan itu akan berbohong tentang isi
 * cabangnya.
 */
function KontrolLevel({
  mode,
  aktif,
  disabled,
  onPilih,
}: {
  mode: LevelMode
  aktif: AccessLevel | null
  disabled: boolean
  onPilih: (level: AccessLevel) => void
}) {
  if (mode !== "view-edit") {
    const nyala = aktif !== null && aktif !== "none"
    const level: AccessLevel = mode === "edit-only" ? "edit" : "view"
    return (
      <button
        type="button"
        role="switch"
        aria-checked={aktif === null ? "mixed" : nyala}
        disabled={disabled}
        onClick={() => onPilih(nyala ? "none" : level)}
        className={[
          "shrink-0 rounded px-2.5 py-1 text-xs font-medium transition-colors",
          nyala
            ? "bg-green-600 text-white"
            : "bg-muted text-muted-foreground hover:bg-muted-foreground/20",
        ].join(" ")}
      >
        {mode === "edit-only" ? "Boleh" : "Boleh lihat"}
      </button>
    )
  }

  return (
    <div className="flex shrink-0 justify-center gap-1">
      {LEVELS.map((lv) => (
        <button
          key={lv}
          type="button"
          disabled={disabled}
          onClick={() => onPilih(lv)}
          className={[
            "rounded px-2.5 py-1 text-xs font-medium transition-colors",
            aktif === lv
              ? lv === "edit"
                ? "bg-green-600 text-white"
                : lv === "view"
                  ? "bg-amber-500 text-white"
                  : "bg-muted-foreground/70 text-background"
              : "bg-muted text-muted-foreground hover:bg-muted-foreground/20",
          ].join(" ")}
        >
          {LEVEL_LABEL[lv]}
        </button>
      ))}
    </div>
  )
}

/**
 * Pemberitahuan bahwa peran yang sedang disusun tidak akan masuk panel admin.
 *
 * Kasusnya nyata: peran "Kasir" hanya diberi `verify`, yang halamannya di
 * `/verify` — orangnya tidak akan pernah melihat sidebar. Sebelumnya tidak ada
 * apa pun di layar yang mengatakan itu, jadi peran seperti ini disusun sambil
 * mengira panelnya ikut terbuka.
 *
 * Yang TIDAK dilakukan di sini: menebak ke halaman mana orangnya akan mendarat.
 * Aturan itu milik `landingPathFor()` di server, dan menyalinnya ke sini akan
 * menghasilkan dua aturan yang cuma sama di hari keduanya ditulis.
 */
function PeringatanLuarPanel({
  tree,
  levels,
}: {
  tree: IzinNode[]
  levels: Record<string, AccessLevel>
}) {
  const daun = React.useMemo(() => daunDari(tree), [tree])
  const punya = (d: Daun) => (levels[d.key] ?? "none") !== "none"
  const adaPanel = daun.some((d) => !d.luarPanel && punya(d))
  const luar = daun.filter((d) => d.luarPanel && punya(d))

  if (adaPanel) return null

  return (
    <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
      {luar.length === 0 ? (
        <>Peran ini belum diberi izin apa pun — akun yang memakainya tidak bisa membuka apa-apa.</>
      ) : (
        <>
          Peran ini <span className="font-semibold">tidak masuk panel admin</span>. Seluruh izinnya
          berada di luar <code>/admin</code>: {luar.map((d) => d.label).join(", ")}.
        </>
      )}
    </div>
  )
}
