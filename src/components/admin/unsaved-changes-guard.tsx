"use client"

import { useState, type ReactNode } from "react"
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard"

type Props = {
  /**
   * Serahkan status perubahan dari luar kalau formulirnya memang tahu — mis.
   * `formState.isDirty` milik react-hook-form. Itu lebih tepat daripada
   * pengamatan DOM di bawah, karena ia tahu bedanya "diubah" dengan "diubah lalu
   * dikembalikan ke nilai semula".
   *
   * Kalau tidak diisi, komponen ini mengamati sendiri (lihat catatan di bawah).
   */
  isDirty?: boolean
  children: ReactNode
}

/**
 * Bungkus sebuah formulir supaya perubahan yang belum disimpan tidak hilang
 * tanpa peringatan.
 *
 * Dibuat sebagai PEMBUNGKUS, bukan sebagai perubahan di dalam tiap formulir,
 * karena tiga dari empat formulir admin adalah `<form action={serverAction}>`
 * polos tanpa state sama sekali — dua di antaranya bahkan Server Component.
 * Mengubah ketiganya jadi react-hook-form hanya demi pelacakan perubahan adalah
 * pekerjaan yang jauh lebih besar daripada yang epic ini minta, dan menyentuh
 * jalur simpan yang sudah bekerja.
 *
 * `display: contents` dipakai supaya pembungkus ini tidak menghasilkan kotak
 * apa pun di layout. Kelas `max-w-xl`, `space-y-4`, dan `lg:grid-cols-2` pada
 * formulir di dalamnya tetap berlaku persis seperti sebelumnya.
 *
 * BATAS PENGAMATAN DOM (saat `isDirty` tidak diisi): begitu ada satu ketikan,
 * formulirnya dianggap berubah dan tetap begitu walau isinya dikembalikan ke
 * nilai awal. Jadi ia bisa memperingatkan padahal sudah tidak ada yang berubah.
 * Itu arah kesalahan yang disengaja — memperingatkan berlebihan hanya
 * merepotkan, sedangkan gagal memperingatkan berarti kehilangan pekerjaan
 * orang. Kalau suatu saat formulirnya punya pelacakan sendiri, isi `isDirty` dan
 * pengamatan ini mundur sendiri.
 */
export function UnsavedChangesGuard({ isDirty, children }: Props) {
  const [tersentuh, setTersentuh] = useState(false)

  // `isDirty` yang diberikan dari luar selalu menang.
  const dikendalikanLuar = isDirty !== undefined
  useUnsavedChangesGuard(dikendalikanLuar ? isDirty : tersentuh)

  function tandai() {
    // React membatalkan render ulang kalau nilainya sama, jadi ini tidak
    // menyebabkan render per ketikan setelah tanda pertama menyala.
    setTersentuh(true)
  }

  return (
    <div
      style={{ display: "contents" }}
      // `onInput` menangkap ketikan; `onChange` menangkap yang tidak diketik —
      // checkbox, select, dan input file. Keduanya menggelembung sampai ke sini.
      onInput={dikendalikanLuar ? undefined : tandai}
      onChange={dikendalikanLuar ? undefined : tandai}
      // Setelah dikirim, tidak ada lagi yang belum disimpan. Formulir server
      // action mengalihkan halaman setelah berhasil, jadi tanda ini tidak perlu
      // dinyalakan lagi. Kalau pengirimannya GAGAL, tandanya sudah padam
      // sementara isinya masih di layar — batas yang diterima, karena kegagalan
      // simpan sudah punya pesannya sendiri di layar.
      onSubmit={() => setTersentuh(false)}
      onReset={() => setTersentuh(false)}
    >
      {children}
    </div>
  )
}
