import { useState, useEffect, useRef } from "react";
import { Monitor, Apple, Delete } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * TATA LETAK PAPAN KETIK — full-size ANSI 104 tuts.
 *
 * Seluruh ukuran di berkas ini diturunkan dari satu angka: lebar satu tuts
 * normal. Dalam dunia papan ketik satuan itu disebut "1u", dan setiap tuts
 * lain adalah kelipatannya — Tab 1,5u, Caps 1,75u, Shift kiri 2,25u, spasi
 * 6,25u. Angka-angka itu bukan selera, melainkan ukuran baku yang dipakai
 * produsen keycap, dan itulah sebabnya gambar di layar ini bisa ditumpangkan
 * ke papan ketik sungguhan dan tetap pas.
 *
 * Versi sebelumnya memakai `flex-[1.5]`, `flex-[2]`, dan seterusnya. Cara itu
 * membagi RUANG SISA, bukan menetapkan lebar, sehingga lebar sebuah tuts
 * bergantung pada berapa banyak tetangga di barisnya — dua baris dengan
 * jumlah tuts berbeda menghasilkan lebar berbeda untuk tuts yang seharusnya
 * sama besar. Akibatnya kolom antar baris tidak pernah benar-benar lurus.
 * Dengan lebar mutlak seperti sekarang, setiap baris berakhir di titik yang
 * sama dan kolomnya sejajar sempurna.
 */
const UNIT = 40;
const GAP = 6;

/** Lebar sebuah tuts dalam piksel, dari ukurannya dalam satuan "u". */
const keyWidth = (u: number) => u * UNIT + (u - 1) * GAP;

/**
 * Lebar baris terpanjang (baris angka: 13u + Backspace 2u = 15u), dipakai
 * sebagai lebar blok utama. Blok navigasi 3u dan numpad 4u menyusul di
 * kanannya, dipisah jarak sebesar satu tuts.
 */
const MAIN_BLOCK_WIDTH = keyWidth(15);
const NAV_BLOCK_WIDTH = keyWidth(3);
const NUMPAD_BLOCK_WIDTH = keyWidth(4);
const BLOCK_GAP = UNIT;

/**
 * Lebar alami papan ketik sebelum diperkecil — dihitung, bukan ditulis
 * tangan, supaya tidak pernah bisa meleset dari isinya. Kekeliruan semacam
 * itu pernah terjadi di berkas ini: tinggi yang ditebak manual membuat baris
 * bawah terpotong.
 */
const KEYBOARD_NATURAL_WIDTH =
  MAIN_BLOCK_WIDTH + NAV_BLOCK_WIDTH + NUMPAD_BLOCK_WIDTH + BLOCK_GAP * 2;

/**
 * Batas atas pembesaran.
 *
 * Semula batasnya 1, dengan alasan agar papan ketik tidak "melar dan berubah
 * kabur". Alasan itu keliru: kabur adalah gejala `transform: scale()`, yang
 * meregangkan hasil gambar. `zoom` tidak begitu — ia menata ulang isinya pada
 * ukuran baru, sehingga tepi tuts dan hurufnya tetap tajam berapa pun
 * angkanya. Yang tersisa dari batas 1 hanyalah kerugiannya: di layar 1920px
 * papan ketik berhenti di 1074px dan meninggalkan ruang kosong lebar di
 * kanannya.
 *
 * 1,6 dipilih sebagai batas yang masuk akal, bukan tanpa batas. Pada monitor
 * yang sangat lebar, papan ketik yang membentang penuh justru sulit dipakai —
 * mata harus menyapu terlalu jauh untuk mencari tuts yang baru saja ditekan,
 * padahal itu tepat yang dilakukan pengguna di sini. 1,6 membuat tuts tumbuh
 * dari 40px ke 64px: lega di layar besar, masih terbaca sebagai papan ketik
 * dalam satu tangkapan mata.
 */
const MAX_SCALE = 1.6;

type KeyLayout = {
  code: string;
  win: React.ReactNode;
  mac: React.ReactNode;
  /** Lebar tuts dalam satuan "u". Bila kosong, dianggap 1u. */
  u?: number;
  isSpecial?: boolean;
  /** Sisipan kosong di kiri tuts, dalam satuan "u" — untuk celah baris F. */
  gapBefore?: number;
};

const formatKeyName = (e: KeyboardEvent): string => {
  if (e.key === " ") return "Space";
  if (e.key.length === 1) return e.key.toUpperCase();
  return e.key;
};

const KEYBOARD_ROWS: KeyLayout[][] = [
  /* Baris fungsi. `gapBefore` membuat celah Esc | F1–F4 | F5–F8 | F9–F12
     seperti papan ketik sungguhan; tanpa itu tiga belas tuts berjajar rapat
     dan tidak ada patokan bagi mata saat mencari F5. */
  [
    { code: "Escape", win: "Esc", mac: "esc", isSpecial: true },
    { code: "F1", win: "F1", mac: "F1", isSpecial: true, gapBefore: 1 },
    { code: "F2", win: "F2", mac: "F2", isSpecial: true },
    { code: "F3", win: "F3", mac: "F3", isSpecial: true },
    { code: "F4", win: "F4", mac: "F4", isSpecial: true },
    { code: "F5", win: "F5", mac: "F5", isSpecial: true, gapBefore: 0.5 },
    { code: "F6", win: "F6", mac: "F6", isSpecial: true },
    { code: "F7", win: "F7", mac: "F7", isSpecial: true },
    { code: "F8", win: "F8", mac: "F8", isSpecial: true },
    { code: "F9", win: "F9", mac: "F9", isSpecial: true, gapBefore: 0.5 },
    { code: "F10", win: "F10", mac: "F10", isSpecial: true },
    { code: "F11", win: "F11", mac: "F11", isSpecial: true },
    { code: "F12", win: "F12", mac: "F12", isSpecial: true },
  ],
  [
    { code: "Backquote", win: "` ~", mac: "` ~" },
    { code: "Digit1", win: "1 !", mac: "1 !" },
    { code: "Digit2", win: "2 @", mac: "2 @" },
    { code: "Digit3", win: "3 #", mac: "3 #" },
    { code: "Digit4", win: "4 $", mac: "4 $" },
    { code: "Digit5", win: "5 %", mac: "5 %" },
    { code: "Digit6", win: "6 ^", mac: "6 ^" },
    { code: "Digit7", win: "7 &", mac: "7 &" },
    { code: "Digit8", win: "8 *", mac: "8 *" },
    { code: "Digit9", win: "9 (", mac: "9 (" },
    { code: "Digit0", win: "0 )", mac: "0 )" },
    { code: "Minus", win: "- _", mac: "- _" },
    { code: "Equal", win: "= +", mac: "= +" },
    { code: "Backspace", win: <Delete className="h-4 w-4" />, mac: <Delete className="h-4 w-4" />, u: 2, isSpecial: true },
  ],
  [
    { code: "Tab", win: "Tab", mac: "tab", u: 1.5, isSpecial: true },
    { code: "KeyQ", win: "Q", mac: "Q" },
    { code: "KeyW", win: "W", mac: "W" },
    { code: "KeyE", win: "E", mac: "E" },
    { code: "KeyR", win: "R", mac: "R" },
    { code: "KeyT", win: "T", mac: "T" },
    { code: "KeyY", win: "Y", mac: "Y" },
    { code: "KeyU", win: "U", mac: "U" },
    { code: "KeyI", win: "I", mac: "I" },
    { code: "KeyO", win: "O", mac: "O" },
    { code: "KeyP", win: "P", mac: "P" },
    { code: "BracketLeft", win: "[ {", mac: "[ {" },
    { code: "BracketRight", win: "] }", mac: "] }" },
    { code: "Backslash", win: "\\ |", mac: "\\ |", u: 1.5 },
  ],
  [
    { code: "CapsLock", win: "Caps", mac: "caps", u: 1.75, isSpecial: true },
    { code: "KeyA", win: "A", mac: "A" },
    { code: "KeyS", win: "S", mac: "S" },
    { code: "KeyD", win: "D", mac: "D" },
    { code: "KeyF", win: "F", mac: "F" },
    { code: "KeyG", win: "G", mac: "G" },
    { code: "KeyH", win: "H", mac: "H" },
    { code: "KeyJ", win: "J", mac: "J" },
    { code: "KeyK", win: "K", mac: "K" },
    { code: "KeyL", win: "L", mac: "L" },
    { code: "Semicolon", win: "; :", mac: "; :" },
    { code: "Quote", win: "' \"", mac: "' \"" },
    { code: "Enter", win: "Enter", mac: "return", u: 2.25, isSpecial: true },
  ],
  [
    { code: "ShiftLeft", win: "Shift", mac: "shift", u: 2.25, isSpecial: true },
    { code: "KeyZ", win: "Z", mac: "Z" },
    { code: "KeyX", win: "X", mac: "X" },
    { code: "KeyC", win: "C", mac: "C" },
    { code: "KeyV", win: "V", mac: "V" },
    { code: "KeyB", win: "B", mac: "B" },
    { code: "KeyN", win: "N", mac: "N" },
    { code: "KeyM", win: "M", mac: "M" },
    { code: "Comma", win: ", <", mac: ", <" },
    { code: "Period", win: ". >", mac: ". >" },
    { code: "Slash", win: "/ ?", mac: "/ ?" },
    { code: "ShiftRight", win: "Shift", mac: "shift", u: 2.75, isSpecial: true },
  ],
  [
    { code: "ControlLeft", win: "Ctrl", mac: "control", u: 1.25, isSpecial: true },
    { code: "MetaLeft", win: "Win", mac: "command", u: 1.25, isSpecial: true },
    { code: "AltLeft", win: "Alt", mac: "option", u: 1.25, isSpecial: true },
    { code: "Space", win: "", mac: "", u: 6.25 },
    { code: "AltRight", win: "Alt", mac: "option", u: 1.25, isSpecial: true },
    { code: "MetaRight", win: "Win", mac: "command", u: 1.25, isSpecial: true },
    { code: "ContextMenu", win: "Menu", mac: "fn", u: 1.25, isSpecial: true },
    { code: "ControlRight", win: "Ctrl", mac: "control", u: 1.25, isSpecial: true },
  ],
];

/**
 * Blok navigasi, ditulis baris demi baris seperti blok utama.
 *
 * Dulu bagian ini sebuah `grid` dengan lima sel `invisible` yang tugasnya
 * mendorong tuts panah ke tempat yang benar. Sel hantu itu ikut masuk ke DOM
 * dan harus disaring khusus saat menggambar, padahal bentuk yang dituju —
 * dua baris tiga tuts, satu baris berisi panah atas saja, lalu tiga panah
 * bawah — jauh lebih jujur bila dinyatakan sebagai baris biasa.
 *
 * Baris PrtSc/ScrLk/Pause sebelumnya tidak ada sama sekali, padahal ini
 * papan ketik full-size dan ketiganya bagian dari standarnya.
 */
const NAV_ROWS: KeyLayout[][] = [
  [
    { code: "PrintScreen", win: "PrtSc", mac: "F13", isSpecial: true },
    { code: "ScrollLock", win: "ScrLk", mac: "F14", isSpecial: true },
    { code: "Pause", win: "Pause", mac: "F15", isSpecial: true },
  ],
  [
    { code: "Insert", win: "Ins", mac: "ins", isSpecial: true },
    { code: "Home", win: "Home", mac: "home", isSpecial: true },
    { code: "PageUp", win: "PgUp", mac: "pg up", isSpecial: true },
  ],
  [
    { code: "Delete", win: "Del", mac: "del", isSpecial: true },
    { code: "End", win: "End", mac: "end", isSpecial: true },
    { code: "PageDown", win: "PgDn", mac: "pg dn", isSpecial: true },
  ],
  [{ code: "ArrowUp", win: "↑", mac: "↑", gapBefore: 1 }],
  [
    { code: "ArrowLeft", win: "←", mac: "←" },
    { code: "ArrowDown", win: "↓", mac: "↓" },
    { code: "ArrowRight", win: "→", mac: "→" },
  ],
];

/**
 * Numpad tetap sebuah grid — di sinilah grid memang bentuk yang tepat: empat
 * kolom seragam, dengan `+` dan `Enter` membentang dua baris dan `0` dua kolom.
 */
const NUMPAD_GRID: (KeyLayout & { className?: string })[] = [
  { code: "NumLock", win: "Num", mac: "clear", isSpecial: true },
  { code: "NumpadDivide", win: "/", mac: "/" },
  { code: "NumpadMultiply", win: "*", mac: "*" },
  { code: "NumpadSubtract", win: "-", mac: "-" },
  { code: "Numpad7", win: "7", mac: "7" },
  { code: "Numpad8", win: "8", mac: "8" },
  { code: "Numpad9", win: "9", mac: "9" },
  { code: "NumpadAdd", win: "+", mac: "+", className: "row-span-2 h-full" },
  { code: "Numpad4", win: "4", mac: "4" },
  { code: "Numpad5", win: "5", mac: "5" },
  { code: "Numpad6", win: "6", mac: "6" },
  { code: "Numpad1", win: "1", mac: "1" },
  { code: "Numpad2", win: "2", mac: "2" },
  { code: "Numpad3", win: "3", mac: "3" },
  { code: "NumpadEnter", win: "Enter", mac: "enter", className: "row-span-2 h-full", isSpecial: true },
  { code: "Numpad0", win: "0", mac: "0", className: "col-span-2" },
  { code: "NumpadDecimal", win: ".", mac: "." },
];

export function KeyboardTest({ onAction }: { onAction: (action: string) => void }) {
  const [layout, setLayout] = useState<"win" | "mac">("win");
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const [clickedOnceKeys, setClickedOnceKeys] = useState<Set<string>>(new Set());
  
  const lastPressRef = useRef<{ code: string; time: number } | null>(null);
  const doubleClickCounts = useRef<Record<string, number>>({});
  const isHoveredRef = useRef<boolean>(false);

  /**
   * Pengecilan papan ketik agar utuh terlihat tanpa geser mendatar.
   *
   * Dulu blok ini memakai `overflow-x-auto`: di laptop, papan ketik terpotong
   * dan separuh tuts bersembunyi di balik tepi kanan. Untuk alat penguji
   * papan ketik itu cacat yang serius — pengguna perlu MELIHAT tuts yang
   * sedang ditekan, dan tuts yang tersembunyi terbaca seperti tuts rusak.
   *
   * Yang diukur adalah wadah luar, bukan `window.innerWidth`. Lebar yang
   * tersedia untuk papan ketik bergantung pada tata letak induk — di halaman
   * /tools ia hanya kebagian 3 dari 4 kolom karena Log Aktivitas duduk di
   * sebelahnya — jadi lebar jendela bukan angka yang benar untuk dibagi.
   * `ResizeObserver` juga ikut menangkap perubahan yang bukan berasal dari
   * ubah-ukuran jendela, misalnya bilah gulir yang muncul.
   */
  const [scale, setScale] = useState(1);
  /**
   * Pita setinggi nol yang tugasnya HANYA menyediakan lebar untuk diukur.
   *
   * Ia harus terpisah dari elemen yang membungkus papan ketik. `zoom` pada
   * sebuah elemen ikut mengubah ukuran yang dilaporkan induknya, jadi
   * mengukur induk itu berarti mengukur sesuatu yang dipengaruhi oleh
   * hasil pengukuran sebelumnya — umpan balik melingkar.
   *
   * Persis itulah yang terjadi saat halaman diperbesar/diperkecil lewat zoom
   * browser: lebar terukur berubah, `scale` ikut naik, papan ketik membesar,
   * lebar terukur berubah lagi, dan ukurannya berhenti di tempat yang keliru
   * — papan ketik melebar melewati kolomnya. Umpan balik itu kini makin
   * penting dijaga karena `scale` boleh melewati 1, jadi papan ketik benar-
   * benar bisa tumbuh mengejar lebar yang dilaporkan induknya.
   *
   * Pita ini tidak memuat apa pun, sehingga lebarnya selalu murni lebar yang
   * tersedia dari induk, tidak peduli seberapa besar papan ketik di bawahnya.
   */
  const measureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const probe = measureRef.current;
    if (!probe) return;

    const measure = () => {
      const available = probe.clientWidth;
      if (available <= 0) return;
      setScale(
        Math.min(MAX_SCALE, available / KEYBOARD_NATURAL_WIDTH)
      );
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(probe);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isHoveredRef.current) {
        e.preventDefault();
      }
      
      if (e.repeat) return;
      
      const code = e.code;
      const now = Date.now();
      
      setPressedKeys((prev) => {
        const next = new Set(prev);
        next.add(code);
        return next;
      });

      setClickedOnceKeys((prev) => {
        const next = new Set(prev);
        next.add(code);
        return next;
      });

      onAction(formatKeyName(e));

      // Check for double press anomaly
      const lastPress = lastPressRef.current;
      if (lastPress && lastPress.code === code && now - lastPress.time < 400) {
        doubleClickCounts.current[code] = (doubleClickCounts.current[code] || 0) + 1;
        
        if (doubleClickCounts.current[code] > 3) {
          onAction(`[ANOMALY] Suspect double click on ${formatKeyName(e)} key`);
          // Reset count so it doesn't spam infinitely
          doubleClickCounts.current[code] = 0;
        }
        
        lastPressRef.current = null;
      } else {
        lastPressRef.current = { code, time: now };
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (isHoveredRef.current) {
        e.preventDefault();
      }
      setPressedKeys((prev) => {
        const next = new Set(prev);
        next.delete(e.code);
        return next;
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [onAction]);

  /**
   * Menggambar satu tuts.
   *
   * `inGrid` menandai tuts numpad, satu-satunya yang lebarnya TIDAK ditetapkan
   * di sini: di dalam grid, kolomlah yang menentukan lebar, dan memaksakan
   * `width` akan mematahkan `col-span-2` milik tuts `0`.
   */
  const renderKey = (
    key: KeyLayout & { className?: string },
    options?: { inGrid?: boolean }
  ) => {
    const isPressed = pressedKeys.has(key.code);
    const isClickedOnce = clickedOnceKeys.has(key.code);
    const u = key.u ?? 1;

    return (
      <div
        key={key.code}
        style={
          options?.inGrid
            ? { height: UNIT }
            : {
                width: keyWidth(u),
                height: UNIT,
                // Sisipan kosong pembentuk celah baris F dan panah atas.
                // Dipasang sebagai margin, bukan elemen kosong tersendiri,
                // supaya tidak ada simpul hantu di DOM yang harus disaring
                // saat menggambar.
                marginLeft: key.gapBefore ? keyWidth(key.gapBefore) + GAP : undefined,
              }
        }
        className={cn(
          // `items-center` — dulu `items-start`, yang membuat setiap label
          // menempel ke tepi kiri tutsnya. Pada tuts lebar seperti Shift dan
          // spasi, teksnya jadi terlihat jatuh ke pojok alih-alih duduk di
          // tengah keycap sebagaimana pada papan ketik sungguhan.
          "flex select-none items-center justify-center rounded-md border px-1.5 text-center",
          // Transisi hanya untuk warna. Sebelumnya `transition-all`, yang ikut
          // menganimasikan perpindahan posisi saat tuts ditekan sehingga
          // responsnya terasa terlambat — pada alat uji papan ketik, umpan
          // balik tekan harus terasa seketika.
          "transition-colors duration-75",
          key.className,
          isPressed
            ? "border-blue-600 bg-blue-600 text-white shadow-inner"
            : isClickedOnce
              ? "border-blue-500/30 bg-blue-500/15 text-blue-700 dark:text-blue-300 hover:bg-blue-500/25"
              : key.isSpecial
                ? "border-border bg-muted/40 text-muted-foreground hover:bg-blue-500/10"
                : "border-border bg-background text-foreground shadow-sm hover:bg-blue-500/10"
        )}
      >
        {/* Ukuran teks TETAP, tidak bertingkat lewat breakpoint. Papan ketik
            ini hidup di dalam lapisan yang diperkecil, jadi breakpoint di sini
            akan mengukur lebar JENDELA sementara yang menentukan besar
            tampilnya adalah `zoom` — dua ukuran yang tidak sejalan, dan
            hasilnya lompatan ukuran teks di saat yang keliru. */}
        <span
          className={cn(
            "font-medium leading-none",
            // Label panjang ("Pause", "PgDn", "command") diberi ukuran lebih
            // kecil agar muat tanpa terpotong di tuts selebar 1u.
            key.isSpecial ? "text-[11px]" : "text-[13px]"
          )}
        >
          {layout === "win" ? key.win : key.mac}
        </span>
      </div>
    );
  };

  /* Padding dikurangi di laptop dan baru melebar di layar besar. Setiap piksel
     yang dihemat di sini langsung menaikkan skala papan ketik, karena wadah
     yang diukur adalah bagian dalam padding ini. */
  return (
    <div
      className="flex flex-col h-full bg-muted/10 p-4 xl:p-8 2xl:p-10 focus:outline-none"
      onMouseEnter={() => isHoveredRef.current = true}
      onMouseLeave={() => isHoveredRef.current = false}
      tabIndex={0}
    >
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold">Tes Keyboard</h2>
          <p className="text-muted-foreground text-sm">Tekan tombol apa saja. Kami mendeteksi gejala double click secara otomatis.</p>
        </div>
        
        <div className="flex items-center space-x-1 bg-muted p-1 rounded-lg">
          <button
            onClick={() => setLayout("win")}
            className={cn(
              "flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm transition-colors",
              layout === "win" ? "bg-background shadow-sm" : "text-muted-foreground hover:bg-background/50"
            )}
          >
            <Monitor className="w-4 h-4" />
            <span>Windows</span>
          </button>
          <button
            onClick={() => setLayout("mac")}
            className={cn(
              "flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm transition-colors",
              layout === "mac" ? "bg-background shadow-sm" : "text-muted-foreground hover:bg-background/50"
            )}
          >
            <Apple className="w-4 h-4" />
            <span>Mac</span>
          </button>
        </div>
      </div>

      <div className="w-full">
        {/* Pita pengukur — lihat `measureRef`. Setinggi nol dan kosong, jadi
            tidak menambah apa pun ke tampilan; keberadaannya semata agar ada
            lebar yang bisa diukur tanpa terpengaruh `zoom` papan ketik. */}
        <div ref={measureRef} className="h-0 w-full" aria-hidden />
        {/* Papan ketik: SELALU ditata pada `KEYBOARD_NATURAL_WIDTH`, apa pun
            lebar layarnya, lalu `zoom` yang menyesuaikannya dengan ruang yang
            ada. Tata letak di dalamnya karena itu tidak pernah berpindah
            breakpoint dan proporsi antar tuts terjaga persis — dan proporsi
            itulah inti alat ini: pengguna mencocokkan gambar di layar dengan
            papan ketik fisik di depannya.

            `zoom`, BUKAN `transform: scale()`. Keduanya memperkecil tampilan,
            tapi `transform` tidak mengubah ruang yang dipesan elemen di alur
            tata letak, sehingga tingginya harus dikoreksi tangan. Koreksi itu
            sempat ditebak 304px — kurang dari tinggi sebenarnya — dan bersama
            `overflow-hidden` yang menyertainya, kekurangan itu memotong baris
            Ctrl–Space beserta baris bawah numpad di laptop.

            `zoom` mengubah ukuran tata letaknya sungguhan, jadi tingginya ikut
            menyesuaikan sendiri: tidak ada tinggi yang perlu dihitung, dan
            tidak ada yang memangkas apa pun. Itu pula yang membuatnya aman
            dipakai untuk MEMBESARKAN, bukan hanya mengecilkan — isinya ditata
            ulang pada ukuran baru, sehingga tetap tajam.

            `mx-auto` menengahkan papan ketik saat pembesaran sudah mentok di
            `MAX_SCALE` dan masih tersisa ruang di kanan-kirinya. */}
        <div
          className="mx-auto flex"
          style={{
            width: KEYBOARD_NATURAL_WIDTH,
            gap: BLOCK_GAP,
            // SELALU disetel, berapa pun nilainya. Melepas properti ini pada
            // nilai tertentu akan mengubah lebar yang terukur tepat di ambang
            // itu, dan pengukuran berikutnya bisa memasangnya kembali —
            // ukurannya lalu bergetar bolak-balik di sekitar ambang tersebut.
            zoom: scale,
          }}
        >
          {/* Blok utama */}
          <div
            className="flex shrink-0 flex-col"
            style={{ width: MAIN_BLOCK_WIDTH, gap: GAP }}
          >
            {KEYBOARD_ROWS.map((row, i) => (
              <div
                key={i}
                className="flex"
                style={{
                  gap: GAP,
                  // Jarak ekstra di bawah baris fungsi. Pada papan ketik
                  // sungguhan baris itu memang terpisah dari blok angka, dan
                  // celah inilah yang membuat keduanya terbaca sebagai dua
                  // kelompok, bukan satu tumpukan enam baris.
                  marginBottom: i === 0 ? GAP * 2 : undefined,
                }}
              >
                {row.map((key) => renderKey(key))}
              </div>
            ))}
          </div>

          {/* Blok navigasi. `marginTop` menyejajarkannya dengan baris angka —
              sama seperti blok utama, baris teratasnya (PrtSc) sejajar dengan
              baris fungsi, lalu ikut turun sejauh celah yang sama. */}
          <div
            className="flex shrink-0 flex-col"
            style={{ width: NAV_BLOCK_WIDTH, gap: GAP }}
          >
            {NAV_ROWS.map((row, i) => (
              <div
                key={i}
                className="flex"
                style={{
                  gap: GAP,
                  marginBottom: i === 0 ? GAP * 2 : undefined,
                  // Baris panah atas duduk langsung di atas panah bawah,
                  // menyisakan satu baris kosong di antara PgDn dan panah —
                  // persis seperti papan ketik full-size.
                  marginTop: i === 3 ? UNIT + GAP : undefined,
                }}
              >
                {row.map((key) => renderKey(key))}
              </div>
            ))}
          </div>

          {/* Numpad. Baris teratasnya sejajar dengan baris angka, jadi ia
              turun sejauh satu baris fungsi ditambah celah kelompoknya. */}
          <div
            className="grid shrink-0 grid-cols-4 grid-rows-5"
            style={{
              width: NUMPAD_BLOCK_WIDTH,
              gap: GAP,
              marginTop: UNIT + GAP * 2,
            }}
          >
            {NUMPAD_GRID.map((key) => renderKey(key, { inGrid: true }))}
          </div>
        </div>
      </div>
    </div>
  );
}
