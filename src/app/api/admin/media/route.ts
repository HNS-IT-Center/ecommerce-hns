import { NextRequest, NextResponse } from "next/server"
import { uploadMedia, WordPressAuthNotConfiguredError } from "@/lib/api/wordpress/media"
import { UnauthorizedError, requireAuth } from "@/lib/auth"

/**
 * Endpoint ini berada di /api, di luar jangkauan proxy yang menjaga /admin —
 * dan ia mengunggah berkas ke pustaka media WordPress dengan kredensial milik
 * sistem. Tanpa pemeriksaan di sini, siapa pun yang tahu alamatnya bisa
 * menitipkan berkas ke server orang lain memakai nama kita.
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
    if (error instanceof WordPressAuthNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Failed to upload media:", error)
    return NextResponse.json({ error: "Gagal upload gambar" }, { status: 500 })
  }
}
