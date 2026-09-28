import { JAKARTA_TIME_ZONE } from "@/lib/utils/timezone";

/**
 * Pesan follow-up WhatsApp dari sales ke pelanggan pemegang quotation.
 *
 * Modul biasa, BUKAN `"use server"` dan bukan komponen — supaya bisa dipanggil
 * dari komponen klien (sapaannya harus dihitung saat tombol ditekan) tanpa
 * melanggar aturan berkas server action (docs/17 §11.1).
 *
 * Tidak ada aritmatika harga di sini, dan itu disengaja: `totalText` diterima
 * SUDAH dalam bentuk rupiah yang diformat di server dari snapshot quotation.
 * Angka yang dibaca pelanggan di WhatsApp wajib sama persis dengan angka di
 * dokumen yang ia pegang, jadi tidak ada satu pun perkalian atau pembulatan
 * yang boleh terjadi di sisi klien (CLAUDE.md §2.7).
 */

/**
 * Jam WIB dari sebuah instant, 0–23.
 *
 * Dibaca lewat `Intl` dengan `JAKARTA_TIME_ZONE`, BUKAN `getHours()` perangkat.
 * Tombol ini dipakai staff yang hampir selalu ada di Batam, tapi laptop dengan
 * zona waktu salah setel bukan hal langka — dan sapaan yang salah adalah hal
 * pertama yang dibaca pelanggan.
 *
 * `hourCycle: "h23"` dipatok supaya tengah malam terbaca `0`, bukan `24`
 * seperti pada sebagian locale/ICU dengan `hour12: false`.
 */
const HOUR_PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: JAKARTA_TIME_ZONE,
  hour: "2-digit",
  hourCycle: "h23",
});

export function jakartaHour(value: Date): number {
  const part = HOUR_PARTS.formatToParts(value).find((p) => p.type === "hour");
  return part ? Number(part.value) : Number.NaN;
}

/**
 * "Selamat pagi" / "siang" / "sore" / "malam" menurut jam WIB.
 *
 * Batasnya mengikuti kebiasaan bicara sehari-hari, bukan pembagian yang rapi
 * empat-empat jam: siang dimulai pukul 11 (bukan 12) dan sore berakhir pukul 18
 * karena di situlah orang berhenti mengatakan "sore".
 *
 * Jam yang tidak terbaca jatuh ke "pagi" — sapaan netral selalu lebih baik
 * daripada pesan yang gagal tersusun.
 */
export function jakartaGreeting(value: Date): string {
  const hour = jakartaHour(value);
  if (Number.isNaN(hour)) return "Selamat pagi";
  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 18) return "Selamat sore";
  return "Selamat malam";
}

export type FollowUpMessageInput = {
  /** Nama pelanggan dari quotation. `null` untuk dokumen anonim lama. */
  customerName: string | null;
  /** Nama tampilan sales YANG SEDANG LOGIN — lihat catatan di bawah. */
  salesName: string;
  /** Kode quotation, apa adanya. Kedua format tetap diterima (docs/17 §1). */
  code: string;
  /** Nomor revisi. Hanya disebut kalau lebih dari 1. */
  revision: number;
  /** Total yang SUDAH diformat rupiah di server. Tidak pernah angka mentah. */
  totalText: string;
  /**
   * Tautan penawaran `https://hnsitcenter.id/q/<token>`, atau `null` untuk
   * quotation lama yang belum punya token.
   *
   * Disusun DI SERVER dan diterima jadi. Merangkainya di sini berarti komponen
   * klien perlu tahu alamat situsnya, dan satu-satunya sumber yang tersedia
   * baginya adalah `window.location` — yang di balik proxy Hostinger bisa
   * berbunyi lain dari domain publik. Pola yang sama sudah dicatat di
   * `src/app/p/[id]/route.ts`.
   */
  publicUrl: string | null;
};

/**
 * Nama sales yang diperkenalkan adalah nama ORANG YANG MENEKAN TOMBOL, bukan
 * `sales_name` yang tersnapshot di quotation.
 *
 * Keduanya bisa berbeda: CS yang menerbitkan lalu mengoper masih bisa membuka
 * detail quotation itu (docs/17 §5). Kalau yang dipakai nama snapshot, CS akan
 * memperkenalkan dirinya memakai nama sales lain kepada pelanggan yang
 * sewaktu-waktu menelepon balik dan menanyakan orang itu.
 */
export function buildFollowUpMessage(input: FollowUpMessageInput, now: Date): string {
  const { customerName, salesName, code, revision, totalText, publicUrl } = input;

  // "Bapak/Ibu" karena nama pelanggan tidak menyimpan jenis kelamin di mana
  // pun. Menebaknya dari nama berarti salah sapa pada pesan pembuka.
  const sapaan = customerName?.trim()
    ? `${jakartaGreeting(now)} Bapak/Ibu ${customerName.trim()},`
    : `${jakartaGreeting(now)} Bapak/Ibu,`;

  // Revisi disebut hanya bila ada. Pada Rev. 1 menyebutkannya justru memancing
  // pertanyaan "revisi apa?" atas dokumen yang belum pernah berubah.
  const nomorDokumen = revision > 1 ? `${code} (Rev. ${revision})` : code;

  /**
   * Tautannya berdiri di barisnya sendiri, didahului kalimat yang menjelaskan
   * ia akan membawa ke mana.
   *
   * Yang membacanya sedang menerima pesan dari nomor yang mungkin belum
   * tersimpan di kontaknya, dan tautan telanjang di tengah kalimat adalah
   * bentuk yang sama persis dipakai penipuan. Kalimat pengantar plus alamat
   * yang terbaca jelas berdomain toko sendiri — bukan pemendek pihak ketiga —
   * adalah dua hal yang membuatnya berani menekan.
   */
  const tautan = publicUrl
    ? `Rincian lengkapnya bisa Bapak/Ibu buka kembali di sini:\n${publicUrl}\n\n`
    : "";

  return (
    `${sapaan}\n\n` +
    `Perkenalkan saya ${salesName} dari HNS IT Center. Saya ingin melakukan follow up ` +
    `untuk rakitan PC Bapak/Ibu dengan nomor quotation ${nomorDokumen}, ` +
    `dengan total ${totalText}.\n\n` +
    tautan +
    `Apakah ada yang bisa kami bantu mengenai rakitan tersebut? Terima kasih.`
  );
}
