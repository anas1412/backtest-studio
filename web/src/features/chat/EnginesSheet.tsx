import { useEffect, useState } from "react";
import { KeyRound, RefreshCw, Terminal, Trash2 } from "lucide-react";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/form";
import { api, notify, useStudio } from "@/lib/api";
import type { KeyProvider } from "@/lib/types";

// One API provider: key and/or URL, saved and checked on Save.
function ProviderRow({ p, status, onChange }: { p: KeyProvider; status?: { available: boolean; detail: string }; onChange: (k: KeyProvider[]) => void }) {
  const [key, setKey] = useState("");
  const [url, setUrl] = useState(p.baseURL ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      onChange(await api.setKey(p.id, { ...(key ? { key } : {}), ...(p.needsURL ? { baseURL: url } : {}) }));
      setKey("");
    } catch (e) {
      notify({ tone: "error", title: "Not saved", description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{p.label}</span>
        {status?.available ? <Badge tone="success" dot>{status.detail}</Badge>
          : p.configured ? <Badge tone="danger" dot>check failed</Badge> : <Badge>not set</Badge>}
        {p.configured && !p.fromEnv && (
          <button type="button" aria-label={`Remove ${p.label}`} title="Remove"
            onClick={async () => onChange(await api.removeKey(p.id))}
            className="ml-auto rounded-md p-1 text-text-muted hover:text-rose-500 focus-ring">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <p className="mt-0.5 text-[11px] text-text-muted">{p.hint}</p>
      {p.configured && !status?.available && status?.detail && <p className="mt-1 text-[11px] text-rose-500">{status.detail}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {p.needsURL && <Input className="min-w-0 flex-1" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={p.defaultURL ?? "https://…/v1"} />}
        {(p.needsKey || p.id === "compatible") && (
          <Input className="min-w-0 flex-1" type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)}
            placeholder={p.key ? `${p.key}${p.fromEnv ? ` (from ${p.env})` : ""}` : p.needsKey ? "Paste API key" : "API key (optional)"} />
        )}
        <button type="button" onClick={save} disabled={saving || (!key && !(p.needsURL && url !== (p.baseURL ?? "")))}
          className="h-9 rounded-lg bg-text-primary px-3 text-xs font-medium text-background disabled:opacity-40 focus-ring">
          {saving ? "Checking…" : "Save & check"}
        </button>
      </div>
    </div>
  );
}

// Which AI the chat can use: agent CLIs found on this machine, and API
// providers with a key. Keys stay on this machine, owner-only, never shown again.
export function EnginesSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const engines = useStudio((s) => s.engines);
  const [keys, setKeys] = useState<KeyProvider[] | null>(null);
  const [scanning, setScanning] = useState(false);
  useEffect(() => { if (open) api.keys().then(setKeys); }, [open]);

  const cli = engines.filter((e) => e.kind === "cli");
  const statusOf = (id: string) => engines.find((e) => e.id === `api:${id}`);
  const rescan = async () => {
    setScanning(true);
    await api.engines(true).finally(() => setScanning(false));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-[32rem]">
        <SheetHeader>
          <SheetTitle>Engines & API keys</SheetTitle>
          <SheetDescription>The AI the chat can use: tools installed here, and providers you add a key for.</SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-6">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold"><Terminal className="h-3.5 w-3.5" /> Installed tools</h3>
              <button type="button" onClick={rescan} className="inline-flex items-center gap-1 text-[11px] text-text-muted hover:text-text-primary focus-ring">
                <RefreshCw className={scanning ? "h-3 w-3 animate-spin" : "h-3 w-3"} /> Scan again
              </button>
            </div>
            <div className="space-y-1.5">
              {cli.map((e) => (
                <div key={e.id} className="rounded-xl border border-border px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{e.label}</span>
                    {e.available ? <Badge tone="success" dot>found</Badge> : <Badge>not installed</Badge>}
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-text-muted" title={e.detail}>{e.available ? e.detail : e.setup}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-text-muted">
              These use their own login or subscription. Claude Code, opencode and Gemini CLI may only edit files in the workspace and
              run the compile, backtest and live scripts. Codex can only be confined to the workspace folder, not to those scripts.
            </p>
          </section>

          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold"><KeyRound className="h-3.5 w-3.5" /> API providers</h3>
            <div className="space-y-2">
              {keys?.map((p) => <ProviderRow key={p.id} p={p} status={statusOf(p.id)} onChange={setKeys} />)}
            </div>
            <p className="mt-2 text-[11px] text-text-muted">
              Keys are saved only on this computer in a file only your user can read, are never shown again in full, and are only sent to
              their own provider. Usage is billed to the key's account.
            </p>
          </section>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
