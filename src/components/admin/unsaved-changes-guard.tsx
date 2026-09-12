"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";

/**
 * Bungkus sebuah formulir supaya perubahan yang belum disimpan tidak hilang
 * tanpa peringatan.
 *
 * Dibuat sebagai PEMBUNGKUS, bukan sebagai perubahan di dalam tiap formulir,
 * karena tiga dari empat formulir admin adalah `<form action={serverAction}>`
 * polos tanpa state sama sekali — dua di antaranya bahkan Server Component.
 * Mengubah ketiganya jadi react-hook-form hanya demi pelacakan perubahan adalah
 * pekerjaan yang jauh lebih besar daripada yang epic ini minta, dan menyentuh
 * jalur simpan yang sudah bekerja.
 *
 * `display: contents` dipakai supaya pembungkus ini tidak menghasilkan kotak
 * apa pun di layout. Kelas pada formulir di dalamnya tetap berlaku persis
 * seperti sebelumnya.
 */

type Ctx = {
  isDirty: boolean;
  /**
   * Pergi ke `href`, bertanya lebih dulu kalau ada perubahan. Dipakai tombol
   * "Batal" supaya ia memakai dialog yang sama dengan penyadap tautan, bukan
   * membuat konfirmasinya sendiri.
   */
  navigate: (href: string) => void;
};

const UnsavedChangesContext = createContext<Ctx | null>(null);

/** Dipakai tombol Batal di dalam formulir. Aman dipanggil di luar pembungkus. */
export function useUnsavedChanges(): Ctx {
  return (
    useContext(UnsavedChangesContext) ?? {
      isDirty: false,
      navigate: () => {},
    }
  );
}

/**
 * Ringkas seluruh isi formulir jadi satu string yang bisa dibandingkan.
 *
 * Kunci diurutkan supaya urutan medan di DOM tidak memengaruhi hasilnya —
 * `StoreHoursEditor` menyisipkan input tersembunyi saat sebuah hari ditandai
 * tutup, dan tanpa pengurutan itu saja sudah terbaca sebagai perubahan.
 */
function ringkas(form: HTMLFormElement): string {
  const data = new FormData(form);
  const bagian: string[] = [];

  for (const [kunci, nilai] of data.entries()) {
    bagian.push(
      typeof nilai === "string"
        ? `${kunci}=${nilai}`
        : `${kunci}=berkas:${nilai.name}:${nilai.size}`,
    );
  }

  bagian.sort();
  return bagian.join("\n");
}

type Props = {
  /**
   * Serahkan status perubahan dari luar kalau formulirnya memang tahu — mis.
   * `formState.isDirty` milik react-hook-form. Kalau tidak diisi, pembungkus ini
   * membandingkan isi formulir sendiri.
   */
  isDirty?: boolean;
  children: ReactNode;
};

export function UnsavedChangesGuard({ isDirty, children }: Props) {
  const router = useRouter();
  const pembungkus = useRef<HTMLDivElement>(null);
  const awal = useRef<string | null>(null);

  const [berubah, setBerubah] = useState(false);
  const [tujuan, setTujuan] = useState<string | null>(null);

  const dikendalikanLuar = isDirty !== undefined;
  const dirty = dikendalikanLuar ? isDirty : berubah;

  /**
   * Isi awal direkam SETELAH render pertama, bukan dari props.
   *
   * Sebagian medan dikendalikan React dan baru punya nilai finalnya setelah
   * terpasang — tujuh `<select>` jam buka misalnya. Merekam dari props berarti
   * membandingkan dua bentuk yang berbeda, dan formulirnya akan terbaca "sudah
   * berubah" sejak detik pertama tanpa ada yang menyentuhnya. Itu persis bug
   * yang membuat dialog ini muncul terus-menerus sebelumnya.
   */
  useEffect(() => {
    if (dikendalikanLuar) return;
    const form = pembungkus.current?.querySelector("form");
    if (form) awal.current = ringkas(form);
  }, [dikendalikanLuar]);

  /**
   * Dibandingkan, bukan disetel sekali.
   *
   * Versi sebelumnya menyalakan tanda pada event `input`/`change` pertama dan
   * tidak pernah memadamkannya, jadi mengetik lalu menghapusnya kembali tetap
   * dianggap perubahan. Dengan perbandingan, mengembalikan nilai ke asalnya
   * memadamkan tandanya sendiri.
   */
  function periksa() {
    if (dikendalikanLuar || awal.current === null) return;
    const form = pembungkus.current?.querySelector("form");
    if (!form) return;
    setBerubah(ringkas(form) !== awal.current);
  }

  const sadap = useCallback((href: string) => setTujuan(href), []);
  useUnsavedChangesGuard(dirty, sadap);

  return (
    <div
      ref={pembungkus}
      style={{ display: "contents" }}
      // `onInput` menangkap ketikan; `onChange` menangkap yang tidak diketik —
      // checkbox, select, dan input file. Keduanya menggelembung sampai ke sini.
      onInput={dikendalikanLuar ? undefined : periksa}
      onChange={dikendalikanLuar ? undefined : periksa}
      // Setelah dikirim, tidak ada lagi yang belum disimpan. Formulir server
      // action mengalihkan halaman setelah berhasil, jadi tanda ini tidak perlu
      // dinyalakan lagi. Kalau pengirimannya GAGAL, tandanya sudah padam
      // sementara isinya masih di layar — batas yang diterima, karena kegagalan
      // simpan sudah punya pesannya sendiri di layar.
      onSubmit={() => setBerubah(false)}
      onReset={() => setBerubah(false)}
    >
      <UnsavedChangesContext.Provider
        value={{
          isDirty: dirty,
          navigate: (href) => (dirty ? setTujuan(href) : router.push(href)),
        }}
      >
        {children}
      </UnsavedChangesContext.Provider>

      {/* Dialog milik project, bukan `window.confirm`. Bedanya bukan gaya:
          dialog bawaan peramban cuma punya "OK" dan "Cancel" yang tidak
          menjelaskan apa pun, sedangkan di sini tombolnya bisa menyebut akibat
          yang sebenarnya — "Buang perubahan". */}
      <ConfirmDialog
        open={tujuan !== null}
        onOpenChange={(open) => {
          if (!open) setTujuan(null);
        }}
        title="Tinggalkan halaman ini?"
        description="Ada perubahan yang belum disimpan. Kalau dilanjutkan, perubahan itu hilang."
        confirmLabel="Buang perubahan"
        cancelLabel="Tetap di sini"
        destructive
        onConfirm={() => {
          const pergi = tujuan;
          setTujuan(null);
          // Tanda dipadamkan lebih dulu supaya penyadap klik tidak menangkap
          // navigasi yang baru saja disetujui orangnya sendiri.
          setBerubah(false);
          if (pergi) router.push(pergi);
        }}
      />
    </div>
  );
}
