import { NextRequest, NextResponse } from "next/server"
import { uploadMedia, WordPressAuthNotConfiguredError } from "@/lib/api/wordpress/media"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File tidak ditemukan" }, { status: 400 })
    }

    const media = await uploadMedia(file)
    return NextResponse.json(media)
  } catch (error) {
    if (error instanceof WordPressAuthNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Failed to upload media:", error)
    return NextResponse.json({ error: "Gagal upload gambar" }, { status: 500 })
  }
}
