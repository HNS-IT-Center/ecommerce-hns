import Link from "next/link";
import { MessageCircle, UserRoundX } from "lucide-react";

import { buildWhatsAppUrl } from "@/lib/api/whatsapp";
import { env } from "@/config/env";

/**
 * Pemberitahuan bahwa akun pelanggan belum tersedia.
 *
 * Menggantikan formulir daftar/masuk yang sebelumnya ada di sini. Formulir itu
 * meminta nama, nomor WhatsApp, email, dan PASSWORD, lalu membuang semuanya —
 * tidak ada yang pernah sampai ke database. Yang tersisa cuma penanda di
 * localStorage yang menerima email apa saja.
 *
 * Dibiarkan sebagai halaman, bukan dihapus rutenya, karena `/login` dan
 * `/register` mungkin sudah tersebar di tautan atau bookmark. Halaman yang
 * menjelaskan lebih baik daripada 404 yang membuat orang mengira situsnya rusak.
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
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <UserRoundX className="h-6 w-6 text-muted-foreground" />
      </div>

      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Akun pelanggan belum tersedia di situs ini. Semua pemesanan, tanya stok,
          dan konsultasi rakit PC dilayani langsung lewat WhatsApp.
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
