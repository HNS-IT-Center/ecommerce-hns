"use client";

import { useEffect, useRef, useState } from "react";
import { ImageIcon, Loader2, Upload, X } from "lucide-react";

import { compressImage } from "@/lib/utils/image-compression";
import { IMAGE_ACCEPT_ATTRIBUTE } from "@/lib/validators/media-upload";

/**
 * Foto depan toko: unggah ke R2, simpan URL-nya di input tersembunyi `imageUrl`.
 *
 * Pratinjaunya memakai rasio dan `object-center` yang sama dengan kartu di
 * `/stores`, supaya staff melihat potongan yang benar-benar akan tampil —
 * bukan foto utuh yang kemudian terpotong tanpa mereka ketahui.
 */
export function StorePhotoField({ initial }: { initial: string | null }) {
  const [imageUrl, setImageUrl] = useState(initial ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hidden = useRef<HTMLInputElement>(null);
  const terpasang = useRef(false);

  /**
   * Beri tahu `UnsavedChangesGuard` bahwa isi formulir berubah.
   *
   * Pembungkus itu hanya memeriksa ulang saat ada event `input`/`change`, dan
   * nilai input tersembunyi yang diubah React tidak memicu keduanya. Tanpa ini,
   * staff yang mengganti foto lalu menekan Batal tidak mendapat peringatan apa
   * pun — foto barunya hilang diam-diam.
   *
   * Dilewati saat pemasangan: nilai awal bukan perubahan.
   */
  useEffect(() => {
    if (!terpasang.current) {
      terpasang.current = true;
      return;
    }
    hidden.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }, [imageUrl]);

  async function handleSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      // Dikompres di browser dulu: foto kamera HP bisa beberapa MB, dan foto
      // ini dimuat setiap pengunjung halaman lokasi.
      const { file: compressed } = await compressImage(file);
      const formData = new FormData();
      formData.append("file", compressed);
      const res = await fetch("/api/admin/media", {
        method: "POST",
        body: formData,
      });
      const data: unknown = await res.json();
      const body = data as { source_url?: unknown; error?: unknown };
      if (!res.ok || typeof body.source_url !== "string") {
        throw new Error(
          typeof body.error === "string" ? body.error : "Upload foto gagal",
        );
      }
      setImageUrl(body.source_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload foto gagal");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div>
      <span className="mb-1 block text-sm font-semibold text-foreground">
        Foto Toko
      </span>
      <input ref={hidden} type="hidden" name="imageUrl" value={imageUrl} />

      {imageUrl ? (
        <div className="relative aspect-2/1 overflow-hidden rounded-xl border border-input">
          {/* eslint-disable-next-line @next/next/no-img-element -- pratinjau admin; URL R2 baru hasil unggah */}
          <img
            src={imageUrl}
            alt="Pratinjau foto toko"
            className="h-full w-full object-cover object-center"
          />
          <button
            type="button"
            onClick={() => setImageUrl("")}
            className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
            aria-label="Hapus foto toko"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        /* Input berkas SENGAJA tanpa `name`: ia tidak ikut dikirim ke server
           action, dan tidak ikut dihitung `UnsavedChangesGuard` sebagai berkas. */
        <label className="flex aspect-2/1 w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-input text-muted-foreground transition-colors hover:border-primary hover:text-primary">
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <span className="flex items-center gap-1.5">
                <ImageIcon className="h-4 w-4" />
                <Upload className="h-4 w-4" />
              </span>
              <span className="text-xs font-medium">Unggah foto depan toko</span>
            </>
          )}
          <input
            type="file"
            accept={IMAGE_ACCEPT_ATTRIBUTE}
            className="sr-only"
            onChange={handleSelected}
            disabled={uploading}
          />
        </label>
      )}

      {error && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
      <p className="mt-1 text-xs text-muted-foreground">
        Opsional. Tampil di popup peta dan kartu cabang di halaman Lokasi Toko.
        Foto dipotong dari tengah — letakkan pintu masuk dan papan nama di bagian
        tengah foto.
      </p>
    </div>
  );
}
