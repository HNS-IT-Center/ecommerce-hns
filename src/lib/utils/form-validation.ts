import type { FormEvent } from "react"

/** Elemen form yang punya Constraint Validation API (`setCustomValidity`, dst.). */
type ValidatableElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

/**
 * Pesan validasi bawaan browser (`required`, `type="email"`, `minLength`, …)
 * ikut BAHASA BROWSER, bukan bahasa halaman — jadi tooltipnya tetap "Please
 * fill out this field" walau seluruh UI Bahasa Indonesia. Attribute `title`
 * tidak menggantikannya, hanya menambah baris di bawahnya. Satu-satunya cara
 * mengganti judul tooltip itu adalah `setCustomValidity()`.
 *
 * Fungsi ini menerjemahkan pesan berdasarkan `validity` elemen. Validasi
 * native-nya TIDAK dimatikan — indikator visual & dukungan pembaca layar
 * bawaan tetap hidup, hanya teksnya yang jadi Indonesia.
 */
export function localizedValidityMessage(el: ValidatableElement): string {
  const v = el.validity
  if (v.valueMissing) return "Kolom ini wajib diisi."
  if (v.typeMismatch) {
    if (el instanceof HTMLInputElement && el.type === "email") {
      return "Masukkan alamat email yang valid."
    }
    return "Format isian tidak sesuai."
  }
  if (v.tooShort && "minLength" in el) return `Minimal ${el.minLength} karakter.`
  if (v.tooLong && "maxLength" in el) return `Maksimal ${el.maxLength} karakter.`
  // `title` sudah menjelaskan format yang benar dalam Bahasa Indonesia (mis.
  // aturan username) — pakai itu kalau ada supaya pesannya spesifik.
  if (v.patternMismatch) return el.title || "Format isian tidak sesuai."
  return "Isian tidak valid."
}

/**
 * Handler siap-pasang supaya tooltip validasi sebuah input berbahasa Indonesia.
 * Spread ke elemennya: `<input required {...localizedValidation} />`.
 *
 * `onInvalid` mengganti teksnya; `onInput` mengosongkannya lagi supaya elemen
 * bisa divalidasi ulang setelah diperbaiki — tanpa ini pesan custom "menempel"
 * dan field dianggap tak valid selamanya.
 */
export const localizedValidation = {
  onInvalid: (e: FormEvent<ValidatableElement>) => {
    e.currentTarget.setCustomValidity(localizedValidityMessage(e.currentTarget))
  },
  onInput: (e: FormEvent<ValidatableElement>) => {
    e.currentTarget.setCustomValidity("")
  },
}
