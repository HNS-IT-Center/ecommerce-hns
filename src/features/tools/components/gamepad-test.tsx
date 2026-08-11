import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  PS_LAYOUT,
  XBOX_LAYOUT,
  type GamepadLayout,
  type SpriteBox,
} from "./gamepad-layouts";

type Layout = "xbox" | "ps";

const STANDARD_MAPPING = {
  0: { xbox: "A", ps: "Cross" },
  1: { xbox: "B", ps: "Circle" },
  2: { xbox: "X", ps: "Square" },
  3: { xbox: "Y", ps: "Triangle" },
  4: { xbox: "LB", ps: "L1" },
  5: { xbox: "RB", ps: "R1" },
  6: { xbox: "LT", ps: "L2" },
  7: { xbox: "RT", ps: "R2" },
  8: { xbox: "View", ps: "Share" },
  9: { xbox: "Menu", ps: "Options" },
  10: { xbox: "LS", ps: "L3" },
  11: { xbox: "RS", ps: "R3" },
  12: { xbox: "D-Pad Up", ps: "Up" },
  13: { xbox: "D-Pad Down", ps: "Down" },
  14: { xbox: "D-Pad Left", ps: "Left" },
  15: { xbox: "D-Pad Right", ps: "Right" },
  16: { xbox: "Xbox", ps: "PS" },
  17: { xbox: "", ps: "Touchpad" },
};

/**
 * Ambang batas gerak analog sebelum dianggap "digerakkan".
 *
 * Stick analog JARANG kembali tepat ke 0 — selalu ada sisa 0.01–0.05 karena
 * keausan mekanis. Tanpa ambang ini, log akan terus terisi sendiri walau
 * pengguna tidak menyentuh apa pun (stick drift).
 */
const AXIS_DEADZONE = 0.15;

/** Arah stick sebagai kata, untuk log yang bisa dibaca manusia. */
function describeDirection(x: number, y: number): string {
  const parts: string[] = [];
  if (y < -AXIS_DEADZONE) parts.push("Up");
  if (y > AXIS_DEADZONE) parts.push("Down");
  if (x < -AXIS_DEADZONE) parts.push("Left");
  if (x > AXIS_DEADZONE) parts.push("Right");
  return parts.join("-");
}

/** Posisi absolut dari kotak persen — dipakai semua sprite. */
function boxStyle(box: SpriteBox): React.CSSProperties {
  return {
    left: `${box.left}%`,
    top: `${box.top}%`,
    width: `${box.width}%`,
    height: `${box.height}%`,
  };
}

export function GamepadTest({ onAction }: { onAction: (action: string) => void }) {
  const [layout, setLayout] = useState<Layout>("xbox");
  const [isConnected, setIsConnected] = useState(false);
  const [controllerName, setControllerName] = useState("");
  const [buttons, setButtons] = useState<readonly GamepadButton[]>([]);
  const [axes, setAxes] = useState<readonly number[]>([]);

  const requestRef = useRef<number>(0);
  const prevButtonsRef = useRef<boolean[]>([]);
  const connectedGamepadRef = useRef<string | null>(null);
  /** Arah stick pada frame sebelumnya — supaya log hanya saat arahnya BERUBAH. */
  const prevStickDirRef = useRef<[string, string]>(["", ""]);

  const pollGamepads = useCallback(() => {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = Array.from(gamepads).find((g) => g !== null);

    if (gp) {
      if (connectedGamepadRef.current !== gp.id) {
        connectedGamepadRef.current = gp.id;
        setIsConnected(true);
        setControllerName(gp.id);
        onAction(`Connected: ${gp.id}`);
      }

      setButtons([...gp.buttons]);
      setAxes([...gp.axes]);

      gp.buttons.forEach((b, index) => {
        const wasPressed = prevButtonsRef.current[index] || false;
        if (b.pressed && !wasPressed) {
          const mapping = STANDARD_MAPPING[index as keyof typeof STANDARD_MAPPING];
          const btnName = mapping ? mapping[layout] : `Button ${index}`;
          if (btnName) onAction(btnName);
        }
        prevButtonsRef.current[index] = b.pressed;
      });

      /**
       * Log gerak analog hanya saat ARAHNYA berubah, bukan tiap frame.
       *
       * Polling berjalan di `requestAnimationFrame` (~60x/detik). Mencatat
       * setiap frame akan membanjiri log dengan ratusan baris identik hanya
       * karena stick ditahan sebentar.
       */
      const sticks: [number, number][] = [
        [gp.axes[0] ?? 0, gp.axes[1] ?? 0],
        [gp.axes[2] ?? 0, gp.axes[3] ?? 0],
      ];
      sticks.forEach(([x, y], i) => {
        const dir = describeDirection(x, y);
        if (dir !== prevStickDirRef.current[i]) {
          if (dir) {
            const label =
              i === 0
                ? layout === "xbox" ? "Left Stick" : "L3 Stick"
                : layout === "xbox" ? "Right Stick" : "R3 Stick";
            onAction(`${label}: ${dir}`);
          }
          prevStickDirRef.current[i] = dir;
        }
      });
    } else if (connectedGamepadRef.current !== null) {
      connectedGamepadRef.current = null;
      setIsConnected(false);
      onAction("Disconnected");
    }

  }, [layout, onAction]);

  /**
   * Jembatan agar loop animasi selalu memanggil `pollGamepads` versi TERBARU.
   *
   * Dulu `pollGamepads` menjadwalkan dirinya sendiri di baris terakhirnya.
   * Itu memanggil variabel yang belum selesai dideklarasikan — persis yang
   * dikeluhkan aturan `react-hooks/immutability`, dan build Vercel menolaknya.
   *
   * Cacatnya bukan sekadar formalitas lint. `pollGamepads` dibuat ulang tiap
   * kali `layout` atau `onAction` berubah, sedangkan loop yang sudah berjalan
   * memegang salinan LAMA dan terus memanggil salinan itu selamanya. Akibat
   * nyatanya: berganti tata letak Xbox ⇄ PlayStation saat gamepad tersambung
   * tetap mencatat nama tombol dengan penamaan yang lama.
   *
   * Ref ini selalu menunjuk versi terkini, sehingga loop membaca yang benar
   * pada setiap frame tanpa perlu dimulai ulang.
   */
  const pollGamepadsRef = useRef(pollGamepads);
  useEffect(() => {
    pollGamepadsRef.current = pollGamepads;
  }, [pollGamepads]);

  /**
   * Efek ini sengaja berdependensi kosong: loop dinyalakan SEKALI selama
   * komponen hidup. Menjadikannya bergantung pada `pollGamepads` akan
   * membatalkan lalu menyalakan ulang loop tiap kali tata letak diganti —
   * kedipan yang tidak perlu, dan sekarang tidak perlu pula karena versi
   * terbaru sudah dijangkau lewat ref.
   */
  useEffect(() => {
    const tick = () => {
      pollGamepadsRef.current();
      requestRef.current = requestAnimationFrame(tick);
    };

    requestRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(requestRef.current);
  }, []);

  const active: GamepadLayout = layout === "xbox" ? XBOX_LAYOUT : PS_LAYOUT;

  // Indeks 10/11 = klik stick (L3/R3); gerakannya sendiri dari `axes`.
  const leftPressed = buttons[10]?.pressed ?? false;
  const rightPressed = buttons[11]?.pressed ?? false;

  const stickOffset = (
    stick: GamepadLayout["sticks"]["left"],
    x: number,
    y: number
  ): React.CSSProperties => {
    // Nilai mentah dipakai apa adanya (bukan dibulatkan ke deadzone) supaya
    // gerakannya halus; deadzone hanya menyaring LOG, bukan tampilan.
    const style = boxStyle(stick.cap);
    return {
      ...style,
      transform: `translate(${x * stick.travelX}%, ${y * stick.travelY}%)`,
      // Tanpa ini tutup analog "melayang" karena transform dihitung ulang tiap
      // frame; transisi pendek membuatnya terasa mengikuti tangan.
      transition: "transform 40ms linear",
    };
  };

  const lx = axes[0] ?? 0;
  const ly = axes[1] ?? 0;
  const rx = axes[2] ?? 0;
  const ry = axes[3] ?? 0;

  return (
    <div className="flex flex-col h-full bg-muted/10 p-6 sm:p-10 min-h-[500px]">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold">Tes Gamepad</h2>
          <p
            className="text-muted-foreground text-sm truncate max-w-[200px] sm:max-w-md"
            title={controllerName}
          >
            {isConnected ? controllerName : "Sambungkan gamepad, lalu tekan tombol apa saja untuk memulai"}
          </p>
        </div>

        <div className="flex items-center space-x-1 bg-muted p-1 rounded-lg">
          <button
            onClick={() => setLayout("xbox")}
            className={cn(
              "flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm transition-colors font-semibold",
              layout === "xbox" ? "bg-background shadow-sm" : "text-muted-foreground hover:bg-background/50"
            )}
          >
            <span className="text-green-600">X</span>BOX
          </button>
          <button
            onClick={() => setLayout("ps")}
            className={cn(
              "flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm transition-colors font-semibold",
              layout === "ps" ? "bg-background shadow-sm" : "text-muted-foreground hover:bg-background/50"
            )}
          >
            <span className="text-blue-600">P</span>S
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center">
        {/*
          Pembungkus memakai `aspectRatio` kanvas sumber. Semua sprite di
          dalamnya diposisikan dengan persen, jadi seluruh susunan ikut
          menskala bersama pembungkus tanpa satu pun angka perlu disesuaikan.
        */}
        <div
          className="relative w-full max-w-[640px]"
          style={{ aspectRatio: active.aspectRatio }}
        >
          <img
            src={active.base}
            alt={layout === "xbox" ? "Xbox Controller" : "PlayStation Controller"}
            className="absolute inset-0 h-full w-full object-contain z-0 drop-shadow-2xl pointer-events-none"
          />

          {/* Soket stick saat ditekan (L3/R3) */}
          {leftPressed && (
            <img
              src={active.sticks.left.clickSrc}
              alt=""
              style={boxStyle(active.sticks.left.click)}
              className="absolute object-contain z-10 pointer-events-none"
            />
          )}
          {rightPressed && (
            <img
              src={active.sticks.right.clickSrc}
              alt=""
              style={boxStyle(active.sticks.right.click)}
              className="absolute object-contain z-10 pointer-events-none"
            />
          )}

          {/* Tutup analog — bergerak mengikuti axes */}
          <img
            src={active.sticks.left.src}
            alt=""
            style={stickOffset(active.sticks.left, lx, ly)}
            className="absolute object-contain z-20 pointer-events-none"
          />
          <img
            src={active.sticks.right.src}
            alt=""
            style={stickOffset(active.sticks.right, rx, ry)}
            className="absolute object-contain z-20 pointer-events-none"
          />

          {/* Tombol yang sedang ditekan */}
          {buttons.map((b, i) => {
            const sprite = active.buttons[i];
            if (!b.pressed || !sprite) return null;
            return (
              <img
                key={`${layout}-${i}`}
                src={sprite.src}
                alt=""
                style={boxStyle(sprite.box)}
                className="absolute object-contain z-30 pointer-events-none"
              />
            );
          })}
        </div>
      </div>

      {/* Nilai axes mentah — berguna untuk mendeteksi stick drift. */}
      {isConnected && (
        <div className="mt-6 grid grid-cols-2 gap-3 text-xs font-mono sm:max-w-md sm:mx-auto w-full">
          <div className="rounded-lg border border-border bg-background/50 px-3 py-2">
            <span className="text-muted-foreground">
              {layout === "xbox" ? "Left Stick" : "L3"}
            </span>
            <div className="tabular-nums">
              X {lx.toFixed(2)} · Y {ly.toFixed(2)}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-background/50 px-3 py-2">
            <span className="text-muted-foreground">
              {layout === "xbox" ? "Right Stick" : "R3"}
            </span>
            <div className="tabular-nums">
              X {rx.toFixed(2)} · Y {ry.toFixed(2)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
