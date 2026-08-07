"use client";

import { useState } from "react";
import { MessageCircle, Loader2, AlertTriangle } from "lucide-react";

import { formatRupiah } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useCartStore } from "@/store/cart";
import {
  prepareCheckoutWhatsApp,
  type PrepareCheckoutResult,
} from "../actions";

/**
 * Mengirim isi keranjang ke WhatsApp CS, dengan harga dari katalog.
 *
 * Yang dikirim ke server hanya id, kuantitas, dan harga yang sedang tampil.
 * Harga yang tampil TIDAK dipakai menghitung apa pun — ia hanya dibandingkan,
 * supaya perubahan bisa ditunjukkan ke pelanggan. Angka di pesan WhatsApp selalu
 * dibaca ulang dari database saat tombol ditekan; keranjang ada di localStorage
 * dan bisa disunting siapa saja lewat devtools.
 */
export function WhatsAppOrderButton() {
  const items = useCartStore((s) => s.items);
  const [loading, setLoading] = useState(false);
  const [konfirmasi, setKonfirmasi] = useState<
    Extract<PrepareCheckoutResult, { ok: true }> | null
  >(null);
  const [galat, setGalat] = useState<string | null>(null);

  const selected = items.filter((i) => i.selected !== false);

  /** Membuka WhatsApp di tab baru. */
  const buka = (url: string) => window.open(url, "_blank", "noopener,noreferrer");

  const handleClick = async () => {
    setGalat(null);
    setLoading(true);
    try {
      const hasil = await prepareCheckoutWhatsApp(
        selected.map((i) => ({
          cartItemId: i.id,
          productId: i.productId,
          quantity: i.quantity,
          displayedUnitPrice: i.price,
          displayedName: i.variationLabel
            ? `${i.name} (${i.variationLabel})`
            : i.name,
        })),
      );

      if (!hasil.ok) {
        setGalat(
          hasil.reason === "all-unavailable"
            ? "Barang di keranjang sudah tidak tersedia. Coba muat ulang halaman ini."
            : hasil.reason === "no-store"
              ? "Nomor WhatsApp CS belum tersedia. Hubungi kami lewat halaman Kontak."
              : "Keranjang kosong.",
        );
        return;
      }

      // Kalau ada harga yang berubah atau barang yang hilang, pelanggan harus
      // melihatnya SEBELUM pesan dikirim — bukan sesudah CS menanyakannya.
      if (hasil.changes.length > 0 || hasil.removedNames.length > 0) {
        setKonfirmasi(hasil);
        return;
      }

      buka(hasil.waUrl);
    } catch {
      setGalat("Gagal menyiapkan pesan. Coba lagi sebentar lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="whatsapp"
        size="lg"
        className="w-full"
        onClick={handleClick}
        disabled={loading || selected.length === 0}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <MessageCircle className="h-5 w-5" />
        )}
        {loading ? "Menyiapkan pesan…" : "Pesan Sekarang via WhatsApp"}
      </Button>

      {galat && (
        <p className="mt-2 text-sm text-sale-red" role="alert">
          {galat}
        </p>
      )}

      <AlertDialog
        open={konfirmasi !== null}
        onOpenChange={(open) => !open && setKonfirmasi(null)}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-sale-red" />
              Ada yang berubah
            </AlertDialogTitle>
            <AlertDialogDescription>
              Katalog berubah sejak halaman ini dibuka. Periksa dulu sebelum
              pesanan dikirim ke CS.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {konfirmasi && (
            <div className="max-h-64 space-y-4 overflow-y-auto text-sm">
              {konfirmasi.changes.length > 0 && (
                <div className="space-y-2">
                  <p className="font-semibold">Harga berubah:</p>
                  {konfirmasi.changes.map((c) => (
                    <div key={c.name} className="rounded-lg border p-3">
                      <p className="font-medium leading-tight">{c.name}</p>
                      <p className="mt-1">
                        <span className="text-muted-foreground line-through">
                          {formatRupiah(c.oldUnitPrice)}
                        </span>{" "}
                        <span className="font-bold">
                          {formatRupiah(c.newUnitPrice)}
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {konfirmasi.removedNames.length > 0 && (
                <div className="space-y-2">
                  <p className="font-semibold">
                    Tidak lagi tersedia dan dikeluarkan dari pesanan:
                  </p>
                  <ul className="list-inside list-disc text-muted-foreground">
                    {konfirmasi.removedNames.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rounded-lg bg-muted p-3">
                <p className="flex justify-between font-bold">
                  <span>Total yang akan dikirim</span>
                  <span>{formatRupiah(konfirmasi.total)}</span>
                </p>
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (konfirmasi) buka(konfirmasi.waUrl);
                setKonfirmasi(null);
              }}
            >
              Lanjut ke WhatsApp
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
