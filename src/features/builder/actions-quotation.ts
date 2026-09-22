"use server";

import { headers } from "next/headers";
import { z } from "zod";

import {
  issueQuotation,
  reviseQuotation,
  type IssueQuotationResult,
  type QuotationOwner,
} from "@/lib/api/pc-build-quotes";
import { getSalesDisplayName, listQuotationSalesUsers } from "@/lib/api/admin-users";
import { getCurrentUser } from "@/lib/auth";
import { bisaAkses, muatIzinUser } from "@/lib/auth/permissions";
import { checkRateLimit, clientIpFrom } from "@/lib/auth/registration-rate-limit";
import {
  MAX_CUSTOMER_NAME,
  MAX_INTERNAL_NOTE,
  TIDAK_OPER,
} from "./quotation-constants";

/**
 * Penerbitan quotation rakitan PC — SATU-SATUNYA jalur yang menerbitkan nomor.
 *
 * Sampai 21 September 2026 nomor lahir sebagai efek samping GET
 * `/build-pc/print?items=…`: membuka halaman itu menulis ke database. Akibatnya
 * setiap refresh tab PDF, setiap pra-render, dan setiap bot yang menelusuri
 * tautan ikut membuat baris baru. Dengan nomor urut, kebiasaan itu jadi jauh
 * lebih mahal daripada sekadar baris duplikat — ia menghabiskan nomor.
 *
 * Karena itu penerbitan pindah ke sini: sebuah aksi, bukan sebuah halaman.
 * Halaman cetak sekarang hanya membaca.
 */

const MAX_ITEMS = 50;

/**
 * Yang boleh dikirim klien: id & kuantitas saja.
 *
 * **Tidak ada medan harga di skema ini, dan jangan pernah ditambahkan**
 * (CLAUDE.md §2.7). Harga dibaca ulang dari katalog di server. `stepId` hanya
 * menentukan pengelompokan kategori di PDF — nama kategorinya sendiri diambil
 * dari konfigurasi builder di database, bukan dari yang dikirim klien.
 */
const SelectionSchema = z.object({
  stepId: z.string().max(64).nullable(),
  productId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(99),
});

/**
 * Nomor HP Indonesia, longgar dengan sengaja.
 *
 * Yang mengetik ini adalah staff yang sedang menyalin dari layar HP pelanggan,
 * bukan pelanggan yang mendaftar. Validasi ketat di situ hanya menghasilkan
 * nomor yang "dibetulkan" supaya lolos — dan nomor yang dibetulkan lebih buruk
 * daripada nomor yang formatnya tidak rapi tapi benar.
 */
const PHONE_PATTERN = /^[0-9+().\s-]{8,20}$/;

const InputSchema = z.object({
  items: z.array(SelectionSchema).min(1).max(MAX_ITEMS),
  customerName: z.string().trim().min(2).max(MAX_CUSTOMER_NAME).optional(),
  customerPhone: z.string().trim().regex(PHONE_PATTERN).optional().or(z.literal("")),
  internalNote: z.string().trim().max(MAX_INTERNAL_NOTE).optional().or(z.literal("")),
  salesUserId: z.string().max(64).optional(),
});

export type IssueQuotationActionResult = IssueQuotationResult;

export async function issueQuotationAction(
  input: unknown,
): Promise<IssueQuotationActionResult> {
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Data yang dikirim tidak valid." };
  }
  const data = parsed.data;

  const user = await getCurrentUser();
  const izin = user ? await muatIzinUser(user) : null;
  const bolehTerbitBernama = izin ? bisaAkses(izin, "quotation-terbit", "edit") : false;

  /**
   * Batas laju per IP untuk penerbitan oleh pengunjung.
   *
   * Nomor berurutan bisa "dipompa": menekan Print berkali-kali menghabiskan
   * nomor bulan itu, dan nomor yang melompat jauh membuat pembukuan toko
   * terlihat seperti kehilangan dokumen. Risiko itu diterima secara sadar saat
   * memilih nomor urut — ini mitigasinya.
   *
   * **Staff dikecualikan.** Seluruh gerai keluar lewat satu IP NAT yang sama,
   * jadi lima penerbitan per menit adalah jatah untuk seisi toko, bukan per
   * orang — dan sales yang sedang melayani antrean akan tertahan oleh batas
   * yang ditujukan untuk bot.
   */
  if (!bolehTerbitBernama) {
    const limit = checkRateLimit("quote_issue", clientIpFrom(await headers()));
    if (!limit.ok) {
      return {
        ok: false,
        error: `Terlalu banyak penerbitan dari jaringan ini. Coba lagi dalam ${limit.retryAfterSeconds} detik.`,
      };
    }
  }

  /**
   * Pengunjung & pelanggan biasa: anonim, apa pun yang mereka kirim.
   *
   * Medan identitas DIBUANG, bukan ditolak dengan pesan error. Yang mengirimnya
   * tanpa izin bukan orang yang salah isi formulir — formulirnya memang tidak
   * pernah ditampilkan kepada mereka — melainkan seseorang yang memanggil
   * action ini langsung. Menjelaskan kepadanya medan apa saja yang ada tidak
   * ada gunanya.
   */
  if (!user || !izin || !bolehTerbitBernama) {
    return issueQuotation(data.items);
  }

  const customerName = data.customerName?.trim() ?? "";
  if (customerName.length < 2) {
    return { ok: false, error: "Nama pelanggan wajib diisi." };
  }

  const adalahSales = bisaAkses(izin, "quotation-sales", "edit");
  const owner = await resolveOwner({
    user,
    adalahSales,
    salesUserId: data.salesUserId,
  });
  if ("error" in owner) return { ok: false, error: owner.error };

  return issueQuotation(data.items, {
    customerName,
    customerPhone: data.customerPhone?.trim() || null,
    internalNote: data.internalNote?.trim() || null,
    ...owner.value,
  });
}

/**
 * Siapa yang akan memegang quotation ini, dan nama siapa yang tercetak.
 *
 * Diputuskan DI SERVER dari izin, bukan dari apa yang dikirim klien. Dialog di
 * builder hanya menentukan apa yang terlihat; yang menahan CS agar tidak bisa
 * menuliskan dirinya sebagai Sales — atau mengoper ke akun yang bukan Sales —
 * adalah pemeriksaan di sini.
 */
async function resolveOwner({
  user,
  adalahSales,
  salesUserId,
}: {
  user: { id: string; name: string }
  adalahSales: boolean
  salesUserId?: string
}): Promise<
  | { value: Pick<QuotationOwner, "ownerUserId" | "salesName" | "createdByUserId"> }
  | { error: string }
> {
  // Sales menerbitkan untuk dirinya sendiri. Pilihan operan diabaikan — sales
  // memindahkan quotation ke sales lain bukan alur yang ada hari ini.
  if (adalahSales) {
    return {
      value: {
        ownerUserId: user.id,
        salesName: (await getSalesDisplayName(user.id)) ?? user.name,
        createdByUserId: user.id,
      },
    };
  }

  // CS. Wajib memilih: salah satu sales, atau "tidak oper" secara eksplisit.
  // Tidak ada bawaan — menebak di sini berarti quotation mendarat di riwayat
  // orang yang tidak pernah memintanya.
  if (!salesUserId) {
    return { error: "Pilih Sales tujuan, atau pilih “Tidak oper”." };
  }

  if (salesUserId === TIDAK_OPER) {
    /**
     * CS memegangnya sendiri. `salesName` NULL — baris "Sales:" tidak tercetak
     * di PDF sama sekali, karena CS memang bukan sales dan menuliskan namanya
     * di situ akan salah menyatakan siapa yang melayani penjualan.
     */
    return {
      value: { ownerUserId: user.id, salesName: null, createdByUserId: user.id },
    };
  }

  // Daftar yang sama yang dipakai dialog — diambil ulang, bukan dipercaya dari
  // klien. Ia juga sudah membuang master dan diri sendiri.
  const kandidat = await listQuotationSalesUsers(user.id);
  const dipilih = kandidat.find((s) => s.id === salesUserId);
  if (!dipilih) {
    return { error: "Sales yang dipilih tidak tersedia. Muat ulang halaman." };
  }

  return {
    value: {
      ownerUserId: dipilih.id,
      salesName: dipilih.displayName,
      createdByUserId: user.id,
    },
  };
}

const ReviseSchema = z.object({
  code: z.string().max(32),
  items: z.array(SelectionSchema).min(1).max(MAX_ITEMS),
  customerName: z.string().trim().min(2).max(MAX_CUSTOMER_NAME),
  customerPhone: z.string().trim().regex(PHONE_PATTERN).optional().or(z.literal("")),
  internalNote: z.string().trim().max(MAX_INTERNAL_NOTE).optional().or(z.literal("")),
  /** BOOLEAN, bukan angka rupiah — lihat CLAUDE.md §2.7. */
  useLatestPrices: z.boolean(),
});

/**
 * Simpan revisi atas quotation yang sudah terbit. Kodenya tidak berubah.
 *
 * Izinnya diperiksa dua lapis dan itu disengaja: `quotation-terbit` di sini
 * (boleh merevisi sama sekali), lalu KEPEMILIKAN di `reviseQuotation` (boleh
 * merevisi yang INI). Lapisan kedua yang menahan sales lain, dan ia hidup di
 * lapisan data — jadi jalur apa pun yang ditambahkan nanti ikut menanggungnya.
 */
export async function reviseQuotationAction(
  input: unknown,
): Promise<IssueQuotationActionResult> {
  const parsed = ReviseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Data yang dikirim tidak valid." };
  }
  const data = parsed.data;

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sesi Anda sudah berakhir. Masuk lagi lalu coba ulang." };

  const izin = await muatIzinUser(user);
  if (!bisaAkses(izin, "quotation-terbit", "edit")) {
    return { ok: false, error: "Akun Anda tidak berhak merevisi quotation." };
  }

  return reviseQuotation(data.code, user.id, {
    selections: data.items,
    customerName: data.customerName,
    customerPhone: data.customerPhone?.trim() || null,
    internalNote: data.internalNote?.trim() || null,
    useLatestPrices: data.useLatestPrices,
  });
}
