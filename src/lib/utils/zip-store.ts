/**
 * Penulis ZIP minimal — metode STORE (tanpa kompresi), tanpa dependensi.
 *
 * Dipakai "Unduh semua" di Dokumentasi Rakitan (docs/17 §21). Kenapa tidak
 * pustaka:
 * - Isinya foto JPEG/PNG/WebP yang sudah terkompresi; DEFLATE hampir tidak
 *   mengecilkannya, hanya menambah kerja CPU di server.
 * - Format STORE cukup kecil untuk ditulis dan diuji di satu berkas, dan tidak
 *   menambah dependensi yang harus diikuti pembaruannya.
 *
 * Setiap entri sudah utuh di memori sebelum ditulis (CRC dan ukurannya
 * diketahui di depan), jadi header lokal berisi angka sebenarnya — tanpa
 * "data descriptor". Bentuk ini dibaca semua pembuka ZIP, termasuk Windows
 * Explorer, Files di iOS, dan pengelola berkas Android.
 *
 * Batas format ZIP biasa (bukan ZIP64): < 65.535 entri dan < 4 GB. Pemanggil
 * di sini jauh di bawahnya (puluhan foto, masing-masing ≤ 25 MB); tetap
 * diperiksa supaya pelanggarannya melempar, bukan menghasilkan ZIP rusak.
 */

export type ZipEntry = { name: string; data: Uint8Array }

const MAX_ENTRIES = 0xffff
const MAX_UINT32 = 0xffffffff
const FLAG_UTF8 = 0x0800
const VERSION = 20

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

/**
 * Tanggal-waktu format DOS, dikunci ke WIB. Server hosting berjalan di UTC;
 * tanpa geseran ini berkas di ZIP tampil bertanggal tujuh jam lebih awal.
 */
function dosDateTime(date: Date): { time: number; date: number } {
  const wib = new Date(date.getTime() + 7 * 60 * 60 * 1000)
  const year = Math.max(wib.getUTCFullYear(), 1980)
  return {
    time: (wib.getUTCHours() << 11) | (wib.getUTCMinutes() << 5) | Math.floor(wib.getUTCSeconds() / 2),
    date: ((year - 1980) << 9) | ((wib.getUTCMonth() + 1) << 5) | wib.getUTCDate(),
  }
}

/**
 * Aliran ZIP dari entri yang datang satu per satu. Hanya satu entri yang
 * dipegang di memori pada satu waktu, jadi ZIP berisi puluhan foto tidak
 * menumpuk semuanya di server.
 */
export function createZipStream(entries: AsyncIterable<ZipEntry>, now: Date = new Date()): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const stamp = dosDateTime(now)
  const central: Uint8Array[] = []
  let offset = 0
  let count = 0
  const iterator = entries[Symbol.asyncIterator]()

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await iterator.next()
        if (!next.done) {
          const { name, data } = next.value
          const nameBytes = encoder.encode(name)
          const crc = crc32(data)
          count += 1
          if (count > MAX_ENTRIES) throw new Error("ZIP: terlalu banyak entri")
          if (data.length > MAX_UINT32 || offset + 30 + nameBytes.length + data.length > MAX_UINT32) {
            throw new Error("ZIP: ukuran melebihi 4 GB")
          }

          const local = new Uint8Array(30 + nameBytes.length)
          const lv = new DataView(local.buffer)
          lv.setUint32(0, 0x04034b50, true)
          lv.setUint16(4, VERSION, true)
          lv.setUint16(6, FLAG_UTF8, true)
          lv.setUint16(8, 0, true) // STORE
          lv.setUint16(10, stamp.time, true)
          lv.setUint16(12, stamp.date, true)
          lv.setUint32(14, crc, true)
          lv.setUint32(18, data.length, true)
          lv.setUint32(22, data.length, true)
          lv.setUint16(26, nameBytes.length, true)
          lv.setUint16(28, 0, true)
          local.set(nameBytes, 30)

          const entry = new Uint8Array(46 + nameBytes.length)
          const cv = new DataView(entry.buffer)
          cv.setUint32(0, 0x02014b50, true)
          cv.setUint16(4, VERSION, true)
          cv.setUint16(6, VERSION, true)
          cv.setUint16(8, FLAG_UTF8, true)
          cv.setUint16(10, 0, true)
          cv.setUint16(12, stamp.time, true)
          cv.setUint16(14, stamp.date, true)
          cv.setUint32(16, crc, true)
          cv.setUint32(20, data.length, true)
          cv.setUint32(24, data.length, true)
          cv.setUint16(28, nameBytes.length, true)
          // extra, komentar, nomor disk, atribut internal/eksternal: semuanya 0
          cv.setUint32(42, offset, true)
          entry.set(nameBytes, 46)
          central.push(entry)

          controller.enqueue(local)
          controller.enqueue(data)
          offset += local.length + data.length
          return
        }

        const centralSize = central.reduce((sum, e) => sum + e.length, 0)
        for (const e of central) controller.enqueue(e)

        const end = new Uint8Array(22)
        const ev = new DataView(end.buffer)
        ev.setUint32(0, 0x06054b50, true)
        ev.setUint16(8, count, true)
        ev.setUint16(10, count, true)
        ev.setUint32(12, centralSize, true)
        ev.setUint32(16, offset, true)
        controller.enqueue(end)
        controller.close()
      } catch (error) {
        controller.error(error)
      }
    },
    async cancel() {
      await iterator.return?.()
    },
  })
}
