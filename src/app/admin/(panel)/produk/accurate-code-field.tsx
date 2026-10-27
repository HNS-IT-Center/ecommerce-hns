"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { periksaKodeAccurateAction, tautkanKodeAccurateAction } from "./actions"

/**
 * Isian Kode Accurate — penambat produk web ke barang di kasir Accurate.
 *
 * Dipakai dua tempat dengan dua urutan kerja yang berbeda, dan perbedaan itu
 * bukan pilihan gaya melainkan akibat dari cara penautan bekerja: `tautkanKode`
 * mencocokkan lewat `products.woo_id`, jadi harus ada produk tersimpan dulu.
 *
 * - **`mode="simpan"`** (Quick Edit & form edit) — produknya sudah ada, jadi
 *   kodenya disimpan sendiri saat isian ditinggalkan, di luar tombol Simpan.
 *   Yang tersimpan di sini bukan bagian dari produk, melainkan tautannya, dan
 *   ia tidak lewat `updateProduct` melainkan `tautkanKode` yang memeriksa dua
 *   hal dulu: kodenya ada di Accurate, dan belum menambat produk lain.
 *   Menyatukannya ke payload produk melewati kedua pemeriksaan itu — dan kode
 *   yang salah pasang mengirim harga ke produk yang keliru (docs/13).
 *
 * - **`mode="tunda"`** (form produk baru) — produknya belum ada, jadi belum ada
 *   yang bisa ditambatkan. Kodenya cuma DIPERIKSA saat isian ditinggalkan,
 *   nilainya diserahkan ke formulir lewat `onUbah`, dan penautannya dikerjakan
 *   pemanggil sesudah produknya tersimpan.
 *
 * Satu komponen untuk dua-duanya supaya pesan, tata letak, dan perilaku
 * pemangkasan spasi tidak lama-lama berbeda di dua layar yang staff pakai
 * bergantian.
 *
 * **Induk produk bervarian (`indukBervarian`) tidak diberi isian** sejak 20
 * Oktober 2026 — hanya keterangan bahwa kodenya masuk lewat SKU varian.
 * Stok induk dibaca dari variannya; kode yang ditautkan ke induk adalah kasus
 * "kode tersangkut di induk" yang berulang kali harus dibereskan dengan skrip
 * (31 induk pada 15 Oktober, Lenovo 28696 pada 19 Oktober). `tautkanKode`
 * menolaknya juga, jadi menyembunyikan isian ini bukan satu-satunya penjaga.
 * Induk yang TERLANJUR punya kode tetap mendapat isiannya — tanpa itu
 * kodenya tidak bisa dilepas dari layar ini.
 */
type AccurateCodeFieldProps = (
  | {
      mode: "simpan"
      /**
       * `wooId` produk — BUKAN `Product.id` internal. Tabel produk admin
       * menyajikan `wooId` sebagai `id` (lihat `db-mapper.ts`), dan
       * `tautkanKode` mencocokkan `WHERE woo_id`. Keduanya sepakat.
       */
      wooId: number
      kode: string | null
      id?: string
    }
  | {
      mode: "tunda"
      kode: string | null
      onUbah: (kode: string | null) => void
      /**
       * Melaporkan galat pemeriksaan ke formulir, bukan cuma menampilkannya di
       * sini. Tanpa ini formulir cuma tahu kodenya null — dan "belum diisi"
       * tidak bisa dibedakan dari "diisi lalu ditolak". Yang kedua perlu
       * disebut sebelum produknya dibuat; yang pertama tidak.
       */
      onGalat: (pesan: string | null) => void
      id?: string
    }
) & {
  indukBervarian?: boolean
  /**
   * Dipanggil setiap kali kode yang SAH berubah — sesudah tersimpan (mode
   * "simpan") atau sesudah lolos pemeriksaan (mode "tunda"); `null` kalau
   * dikosongkan atau ditolak. Ketikan yang belum diperiksa tidak dilaporkan.
   * Dipakai formulir produk supaya SKU bisa mengikuti kode ini.
   */
  onKodeSah?: (kode: string | null) => void
}

export function AccurateCodeField(props: AccurateCodeFieldProps) {
  const idIsian = props.id ?? "accurate-code"
  const [nilai, setNilai] = useState(props.kode ?? "")
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const [pesanBaik, setPesanBaik] = useState<string | null>(null)

  if (props.indukBervarian && !props.kode) {
    return (
      <div className="rounded-xl border border-dashed border-input px-3 py-2.5 text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground">Kode Accurate</span> ditautkan per varian —
        isi kolom SKU varian dengan kode Accurate-nya, dan varian itu tertaut sendiri saat
        produk disimpan.
      </div>
    )
  }

  async function tangani() {
    const bersih = nilai.trim()
    const semula = props.kode ?? ""

    if (props.mode === "simpan") {
      if (bersih === semula) {
        setGalat(null)
        return
      }
      setSibuk(true)
      setGalat(null)
      setPesanBaik(null)
      const hasil = await tautkanKodeAccurateAction({
        wooId: props.wooId,
        kode: bersih === "" ? null : bersih,
      })
      setSibuk(false)

      if (hasil.error) {
        // Isian dikembalikan ke nilai tersimpan. Teks yang ditolak kalau
        // dibiarkan menempel akan tampak seperti sudah tertaut.
        setGalat(hasil.error)
        setNilai(semula)
        return
      }
      setPesanBaik("Tautan tersimpan.")
      props.onKodeSah?.(bersih === "" ? null : bersih)
      return
    }

    // mode "tunda": tidak ada yang ditulis, cuma diperiksa.
    props.onUbah(bersih === "" ? null : bersih)
    if (bersih === "") {
      setGalat(null)
      props.onGalat(null)
      setPesanBaik(null)
      props.onKodeSah?.(null)
      return
    }

    setSibuk(true)
    setGalat(null)
    props.onGalat(null)
    setPesanBaik(null)
    const hasil = await periksaKodeAccurateAction({ kode: bersih })
    setSibuk(false)

    if (!hasil.ok) {
      // Isiannya sengaja TIDAK dikosongkan di sini, beda dari mode "simpan".
      // Belum ada apa pun yang tersimpan untuk dipulihkan, dan membuang
      // ketikan orang berarti ia harus mengetik ulang untuk membetulkan satu
      // huruf. Yang penting nilainya tidak ikut terkirim — itu dijaga di
      // `onUbah` di bawah.
      setGalat(hasil.alasan)
      props.onGalat(hasil.alasan)
      props.onUbah(null)
      props.onKodeSah?.(null)
      return
    }
    // Namanya ditampilkan supaya kode yang sah tapi salah barang ketahuan
    // sebelum produknya dibuat.
    setPesanBaik(`Cocok: ${hasil.namaBarang}`)
    props.onKodeSah?.(bersih)
  }

  return (
    <div>
      <Label htmlFor={idIsian} className="mb-1.5">
        Kode Accurate <span className="font-normal text-muted-foreground">(opsional)</span>
      </Label>
      <div className="relative">
        <Input
          id={idIsian}
          className="text-xs md:text-xs"
          placeholder="Kosongkan kalau belum ditautkan"
          value={nilai}
          disabled={sibuk}
          onChange={(e) => {
            setNilai(e.target.value)
            setPesanBaik(null)
            setGalat(null)
            // Formulir ikut dibersihkan, bukan hanya tampilan di sini: galat
            // yang tertinggal di atas sana akan memperingatkan soal kode yang
            // sudah tidak ada lagi di isian.
            if (props.mode === "tunda") props.onGalat(null)
          }}
          onBlur={tangani}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              e.currentTarget.blur()
            }
          }}
        />
        {sibuk && (
          <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
      {galat ? (
        <p className="mt-1 text-[11px] text-destructive">{galat}</p>
      ) : props.indukBervarian && !pesanBaik ? (
        <p className="mt-1 text-[11px] text-destructive">
          Kode ini menempel di INDUK, padahal stok induk dibaca dari variannya. Kosongkan kolom
          ini lalu klik Simpan — varian yang SKU-nya sama dengan kode itu tertaut sendiri.
        </p>
      ) : pesanBaik ? (
        <p className="mt-1 text-[11px] text-success">{pesanBaik}</p>
      ) : (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Kode barang di kasir Accurate — penyambung stok &amp; harga.{" "}
          {props.mode === "simpan"
            ? "Tersimpan sendiri, di luar tombol Simpan."
            : "Ditautkan setelah produknya dibuat."}
        </p>
      )}
    </div>
  )
}
