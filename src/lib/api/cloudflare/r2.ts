import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { env } from "@/config/env"

// Pembeda unggahan yang jatuh pada milidetik yang sama — lihat catatan di
// `uploadMedia`.
let uploadCounter = 0

export class R2UploadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "R2UploadError"
  }
}

type R2Config = {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  publicUrl: string
}

/**
 * Reads the R2 credentials, failing loudly only when an upload is actually
 * attempted.
 *
 * The credentials are optional in `config/env.ts` on purpose: that schema is
 * parsed at module load, so marking them required takes down the whole app —
 * storefront included — on any machine that has not been given an R2 bucket.
 * Missing credentials should break uploading, not browsing.
 */
function readConfig(): R2Config {
  const missing = (
    [
      "R2_ACCOUNT_ID",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
      "R2_BUCKET_NAME",
      "NEXT_PUBLIC_R2_PUBLIC_URL",
    ] as const
  ).filter((key) => !env[key])

  if (missing.length > 0) {
    throw new R2UploadError(
      `Upload ke R2 belum dikonfigurasi. Lengkapi variabel berikut di .env: ${missing.join(", ")}.`
    )
  }

  return {
    accountId: env.R2_ACCOUNT_ID!,
    accessKeyId: env.R2_ACCESS_KEY_ID!,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    bucket: env.R2_BUCKET_NAME!,
    publicUrl: env.NEXT_PUBLIC_R2_PUBLIC_URL!,
  }
}

// S3 Client configured for Cloudflare R2, built on first use so that an
// unconfigured deployment does not crash while merely importing this module.
let s3Client: S3Client | null = null

function getClient(config: R2Config): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    })
  }
  return s3Client
}

/**
 * Upload a file directly to Cloudflare R2 bucket.
 * 
 * Returns an object compatible with the frontend's image structure.
 * Because R2 does not have an integer ID like WordPress Media Library,
 * we generate a synthetic ID using Date.now().
 */
export async function uploadMedia(file: File): Promise<{ id: number; source_url: string; alt: string }> {
  // Outside the try on purpose: a configuration problem should surface as
  // itself, not disguised as an upload failure.
  const config = readConfig()

  try {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Date.now() saja TIDAK cukup unik: mengunggah beberapa gambar sekaligus
    // (Promise.all dari form admin) menyelesaikan beberapa berkas dalam
    // milidetik yang sama, sehingga dua unggahan mendapat id — dan nama berkas —
    // yang identik. Akibatnya berkas pertama tertimpa di R2 dan React melihat
    // dua elemen dengan key yang sama, yang membuat kartu gambar saling
    // menumpuk di pengurut. Penghitung dalam proses menutup celah itu.
    const timestamp = Date.now()
    const uniqueId = timestamp * 1000 + (uploadCounter++ % 1000)
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "").toLowerCase()
    const key = `products/${uniqueId}-${safeName}`
    
    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: buffer,
      ContentType: file.type,
      // Public cache control if needed
      CacheControl: "public, max-age=31536000",
    })

    await getClient(config).send(command)

    // Ensure the public URL does not have a trailing slash, and the key does not have a leading slash
    const publicBase = config.publicUrl.replace(/\/$/, "")
    const source_url = `${publicBase}/${key}`
    
    return {
      id: uniqueId, // Synthetic ID for React keys and local state management
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
