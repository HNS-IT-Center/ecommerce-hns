import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { env } from "@/config/env"
import { UnauthorizedError } from "@/lib/auth"

export class R2UploadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "R2UploadError"
  }
}

// S3 Client configured for Cloudflare R2
const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
})

/**
 * Upload a file directly to Cloudflare R2 bucket.
 * 
 * Returns an object compatible with the frontend's image structure.
 * Because R2 does not have an integer ID like WordPress Media Library,
 * we generate a synthetic ID using Date.now().
 */
export async function uploadMedia(file: File): Promise<{ id: number; source_url: string; alt: string }> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // Create a unique filename
    const timestamp = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "").toLowerCase()
    const key = `products/${timestamp}-${safeName}`
    
    const command = new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: file.type,
      // Public cache control if needed
      CacheControl: "public, max-age=31536000",
    })

    await s3Client.send(command)

    // Ensure the public URL does not have a trailing slash, and the key does not have a leading slash
    const publicBase = env.NEXT_PUBLIC_R2_PUBLIC_URL.replace(/\/$/, "")
    const source_url = `${publicBase}/${key}`
    
    return {
      id: timestamp, // Synthetic ID for React keys and local state management
      source_url,
      alt: file.name,
    }
  } catch (error) {
    console.error("R2 Upload Error:", error)
    if (error instanceof Error) {
      throw new R2UploadError(`Gagal upload ke R2: ${error.message}`)
    }
    throw new R2UploadError("Gagal upload ke R2 karena error yang tidak diketahui.")
  }
}
