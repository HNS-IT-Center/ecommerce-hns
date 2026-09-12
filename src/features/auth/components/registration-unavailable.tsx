import Link from "next/link";
import { MessageCircle } from "lucide-react";

import { buildWhatsAppUrl } from "@/lib/api/whatsapp";
import { env } from "@/config/env";

/**
 * Mengarahkan pengunjung `/login`, `/register`, dan `/account` ke jalur
 * pemesanan yang sungguhan: WhatsApp.
 *
 * Menggantikan formulir daftar/masuk yang sebelumnya ada di sini. Formulir itu
 * meminta nama, nomor WhatsApp, email, dan PASSWORD, lalu membuang semuanya —
 * tidak ada yang pernah sampai ke database. Yang tersisa cuma penanda di
 * localStorage yang menerima email apa saja.
 *
 * Dibiarkan sebagai halaman, bukan dihapus rutenya, karena `/login` dan
 * `/register` mungkin sudah tersebar di tautan atau bookmark. Halaman yang
 * menjelaskan lebih baik daripada 404 yang membuat orang mengira situsnya rusak.
 *
 * COPY-NYA SENGAJA TIDAK MENYEBUT AKUN SAMA SEKALI — jangan tambahkan.
 * "Akun belum tersedia" adalah janji terselubung: "belum" berarti "nanti ada".
 * "Akun tidak tersedia" salah arah pula, karena akun pelanggan memang
 * direncanakan. Pelanggan tidak peduli apakah kami punya sistem akun; mereka
 * mau tahu cara memesan. Kalimat yang hanya menyatakan jalur pemesanan tetap
 * benar apa pun yang dibangun nanti, dan tidak perlu ditulis ulang.
 */
export function RegistrationUnavailable({
  title,
}: {
  title: string;
}) {
  const waUrl = buildWhatsAppUrl(
    env.NEXT_PUBLIC_WHATSAPP_CS_NUMBER,
    "Halo HNS IT Center, saya ingin bertanya tentang produk Anda.",
  );

  return (
    <div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-8 text-center shadow-sm">
      {/* Ikon percakapan, bukan orang-dicoret. Ikon yang mencoret pengguna
          menyatakan penolakan — padahal halaman ini menunjukkan jalan, bukan
          menutup pintu. */}
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-whatsapp/10">
        <MessageCircle className="h-6 w-6 text-whatsapp" />
      </div>

      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Pemesanan, tanya stok, dan konsultasi rakit PC dilayani langsung oleh
          tim kami lewat WhatsApp.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-xl bg-whatsapp px-4 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          <MessageCircle className="h-4 w-4" />
          Chat WhatsApp
        </a>
        <Link
          href="/shop"
          className="flex items-center justify-center rounded-xl border border-input px-4 py-3 text-sm font-semibold transition-colors hover:bg-muted"
        >
          Lihat Produk
        </Link>
      </div>
    </div>
  );
}
