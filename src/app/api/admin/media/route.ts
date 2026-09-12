import { NextRequest, NextResponse } from "next/server"
import { uploadMedia, R2UploadError } from "@/lib/api/cloudflare/r2"
import { UnauthorizedError, requireAuth } from "@/lib/auth"
import { UploadRejectedError } from "@/lib/validators/media-upload"

/**
 * Endpoint ini berada di /api, di luar jangkauan proxy yang menjaga /admin —
 * dan ia mengunggah berkas ke bucket Cloudflare R2 dengan kredensial milik
 * sistem. Tanpa pemeriksaan di sini, siapa pun yang tahu alamatnya bisa
 * menitipkan berkas ke penyimpanan kita memakai nama kita.
 *
 * Isi berkasnya diperiksa satu lapis lebih dalam, di `uploadMedia()` — lihat
 * `lib/validators/media-upload.ts`. Jenis berkas yang diterima ditentukan dari
 * isi berkas, bukan dari nama atau `type` yang dikirim klien.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth()
    const formData = await request.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File tidak ditemukan" }, { status: 400 })
    }

    const media = await uploadMedia(file)
    return NextResponse.json(media)
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    // Berkas yang ditolak bukan kegagalan server: pesannya memang ditujukan ke
    // staff yang mengunggah, dan isinya hanya soal berkas mereka sendiri.
    if (error instanceof UploadRejectedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error instanceof R2UploadError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Failed to upload media:", error)
    return NextResponse.json({ error: "Gagal upload gambar" }, { status: 500 })
  }
}
