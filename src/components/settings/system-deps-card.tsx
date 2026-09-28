"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Terminal,
  Download,
  ExternalLink,
  RefreshCw,
  Mic,
  Clapperboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchSystemStatus } from "@/actions/system-actions";
import type { SystemStatus, CheckResult } from "@/lib/system-check";

interface SystemDepsCardProps {
  initial: SystemStatus;
}

export function SystemDepsCard({ initial }: SystemDepsCardProps) {
  const router = useRouter();
  const [status, setStatus] = useState<SystemStatus>(initial);
  const [refreshing, setRefreshing] = useState(false);

  const [venvRunning, setVenvRunning] = useState(false);
  const [venvLog, setVenvLog] = useState<string[]>([]);
  const [venvDone, setVenvDone] = useState<boolean | null>(null);

  const [whisperRunning, setWhisperRunning] = useState(false);
  const [whisperLog, setWhisperLog] = useState<string[]>([]);
  const [whisperDone, setWhisperDone] = useState<boolean | null>(null);

  const logRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const s = await fetchSystemStatus();
    setStatus(s);
    setRefreshing(false);
  }, []);

  const consumeSSE = useCallback(
    async (
      url: string,
      setLog: (fn: (p: string[]) => string[]) => void,
      setRunning: (v: boolean) => void,
      setDone: (v: boolean | null) => void,
    ) => {
      setRunning(true);
      setDone(null);
      setLog(() => []);

      const res = await fetch(url, { method: "POST" });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        setLog((p) => [...p, `Error: ${(err as { error?: string }).error ?? res.statusText}`]);
        setRunning(false);
        setDone(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const dataLine = part.split("\n").find((l) => l.startsWith("data: "));
          if (!dataLine) continue;
          try {
            const data = JSON.parse(dataLine.slice(6));
            if (data.line) {
              setLog((p) => [...p, data.line]);
            }
            if (data.message) {
              setLog((p) => [...p, data.message]);
            }
            if (data.success !== undefined) {
              setDone(data.success);
            }
          } catch {}
        }
      }

      setRunning(false);
      await refresh();
      router.refresh();
    },
    [refresh, router],
  );

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [venvLog, whisperLog]);

  const handleVenvSetup = () =>
    consumeSSE("/api/setup/venv", setVenvLog, setVenvRunning, setVenvDone);

  const handleWhisperDownload = () =>
    consumeSSE("/api/setup/whisper", setWhisperLog, setWhisperRunning, setWhisperDone);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Terminal className="h-4 w-4" />
              System Dependencies
            </CardTitle>
            <CardDescription className="mt-1">
              External tools that ClipEngine needs to process videos.
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={refresh}
            disabled={refreshing}
          >
            <RefreshCw
              className={cn("h-4 w-4", refreshing && "animate-spin")}
            />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ffmpeg */}
        <DependencyRow
          label="ffmpeg"
          description="Video encoding/decoding. Bundled with the app."
          result={status.ffmpeg}
        />

        {/* Python */}
        <DependencyRow
          label="Python 3"
          description="Required for speaker diarization (pyannote)."
          result={status.python}
          installHint={
            !status.python.ok ? (
              <a
                href="https://www.python.org/downloads/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Download Python from python.org
              </a>
            ) : undefined
          }
        />

        {/* Venv */}
        <DependencyRow
          label="Python Components"
          description="PyTorch, pyannote-audio, mediapipe — installed in ~/.clipengine-venv"
          result={status.venv}
          action={
            !status.venv.ok && status.python.ok && !venvRunning ? (
              <Button size="sm" variant="outline" onClick={handleVenvSetup}>
                <Download className="h-3.5 w-3.5 mr-1" />
                Install (~2 GB download)
              </Button>
            ) : venvRunning ? (
              <Button size="sm" variant="outline" disabled>
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                Installing…
              </Button>
            ) : undefined
          }
        />

        {venvLog.length > 0 && (
          <LogPanel
            ref={logRef}
            lines={venvLog}
            done={venvDone}
            label="Python components"
          />
        )}

        {/* Whisper model */}
        <DependencyRow
          label="Whisper Model"
          description="Local speech-to-text model (base.en, ~150 MB download)."
          result={status.whisperModel}
          icon={<Mic className="h-4 w-4" />}
          action={
            !status.whisperModel.ok && !whisperRunning ? (
              <Button
                size="sm"
                variant="outline"
                onClick={handleWhisperDownload}
              >
                <Download className="h-3.5 w-3.5 mr-1" />
                Download Model
              </Button>
            ) : whisperRunning ? (
              <Button size="sm" variant="outline" disabled>
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                Downloading…
              </Button>
            ) : undefined
          }
        />

        {whisperLog.length > 0 && (
          <LogPanel
            ref={logRef}
            lines={whisperLog}
            done={whisperDone}
            label="Whisper model"
          />
        )}

        {/* Sidecar */}
        <DependencyRow
          label="Python Sidecar"
          description="Background service for speaker detection and face analysis."
          result={status.sidecar}
          icon={<Clapperboard className="h-4 w-4" />}
          note={
            status.sidecar.ok
              ? undefined
              : "The sidecar starts automatically when you launch ClipEngine via Electron. In dev mode, start it manually."
          }
        />
      </CardContent>
    </Card>
  );
}

function DependencyRow({
  label,
  description,
  result,
  icon,
  action,
  installHint,
  note,
}: {
  label: string;
  description: string;
  result: CheckResult;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  installHint?: React.ReactNode;
  note?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="mt-0.5">
        {result.ok ? (
          <CheckCircle2 className="h-4 w-4 text-primary" />
        ) : (
          <AlertCircle className="h-4 w-4 text-amber-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium">{label}</span>
          <StatusPill ok={result.ok} />
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        {result.detail && result.ok && (
          <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">
            {result.detail}
          </p>
        )}
        {installHint && <div className="mt-1.5">{installHint}</div>}
        {note && (
          <p className="text-xs text-muted-foreground mt-1 italic">{note}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function StatusPill({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="text-[9px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
      Installed
    </span>
  ) : (
    <span className="text-[9px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
      Missing
    </span>
  );
}

import { forwardRef } from "react";

const LogPanel = forwardRef<
  HTMLDivElement,
  { lines: string[]; done: boolean | null; label: string }
>(function LogPanel({ lines, done, label }, ref) {
  return (
    <div className="rounded-md border bg-muted/30 overflow-hidden">
      <div
        ref={ref}
        className="max-h-48 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed text-muted-foreground"
      >
        {lines.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
      {done !== null && (
        <div
          className={cn(
            "px-3 py-2 border-t text-xs font-medium flex items-center gap-1.5",
            done
              ? "bg-primary/5 text-primary"
              : "bg-destructive/5 text-destructive",
          )}
        >
          {done ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5" />
              {label} installed successfully
            </>
          ) : (
            <>
              <AlertCircle className="h-3.5 w-3.5" />
              {label} installation failed — check the log above
            </>
          )}
        </div>
      )}
    </div>
  );
});
