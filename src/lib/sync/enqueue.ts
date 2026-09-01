import { ProductType } from "@prisma/client";

import { env } from "@/config/env";
import { getPrisma } from "@/lib/prisma/client";

/**
 * Batas waktu mengantre.
 *
 * Menelan error saja tidak cukup. Kalau database bermasalah — kuota koneksi
 * Hostinger pernah habis — driver bisa menahan panggilan ini lebih dari 100
 * detik sebelum menyerah (terukur, bukan perkiraan). Selama itu admin yang
 * menyimpan produk ikut menunggu, karena pemanggilnya meng-await.
 *
 * Antrean adalah pekerjaan sampingan; kalau lambat, lebih baik dilewat. Job
 * yang terlewat terbentuk lagi pada penyimpanan berikutnya, dan reconcile di
 * Fase 3 menangkap sisanya.
 */
const ENQUEUE_TIMEOUT_MS = 3000;

/**
 * Mengantrekan produk untuk didorong ke WooCommerce.
 *
 * TIDAK mengirim apa pun. Hanya menaruh penanda "produk ini perlu dikirim";
 * pengirimannya dikerjakan worker terpisah yang membaca harga terbaru langsung
 * dari database, bukan dari isi job. Karena itu job yang tertunda lama tidak
 * pernah mengirim angka basi.
 *
 * TIDAK PERNAH melempar ke pemanggil, dan tidak pernah menahan lebih lama dari
 * ENQUEUE_TIMEOUT_MS. Gagal mengantre tidak boleh menggagalkan — atau
 * memperlambat — penyimpanan produk oleh admin. Kegagalan dicatat ke console
 * lalu ditelan secara sadar (bukan try/catch kosong).
 *
 * @param productId  ID lokal (Product.id), BUKAN wooId.
 * @param reason     Alasan singkat untuk jejak log, mis. "update_product".
 */
export async function enqueueProductSync(
  productId: number,
  reason: string,
): Promise<void> {
  if (!env.SYNC_ENQUEUE_ENABLED) return;

  try {
    await Promise.race([
      enqueue(productId, reason),
      new Promise<never>((_, reject) => {
        const timer = setTimeout(
          () => reject(new Error("melewati batas " + ENQUEUE_TIMEOUT_MS + "ms")),
          ENQUEUE_TIMEOUT_MS,
        );
        // Jangan menahan proses tetap hidup hanya demi timer ini.
        timer.unref?.();
      }),
    ]);
  } catch (error) {
    // Ditelan dengan sengaja — lihat catatan pada dokumentasi di atas.
    console.error(
      "[sync/enqueue] gagal mengantre productId=" +
        productId +
        " reason=" +
        reason +
        ":",
      error,
    );
  }
}

/** Pekerjaan sebenarnya. Boleh melempar; pemanggilnya yang menjaga. */
async function enqueue(productId: number, reason: string): Promise<void> {
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
      "[sync/enqueue] produk tidak ditemukan: id=" +
        productId +
        " reason=" +
        reason,
    );
    return;
  }

  // Induk VARIABLE tidak punya harga untuk dikirim — harganya tinggal di
  // varian. Mengantrekan induknya menghasilkan job yang selamanya tidak punya
  // apa pun untuk didorong, dan itu baru ketahuan jauh di worker nanti.
  const targetIds =
    product.type === ProductType.VARIABLE
      ? product.variations.map((v) => v.id)
      : [product.id];

  // VARIABLE tanpa varian: tidak ada yang bisa dikirim, dan itu bukan error.
  if (targetIds.length === 0) return;

  for (const targetId of targetIds) {
    // upsert pada dedupeKey, jangan pernah create buta: satu produk hanya boleh
    // punya satu job PENDING. Edit harga 20x tetap menghasilkan satu push. Saat
    // job diklaim worker, dedupeKey di-NULL-kan sehingga edit berikutnya bebas
    // membuat job PENDING baru.
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
}
