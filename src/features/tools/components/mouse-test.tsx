import { useState, MouseEvent as ReactMouseEvent, WheelEvent, useCallback, useEffect, useRef } from "react";
import { MousePointer2, Mouse as MouseIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type MouseButton = "left" | "right" | "middle" | "back" | "forward" | null;

export function MouseTest({ onAction }: { onAction: (action: string) => void }) {
  const [activeButtons, setActiveButtons] = useState<Set<MouseButton>>(new Set());
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [scrollDelta, setScrollDelta] = useState(0);
  
  const doubleClickCounts = useRef<Record<string, number>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  // Use a native event listener with passive: false to reliably block scrolling
  useEffect(() => {
    const handleNativeWheel = (e: globalThis.WheelEvent) => {
      e.preventDefault();
    };
    
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleNativeWheel, { passive: false });
    }
    return () => {
      if (container) {
        container.removeEventListener('wheel', handleNativeWheel);
      }
    };
  }, []);

  const getButtonName = (button: number): MouseButton => {
    switch (button) {
      case 0: return "left";
      case 1: return "middle";
      case 2: return "right";
      case 3: return "back";
      case 4: return "forward";
      default: return null;
    }
  };

  const handleMouseDown = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
    const btn = getButtonName(e.button);
    if (btn) {
      setActiveButtons(prev => {
        const next = new Set(prev);
        next.add(btn);
        return next;
      });
      onAction(`${btn.charAt(0).toUpperCase() + btn.slice(1)} Click`);
    }
  }, [onAction]);

  const handleMouseUp = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
    const btn = getButtonName(e.button);
    if (btn) {
      setActiveButtons(prev => {
        const next = new Set(prev);
        next.delete(btn);
        return next;
      });
    }
  }, []);

  const handleDoubleClick = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
    const btn = getButtonName(e.button);
    if (btn) {
      doubleClickCounts.current[btn] = (doubleClickCounts.current[btn] || 0) + 1;
      
      if (doubleClickCounts.current[btn] > 3) {
        onAction(`[ANOMALY] Suspect double click on ${btn.charAt(0).toUpperCase() + btn.slice(1)} Click`);
        doubleClickCounts.current[btn] = 0; // reset
      }
    }
  }, [onAction]);

  const handleMouseMove = useCallback((e: ReactMouseEvent) => {
    e.preventDefault(); // Prevents selection
    setCoords({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY });
  }, []);

  const handleWheel = useCallback((e: WheelEvent) => {
    const direction = e.deltaY > 0 ? "Down" : "Up";
    setScrollDelta(prev => prev + e.deltaY);
    onAction(`Scroll ${direction}`);
  }, [onAction]);
  
  // Clear scroll delta after a bit
  useEffect(() => {
    if (scrollDelta !== 0) {
      const timer = setTimeout(() => setScrollDelta(0), 150);
      return () => clearTimeout(timer);
    }
  }, [scrollDelta]);

  return (
    <div className="flex flex-col h-full bg-muted/10 p-6 sm:p-10">
      <div className="mb-8">
        <h2 className="text-2xl font-bold">Tes Mouse</h2>
        <p className="text-muted-foreground text-sm">Klik, scroll, dan gerakkan mouse di area bawah ini. Pintasan browser dinonaktifkan di sini.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 h-[400px]">
        {/* Interactive Area */}
        <div 
          ref={containerRef}
          className="md:col-span-2 relative bg-background border-2 border-dashed border-border rounded-xl overflow-hidden cursor-crosshair group flex items-center justify-center transition-colors hover:border-primary/50"
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          onDoubleClick={handleDoubleClick}
          onContextMenu={(e) => e.preventDefault()}
          onWheel={handleWheel}
        >
          <div className="absolute inset-0 pointer-events-none opacity-5 flex items-center justify-center">
            <MousePointer2 className="w-48 h-48" />
          </div>
          
          <div className="z-10 text-center pointer-events-none">
            <p className="font-mono text-xl font-bold text-primary">
              X: {Math.round(coords.x)} Y: {Math.round(coords.y)}
            </p>
            <p className="text-muted-foreground mt-2">Area Tes</p>
          </div>
          
          {/* Mouse follower */}
          <div 
            className="absolute w-4 h-4 rounded-full bg-accent/50 pointer-events-none -translate-x-1/2 -translate-y-1/2 transition-opacity opacity-0 group-hover:opacity-100"
            style={{ left: coords.x, top: coords.y }}
          />
        </div>

        {/* Visual Mouse Graphic */}
        <div className="flex flex-col items-center justify-center space-y-6">
          <div className="relative w-40 h-64 bg-background border-4 border-border rounded-full p-2 flex flex-col items-center justify-start pt-6 shadow-sm">
            
            <div className="flex w-full px-2 gap-2 h-20">
              {/* Left Button */}
              <div className={cn(
                "flex-1 rounded-t-3xl rounded-bl-sm rounded-br-3xl transition-colors duration-75 border-2",
                activeButtons.has("left") ? "bg-accent border-accent shadow-inner" : "bg-muted/50 border-border hover:bg-muted"
              )} />
              
              {/* Middle / Scroll */}
              <div className="w-6 flex items-center justify-center">
                <div className={cn(
                  "w-4 rounded-full transition-all duration-75 border border-border/50",
                  activeButtons.has("middle") ? "h-10 bg-accent" : "h-12 bg-muted-foreground/30",
                  scrollDelta < 0 ? "-translate-y-2" : scrollDelta > 0 ? "translate-y-2" : ""
                )} />
              </div>
              
              {/* Right Button */}
              <div className={cn(
                "flex-1 rounded-t-3xl rounded-br-sm rounded-bl-3xl transition-colors duration-75 border-2",
                activeButtons.has("right") ? "bg-accent border-accent shadow-inner" : "bg-muted/50 border-border hover:bg-muted"
              )} />
            </div>
            
            <div className="mt-8 flex gap-4 opacity-50">
               <MouseIcon className="w-8 h-8 text-muted-foreground" />
            </div>
            
            {/* Side buttons */}
            <div className="absolute left-[-12px] top-24 flex flex-col gap-2">
              <div className={cn(
                "w-3 h-8 rounded-l-md border-y border-l transition-colors duration-75",
                activeButtons.has("forward") ? "bg-accent border-accent" : "bg-muted border-border"
              )} />
              <div className={cn(
                "w-3 h-8 rounded-l-md border-y border-l transition-colors duration-75",
                activeButtons.has("back") ? "bg-accent border-accent" : "bg-muted border-border"
              )} />
            </div>
            
          </div>
          
          <div className="text-center text-sm text-muted-foreground">
            <p>Respons Tombol Fisik</p>
          </div>
        </div>
      </div>
    </div>
  );
}
