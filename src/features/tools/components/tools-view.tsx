"use client";

import { useState, useEffect } from "react";
import { KeyboardTest } from "./keyboard-test";
import { MouseTest } from "./mouse-test";
import { GamepadTest } from "./gamepad-test";
import { ActivityLog, type LogEntry } from "./activity-log";
import { Monitor, Mouse, Gamepad2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "keyboard" | "mouse" | "gamepad";

export function ToolsView() {
  const [activeTab, setActiveTab] = useState<Tab>("keyboard");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const addLog = (device: "Keyboard" | "Mouse" | "Gamepad", action: string) => {
    setLogs((prev) => {
      const uniqueId = Date.now().toString() + "-" + Math.random().toString(36).substr(2, 9);
      const newLogs = [{ id: uniqueId, timestamp: new Date(), device, action }, ...prev];
      return newLogs.slice(0, 50); // Keep first 50 logs
    });
  };

  if (isMobile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6 bg-muted/30 rounded-2xl border border-border">
        <Monitor className="w-12 h-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold mb-2">Hanya Tersedia di Desktop</h2>
        <p className="text-muted-foreground max-w-md">
          Alat tes hardware ini membutuhkan keyboard, mouse, atau gamepad fisik agar bisa
          berfungsi. Silakan buka halaman ini lewat komputer atau laptop.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-3 space-y-6">
        <div className="flex space-x-2 bg-muted/50 p-1.5 rounded-xl overflow-x-auto">
          {[
            { id: "keyboard", icon: Monitor, label: "Keyboard" },
            { id: "mouse", icon: Mouse, label: "Mouse" },
            { id: "gamepad", icon: Gamepad2, label: "Gamepad" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as Tab);
                setLogs([]); // clear logs on switch
              }}
              className={cn(
                "flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex-1 justify-center min-w-[120px]",
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
              )}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="bg-background rounded-2xl border border-border overflow-hidden">
          {activeTab === "keyboard" && <KeyboardTest onAction={(action) => addLog("Keyboard", action)} />}
          {activeTab === "mouse" && <MouseTest onAction={(action) => addLog("Mouse", action)} />}
          {activeTab === "gamepad" && <GamepadTest onAction={(action) => addLog("Gamepad", action)} />}
        </div>
      </div>

      <div className="lg:col-span-1 h-[600px]">
        <ActivityLog logs={logs} onClear={() => setLogs([])} />
      </div>
    </div>
  );
}
