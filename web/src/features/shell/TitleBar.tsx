import { useState } from "react";
import { PanelLeftClose, PanelLeftOpen, Radio, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useStudio } from "@/lib/api";
import { inDesktop } from "@/lib/updates";
import { Logo } from "./Logo";
import { Mt5Sheet } from "./Mt5Sheet";
import { UpdateChip } from "./UpdateChip";
import { WindowControls } from "./WindowControls";
import { EnginesSheet } from "@/features/chat/EnginesSheet";

const MT5 = {
  ready: { tone: "success", label: "MT5 ready", pulse: false },
  testing: { tone: "warning", label: "Backtesting…", pulse: true },
  symbols: { tone: "warning", label: "Reading symbols…", pulse: true },
  live: { tone: "success", label: "Trading live", pulse: true },
  "gui-open": { tone: "danger", label: "MT5 open · close to test", pulse: false },
} as const;

// The app's own title bar: app-wide status and settings, and (in the desktop
// app) dragging and the window buttons. Empty space drags the window.
export function TitleBar({ chatCollapsed, onToggleChat, onOpenStrategy }: {
  chatCollapsed: boolean; onToggleChat?: () => void; onOpenStrategy: (name: string) => void;
}) {
  const mt5 = useStudio((s) => s.mt5);
  const mt5Config = useStudio((s) => s.mt5Config);
  const connected = useStudio((s) => s.connected);
  const live = useStudio((s) => s.live);
  const [mt5Sheet, setMt5Sheet] = useState(false);
  const [settings, setSettings] = useState(false);
  const m = MT5[mt5];
  const iconBtn = "grid h-7 w-7 place-items-center rounded-md text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary focus-ring";

  return (
    <header data-tauri-drag-region className="flex h-10 shrink-0 select-none items-center gap-2 border-b border-border bg-surface pl-2">
      {onToggleChat && (
        <button type="button" className={iconBtn} onClick={onToggleChat} aria-label={chatCollapsed ? "Show chat" : "Hide chat"}
          title={chatCollapsed ? "Show chat" : "Hide chat"}>
          {chatCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      )}
      <div data-tauri-drag-region className="flex items-center gap-2">
        <Logo size={20} />
        <span data-tauri-drag-region className="hidden text-xs font-semibold tracking-tight sm:inline">Backtest Studio</span>
      </div>

      {live && (
        <button type="button" onClick={() => onOpenStrategy(live.strategy)} title="Show the strategy trading live"
          className="ml-2 inline-flex h-6 min-w-0 items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 text-[11px] font-medium text-emerald-400 focus-ring">
          <Radio className="h-3 w-3 shrink-0" />
          <span className="truncate">LIVE {live.strategy} · {live.symbol} {live.period}</span>
        </button>
      )}

      <div data-tauri-drag-region className="h-full min-w-4 flex-1" />

      {connected ? (
        <button type="button" onClick={() => setMt5Sheet(true)} title="MT5 install and account" className="rounded-full focus-ring">
          <Badge tone={m.tone} dot pulse={m.pulse}>
            {m.label}
            {mt5Config?.account.login && <span className="ml-1 hidden font-normal opacity-80 lg:inline">· {mt5Config.account.login}</span>}
          </Badge>
        </button>
      ) : <Badge tone="danger" dot>Server offline</Badge>}
      <UpdateChip />
      <button type="button" className={iconBtn} onClick={() => setSettings(true)} aria-label="Engines and API keys" title="Engines & API keys">
        <Settings2 className="h-4 w-4" />
      </button>
      {inDesktop ? <WindowControls /> : <span className="w-1" />}

      <Mt5Sheet open={mt5Sheet} onOpenChange={setMt5Sheet} />
      <EnginesSheet open={settings} onOpenChange={setSettings} />
    </header>
  );
}
