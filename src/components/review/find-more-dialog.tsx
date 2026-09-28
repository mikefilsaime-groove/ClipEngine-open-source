"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import {
  Loader2,
  Sparkles,
  AlertTriangle,
  PartyPopper,
  Check,
  Layers,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FindMoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  type: "clip" | "short";
  onComplete?: () => void;
}

type Phase = "analyzing" | "processing" | "success" | "error";

interface ProgressItem {
  index: number;
  title: string;
  viralityScore: number;
  done: boolean;
  stacked: boolean;
}

// Wire-format events from /api/find-more SSE stream.
type ProgressEvent =
  | { type: "analyzing" }
  | { type: "found"; total: number }
  | {
      type: "item_start";
      index: number;
      total: number;
      title: string;
      viralityScore: number;
    }
  | {
      type: "item_done";
      index: number;
      total: number;
      title: string;
      stacked: boolean;
    }
  | { type: "complete"; added: number; returned: number; filtered: number }
  | { type: "error"; message: string };

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function FindMoreDialog({
  open,
  onOpenChange,
  projectId,
  type,
  onComplete,
}: FindMoreDialogProps) {
  const [phase, setPhase] = useState<Phase>("analyzing");
  const [items, setItems] = useState<ProgressItem[]>([]);
  const [totalExpected, setTotalExpected] = useState<number | null>(null);
  const [addedCount, setAddedCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const startedAtRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Pin onComplete in a ref so the fetch effect doesn't re-run on every
  // parent render. Without this, router.refresh() causes the parent to
  // produce a new onComplete reference, which retriggers the effect and
  // restarts the find-more call in an infinite loop.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const typeLabel = type === "clip" ? "clips" : "shorts";

  const fireConfetti = useCallback(() => {
    const defaults = { spread: 70, ticks: 140, gravity: 0.9, scalar: 1.1 };
    confetti({
      ...defaults,
      particleCount: 80,
      origin: { x: 0.1, y: 0.9 },
      angle: 60,
    });
    confetti({
      ...defaults,
      particleCount: 80,
      origin: { x: 0.9, y: 0.9 },
      angle: 120,
    });
    window.setTimeout(() => {
      confetti({
        particleCount: 120,
        spread: 100,
        origin: { x: 0.5, y: 0.6 },
        scalar: 1.2,
      });
    }, 250);
  }, []);

  // Run the SSE request whenever the dialog opens. Dependencies are
  // intentionally narrow — we do NOT include onComplete here (see ref above).
  useEffect(() => {
    if (!open) return;

    setPhase("analyzing");
    setItems([]);
    setTotalExpected(null);
    setAddedCount(0);
    setErrorMessage(null);
    setElapsedMs(0);
    startedAtRef.current = Date.now();

    const controller = new AbortController();
    abortRef.current = controller;

    (async () => {
      try {
        const res = await fetch("/api/find-more", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, type }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const errJson = await res.json().catch(() => ({}));
          setErrorMessage(errJson.error ?? `Request failed (${res.status})`);
          setPhase("error");
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        // Parse SSE `data: {...}\n\n` frames as they arrive.
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";

          for (const frame of frames) {
            const line = frame.trim();
            if (!line.startsWith("data:")) continue;
            const json = line.slice(5).trim();
            if (!json) continue;

            let event: ProgressEvent;
            try {
              event = JSON.parse(json) as ProgressEvent;
            } catch {
              continue;
            }

            switch (event.type) {
              case "analyzing":
                setPhase("analyzing");
                break;
              case "found":
                setTotalExpected(event.total);
                setPhase(event.total > 0 ? "processing" : "processing");
                break;
              case "item_start":
                setItems((prev) => {
                  if (prev.some((p) => p.index === event.index)) return prev;
                  return [
                    ...prev,
                    {
                      index: event.index,
                      title: event.title,
                      viralityScore: event.viralityScore,
                      done: false,
                      stacked: false,
                    },
                  ];
                });
                break;
              case "item_done":
                setItems((prev) =>
                  prev.map((p) =>
                    p.index === event.index
                      ? { ...p, done: true, stacked: event.stacked }
                      : p,
                  ),
                );
                break;
              case "complete":
                setAddedCount(event.added);
                setPhase("success");
                if (event.added > 0) fireConfetti();
                onCompleteRef.current?.();
                break;
              case "error":
                setErrorMessage(event.message);
                setPhase("error");
                break;
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setErrorMessage(err instanceof Error ? err.message : "Find more failed");
        setPhase("error");
      }
    })();

    return () => {
      controller.abort();
      abortRef.current = null;
    };
  }, [open, projectId, type, fireConfetti]);

  // Live elapsed timer — only ticks while a run is in progress.
  useEffect(() => {
    const running = phase === "analyzing" || phase === "processing";
    if (!open || !running) return;
    const tick = window.setInterval(() => {
      if (startedAtRef.current) {
        setElapsedMs(Date.now() - startedAtRef.current);
      }
    }, 500);
    return () => window.clearInterval(tick);
  }, [open, phase]);

  // Auto-close after the success celebration.
  useEffect(() => {
    if (phase !== "success") return;
    const t = window.setTimeout(() => {
      onOpenChange(false);
    }, 3500);
    return () => window.clearTimeout(t);
  }, [phase, onOpenChange]);

  const running = phase === "analyzing" || phase === "processing";
  const doneCount = items.filter((i) => i.done).length;
  const progressPct =
    totalExpected && totalExpected > 0
      ? Math.round((doneCount / totalExpected) * 100)
      : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (running && !next) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg" showCloseButton={!running}>
        <DialogTitle className="sr-only">
          {phase === "success"
            ? "Done"
            : phase === "error"
              ? "Error"
              : `Finding more ${typeLabel}`}
        </DialogTitle>

        {phase === "analyzing" && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-xl animate-pulse" />
              <div className="relative bg-blue-500/10 rounded-full p-4">
                <Sparkles className="h-8 w-8 text-blue-500 animate-pulse" />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                Analyzing transcript…
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Gemini is re-reading the full transcript and hunting for
                moments we haven&apos;t scored yet. Existing {typeLabel}{" "}
                ranges are marked off-limits so we don&apos;t duplicate.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                This may take 1–3 minutes. Please don&apos;t close this tab.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="tabular-nums">{formatElapsed(elapsedMs)}</span>
            </div>
          </div>
        )}

        {phase === "processing" && (
          <div className="flex flex-col gap-4 py-2">
            <div className="text-center">
              <h2 className="text-lg font-semibold">
                {totalExpected === 0
                  ? `No new ${typeLabel} found`
                  : `Found ${totalExpected} new ${totalExpected === 1 ? type : typeLabel}`}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {totalExpected === 0
                  ? "Your existing candidates already cover the best moments."
                  : "Generating previews for each — stacking multi-speaker shorts where needed."}
              </p>
            </div>

            {totalExpected !== null && totalExpected > 0 && (
              <>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {doneCount} of {totalExpected} processed
                    </span>
                    <span className="tabular-nums">
                      {formatElapsed(elapsedMs)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300 ease-out"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto rounded-md border bg-muted/30 divide-y">
                  {items.map((item) => (
                    <div
                      key={item.index}
                      className="flex items-center gap-3 px-3 py-2 text-sm"
                    >
                      <div
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-full shrink-0 transition-colors",
                          item.done
                            ? "bg-green-500 text-white"
                            : "bg-muted border border-muted-foreground/30",
                        )}
                      >
                        {item.done ? (
                          <Check className="h-3 w-3" strokeWidth={3} />
                        ) : (
                          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "truncate",
                            item.done
                              ? "text-foreground"
                              : "text-muted-foreground",
                          )}
                        >
                          {item.title}
                        </p>
                      </div>
                      {item.stacked && (
                        <span className="flex items-center gap-0.5 text-[10px] font-semibold text-blue-500 shrink-0">
                          <Layers className="h-3 w-3" />
                          STACKED
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                        {item.viralityScore}
                      </span>
                    </div>
                  ))}
                  {/* Unseen placeholder slots for items not yet announced */}
                  {Array.from({
                    length: Math.max(0, totalExpected - items.length),
                  }).map((_, i) => (
                    <div
                      key={`placeholder-${i}`}
                      className="flex items-center gap-3 px-3 py-2 text-sm opacity-50"
                    >
                      <div className="h-5 w-5 rounded-full border border-dashed border-muted-foreground/30 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-muted-foreground italic">
                          Waiting…
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {phase === "success" && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="bg-green-500/10 rounded-full p-4">
              <PartyPopper className="h-8 w-8 text-green-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold">
                {addedCount > 0
                  ? `Added ${addedCount} new ${addedCount === 1 ? type : typeLabel}!`
                  : `No new ${typeLabel} found`}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {addedCount > 0
                  ? `Finished in ${formatElapsed(elapsedMs)}. Check the list below.`
                  : "Your existing candidates already cover the best moments."}
              </p>
            </div>
          </div>
        )}

        {phase === "error" && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="bg-red-500/10 rounded-full p-4">
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Find more failed</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm break-words">
                {errorMessage ?? "Something went wrong."}
              </p>
            </div>
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
