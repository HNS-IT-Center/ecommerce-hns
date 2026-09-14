"use client"

import { useState } from "react"
import { updatePolicyPage } from "../actions"
import { UnsavedChangesGuard } from "@/components/admin/unsaved-changes-guard"
import { RichTextEditor } from "@/components/admin/rich-text-editor"

type PolicyPageFormProps = {
  slug: string
  title: string
  content: string
}

export function PolicyPageForm({ slug, title, content }: PolicyPageFormProps) {
  const [html, setHtml] = useState(content)

  return (
    <UnsavedChangesGuard>
      <form action={updatePolicyPage} className="space-y-4">
        <input type="hidden" name="slug" value={slug} />

        <div>
          <label className="mb-1 block text-sm font-semibold" htmlFor="title">
            Judul
          </label>
          <input
            id="title"
            name="title"
            defaultValue={title}
            required
            className="w-full max-w-xl rounded-xl border border-input bg-muted/50 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:bg-background"
          />
        </div>

        <div>
          <span className="mb-1 block text-sm font-semibold">Isi Halaman</span>
          {/*
            Editor teks kaya, bukan lagi textarea HTML mentah. Staf yang
            memperbarui kebijakan tidak perlu tahu `<h2>` atau `<ul>` — dan
            kebijakan yang sulit diperbarui adalah kebijakan yang dibiarkan
            usang, seperti "seluruh Indonesia" dan biaya restocking yang
            sempat bertahan di situs setelah aturannya berubah.

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
            `updatePolicyPage` membaca `formData.get("content")` — sama seperti
            sebelum editor ini dipasang, jadi server action tidak berubah
            sama sekali.
          */}
          <input type="hidden" name="content" value={html} />
        </div>

        <button
          type="submit"
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Simpan Perubahan
        </button>
      </form>
    </UnsavedChangesGuard>
  )
}
