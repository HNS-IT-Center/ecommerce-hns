"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Link2, Loader2, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import type { BarisUsulan, HasilUsulan } from "@/lib/api/accurate/usulan-pasangan"
import type { Keyakinan } from "@/lib/api/accurate/pencocokan-nama"

import { abaikanKodeAction, tautkanKodeAction } from "./actions"

const LABEL_KEYAKINAN: Record<Keyakinan, string> = {
  tinggi: "Jelas",
  sedang: "Perlu dilihat",
  rendah: "Meragukan",
}

const KELAS_KEYAKINAN: Record<Keyakinan, string> = {
  tinggi: "bg-success/10 text-success border-success/30",
  sedang: "bg-warning/10 text-warning border-warning/30",
  rendah: "bg-muted text-muted-foreground border-border",
}

/**
 * Tab Usulan Pasangan — antrean penautan beserta kandidat dari mesin.
 *
 * ATURAN YANG MEMBENTUK SELURUH LAYAR INI (docs/13 §5):
 *
 *   Mesin mengurutkan, TIDAK PERNAH memilih.
 *
 * Karena itu: nol pra-centang, tidak ada tombol "terima semua usulan", yang
 * ditampilkan ALASAN (token yang cocok) bukan skor, dan tombol "tidak ada yang
 * cocok" sejajar menonjolnya dengan kandidatnya.
 *
 * Yang terakhir itu bukan kesopanan. Kalau yang tampil cuma tiga kandidat tanpa
 * jalan keluar yang jelas, orang cenderung memilih yang paling tidak salah dari
 * tiga — padahal jawaban yang benar sering "tidak ada yang cocok". Filter yang
 * mempersempit pilihan menolong; filter yang mempersempit KEMUNGKINAN JAWABAN
 * menyesatkan.
 *
 * Akurasi terukur mesinnya: kandidat benar ada di 3 teratas pada 93,1% kasus —
 * dan itu batas atas dari kunci jawaban yang bias. Artinya sekitar satu dari
 * empermpat belas barang TIDAK punya jawaban benar di layar sama sekali.
 */
export function UsulanView({ data, q }: { data: HasilUsulan; q: string }) {
  const router = useRouter()
  const [teksCari, setTeksCari] = React.useState(q)
  const [pending, startTransition] = React.useTransition()
  const [pesan, setPesan] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  /** Penautan yang sedang dikonfirmasi (null = tidak ada). */
  const [menautkan, setMenautkan] = React.useState<{
    baris: BarisUsulan
    wooId: number
    namaProduk: string
  } | null>(null)

  /** Barang yang sedang ditandai tidak dijual di web. */
  const [mengabaikan, setMengabaikan] = React.useState<BarisUsulan | null>(null)

  function url(ubahan: { page?: number; q?: string }) {
    const sp = new URLSearchParams()
    sp.set("tab", "usulan")
    const cari = ubahan.q ?? q
    if (cari) sp.set("q", cari)
    const page = ubahan.page ?? data.page
    if (page > 1) sp.set("page", String(page))
    return `/admin/harga-accurate?${sp.toString()}`
  }

  function tautkan() {
    const t = menautkan
    if (!t) return
    startTransition(async () => {
      const res = await tautkanKodeAction({
        wooId: t.wooId,
        kode: t.baris.kodeAccurate,
        isiSku: true,
      })
      if (!res.ok) {
        setPesan(null)
        setError(res.alasan)
        return
      }
      setError(null)
      setPesan(`"${t.baris.namaBarang}" ditautkan ke "${t.namaProduk}".`)
      router.refresh()
    })
  }

  function abaikan() {
    const b = mengabaikan
    if (!b) return
    startTransition(async () => {
      const res = await abaikanKodeAction({ kode: b.kodeAccurate })
      if (!res.ok) {
        setPesan(null)
        setError(res.alasan)
        return
      }
      setError(null)
      setPesan(`"${b.namaBarang}" ditandai tidak dijual di web.`)
      router.refresh()
    })
  }

  return (
    <div>
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <p className="text-sm">
          <strong>{data.total.toLocaleString("id-ID")}</strong> barang Accurate belum tertaut.
          Mesin mengurutkan kandidat; <strong>yang memutuskan tetap Anda</strong>.
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {(["tinggi", "sedang", "rendah"] as const).map((k) => (
            <span key={k} className={`rounded-full border px-2 py-0.5 ${KELAS_KEYAKINAN[k]}`}>
              {LABEL_KEYAKINAN[k]}: {data.rekap[k].toLocaleString("id-ID")}
            </span>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Diurutkan dari yang paling jelas. Kandidat benar ada di 3 teratas pada sekitar 93% kasus
          saat diuji — jadi <strong>kira-kira 1 dari 14 barang tidak punya jawaban benar di
          layar</strong>. Kalau tidak ada yang cocok, katakan begitu; jangan pilih yang paling
          mendekati.
        </p>
      </div>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          router.replace(url({ q: teksCari.trim(), page: 1 }))
        }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8 text-xs md:text-xs"
            placeholder="Cari nama atau kode barang Accurate…"
            value={teksCari}
            onChange={(e) => setTeksCari(e.target.value)}
          />
        </div>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          Cari
        </Button>
      </form>

      {pesan && (
        <p className="mt-3 rounded-lg border border-success/30 bg-success/10 p-3 text-sm">{pesan}</p>
      )}
      {error && (
        <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {data.rows.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Tidak ada barang yang cocok dengan pencarian ini.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {data.rows.map((b) => (
            <li key={b.kodeAccurate} className="rounded-2xl border border-border bg-background p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium break-words">{b.namaBarang}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {b.kodeAccurate}
                    {b.kategori && ` · ${b.kategori}`}
                    {b.brand && ` · ${b.brand}`}
                    {b.stok !== null && ` · stok ${b.stok}`}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${KELAS_KEYAKINAN[b.keyakinan]}`}
                >
                  {LABEL_KEYAKINAN[b.keyakinan]}
                </span>
              </div>

              {b.kembar && (
                <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-warning/40 bg-warning/5 p-2 text-[11px]">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                  <span>
                    Kandidat teratas cocok pada kata yang <strong>sama persis</strong> — biasanya
                    varian dari model yang sama. Urutannya di sini tidak berarti apa-apa; bedanya
                    ada di bagian yang tidak tertulis di nama Accurate.
                  </span>
                </p>
              )}

              {b.kandidat.length === 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Tidak ada kandidat yang ditemukan mesin.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {b.kandidat.map((k) => (
                    <li
                      key={k.wooId}
                      className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border bg-muted/20 p-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs break-words">{k.nama}</p>
                        <p className="mt-1 flex flex-wrap gap-1">
                          {/* ALASAN, bukan skor. Staff bisa menilai benar-salahnya
                              "cocok pada M171, WIRELESS" dalam sekali baca; angka
                              7,42 tidak bisa dinilai siapa pun. */}
                          {k.alasan.slice(0, 6).map((t) => (
                            <span
                              key={t}
                              className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                            >
                              {t}
                            </span>
                          ))}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        className="gap-1.5"
                        onClick={() =>
                          setMenautkan({ baris: b, wooId: k.wooId, namaProduk: k.nama })
                        }
                      >
                        <Link2 className="h-3.5 w-3.5" />
                        Tautkan
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Sejajar menonjolnya dengan kandidat — lihat catatan komponen. */}
              <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => setMengabaikan(b)}
                >
                  Tidak ada yang cocok — tandai tidak dijual di web
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Halaman {data.page} dari {data.pageCount}
          {pending && (
            <span className="ml-2 inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> menyimpan…
            </span>
          )}
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={data.page <= 1 || pending}
            onClick={() => router.replace(url({ page: data.page - 1 }))}
          >
            Sebelumnya
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={data.page >= data.pageCount || pending}
            onClick={() => router.replace(url({ page: data.page + 1 }))}
          >
            Berikutnya
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={menautkan !== null}
        onOpenChange={(open) => {
          if (!open) setMenautkan(null)
        }}
        title="Tautkan barang ini?"
        description={
          menautkan ? (
            <span className="block space-y-2 text-left text-xs">
              <span className="block">
                <span className="text-muted-foreground">Accurate:</span>{" "}
                <strong className="text-foreground">{menautkan.baris.namaBarang}</strong>
              </span>
              <span className="block">
                <span className="text-muted-foreground">Produk web:</span>{" "}
                <strong className="text-foreground">{menautkan.namaProduk}</strong>
              </span>
              <span className="block text-muted-foreground">
                SKU produk akan diisi kodenya kalau masih kosong. Tautan ini menentukan harga
                barang mana yang dibandingkan dengan kasir — dan tercatat atas nama Anda.
              </span>
            </span>
          ) : null
        }
        confirmLabel="Ya, tautkan"
        onConfirm={tautkan}
      />

      <ConfirmDialog
        open={mengabaikan !== null}
        onOpenChange={(open) => {
          if (!open) setMengabaikan(null)
        }}
        title="Tandai tidak dijual di web?"
        description={
          mengabaikan ? (
            <span className="block space-y-2 text-left text-xs">
              <span className="block font-medium text-foreground">{mengabaikan.namaBarang}</span>
              <span className="block text-muted-foreground">
                Barangnya tetap ada di tabel harga dan tidak dihapus dari Accurate. Yang berubah
                hanya kedudukannya di antrean ini — bisa dibatalkan kapan saja dari Daftar Harga.
              </span>
            </span>
          ) : null
        }
        confirmLabel="Tandai"
        onConfirm={abaikan}
      />
    </div>
  )
}
