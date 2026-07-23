"use client"

import { useState } from "react"
import { updatePolicyPage } from "../actions"

type PolicyPageFormProps = {
  slug: string
  title: string
  content: string
}

export function PolicyPageForm({ slug, title, content }: PolicyPageFormProps) {
  const [previewHtml, setPreviewHtml] = useState(content)

  return (
    <form action={updatePolicyPage} className="grid gap-6 lg:grid-cols-2">
      <input type="hidden" name="slug" value={slug} />

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-semibold" htmlFor="title">
            Judul
          </label>
          <input
            id="title"
            name="title"
            defaultValue={title}
            required
            className="w-full rounded-xl border border-input bg-muted/50 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:bg-background"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold" htmlFor="content">
            Konten (HTML)
          </label>
          <textarea
            id="content"
            name="content"
            defaultValue={content}
            required
            rows={20}
            onChange={(e) => setPreviewHtml(e.target.value)}
            className="w-full rounded-xl border border-input bg-muted/50 px-3 py-2 font-mono text-xs outline-none transition-colors focus:border-primary focus:bg-background"
          />
        </div>

        <button
          type="submit"
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Simpan Perubahan
        </button>
      </div>

      <div>
        <p className="mb-1 text-sm font-semibold">Preview</p>
        <div className="prose prose-sm max-w-none rounded-xl border border-border bg-background p-4">
          <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </div>
      </div>
    </form>
  )
}
