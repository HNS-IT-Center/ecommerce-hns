import { ProductType } from "@prisma/client";

import { env } from "@/config/env";
import { getPrisma } from "@/lib/prisma/client";

/**
 * Mengantrekan produk untuk didorong ke WooCommerce.
 *
 * TIDAK mengirim apa pun. Hanya menaruh penanda "produk ini perlu dikirim";
 * pengirimannya dikerjakan worker terpisah yang membaca harga terbaru langsung
 * dari database, bukan dari isi job. Karena itu job yang tertunda lama tidak
 * pernah mengirim angka basi.
 *
 * TIDAK PERNAH melempar error ke pemanggil. Gagal mengantre tidak boleh
 * menggagalkan penyimpanan produk oleh admin — antrean adalah urusan
 * belakangan, sedangkan simpanan admin adalah pekerjaan utamanya. Kegagalan
 * dicatat ke console lalu ditelan secara sadar (bukan try/catch kosong).
 *
 * @param productId  ID lokal (Product.id), BUKAN wooId.
 * @param reason     Alasan singkat untuk jejak log, mis. "update_price".
 */
export async function enqueueProductSync(
  productId: number,
  reason: string,
): Promise<void> {
  if (!env.SYNC_ENQUEUE_ENABLED) return;

  try {
    const prisma = getPrisma();

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        type: true,
        variations: { select: { id: true } },
      },
    });

    if (!product) {
      console.error(
        `[sync/enqueue] produk tidak ditemukan: id=${productId} reason=${reason}`,
      );
      return;
    }

    // Induk VARIABLE tidak punya harga untuk dikirim — harganya tinggal di
    // varian. Mengantrekan induknya menghasilkan job yang selamanya tidak
    // punya apa pun untuk didorong, dan itu baru ketahuan di worker nanti.
    const targetIds =
      product.type === ProductType.VARIABLE
        ? product.variations.map((v) => v.id)
        : [product.id];

    if (targetIds.length === 0) {
      // VARIABLE tanpa varian: tidak ada yang bisa dikirim, dan itu bukan error.
      return;
    }

    for (const targetId of targetIds) {
      // upsert pada dedupeKey, jangan pernah create buta: satu produk hanya
      // boleh punya satu job PENDING. Edit harga 20x tetap menghasilkan satu
      // push. Saat job diklaim worker, dedupeKey di-NULL-kan sehingga edit
      // berikutnya bebas membuat job PENDING baru.
      await prisma.productSyncJob.upsert({
        where: { dedupeKey: targetId },
        create: {
          productId: targetId,
          dedupeKey: targetId,
          status: "PENDING",
        },
        update: {
          status: "PENDING",
          attempts: 0,
          lastError: null,
          nextAttemptAt: new Date(),
        },
      });
    }
  } catch (error) {
    // Ditelan dengan sengaja — lihat catatan di atas.
    console.error(
      `[sync/enqueue] gagal mengantre productId=${productId} reason=${reason}:`,
      error,
    );
  }
}
