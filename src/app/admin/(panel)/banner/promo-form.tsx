"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CalendarClock, ExternalLink, FileText, Images, Loader2, Package, Trash2 } from "lucide-react"

// Hanya TIPE — lihat catatan di `banner-list.tsx`.
import type { PromoForEdit, PromoPickerProduct } from "@/lib/api/promos"
import { toDateInputValue } from "@/lib/utils/banner"
import { promoHref, slugifyPromo } from "@/lib/utils/promo"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useToastManager } from "@/components/ui/toast"
import { createPromo, deletePromo, updatePromo, type PromoValues } from "./promo-actions"
import { PromoProductPicker } from "./promo-product-picker"

const FIELD_TEXT = "text-xs md:text-xs"
const TEXTAREA_CLASS =
  "w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

function SectionHeading({ icon: Icon, title, accent }: { icon: React.ElementType; title: string; accent: string }) {
  return (
    <CardTitle className="flex items-center gap-2 text-[15px]">
      <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", accent)}>
        <Icon className="h-4 w-4" />
      </span>
      {title}
    </CardTitle>
  )
}

const BACK_HREF = "/admin/banner?tab=promo"

export function PromoForm({ promo }: { promo?: PromoForEdit }) {
  const router = useRouter()
  const toastManager = useToastManager()
  const isEdit = Boolean(promo)

  const [title, setTitle] = React.useState(promo?.title ?? "")
  const [slug, setSlug] = React.useState(promo?.slug ?? "")
  /**
   * Slug mengikuti judul HANYA selama staff belum menyentuhnya sendiri, dan
   * tidak pernah untuk promo yang sudah ada — mengganti alamat halaman yang
   * sudah dibagikan memutus tautan yang beredar.
   */
  const [slugTouched, setSlugTouched] = React.useState(isEdit)
  const [description, setDescription] = React.useState(promo?.description ?? "")
  const [terms, setTerms] = React.useState(promo?.terms ?? "")
  const [startsAt, setStartsAt] = React.useState(toDateInputValue(promo?.startsAt))
  const [endsAt, setEndsAt] = React.useState(toDateInputValue(promo?.endsAt))
  const [isActive, setIsActive] = React.useState(promo?.isActive ?? true)
  const [products, setProducts] = React.useState<PromoPickerProduct[]>(promo?.products ?? [])

  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = React.useState(false)

  function handleTitleChange(next: string) {
    setTitle(next)
    if (!slugTouched) setSlug(slugifyPromo(next))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)

    const values: PromoValues = {
      title,
      slug,
      description,
      terms,
      isActive,
      startsAt,
      endsAt,
      productIds: products.map((p) => p.id),
    }

    try {
      const result = promo
        ? await updatePromo(promo.id, promo.slug, values)
        : await createPromo(values)
      if (!result.success) {
        setError(result.error)
        return
      }
      toastManager.add({ title: isEdit ? "Promo disimpan" : "Promo dibuat" })
      router.push(BACK_HREF)
      router.refresh()
    } catch {
      setError("Terjadi kesalahan tak terduga. Coba lagi.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!promo) return
    const result = await deletePromo(promo.id, promo.slug)
    if (!result.success) {
      toastManager.add({ title: "Gagal", description: result.error })
      return
    }
    router.push(BACK_HREF)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="sticky top-0 z-30 -mx-1 flex items-center justify-between gap-3 rounded-xl border border-border bg-background/85 px-3 py-2.5 backdrop-blur-md">
        <p className="min-w-0 truncate text-xs text-muted-foreground">
          {isEdit ? "Menyunting promo" : "Promo baru"}
          {slug && <span className="ml-1 font-mono">{promoHref(slug)}</span>}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {promo && (
            <Button
              variant="outline"
              size="sm"
              render={<Link href={promoHref(promo.slug)} target="_blank" />}
              nativeButton={false}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Lihat
            </Button>
          )}
          <Button type="submit" disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "Simpan Perubahan" : "Buat Promo"}
          </Button>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <SectionHeading icon={Package} title="Produk dalam Promo" accent="bg-sale-red/10 text-sale-red" />
            </CardHeader>
            <CardContent>
              <PromoProductPicker value={products} onChange={setProducts} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <SectionHeading icon={FileText} title="Isi Halaman" accent="bg-primary/10 text-primary" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="promo-title" className="mb-1.5">Judul</Label>
                <Input
                  id="promo-title"
                  required
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="mis. September Laptop Sale"
                  className={FIELD_TEXT}
                />
              </div>
              <div>
                <Label htmlFor="promo-slug" className="mb-1.5">Alamat halaman</Label>
                <div className="flex items-center rounded-lg border border-input pl-2.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                  <span className="text-xs text-muted-foreground">/promo/</span>
                  <input
                    id="promo-slug"
                    required
                    value={slug}
                    onChange={(e) => {
                      setSlugTouched(true)
                      setSlug(e.target.value.toLowerCase())
                    }}
                    className="h-8 min-w-0 flex-1 bg-transparent pr-2.5 font-mono text-xs outline-none"
                  />
                </div>
                {isEdit && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Mengganti alamat membuat tautan lama yang sudah dibagikan tidak bisa dibuka.
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="promo-description" className="mb-1.5">Deskripsi singkat (opsional)</Label>
                <textarea
                  id="promo-description"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="mis. Potongan harga untuk laptop gaming & kerja, plus komponen pilihan."
                  className={TEXTAREA_CLASS}
                />
              </div>
              <div>
                <Label htmlFor="promo-terms" className="mb-1.5">Syarat & ketentuan (opsional)</Label>
                <textarea
                  id="promo-terms"
                  rows={4}
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  placeholder={"Satu butir per baris, mis.\nSelama persediaan masih ada.\nTidak dapat digabung dengan promo lain."}
                  className={TEXTAREA_CLASS}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <SectionHeading icon={CalendarClock} title="Jadwal & Status" accent="bg-warning/10 text-warning" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="promo-starts" className="mb-1.5">Mulai</Label>
                  <Input id="promo-starts" type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={FIELD_TEXT} />
                </div>
                <div>
                  <Label htmlFor="promo-ends" className="mb-1.5">Berakhir</Label>
                  <Input id="promo-ends" type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={FIELD_TEXT} />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Menentukan hitung mundur dan status halaman (belum mulai / berlangsung / berakhir),
                mulai pukul 00:00 sampai 23:59. Jadwal ini <strong>tidak mengubah harga</strong> —
                harga obral tetap diatur per produk di halaman produk.
              </p>
              <div className="flex items-center gap-2">
                <Switch checked={isActive} onCheckedChange={setIsActive} aria-label="Aktif" />
                <span className="text-xs text-muted-foreground">
                  Aktif. Matikan untuk menyembunyikan halaman (404) tanpa menghapus.
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <SectionHeading icon={Images} title="Banner" accent="bg-violet-500/10 text-violet-500" />
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {promo && promo.banners.length > 0 ? (
                <ul className="space-y-1">
                  {promo.banners.map((banner) => (
                    <li key={banner.id}>
                      <Link href={`/admin/banner/${banner.id}`} className="text-primary hover:underline">
                        {banner.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">Belum ada banner yang menaut promo ini.</p>
              )}
              <p className="text-[11px] text-muted-foreground">
                Pilih promo ini di bagian <strong>Halaman Promo</strong> pada formulir banner. Gambar
                banner pertama dipakai sebagai header halaman.
              </p>
            </CardContent>
          </Card>

          {promo && (
            <Button type="button" variant="destructive" className="w-full" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4" />
              Hapus Promo
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        destructive
        confirmLabel="Hapus"
        title={`Hapus promo "${promo?.title}"?`}
        description={
          <>
            Halaman <span className="font-mono">{promo ? promoHref(promo.slug) : ""}</span> langsung tidak bisa
            dibuka. Banner yang menautnya <strong>tidak ikut terhapus</strong> — ia kembali memakai link
            tombolnya sendiri.
          </>
        }
        onConfirm={handleDelete}
      />
    </form>
  )
}
