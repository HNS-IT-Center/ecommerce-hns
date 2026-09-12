"use client"

import Image from "next/image"
import { useState, useTransition } from "react"
import { ChevronDown, ChevronUp, ImagePlus, Plus, Save, Trash2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  MAX_PREBUILD_GAMES,
  slugifyGameId,
  type PrebuildGame,
} from "@/lib/pc-prebuild/games"
import { compressImage } from "@/lib/utils/image-compression"
import { IMAGE_ACCEPT_ATTRIBUTE } from "@/lib/validators/media-upload"

import { savePcPrebuildGames } from "../actions"

/**
 * Daftar game untuk grid estimasi FPS — satu daftar untuk semua paket.
 *
 * Tinggal di tab tersendiri pada halaman yang sama, BUKAN di rute baru dengan
 * entri sidebar sendiri. Daftar ini cuma berarti di dalam konteks paket
 * prebuild; sebagai menu tersendiri ia akan berdiri sejajar dengan "Produk" dan
 * "Kategori" padahal isinya delapan baris yang jarang disentuh.
 *
 * Disimpan lewat aksinya SENDIRI, terpisah dari tombol simpan paket. Keduanya
 * menulis baris `settings` yang berbeda, dan menyatukan tombolnya berarti
 * mengubah satu nama game ikut menuliskan ulang seluruh konfigurasi paket.
 *
 * ## Id tidak ikut berubah saat nama diubah
 *
 * Entri FPS pada paket yang sudah dianalisis menunjuk `id`. Membetulkan ejaan
 * nama game tidak boleh menghapus angka yang sudah dihitung — jadi `id` hanya
 * dibuat sekali, saat barisnya ditambahkan.
 */
export function GamesManager({ initialGames }: { initialGames: PrebuildGame[] }) {
  const [games, setGames] = useState<PrebuildGame[]>(initialGames)
  const [namaBaru, setNamaBaru] = useState("")
  const [flash, setFlash] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const penuh = games.length >= MAX_PREBUILD_GAMES

  function tambah() {
    const nama = namaBaru.trim()
    if (!nama || penuh) return

    // Id kembar tidak bisa dibedakan entri FPS. Ditambah akhiran angka, bukan
    // ditolak: staff yang menambah "Battlefield" kedua kali biasanya memang
    // memaksudkan judul yang berbeda.
    const dasar = slugifyGameId(nama)
    let id = dasar
    let n = 2
    while (games.some((g) => g.id === id)) {
      id = `${dasar}-${n}`
      n += 1
    }

    setGames([...games, { id, name: nama, logo: "", order: games.length }])
    setNamaBaru("")
  }

  function ubah(id: string, patch: Partial<PrebuildGame>) {
    setGames((lama) => lama.map((g) => (g.id === id ? { ...g, ...patch } : g)))
  }

  function geser(index: number, arah: -1 | 1) {
    const tujuan = index + arah
    if (tujuan < 0 || tujuan >= games.length) return
    setGames((lama) => {
      const salinan = [...lama]
      const [diambil] = salinan.splice(index, 1)
      salinan.splice(tujuan, 0, diambil)
      return salinan.map((g, i) => ({ ...g, order: i }))
    })
  }

  function simpan() {
    setFlash(null)
    startTransition(async () => {
      const hasil = await savePcPrebuildGames(games.map((g, i) => ({ ...g, order: i })))
      setFlash(hasil.success ? `Tersimpan — ${hasil.games} game.` : "Gagal menyimpan.")
    })
  }

  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Game yang muncul di grid estimasi FPS pada halaman paket. Urutannya menentukan urutan
        barisnya; lima teratas yang terlihat lebih dulu sebelum digulir. Logonya opsional — tanpa
        logo, grid memakai inisial nama.
      </p>

      <div className="space-y-2">
        {games.map((game, index) => (
          <div
            key={game.id}
            className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2.5"
          >
            <LogoGame url={game.logo} nama={game.name} onChange={(logo) => ubah(game.id, { logo })} />

            <Input
              value={game.name}
              onChange={(e) => ubah(game.id, { name: e.target.value })}
              aria-label={`Nama game ${game.id}`}
              className="h-9 min-w-40 flex-1 text-sm"
            />

            <code className="rounded bg-muted px-2 py-1 text-[11px] text-muted-foreground">
              {game.id}
            </code>

            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                disabled={index === 0}
                onClick={() => geser(index, -1)}
                aria-label={`Naikkan ${game.name}`}
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                disabled={index === games.length - 1}
                onClick={() => geser(index, 1)}
                aria-label={`Turunkan ${game.name}`}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="icon-sm"
                onClick={() => setGames(games.filter((g) => g.id !== game.id))}
                aria-label={`Hapus ${game.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}

        {games.length === 0 && (
          <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            Daftar kosong — grid estimasi FPS tidak akan tampil di halaman paket.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={namaBaru}
          onChange={(e) => setNamaBaru(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              tambah()
            }
          }}
          placeholder={penuh ? `Maksimal ${MAX_PREBUILD_GAMES} game` : "Nama game baru…"}
          disabled={penuh}
          aria-label="Nama game baru"
          className="h-9 w-56 text-sm"
        />
        <Button type="button" variant="outline" size="sm" onClick={tambah} disabled={penuh || !namaBaru.trim()}>
          <Plus className="h-3.5 w-3.5" />
          Tambah game
        </Button>

        <Button type="button" size="sm" onClick={simpan} disabled={pending}>
          <Save className="h-3.5 w-3.5" />
          {pending ? "Menyimpan…" : "Simpan daftar game"}
        </Button>

        {flash && <span className="text-sm text-muted-foreground">{flash}</span>}
      </div>
    </div>
  )
}

/**
 * Logo satu game. Diunggah ke R2 lewat `POST /api/admin/media` — jalur unggah
 * satu-satunya di project ini (CLAUDE.md §2.2), dan dikompres dulu di browser
 * seperti foto paket.
 */
function LogoGame({
  url,
  nama,
  onChange,
}: {
  url: string
  nama: string
  onChange: (url: string) => void
}) {
  const [mengunggah, setMengunggah] = useState(false)

  async function pilih(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setMengunggah(true)
    try {
      const { file: compressed } = await compressImage(file)
      const formData = new FormData()
      formData.append("file", compressed)
      const res = await fetch("/api/admin/media", { method: "POST", body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Upload logo gagal")
      onChange(data.source_url as string)
    } catch {
      // Kegagalan unggah dibiarkan senyap di baris sekecil ini: logonya opsional,
      // dan grid tetap tampil dengan inisial. Yang penting barisnya tidak
      // menyimpan URL yang tidak jadi.
    } finally {
      setMengunggah(false)
      e.target.value = ""
    }
  }

  if (url) {
    return (
      <div className="relative">
        <Image
          src={url}
          alt=""
          width={36}
          height={36}
          className="h-9 w-9 rounded-lg border bg-white object-contain"
        />
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={`Hapus logo ${nama}`}
          className="absolute -right-1.5 -top-1.5 rounded-full border bg-background p-0.5 text-muted-foreground hover:text-destructive"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    )
  }

  return (
    <label className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg border border-dashed bg-muted/40 text-muted-foreground hover:bg-muted">
      {mengunggah ? (
        <span className="text-[9px] font-semibold">…</span>
      ) : (
        <ImagePlus className="h-4 w-4" />
      )}
      <span className="sr-only">Unggah logo {nama}</span>
      <input type="file" accept={IMAGE_ACCEPT_ATTRIBUTE} onChange={pilih} disabled={mengunggah} className="sr-only" />
    </label>
  )
}
