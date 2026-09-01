"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { DecodeHintType } from "@zxing/library"

/** Sebab kegagalan yang masing-masing butuh kalimat berbeda di layar. */
export type ScannerFailure =
  | "insecure-context"
  | "unsupported"
  | "permission-denied"
  | "no-camera"
  | "camera-busy"
  | "unknown"

export type ScannerState =
  | { status: "starting" }
  | { status: "scanning" }
  | { status: "failed"; reason: ScannerFailure }

/**
 * `BarcodeDetector` belum ada di lib.dom bawaan TypeScript, jadi bentuknya
 * dideklarasikan seperlunya di sini. Sengaja hanya anggota yang benar-benar
 * dipakai — penyempitan tipe, bukan `any` (CLAUDE.md §2.4).
 */
type DetectedBarcode = { rawValue: string }

type BarcodeDetectorLike = {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>
}

type BarcodeDetectorConstructor = {
  new (options?: { formats?: string[] }): BarcodeDetectorLike
}

/**
 * Format yang diminta ke `BarcodeDetector`.
 *
 * QR untuk stiker produk, sisanya format barcode garis yang lazim dipakai
 * stiker SKU gudang.
 */
const NATIVE_FORMATS = [
  "qr_code",
  "code_128",
  "code_39",
  "code_93",
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "itf",
  "data_matrix",
]

/** Jeda antar percobaan baca. Cukup responsif, tapi tidak menguras baterai. */
const SCAN_INTERVAL_MS = 140

/**
 * Lebar bingkai yang dianalisis. Frame kamera bisa 1280px atau lebih, dan
 * menganalisis seluruhnya di jalur ZXing (murni JavaScript, tanpa bantuan
 * hardware) terasa berat di ponsel kelas menengah. 640px masih jauh di atas
 * yang dibutuhkan untuk membaca stiker QR.
 */
const ANALYSIS_WIDTH = 640

type Decoder = (image: ImageData) => string | null

/**
 * Pembaca cadangan berbasis ZXing — dan di iPhone, ini SATU-SATUNYA pembaca.
 *
 * Safari tidak mengimplementasikan `BarcodeDetector` sama sekali, jadi setiap
 * pemindaian dari iPhone melewati jalur ini. Karena itu jalur ini bukan
 * "cadangan yang jarang kepakai" — ia harus sama benarnya dengan jalur native,
 * dan wajib diuji di iPhone sungguhan, bukan hanya di simulator desktop.
 *
 * Diimpor dinamis supaya paketnya hanya diunduh saat tombol scan benar-benar
 * ditekan; pembeli yang tidak pernah memindai tidak ikut menanggung bobotnya.
 */
async function createZxingDecoder(): Promise<Decoder> {
  const {
    MultiFormatReader,
    BarcodeFormat,
    DecodeHintType: HintType,
    RGBLuminanceSource,
    BinaryBitmap,
    HybridBinarizer,
  } = await import("@zxing/library")

  const hints = new Map<DecodeHintType, unknown>()
  hints.set(HintType.POSSIBLE_FORMATS, [
    BarcodeFormat.QR_CODE,
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.CODE_93,
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.ITF,
    BarcodeFormat.DATA_MATRIX,
  ])
  // Barcode garis di stiker sering miring atau agak buram; tanpa ini banyak
  // percobaan yang sebenarnya terbaca justru dilewatkan.
  hints.set(HintType.TRY_HARDER, true)

  const reader = new MultiFormatReader()
  reader.setHints(hints)

  return (image: ImageData) => {
    // RGBA WAJIB dikonversi lebih dulu, bukan diserahkan mentah.
    //
    // `RGBLuminanceSource` hanya melakukan konversi sendiri kalau menerima
    // `Int32Array`; sebuah `Uint8ClampedArray` — persis yang keluar dari
    // `ImageData` — dipakai APA ADANYA sebagai data luminance. Menyerahkan
    // buffer RGBA ke sana tidak melempar error apa pun, hanya menghasilkan
    // bitmap sampah yang tidak pernah cocok dengan kode mana pun. Gejalanya
    // menipu: kamera menyala, tidak ada pesan salah, tapi tidak pernah membaca.
    const { data, width, height } = image
    const luminances = new Uint8ClampedArray(width * height)
    for (let i = 0, p = 0; i < luminances.length; i++, p += 4) {
      // Rata-rata berbobot hijau, sama dengan yang dipakai ZXing sendiri.
      luminances[i] = (data[p] + 2 * data[p + 1] + data[p + 2]) / 4
    }

    const source = new RGBLuminanceSource(luminances, width, height)
    const bitmap = new BinaryBitmap(new HybridBinarizer(source))

    try {
      return reader.decodeWithState(bitmap).getText()
    } catch {
      // NotFoundException pada frame tanpa kode — kejadian normal tiap tik,
      // bukan kesalahan yang perlu dilaporkan.
      return null
    }
  }
}

function classifyCameraError(error: unknown): ScannerFailure {
  const name = error instanceof DOMException ? error.name : ""

  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "permission-denied"
    case "NotFoundError":
    case "OverconstrainedError":
      return "no-camera"
    case "NotReadableError":
    case "AbortError":
      // Kamera sedang dipegang aplikasi lain — sering terjadi di Android.
      return "camera-busy"
    default:
      return "unknown"
  }
}

/**
 * Halangan yang sudah bisa dipastikan SEBELUM kamera disentuh.
 *
 * Dipisah jadi fungsi murni supaya jawabannya bisa dipakai di tiga tempat yang
 * membutuhkannya — nilai awal state, tombol Coba Lagi, dan penjaga di dalam
 * efek — tanpa ada satu pun yang memanggil `setState` dari dalam efek.
 *
 * Urutannya penting: di origin yang tidak aman Safari menghilangkan
 * `navigator.mediaDevices` sepenuhnya, jadi memeriksa `isSecureContext` lebih
 * dulu mencegah pesan "browser tidak didukung" yang menyesatkan padahal yang
 * kurang cuma HTTPS.
 */
function detectEnvironmentFailure(): ScannerFailure | null {
  if (typeof window === "undefined") return null
  if (!window.isSecureContext) return "insecure-context"
  if (!navigator.mediaDevices?.getUserMedia) return "unsupported"
  return null
}

type UseCodeScannerOptions = {
  /** Kamera hanya menyala saat true. */
  active: boolean
  /** Dipanggil sekali untuk tiap kode yang berhasil dibaca. */
  onDetect: (raw: string) => void
}

/**
 * Menyalakan kamera belakang dan membaca kode dari alirannya.
 *
 * Jalur bacanya dua, dipilih menurut kemampuan browser: `BarcodeDetector`
 * bawaan kalau ada (Chrome/Android — dibantu hardware, jauh lebih hemat
 * baterai), dan ZXing untuk sisanya (Safari/iOS, Firefox).
 */
export function useCodeScanner({ active, onDetect }: UseCodeScannerOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [state, setState] = useState<ScannerState>(() => {
    const failure = detectEnvironmentFailure()
    return failure ? { status: "failed", reason: failure } : { status: "starting" }
  })

  /** Percobaan ulang setelah izin ditolak lalu diberikan lewat setelan browser. */
  const [attempt, setAttempt] = useState(0)

  /**
   * State WAJIB ikut disetel ulang di sini, tidak cukup menaikkan `attempt`.
   *
   * Selama state masih "failed", antarmuka menampilkan layar kesalahan dan
   * TIDAK merender elemen `<video>`. Efek yang dijalankan ulang akan meminta
   * kamera, mendapatkannya, lalu tidak menemukan elemen untuk menampungnya dan
   * berhenti — tombol Coba Lagi jadi tidak pernah bisa berhasil sekali pun.
   * Keduanya disetel dalam satu penanganan peristiwa, jadi React menggabungkan
   * keduanya menjadi satu render.
   */
  const retry = useCallback(() => {
    const failure = detectEnvironmentFailure()
    setState(failure ? { status: "failed", reason: failure } : { status: "starting" })
    setAttempt((n) => n + 1)
  }, [])

  /**
   * `onDetect` dititipkan lewat ref supaya kamera tidak mati-nyala setiap
   * induknya render ulang dan menghasilkan fungsi baru.
   */
  const onDetectRef = useRef(onDetect)
  useEffect(() => {
    onDetectRef.current = onDetect
  }, [onDetect])

  useEffect(() => {
    if (!active) return

    let cancelled = false
    let stream: MediaStream | null = null

    // Halangan lingkungan sudah tercermin di state sejak inisialisasi (dan
    // disegarkan tiap kali Coba Lagi ditekan), jadi di sini cukup berhenti —
    // tidak ada `setState` dari dalam efek.
    if (detectEnvironmentFailure()) return

    async function start() {
      setState({ status: "starting" })

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          // `ideal`, bukan `exact`: di laptop tanpa kamera belakang `exact`
          // melempar OverconstrainedError dan pemindainya mati total, padahal
          // webcam depan sebenarnya masih bisa dipakai.
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        })
      } catch (error) {
        if (!cancelled) setState({ status: "failed", reason: classifyCameraError(error) })
        return
      }

      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      const video = videoRef.current
      if (!video) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      video.srcObject = stream

      // Dua baris inilah yang membuatnya jalan di iPhone.
      //
      // Tanpa `playsinline`, iOS merebut video ke pemutar layar penuh miliknya
      // dan seluruh antarmuka pemindai lenyap di baliknya. `muted` wajib
      // menyertainya, karena tanpa itu autoplay-nya ditolak. Atributnya diset
      // langsung ke DOM supaya dipastikan sudah berlaku sebelum `play()`.
      video.setAttribute("playsinline", "true")
      video.muted = true

      try {
        await video.play()
      } catch (error) {
        if (!cancelled) setState({ status: "failed", reason: classifyCameraError(error) })
        return
      }

      if (cancelled) return

      const NativeDetector = (
        window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }
      ).BarcodeDetector

      let nativeDetector: BarcodeDetectorLike | null = null
      let zxingDecode: Decoder | null = null

      if (NativeDetector) {
        try {
          nativeDetector = new NativeDetector({ formats: NATIVE_FORMATS })
        } catch {
          // Sebagian browser mengiklankan konstruktornya tapi menolak daftar
          // format yang diminta. Turun ke ZXing, bukan menyerah.
          nativeDetector = null
        }
      }

      if (!nativeDetector) {
        try {
          zxingDecode = await createZxingDecoder()
        } catch {
          if (!cancelled) setState({ status: "failed", reason: "unsupported" })
          return
        }
      }

      if (cancelled) return
      setState({ status: "scanning" })

      const canvas = document.createElement("canvas")
      // `willReadFrequently` mencegah canvas dipindah ke GPU, yang justru
      // membuat `getImageData` tiap frame jadi lambat.
      const context = canvas.getContext("2d", { willReadFrequently: true })

      while (!cancelled) {
        const current = videoRef.current

        if (current && current.readyState >= current.HAVE_CURRENT_DATA) {
          let found: string | null = null

          if (nativeDetector) {
            try {
              const codes = await nativeDetector.detect(current)
              found = codes[0]?.rawValue ?? null
            } catch {
              // Frame ini gagal dianalisis — lanjut ke frame berikutnya.
            }
          } else if (zxingDecode && context) {
            const scale = Math.min(1, ANALYSIS_WIDTH / current.videoWidth)
            canvas.width = Math.max(1, Math.round(current.videoWidth * scale))
            canvas.height = Math.max(1, Math.round(current.videoHeight * scale))
            context.drawImage(current, 0, 0, canvas.width, canvas.height)

            try {
              found = zxingDecode(context.getImageData(0, 0, canvas.width, canvas.height))
            } catch {
              // `getImageData` bisa melempar kalau frame belum benar-benar siap.
            }
          }

          if (found && !cancelled) {
            onDetectRef.current(found)
            return
          }
        }

        await new Promise((resolve) => setTimeout(resolve, SCAN_INTERVAL_MS))
      }
    }

    void start()

    // Disalin sekarang, bukan dibaca saat pembersihan: saat pembersihan
    // berjalan, komponennya bisa sudah melepas elemen itu dan `videoRef.current`
    // sudah null — alirannya lalu menggantung di elemen yang tidak pernah
    // dilepaskan.
    const attachedVideo = videoRef.current

    return () => {
      cancelled = true
      // Track WAJIB dihentikan. Tanpa ini lampu kamera tetap menyala setelah
      // panelnya ditutup, dan pengguna sewajarnya menyangka masih direkam.
      stream?.getTracks().forEach((track) => track.stop())

      if (attachedVideo) {
        attachedVideo.pause()
        attachedVideo.srcObject = null
      }
    }
  }, [active, attempt])

  return { videoRef, state, retry }
}
