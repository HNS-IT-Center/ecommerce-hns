import { useState, useEffect, useRef } from "react";
import { Monitor, Apple, Delete } from "lucide-react";
import { cn } from "@/lib/utils";

type KeyLayout = {
  code: string;
  win: React.ReactNode;
  mac: React.ReactNode;
  flex?: string;
  isSpecial?: boolean;
};

const formatKeyName = (e: KeyboardEvent): string => {
  if (e.key === " ") return "Space";
  if (e.key.length === 1) return e.key.toUpperCase();
  return e.key;
};

const KEYBOARD_ROWS: KeyLayout[][] = [
  [
    { code: "Escape", win: "Esc", mac: "esc", isSpecial: true },
    { code: "F1", win: "F1", mac: "F1", isSpecial: true },
    { code: "F2", win: "F2", mac: "F2", isSpecial: true },
    { code: "F3", win: "F3", mac: "F3", isSpecial: true },
    { code: "F4", win: "F4", mac: "F4", isSpecial: true },
    { code: "F5", win: "F5", mac: "F5", isSpecial: true },
    { code: "F6", win: "F6", mac: "F6", isSpecial: true },
    { code: "F7", win: "F7", mac: "F7", isSpecial: true },
    { code: "F8", win: "F8", mac: "F8", isSpecial: true },
    { code: "F9", win: "F9", mac: "F9", isSpecial: true },
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
    { code: "Backspace", win: <Delete className="w-5 h-5 mx-auto" />, mac: <Delete className="w-5 h-5 mx-auto" />, flex: "flex-[1.5]", isSpecial: true },
  ],
  [
    { code: "Tab", win: "Tab", mac: "tab", flex: "flex-[1.5]", isSpecial: true },
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
    { code: "Backslash", win: "\\ |", mac: "\\ |", flex: "flex-[1]" },
  ],
  [
    { code: "CapsLock", win: "Caps Lock", mac: "caps lock", flex: "flex-[1.8]", isSpecial: true },
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
    { code: "Enter", win: "Enter", mac: "return", flex: "flex-[2]", isSpecial: true },
  ],
  [
    { code: "ShiftLeft", win: "Shift", mac: "shift", flex: "flex-[2.5]", isSpecial: true },
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
    { code: "ShiftRight", win: "Shift", mac: "shift", flex: "flex-[2.5]", isSpecial: true },
  ],
  [
    { code: "ControlLeft", win: "Ctrl", mac: "control", flex: "flex-[1.2]", isSpecial: true },
    { code: "MetaLeft", win: "Win", mac: "command", flex: "flex-[1.2]", isSpecial: true },
    { code: "AltLeft", win: "Alt", mac: "option", flex: "flex-[1.2]", isSpecial: true },
    { code: "Space", win: "", mac: "", flex: "flex-[6]" },
    { code: "AltRight", win: "Alt", mac: "option", flex: "flex-[1.2]", isSpecial: true },
    { code: "MetaRight", win: "Win", mac: "command", flex: "flex-[1.2]", isSpecial: true },
    { code: "ContextMenu", win: "Menu", mac: "fn", flex: "flex-[1.2]", isSpecial: true },
    { code: "ControlRight", win: "Ctrl", mac: "control", flex: "flex-[1.2]", isSpecial: true },
  ],
];

const NUMPAD_GRID = [
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
  { code: "Numpad0", win: "0", mac: "0", className: "col-span-2 w-full" },
  { code: "NumpadDecimal", win: ".", mac: "." },
];

const NAV_GRID = [
  { code: "Insert", win: "Ins", mac: "ins", isSpecial: true },
  { code: "Home", win: "Home", mac: "home", isSpecial: true },
  { code: "PageUp", win: "PgUp", mac: "pg up", isSpecial: true },
  { code: "Delete", win: "Del", mac: "del", isSpecial: true },
  { code: "End", win: "End", mac: "end", isSpecial: true },
  { code: "PageDown", win: "PgDn", mac: "pg dn", isSpecial: true },
  { code: "empty1", win: "", mac: "", className: "invisible" },
  { code: "empty2", win: "", mac: "", className: "invisible" },
  { code: "empty3", win: "", mac: "", className: "invisible" },
  { code: "empty4", win: "", mac: "", className: "invisible" },
  { code: "ArrowUp", win: "↑", mac: "↑" },
  { code: "empty5", win: "", mac: "", className: "invisible" },
  { code: "ArrowLeft", win: "←", mac: "←" },
  { code: "ArrowDown", win: "↓", mac: "↓" },
  { code: "ArrowRight", win: "→", mac: "→" },
];

export function KeyboardTest({ onAction }: { onAction: (action: string) => void }) {
  const [layout, setLayout] = useState<"win" | "mac">("win");
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const [clickedOnceKeys, setClickedOnceKeys] = useState<Set<string>>(new Set());
  
  const lastPressRef = useRef<{ code: string; time: number } | null>(null);
  const doubleClickCounts = useRef<Record<string, number>>({});
  const isHoveredRef = useRef<boolean>(false);

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

  const renderKey = (key: KeyLayout & { className?: string }) => {
    if (key.code.startsWith("empty")) {
       return <div key={key.code} className={key.className} />;
    }

    const isPressed = pressedKeys.has(key.code);
    const isClickedOnce = clickedOnceKeys.has(key.code);
    
    return (
      <div
        key={key.code}
        className={cn(
          "flex flex-col items-start justify-center px-2 py-3 rounded-lg border shadow-sm transition-all duration-75 min-w-[40px] select-none",
          key.flex ? key.flex : "flex-1",
          key.className,
          isPressed 
            ? "bg-blue-600 border-blue-700 text-white shadow-inner translate-y-[2px]" 
            : isClickedOnce
              ? "bg-blue-500/20 border-blue-500/30 text-blue-700 dark:text-blue-300 hover:bg-blue-500/30"
              : "bg-background border-border text-foreground hover:bg-blue-500/10",
          key.isSpecial && !isPressed && !isClickedOnce ? "bg-muted/30" : ""
        )}
      >
        <span className={cn(
          "text-xs md:text-sm font-medium",
          key.isSpecial ? "text-[10px] md:text-xs text-muted-foreground" : "",
          isPressed ? "text-white" : isClickedOnce ? "text-blue-700 dark:text-blue-300" : ""
        )}>
          {layout === "win" ? key.win : key.mac}
        </span>
      </div>
    );
  };

  return (
    <div 
      className="flex flex-col h-full bg-muted/10 p-6 sm:p-10 focus:outline-none"
      onMouseEnter={() => isHoveredRef.current = true}
      onMouseLeave={() => isHoveredRef.current = false}
      tabIndex={0}
    >
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold">Keyboard Tester</h2>
          <p className="text-muted-foreground text-sm">Press any key. We will catch double click anomalies automatically.</p>
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

      <div className="w-full max-w-[1400px] mx-auto flex gap-6 overflow-x-auto pb-4">
        {/* Main Keyboard Section */}
        <div className="flex-1 space-y-2 min-w-[700px]">
          {KEYBOARD_ROWS.map((row, i) => (
            <div key={i} className="flex gap-2 w-full">
              {row.map(renderKey)}
            </div>
          ))}
        </div>

        {/* Navigation / Arrow Keys Section */}
        <div className="grid grid-cols-3 gap-2 w-[180px] shrink-0 grid-rows-5 mt-[3.25rem]">
          {NAV_GRID.map(renderKey)}
        </div>

        {/* Numpad Section */}
        <div className="grid grid-cols-4 gap-2 w-64 shrink-0 grid-rows-5 mt-[3.25rem]">
          {NUMPAD_GRID.map(renderKey)}
        </div>
      </div>
    </div>
  );
}
