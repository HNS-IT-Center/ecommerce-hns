import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type LogEntry = {
  id: string;
  timestamp: Date;
  device: "Keyboard" | "Mouse" | "Gamepad";
  action: string;
};

export function ActivityLog({ logs, onClear }: { logs: LogEntry[]; onClear: () => void }) {
  return (
    <div className="flex flex-col h-full bg-muted/20 border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-border bg-background">
        <h3 className="font-semibold">Activity Log</h3>
        <button
          onClick={onClear}
          disabled={logs.length === 0}
          className="text-muted-foreground hover:text-accent disabled:opacity-50 transition-colors p-1"
          aria-label="Clear logs"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono">
        {logs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground opacity-50 text-sm">
            Waiting for input...
          </div>
        ) : (
          logs.map((log) => (
            <div 
              key={log.id} 
              className={cn(
                "flex justify-between items-center py-2 px-3 rounded-lg border border-border/50 bg-background/50 animate-in fade-in slide-in-from-top-2",
                log.action.includes("Anomaly") && "bg-destructive/10 border-destructive/20"
              )}
            >
              <div className="flex items-center gap-2">
                <span className={cn(
                  "font-bold text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded",
                  log.device === "Keyboard" ? "bg-blue-500/10 text-blue-500" :
                  log.device === "Mouse" ? "bg-green-500/10 text-green-500" :
                  "bg-purple-500/10 text-purple-500"
                )}>
                  {log.device}
                </span>
                <span className={cn(
                  "text-sm font-medium",
                  log.action.includes("Anomaly") && "text-destructive"
                )}>
                  {log.action}
                </span>
              </div>
              <span className="text-muted-foreground text-[10px] whitespace-nowrap ml-2">
                {format(log.timestamp, "HH:mm:ss")}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
