import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { env } from "@/config/env"
import {
  assertUploadSizeAllowed,
  buildSafeObjectName,
  validateUpload,
} from "@/lib/validators/media-upload"

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
 *
 * Pemeriksaan berkas dilakukan DI SINI, bukan di route yang memanggilnya.
 * Endpoint `/api/admin/media` bukan satu-satunya jalan masuk selamanya, dan
 * penjaga yang harus diingat setiap pemanggil baru adalah penjaga yang cepat
 * atau lambat terlewat — persis alasan `requireOwner` menolak dijadikan
 * pemeriksaan terpusat di `lib/auth/index.ts`. Menaruhnya di sini membuat
 * jalur unggah yang lolos tanpa pemeriksaan tidak ada.
 */
export async function uploadMedia(file: File): Promise<{ id: number; source_url: string; alt: string }> {
  // Outside the try on purpose: a configuration problem should surface as
  // itself, not disguised as an upload failure.
  const config = readConfig()

  // Sengaja di luar `try` dengan alasan yang sama: berkas yang ditolak adalah
  // jawaban yang benar, bukan kegagalan sistem yang perlu disamarkan jadi
  // "gagal upload ke R2". Ukurannya diperiksa lewat `file.size` DULU, sebelum
  // `arrayBuffer()` menarik seluruh isinya ke memori.
  assertUploadSizeAllowed(file.size)
  const buffer = Buffer.from(await file.arrayBuffer())
  const media = validateUpload(buffer)

  try {
    // Date.now() saja TIDAK cukup unik: mengunggah beberapa gambar sekaligus
    // (Promise.all dari form admin) menyelesaikan beberapa berkas dalam
    // milidetik yang sama, sehingga dua unggahan mendapat id — dan nama berkas —
    // yang identik. Akibatnya berkas pertama tertimpa di R2 dan React melihat
    // dua elemen dengan key yang sama, yang membuat kartu gambar saling
    // menumpuk di pengurut. Penghitung dalam proses menutup celah itu.
    const timestamp = Date.now()
    const uniqueId = timestamp * 1000 + (uploadCounter++ % 1000)
    const key = `products/${uniqueId}-${buildSafeObjectName(file.name, media.extension)}`

    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: buffer,
      // Hasil pembacaan isi berkas, BUKAN `file.type` kiriman klien. Nilai ini
      // yang nanti dikirim R2 sebagai header `Content-Type` ke setiap browser
      // yang membuka URL-nya, jadi ia tidak boleh berasal dari pengunggah.
      ContentType: media.mime,
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
    // Pesan mentah SDK TIDAK diteruskan ke pemanggil. Isinya bisa memuat
    // endpoint `<R2_ACCOUNT_ID>.r2.cloudflarestorage.com` beserta detail
    // penandatanganan permintaan — keterangan infrastruktur yang tidak punya
    // urusan sampai ke browser, apalagi lewat endpoint yang balasannya bisa
    // dibaca siapa pun yang berhasil memanggilnya. Detail lengkapnya tetap ada
    // di log server, tempat yang memang untuk itu.
    console.error("R2 Upload Error:", error)
    throw new R2UploadError(
      "Gagal mengunggah berkas ke penyimpanan. Coba lagi beberapa saat lagi; kalau tetap gagal, hubungi admin sistem.",
    )
  }
}
