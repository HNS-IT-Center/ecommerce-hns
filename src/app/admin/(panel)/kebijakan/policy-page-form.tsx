"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import { TriangleAlert } from "lucide-react"

import { createPolicyPageAction, updatePolicyPage } from "./actions"
import { EMPTY_POLICY_STATE } from "./state"
import { UnsavedChangesGuard } from "@/components/admin/unsaved-changes-guard"
import { RichTextEditor } from "@/components/admin/rich-text-editor"
import { slugify } from "@/lib/utils/slug"

type PolicyPageFormProps = {
  /** Kosong berarti kebijakan baru. */
  page?: {
    slug: string
    title: string
    description: string
    content: string
    sortOrder: number
  }
}

const inputClass =
  "w-full rounded-xl border border-input bg-muted/50 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:bg-background"
const labelClass = "mb-1 block text-sm font-semibold text-foreground"

export function PolicyPageForm({ page }: PolicyPageFormProps) {
  const isEdit = Boolean(page)
  const [state, action, pending] = useActionState(
    isEdit ? updatePolicyPage : createPolicyPageAction,
    EMPTY_POLICY_STATE,
  )

  const [html, setHtml] = useState(page?.content ?? "")
  const [title, setTitle] = useState(page?.title ?? "")
  const [slug, setSlug] = useState(page?.slug ?? "")
  const [slugDisentuh, setSlugDisentuh] = useState(false)

  const galat = useRef<HTMLParagraphElement>(null)

  // Gulirkan ke pesan galat saat simpan ditolak — alasannya sama seperti pada
  // formulir toko: tombol Simpan bisa jauh dari puncak formulir, dan staff yang
  // tidak melihat apa pun berubah menyimpulkan datanya tersimpan.
  useEffect(() => {
    if (!state.error || !galat.current) return
    galat.current.scrollIntoView({ behavior: "smooth", block: "center" })
    galat.current.focus()
  }, [state.error])

  /*
   * Slug mengikuti judul selama staff belum menyentuhnya sendiri.
   *
   * Hanya saat membuat baru. Pada penyuntingan, slug adalah alamat yang sudah
   * beredar — ia ditampilkan tapi tidak bisa diubah, karena mengubahnya
   * mematikan setiap tautan ke halaman itu tanpa ada yang memberi tahu.
   */
  const slugPratinjau = isEdit ? page!.slug : slugify(slugDisentuh ? slug : title)

  return (
    <UnsavedChangesGuard>
      <form action={action} className="max-w-4xl space-y-5">
        {state.error && (
          <p
            ref={galat}
            tabIndex={-1}
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive outline-none"
          >
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {state.error}
          </p>
        )}

        <div>
          <label className={labelClass} htmlFor="title">
            Judul
          </label>
          <input
            id="title"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Kebijakan Garansi"
            className={`${inputClass} max-w-xl`}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="slug">
            Alamat Halaman
          </label>
          {isEdit ? (
            <>
              {/*
                Ditampilkan sebagai teks, bukan medan terkunci: medan yang tampak
                seperti isian tapi menolak diketik membuat orang mengira ada yang
                rusak. Nilainya tetap ikut terkirim lewat medan tersembunyi.
              */}
              <p className="text-sm text-muted-foreground">
                <code className="rounded bg-muted px-1.5 py-0.5">/kebijakan/{page!.slug}</code>{" "}
                <span className="text-xs">
                  — tidak bisa diubah. Alamat ini sudah beredar di tautan dan mesin pencari.
                </span>
              </p>
              <input type="hidden" name="slug" value={page!.slug} />
            </>
          ) : (
            <>
              <input
                id="slug"
                name="slug"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value)
                  setSlugDisentuh(true)
                }}
                placeholder="kebijakan-garansi"
                className={`${inputClass} max-w-xl`}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Kosongkan untuk mengikuti judul. Alamatnya nanti:{" "}
                <code className="rounded bg-muted px-1.5 py-0.5">
                  /kebijakan/{slugPratinjau || "…"}
                </code>{" "}
                — <strong>tidak bisa diubah lagi setelah disimpan.</strong>
              </p>
            </>
          )}
        </div>

        <div>
          <label className={labelClass} htmlFor="description">
            Ringkasan
          </label>
          <input
            id="description"
            name="description"
            defaultValue={page?.description ?? ""}
            maxLength={255}
            placeholder="Satu kalimat tentang isi kebijakan ini."
            className={`${inputClass} max-w-xl`}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Tampil di kartu halaman /kebijakan dan sebagai deskripsi di hasil pencarian Google.
            Maksimal 255 karakter.
          </p>
        </div>

        <div>
          <label className={labelClass} htmlFor="sortOrder">
            Urutan
          </label>
          <input
            id="sortOrder"
            name="sortOrder"
            type="number"
            defaultValue={page?.sortOrder ?? 0}
            className={`${inputClass} max-w-[8rem]`}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Angka kecil tampil lebih dulu di halaman /kebijakan.
          </p>
        </div>

        <div>
          <span className={labelClass}>Isi Halaman</span>
          {/*
            Editor teks kaya, bukan textarea HTML mentah. Staf yang memperbarui
            kebijakan tidak perlu tahu `<h2>` atau `<ul>` — dan kebijakan yang
            sulit diperbarui adalah kebijakan yang dibiarkan usang, seperti
            "seluruh Indonesia" dan biaya restocking yang sempat bertahan di
            situs setelah aturannya berubah.

            Tingginya dinaikkan dari bawaan: halaman kebijakan punya belasan
            judul dan daftar, jauh lebih panjang daripada spesifikasi produk.
          */}
          <RichTextEditor
            value={html}
            onChange={setHtml}
            placeholder="Tulis isi kebijakan di sini…"
            heightClass="min-h-[28rem] max-h-[40rem]"
            emptyPreviewHtml="<p>Belum ada isi.</p>"
          />
          {/*
            Tiptap bukan elemen form, jadi isinya tidak ikut terkirim sendiri.
            Penjaga isi kosong ada di lapisan data, bukan `required` di sini:
            `required` pada input tersembunyi diabaikan peramban.
          */}
          <input type="hidden" name="content" value={html} />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? "Menyimpan…" : isEdit ? "Simpan Perubahan" : "Simpan Kebijakan"}
        </button>
      </form>
    </UnsavedChangesGuard>
  )
}
