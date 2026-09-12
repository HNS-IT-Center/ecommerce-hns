"use client"

import * as React from "react"
import { Loader2, Play, Upload, X, Link2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { VIDEO_ACCEPT_ATTRIBUTE } from "@/lib/validators/media-upload"

type VideoUploaderProps = {
  value: string
  onChange: (url: string) => void
}

export function VideoUploader({ value, onChange }: VideoUploaderProps) {
  const [uploading, setUploading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [linkDraft, setLinkDraft] = React.useState(value)

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/admin/media", { method: "POST", body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Upload video gagal")
      onChange(data.source_url as string)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload video gagal")
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-input bg-muted/20 p-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Play className="h-5 w-5 fill-current" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground">Video terpasang</p>
          <p className="truncate text-xs text-muted-foreground" title={value}>
            {value}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            onChange("")
            setLinkDraft("")
          }}
          className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label="Hapus video"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-input bg-background p-3">
      <Tabs defaultValue="upload">
        <TabsList className="mb-3">
          <TabsTrigger value="upload">Upload File</TabsTrigger>
          <TabsTrigger value="link">Tempel Link</TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <label
            className={cn(
              "flex h-20 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-input text-muted-foreground transition-colors hover:border-primary hover:text-primary",
              uploading && "pointer-events-none opacity-60"
            )}
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Upload className="h-4 w-4" />
                <span className="text-xs font-medium">Pilih file video (mp4, mov, dll)</span>
              </>
            )}
            <input
              type="file"
              accept={VIDEO_ACCEPT_ATTRIBUTE}
              className="hidden"
              onChange={handleFileSelected}
              disabled={uploading}
            />
          </label>
        </TabsContent>

        <TabsContent value="link">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Link2 className="pointer-events-none absolute inset-y-0 start-2.5 flex h-full w-3.5 items-center text-muted-foreground" />
              <Input
                value={linkDraft}
                onChange={(e) => setLinkDraft(e.target.value)}
                placeholder="https://youtube.com/watch?v=…"
                style={{ paddingInlineStart: "1.75rem" }}
              />
            </div>
            <button
              type="button"
              onClick={() => onChange(linkDraft.trim())}
              disabled={!linkDraft.trim()}
              className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              Pasang
            </button>
          </div>
        </TabsContent>
      </Tabs>

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  )
}
