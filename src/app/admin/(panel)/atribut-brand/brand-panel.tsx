"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { ImageIcon, Loader2, Pencil, Plus, Trash2, Upload, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useToastManager } from "@/components/ui/toast"
import { compressImage } from "@/lib/utils/image-compression"
import { slugify } from "@/lib/utils/slug"
import { IMAGE_ACCEPT_ATTRIBUTE } from "@/lib/validators/media-upload"
// Hanya TIPE yang diimpor dari lapisan data — `import type` dihapus saat
// kompilasi, jadi Prisma tidak ikut masuk ke bundel browser.
import type { BrandRow } from "@/lib/api/taxonomy"

import { createBrand, deleteBrand, updateBrand, type ActionResult } from "./actions"

/** Formulir yang sedang terbuka: brand baru, atau brand yang sedang disunting. */
type FormState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; brand: BrandRow }

export function BrandPanel({ brands }: { brands: BrandRow[] }) {
  const router = useRouter()
  const toastManager = useToastManager()

  const [form, setForm] = React.useState<FormState>({ mode: "closed" })
  const [pendingDelete, setPendingDelete] = React.useState<BrandRow | null>(null)
  const [busy, setBusy] = React.useState(false)

  async function run(action: () => Promise<ActionResult>, onSuccess?: () => void) {
    setBusy(true)
    try {
      const result = await action()
      if (!result.success) {
        toastManager.add({ title: "Gagal", description: result.error })
        return false
      }
      onSuccess?.()
      router.refresh()
      return true
    } catch {
      toastManager.add({
        title: "Gagal",
        description: "Terjadi kesalahan tak terduga. Coba lagi.",
      })
      return false
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    const ok = await run(() => deleteBrand(pendingDelete.id))
    if (ok) setPendingDelete(null)
  }

  return (
    <div className="space-y-4">
      {form.mode === "closed" ? (
        <Button onClick={() => setForm({ mode: "create" })} disabled={busy} className="gap-2">
          <Plus className="h-4 w-4" />
          Tambah Brand
        </Button>
      ) : (
        <BrandForm
          key={form.mode === "edit" ? form.brand.id : "create"}
          brand={form.mode === "edit" ? form.brand : null}
          busy={busy}
          onCancel={() => setForm({ mode: "closed" })}
          onSubmit={async (values) => {
            const action =
              form.mode === "edit"
                ? () => updateBrand(form.brand.id, values)
                : () => createBrand(values)
            await run(action, () => setForm({ mode: "closed" }))
          }}
        />
      )}

      {brands.length === 0 && (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          Belum ada brand. Tambahkan yang pertama lewat tombol di atas.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {brands.map((brand) => (
          <div
            key={brand.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
          >
            <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-muted/40">
              {brand.logoUrl ? (
                <Image
                  src={brand.logoUrl}
                  alt=""
                  width={48}
                  height={48}
                  className="h-full w-full object-contain"
                />
              ) : (
                <ImageIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{brand.name}</p>
              <p className="truncate text-xs text-muted-foreground">/{brand.slug}</p>
              <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                {brand.productCount} produk
              </p>
            </div>

            <div className="flex shrink-0 flex-col gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setForm({ mode: "edit", brand })}
                disabled={busy}
                aria-label={`Ubah brand ${brand.name}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPendingDelete(brand)}
                disabled={busy}
                aria-label={`Hapus brand ${brand.name}`}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        destructive
        confirmLabel="Hapus"
        title={`Hapus brand "${pendingDelete?.name}"?`}
        description={
          pendingDelete && pendingDelete.productCount > 0
            ? `${pendingDelete.productCount} produk memakai brand ini dan akan menjadi tanpa brand — produknya sendiri TIDAK ikut terhapus. Tindakan ini tidak bisa dibatalkan.`
            : "Tindakan ini tidak bisa dibatalkan."
        }
        onConfirm={confirmDelete}
      />
    </div>
  )
}

type BrandFormValues = { name: string; slug: string; logoUrl: string | null }

function BrandForm({
  brand,
  busy,
  onCancel,
  onSubmit,
}: {
  brand: BrandRow | null
  busy: boolean
  onCancel: () => void
  onSubmit: (values: BrandFormValues) => void | Promise<void>
}) {
  const toastManager = useToastManager()

  const [name, setName] = React.useState(brand?.name ?? "")
  const [slug, setSlug] = React.useState(brand?.slug ?? "")
  const [logoUrl, setLogoUrl] = React.useState<string | null>(brand?.logoUrl ?? null)
  const [uploading, setUploading] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  /**
   * Logo diunggah SEGERA saat dipilih, tidak ditahan sampai formulir disimpan.
   *
   * Beda dengan gambar produk (`image-uploader.tsx`) yang bisa berjumlah banyak
   * dan sering dibatalkan: di sini hanya satu berkas per brand, dan mengunggah
   * lebih awal membuat pratinjaunya memakai URL R2 yang sebenarnya — sehingga
   * yang dilihat admin sebelum menyimpan sama persis dengan yang tersimpan.
   */
  async function handleFile(file: File) {
    setUploading(true)
    try {
      const compressed = await compressImage(file)

      const formData = new FormData()
      formData.append("file", compressed.file)

      const response = await fetch("/api/admin/media", { method: "POST", body: formData })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Upload logo gagal")

      setLogoUrl(data.source_url as string)
    } catch (error) {
      toastManager.add({
        title: "Upload gagal",
        description: error instanceof Error ? error.message : "Coba lagi.",
      })
    } finally {
      setUploading(false)
      // Direset supaya memilih berkas yang SAMA setelah gagal tetap memicu
      // `onChange` — tanpa ini percobaan kedua terlihat seperti tidak bereaksi.
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (!name.trim()) return
        void onSubmit({ name: name.trim(), slug: slug.trim(), logoUrl })
      }}
      className="space-y-4 rounded-xl border border-border bg-card p-4"
    >
      <p className="font-semibold">{brand ? `Ubah brand: ${brand.name}` : "Brand baru"}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="brand-name">Nama</Label>
          <Input
            id="brand-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="mis. ASUS"
            maxLength={191}
            autoFocus
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="brand-slug">Slug</Label>
          <Input
            id="brand-slug"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder={name ? slugify(name) : "dibuat otomatis dari nama"}
            maxLength={191}
          />
          <p className="text-xs text-muted-foreground">
            Kosongkan untuk dibuat otomatis dari nama.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Logo Brand</Label>
        <div className="flex items-center gap-3">
          <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-muted/40">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt=""
                width={64}
                height={64}
                className="h-full w-full object-contain"
              />
            ) : (
              <ImageIcon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={IMAGE_ACCEPT_ATTRIBUTE}
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void handleFile(file)
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy || uploading}
              className="gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Mengunggah…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  {logoUrl ? "Ganti Logo" : "Unggah Logo"}
                </>
              )}
            </Button>

            {logoUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setLogoUrl(null)}
                disabled={busy || uploading}
                className="gap-1 text-muted-foreground"
              >
                <X className="h-4 w-4" />
                Hapus Logo
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={busy || uploading || !name.trim()}>
          {brand ? "Simpan Perubahan" : "Tambah Brand"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Batal
        </Button>
      </div>
    </form>
  )
}
