"use client"

import { QRCodeSVG } from "qrcode.react"

/**
 * QR ke halaman paket, untuk lembar cetak PDF.
 *
 * Client Component hanya karena `qrcode.react` memakai hook; lembar cetaknya
 * sendiri Server Component. SVG, bukan canvas: canvas tercetak sebagai bitmap
 * dan bisa buram di printer, SVG tetap tajam di ukuran berapa pun.
 */
export function PrintQr({ value, color }: { value: string; color: string }) {
  return <QRCodeSVG value={value} size={256} fgColor={color} bgColor="#ffffff" level="M" className="h-full w-full" />
}
