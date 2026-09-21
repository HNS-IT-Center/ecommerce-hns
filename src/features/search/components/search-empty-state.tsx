import Link from "next/link";
import { MessageCircle, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/ui/product-card";
import { buildWhatsAppUrl } from "@/lib/api/whatsapp";
import { mapWooProductToUI } from "@/lib/api/woocommerce/mapper";
import {
  getSearchSuggestions,
  type SearchSuggestionFilters,
} from "@/lib/api/woocommerce/search-suggestions";
import { getStockDisplayMode } from "@/lib/api/stock-display";

interface SearchEmptyStateProps {
  /** Kata kunci yang diketik pelanggan. Kosong = halaman disaring filter saja. */
  query: string;
  /** Filter yang sedang aktif, dipakai saran supaya tidak melompati pilihan pelanggan. */
  filters: SearchSuggestionFilters;
  /** Ada filter aktif — mengubah nasihat yang diberikan, bukan cuma hiasan. */
  hasActiveFilters: boolean;
  whatsappNumber: string;
}

const SUGGESTION_LIMIT = 10;

/**
 * Layar "tidak ditemukan" di `/search`.
 *
 * Halaman kosong adalah ujung jalan bagi pelanggan yang justru paling siap
 * beli: ia mengetik kode model persis. Maka di sini disediakan dua jalan
 * keluar — produk sekeluarga yang kata kuncinya dilonggarkan (lihat
 * `search-suggestions.ts`), dan tombol tanya CS yang sudah membawa kata kunci
 * yang tadi diketik.
 *
 * Label saran ditulis tegas sebagai "mungkin", dan kata kunci yang dipakai
 * ikut dicetak. Kalau saran tampil tanpa keterangan itu, pelanggan akan
 * membacanya sebagai hasil pencariannya sendiri dan mengira barang yang ia
 * ketik tersedia.
 */
export async function SearchEmptyState({
  query,
  filters,
  hasActiveFilters,
  whatsappNumber,
}: SearchEmptyStateProps) {
  const suggestion = await getSearchSuggestions({
    query,
    filters,
    limit: SUGGESTION_LIMIT,
  });

  const stockDisplayMode = await getStockDisplayMode();
  const suggestedProducts =
    suggestion?.products.map((p) => mapWooProductToUI(p, stockDisplayMode)) ?? [];

  const waMessage = query
    ? `Halo HNS IT Center, saya mencari "${query}" tapi tidak menemukannya di website. Apakah produk ini tersedia?`
    : "Halo HNS IT Center, saya tidak menemukan produk yang saya cari di website. Bisa dibantu?";

  return (
    <div className="mt-4 flex flex-col gap-8">
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card p-6 text-center sm:p-8">
        <SearchX className="mb-3 h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-lg font-medium">Produk tidak ditemukan.</p>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {query ? (
            <>
              Tidak ada produk yang cocok dengan{" "}
              <span className="font-medium text-foreground">&ldquo;{query}&rdquo;</span>
              {hasActiveFilters ? " dan filter yang dipilih" : ""}. Stok kami berubah
              setiap hari — kalau barangnya spesifik, CS bisa mengeceknya langsung.
            </>
          ) : (
            "Tidak ada produk yang cocok dengan filter yang dipilih. Coba longgarkan filternya."
          )}
        </p>

        <div className="mt-5 flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-center">
          <Button
            variant="whatsapp"
            nativeButton={false}
            render={
              <a
                href={buildWhatsAppUrl(whatsappNumber, waMessage)}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            <MessageCircle className="h-4 w-4" />
            Tanyakan ke CS via WhatsApp
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link href="/shop" />}>
            Lihat semua produk
          </Button>
        </div>
      </div>

      {suggestedProducts.length > 0 && suggestion && (
        <section aria-labelledby="saran-pencarian">
          <h2 id="saran-pencarian" className="text-xl font-extrabold tracking-tight">
            Mungkin yang Anda cari
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Bukan hasil persis. Ini produk untuk kata kunci{" "}
            <span className="font-medium text-foreground">
              &ldquo;{suggestion.keyword}&rdquo;
            </span>
            {suggestion.filtersDropped ? ", tanpa filter yang sedang aktif" : ""}.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 xl:gap-6">
            {suggestedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
