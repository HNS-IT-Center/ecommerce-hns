"use client"

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react"
import Image from "next/image"
import { CircleCheck, Loader2, TriangleAlert, Upload, User2 } from "lucide-react"

import { useSessionActions } from "@/components/providers/session-provider"
import { IMAGE_ACCEPT_ATTRIBUTE } from "@/lib/validators/media-upload"
import { MAX_SALES_DISPLAY_NAME } from "@/features/quotation/lib/sales-name"

import { updateStaffProfileAction, updateUsernameAction } from "../actions"
import { EMPTY_ACCOUNT_STATE } from "../lib/state"
import { AvatarCropper } from "./avatar-cropper"
import { ChangePasswordForm } from "./change-password-form"

const inputClass =
  "w-full rounded-xl border border-input bg-muted/50 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:bg-background disabled:cursor-not-allowed disabled:opacity-70"

const labelClass = "mb-1 block text-sm font-semibold"

const tombolClass =
  "inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60 sm:w-auto"

export type StaffProfileValues = {
  name: string
  email: string
  username: string | null
  phoneNumber: string | null
  image: string | null
  salesDisplayName: string | null
  hasPassword: boolean
}

function Pesan({ error, ok }: { error: string | null; ok: string | null }) {
  if (error) {
    return (
      <p
        role="alert"
        className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
      >
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
        {error}
      </p>
    )
  }
  if (ok) {
    return (
      <p
        role="status"
        className="flex items-start gap-2 rounded-xl border border-brand-green/30 bg-brand-green/10 px-4 py-3 text-sm text-brand-green"
      >
        <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" />
        {ok}
      </p>
    )
  }
  return null
}

/**
 * Kartu "Profil Saya" milik STAFF di `/profile`.
 *
 * Tiga formulir terpisah dalam satu kartu, dan pemisahannya disengaja: yang
 * pertama mengubah apa yang DIBACA pelanggan (foto, nama sales, nomor WA), dua
 * berikutnya mengubah KUNCI PINTU (username, password). Satu tombol Simpan
 * untuk ketiganya berarti gagal mengganti password ikut membatalkan perbaikan
 * nomor telepon — dan orang yang menekannya tidak pernah tahu mana yang
 * tersimpan.
 *
 * Memilih foto membuka `AvatarCropper` lebih dulu; yang naik ke R2 (lewat
 * `POST /api/admin/media`, satu-satunya jalur unggah — CLAUDE.md §2.2) adalah
 * hasil potongannya, 512×512 WebP. Unggahannya terjadi begitu potongan
 * disetujui, tidak menunggu tombol Simpan Profil: cuma ada satu gambar dan
 * tidak ada urutan yang perlu disusun, jadi menahannya hanya menambah keadaan
 * yang bisa tidak sinkron dengan yang terlihat. Medan `image` yang ikut saat
 * Simpan berisi URL hasil unggahan itu.
 */
export function StaffProfileCard({
  profile,
  minPasswordLength,
  bolehQuotation,
  actions,
}: {
  profile: StaffProfileValues
  minPasswordLength: number
  /** Sales & CS melihat penjelasan tentang quotation; kasir tidak perlu. */
  bolehQuotation: boolean
  /**
   * Tombol "Panel Admin" dan "Keluar", dirender halaman server lalu dititipkan
   * ke sini.
   *
   * Dititipkan, BUKAN dipindahkan ke dalam komponen ini: keduanya sebuah
   * `<Link>` dan sebuah `<form action={serverAction}>`, dan menariknya ke
   * komponen klien berarti aksi keluar harus diimpor ke bundel peramban demi
   * sebuah tombol yang cuma mengirim formulir.
   *
   * Sebelum 23 September 2026 keduanya tinggal di kartu terpisah di atas kartu
   * ini — dua kotak berjudul "Profil Saya" bertumpuk, dengan bilah tab terjepit
   * di antaranya.
   */
  actions?: ReactNode
}) {
  const [profilState, simpanProfil, profilPending] = useActionState(
    updateStaffProfileAction,
    EMPTY_ACCOUNT_STATE,
  )
  const [usernameState, simpanUsername, usernamePending] = useActionState(
    updateUsernameAction,
    EMPTY_ACCOUNT_STATE,
  )

  /**
   * Beri tahu header bahwa identitas yang ditampilkannya sudah berubah.
   *
   * `revalidatePath` di server action menyegarkan komponen SERVER, tapi avatar
   * di header dirender dari jawaban `/api/auth/me` yang sudah dipegang klien
   * (`SessionProvider`) — dan itu tidak ikut basi dengan sendirinya. Tanpa
   * baris ini, staff yang baru mengganti fotonya melihat kartunya berubah
   * sementara header di atasnya masih memakai foto lama, sampai ia berpindah
   * tab dan kembali.
   */
  const { refresh } = useSessionActions()
  useEffect(() => {
    if (profilState.ok) void refresh(true)
  }, [profilState.ok, refresh])

  const [fotoUrl, setFotoUrl] = useState(profile.image ?? "")
  const [unggahPending, setUnggahPending] = useState(false)
  const [unggahError, setUnggahError] = useState<string | null>(null)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const inputFileRef = useRef<HTMLInputElement>(null)

  // Object URL berkas yang sedang dipotong dilepas saat komponen ditutup, kalau
  // tidak berkasnya tetap ditahan di memori peramban sampai tabnya ditutup.
  const objectUrlRef = useRef<string | null>(null)
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    }
  }, [])

  function lepasObjectUrl() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }

  /**
   * Memilih berkas TIDAK langsung mengunggah — ia membuka pemotong lingkaran.
   *
   * Yang diunggah adalah hasil potongan, bukan berkas aslinya: foto dari kamera
   * HP hampir selalu potret 4000px, dan tanpa pemotong ia dipasang apa adanya
   * lalu dipotong CSS menjadi lingkaran di bagian tengah — yang untuk foto
   * setengah badan berarti avatar berisi dada, bukan wajah.
   */
  function pilihFoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Kosongkan input supaya memilih berkas yang SAMA dua kali tetap memicu
    // `change` — kejadian wajar setelah percobaan pertama dibatalkan.
    event.target.value = ""
    if (!file) return

    setUnggahError(null)
    lepasObjectUrl()
    objectUrlRef.current = URL.createObjectURL(file)
    setCropSrc(objectUrlRef.current)
  }

  /** Hasil potongan (512×512 WebP, sudut transparan) langsung naik ke R2. */
  async function unggahPotongan(file: File) {
    setUnggahError(null)
    setUnggahPending(true)
    try {
      const body = new FormData()
      body.append("file", file)
      const res = await fetch("/api/admin/media", { method: "POST", body })
      const data = (await res.json()) as { source_url?: string; error?: string }

      if (!res.ok || !data.source_url) {
        setUnggahError(data.error ?? "Gagal mengunggah foto. Coba lagi.")
        return
      }
      // Pratinjau memakai URL R2 yang sudah pasti tersimpan, bukan object URL
      // lokal — apa yang terlihat sesudah ini sama dengan apa yang akan dilihat
      // pelanggan.
      setFotoUrl(data.source_url)
      setCropSrc(null)
      lepasObjectUrl()
    } catch {
      setUnggahError("Gagal mengunggah foto. Periksa koneksi lalu coba lagi.")
    } finally {
      setUnggahPending(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* ---------- Identitas yang dibaca pelanggan ---------- */}
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        {/* Kepala kartu: foto, nama akun, dan tombol — menggantikan kartu
            "Profil Saya" terpisah yang dulu berdiri di atas bilah tab.

            Blok ini sengaja berada DI LUAR formulir Simpan Profil di bawahnya.
            `actions` memuat sebuah `<form action={customerLogoutAction}>`, dan
            HTML melarang form bersarang: peramban membuang form bagian dalam
            saat mem-parse HTML server sementara React tetap merendernya di
            klien — hydration mismatch, dan tombol Keluar yang tidak bisa
            diandalkan. Jangan tarik blok ini kembali ke dalam formulir. */}
        <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-border bg-muted sm:h-20 sm:w-20">
              {fotoUrl ? (
                <Image
                  src={fotoUrl}
                  alt="Foto profil"
                  fill
                  sizes="80px"
                  className="object-cover"
                  // Pratinjau bisa berupa object URL lokal, yang tidak bisa
                  // dilewatkan optimizer gambar Next.
                  unoptimized
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <User2 className="h-8 w-8" />
                </div>
              )}
            </div>

            <div className="min-w-0">
              <p className="truncate text-lg font-bold">{profile.name}</p>
              <p className="truncate text-sm text-muted-foreground">{profile.email}</p>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <button
                  type="button"
                  onClick={() => inputFileRef.current?.click()}
                  disabled={unggahPending}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-input px-2.5 text-xs font-semibold transition-colors hover:bg-muted disabled:opacity-60"
                >
                  {unggahPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  {unggahPending ? "Mengunggah…" : "Ganti Foto"}
                </button>

                {fotoUrl && (
                  <button
                    type="button"
                    onClick={() => setFotoUrl("")}
                    className="text-xs font-semibold text-muted-foreground hover:text-destructive"
                  >
                    Hapus foto
                  </button>
                )}
              </div>
            </div>
          </div>

          {actions && <div className="flex flex-wrap gap-2 sm:shrink-0">{actions}</div>}
        </div>

        <form action={simpanProfil}>
          {/* Pemilih berkas & medan tersembunyi: tombolnya ada di kepala kartu,
              input aslinya tetap harus berada DI DALAM formulir ini supaya
              `image` ikut terkirim saat Simpan Profil ditekan. */}
          <input
            ref={inputFileRef}
            type="file"
            accept={IMAGE_ACCEPT_ATTRIBUTE}
            onChange={pilihFoto}
            className="hidden"
          />
          <input type="hidden" name="image" value={fotoUrl} />

          <div className="mt-5">
            <div className="space-y-4">
              <div>
                <label className={labelClass} htmlFor="salesDisplayName">
                  Nama Sales
                </label>
                <input
                  id="salesDisplayName"
                  name="salesDisplayName"
                  type="text"
                  defaultValue={profile.salesDisplayName ?? ""}
                  placeholder={profile.name}
                  maxLength={MAX_SALES_DISPLAY_NAME}
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Nama yang dibaca pelanggan. Kosongkan untuk memakai nama akun ({profile.name}).
                </p>
              </div>

              <div>
                <label className={labelClass} htmlFor="phoneNumber">
                  Nomor WhatsApp
                </label>
                <input
                  id="phoneNumber"
                  name="phoneNumber"
                  type="tel"
                  inputMode="tel"
                  defaultValue={profile.phoneNumber ?? ""}
                  placeholder="08xxxxxxxxxx"
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {bolehQuotation
                    ? "Dipakai saat pelanggan menekan “Tanya via WhatsApp” di tautan penawaran Anda. Kalau kosong, pesannya jatuh ke Customer Service."
                    : "Nomor yang bisa dihubungi rekan kerja."}
                </p>
              </div>

              <div>
                <label className={labelClass} htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={profile.email}
                  readOnly
                  disabled
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Email tidak bisa diganti sendiri — ia yang menyambungkan akun panel dengan login
                  Google Anda. Hubungi owner kalau harus diubah.
                </p>
              </div>
            </div>
          </div>

          {unggahError && (
            <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {unggahError}
            </p>
          )}

          <div className="mt-5 space-y-4">
            <Pesan error={profilState.error} ok={profilState.ok} />
            <button type="submit" disabled={profilPending || unggahPending} className={tombolClass}>
              {profilPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan Profil
            </button>
          </div>
        </form>
      </div>

      <AvatarCropper
        src={cropSrc}
        pending={unggahPending}
        onCancel={() => {
          setCropSrc(null)
          lepasObjectUrl()
        }}
        onDone={unggahPotongan}
      />

      {/* ---------- Kunci pintu ---------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <form action={simpanUsername} className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h2 className="font-bold">Username</h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Dipakai untuk masuk, selain email.
          </p>

          <div className="space-y-4">
            <Pesan error={usernameState.error} ok={usernameState.ok} />
            <div>
              <label className={labelClass} htmlFor="username">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                defaultValue={profile.username ?? ""}
                placeholder="mis. saleshns1"
                autoComplete="username"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Huruf kecil, angka, titik, garis bawah, dan tanda hubung.
              </p>
            </div>
            <button type="submit" disabled={usernamePending} className={tombolClass}>
              {usernamePending && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan Username
            </button>
          </div>
        </form>

        {/* Formulirnya tampil untuk SEMUA akun — yang berbeda cuma keterangan
            di atasnya. Akun Google (`hasPassword` false, lihat
            `lib/api/staff-profile.ts`) memakainya untuk MEMASANG password
            pertama, bukan mengganti. */}
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h2 className="font-bold">Password</h2>
          {profile.hasPassword ? (
            <p className="mt-1 mb-4 text-sm text-muted-foreground">
              Setelah diganti, sesi di perangkat lain diputus. Sesi di perangkat ini tetap jalan.
            </p>
          ) : (
            <p className="mt-1 mb-4 text-sm text-muted-foreground">
              Akun ini masuk lewat <strong className="font-semibold">Google</strong> dan belum punya
              password. Pasang satu kalau ingin bisa masuk tanpa Google — login Google Anda tetap
              berjalan seperti biasa.
            </p>
          )}

          <ChangePasswordForm minLength={minPasswordLength} hasPassword={profile.hasPassword} />

          {/* Sengaja TEKS, bukan tautan: `/login/lupa-password` memantulkan
              siapa pun yang masih punya sesi ke `/profile`, dan yang membaca
              kalimat ini pasti punya. Ini catatan untuk dipakai NANTI, saat
              orangnya justru tidak bisa sampai ke halaman ini.

              Hanya untuk yang SUDAH punya password: `forgotPasswordAction`
              melewati akun tanpa `passwordHash`, jadi menjanjikannya kepada
              akun Google adalah janji yang tidak pernah ditepati. */}
          {profile.hasPassword && (
            <p className="mt-4 text-xs text-muted-foreground">
              Lupa password dan tidak bisa masuk? Di halaman masuk ada{" "}
              <strong className="font-semibold">Lupa password?</strong> — tautan pembuatan password
              baru dikirim ke {profile.email}.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
