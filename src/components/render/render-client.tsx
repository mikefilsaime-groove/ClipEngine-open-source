"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Info,
  Ban,
  FolderOpen,
  Film,
  Scissors,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDuration, formatDurationRange } from "@/lib/render-estimate";
import { YouTubeSuggestionsCard } from "./youtube-suggestions";

interface PreflightCandidate {
  id: string;
  title: string;
  type: string;
  duration: number;
  viralityScore: number;
  exportQuality: string | null;
}

interface RenderedCandidate {
  id: string;
  title: string;
  type: string;
  duration: number;
  viralityScore: number;
  outputPath: string | null;
  previewPath: string | null;
}

interface RenderClientProps {
  projectId: string;
  defaultQuality: string;
  approved: PreflightCandidate[];
  rendered: RenderedCandidate[];
  existingJobId: string | null;
  estimatedSeconds: number;
}

type Phase = "preflight" | "running" | "complete";

interface LiveItem {
  id: string;
  candidateId: string;
  title: string;
  duration: number;
  isVertical: boolean;
  status: "pending" | "running" | "done" | "failed";
  progressPct: number;
  outputPath: string | null;
  errorMessage: string | null;
}

interface LiveJob {
  id: string;
  status: string;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  estimatedSeconds: number;
  actualSeconds: number | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export function RenderClient({
  projectId,
  defaultQuality,
  approved,
  rendered,
  existingJobId,
  estimatedSeconds,
}: RenderClientProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(existingJobId ? "running" : "preflight");
  const [jobId, setJobId] = useState<string | null>(existingJobId);
  const [starting, setStarting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [job, setJob] = useState<LiveJob | null>(null);
  const [items, setItems] = useState<LiveItem[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const confettiFired = useRef(false);

  const subscribe = useCallback(
    (id: string) => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      const es = new EventSource(`/api/video/render/${id}/stream`);
      eventSourceRef.current = es;

      es.addEventListener("snapshot", (e) => {
        const data = JSON.parse((e as MessageEvent).data);
        setJob(data.job);
        setItems(data.items);
      });

      es.addEventListener("update", (e) => {
        const data = JSON.parse((e as MessageEvent).data);
        setJob((prev) => (prev ? { ...prev, ...data.job } : prev));
        setItems((prev) => {
          const patch: Record<string, Partial<LiveItem>> = {};
          for (const it of data.items) patch[it.id] = it;
          return prev.map((it) => ({ ...it, ...patch[it.id] }));
        });
      });

      es.addEventListener("complete", (e) => {
        const data = JSON.parse((e as MessageEvent).data);
        setPhase("complete");
        if (data.status === "complete" && !confettiFired.current) {
          confettiFired.current = true;
          fireConfetti();
        }
        es.close();
        eventSourceRef.current = null;
        router.refresh();
      });

      es.addEventListener("error", () => {
        // Transient connection errors — EventSource auto-reconnects
      });
    },
    [router],
  );

  useEffect(() => {
    if (existingJobId) {
      subscribe(existingJobId);
    }
    return () => {
      eventSourceRef.current?.close();
    };
  }, [existingJobId, subscribe]);

  const handleStart = async () => {
    setStarting(true);
    try {
      const res = await fetch("/api/video/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("Start failed:", err);
        setStarting(false);
        return;
      }
      const data = (await res.json()) as { jobId: string };
      setJobId(data.jobId);
      setPhase("running");
      confettiFired.current = false;
      subscribe(data.jobId);
    } finally {
      setStarting(false);
    }
  };

  const handleCancel = async () => {
    if (!jobId) return;
    setCancelling(true);
    try {
      await fetch(`/api/video/render/${jobId}/cancel`, { method: "POST" });
    } finally {
      setCancelling(false);
    }
  };

  // ---------- Preflight ----------
  if (phase === "preflight") {
    const clipCount = approved.filter((c) => c.type === "clip").length;
    const shortCount = approved.filter((c) => c.type === "short").length;
    const totalDuration = approved.reduce((sum, c) => sum + c.duration, 0);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Render</h1>
          <p className="text-muted-foreground mt-1">
            Export your approved clips and shorts to MP4 files.
          </p>
        </div>

        {approved.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                No approved candidates yet. Approve clips or shorts first.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Ready to render</CardTitle>
                <CardDescription>
                  Review the summary before you kick off the batch.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard
                    icon={<Scissors className="h-4 w-4" />}
                    label="Clips"
                    value={String(clipCount)}
                  />
                  <StatCard
                    icon={<Film className="h-4 w-4" />}
                    label="Shorts"
                    value={String(shortCount)}
                  />
                  <StatCard
                    icon={<Clock className="h-4 w-4" />}
                    label="Total Duration"
                    value={formatDuration(totalDuration)}
                  />
                  <StatCard
                    icon={<Info className="h-4 w-4" />}
                    label="Default Quality"
                    value={defaultQuality.toUpperCase()}
                  />
                </div>

                <div className="rounded-md bg-primary/5 border border-primary/20 p-4">
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Estimated render time:{" "}
                        <span className="text-primary">
                          {formatDurationRange(estimatedSeconds)}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Estimates are based on clip duration, quality, and
                        enabled features (captions, bumpers, watermark,
                        stacked layout). 4K renders can run{" "}
                        <strong>3–5× slower</strong> than 1080p.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-md bg-muted/40 border border-border p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">
                        Keep this tab open — but you don't have to watch it
                      </p>
                      <ul className="text-xs text-muted-foreground space-y-1 leading-relaxed">
                        <li>
                          • Rendering runs in the background on your machine.
                          You can navigate to other tabs or close this one —
                          progress will resume when you come back.
                        </li>
                        <li>
                          • Keep your computer awake and plugged in. ffmpeg is
                          CPU/GPU-intensive and will eat your battery.
                        </li>
                        <li>
                          • For large batches at 1080p or 4K this can take
                          anywhere from a few minutes to over an hour. Plan
                          accordingly.
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    size="lg"
                    onClick={handleStart}
                    disabled={starting}
                    className="gap-2"
                  >
                    {starting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Starting…
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" />
                        Start rendering {approved.length} items
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Preview</CardTitle>
                <CardDescription>
                  These items will be rendered, in order.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-border">
                  {approved.map((c, i) => (
                    <div key={c.id} className="flex items-center gap-3 py-2.5">
                      <span className="text-xs text-muted-foreground font-mono w-6 shrink-0 text-right">
                        {i + 1}
                      </span>
                      {c.type === "short" ? (
                        <Film className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <Scissors className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-sm flex-1 min-w-0 truncate">
                        {c.title}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                        {formatDuration(c.duration)}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0 w-10 text-right">
                        {c.viralityScore}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Previously rendered items — always shown */}
        {rendered.length > 0 && <RenderedHistory items={rendered} />}
      </div>
    );
  }

  // ---------- Running / Complete ----------
  const overallWeighted = (() => {
    if (!items.length) return 0;
    const totalWork = items.reduce((s, it) => s + it.duration, 0);
    if (totalWork === 0) return 0;
    const doneWork = items.reduce((sum, it) => {
      if (it.status === "done") return sum + it.duration;
      if (it.status === "running") return sum + (it.duration * it.progressPct) / 100;
      if (it.status === "failed") return sum + it.duration;
      return sum;
    }, 0);
    return Math.min(100, (doneWork / totalWork) * 100);
  })();

  const isComplete = phase === "complete";
  const jobStatus = job?.status ?? "running";
  const completedCount = items.filter((it) => it.status === "done").length;
  const failedCount = items.filter((it) => it.status === "failed").length;
  const runningItem = items.find((it) => it.status === "running");

  const etaSeconds = (() => {
    if (!job?.startedAt || overallWeighted === 0 || overallWeighted >= 100) return null;
    const elapsed = (Date.now() - new Date(job.startedAt).getTime()) / 1000;
    const total = elapsed / (overallWeighted / 100);
    return Math.max(0, Math.round(total - elapsed));
  })();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Render</h1>
        <p className="text-muted-foreground mt-1">
          {isComplete
            ? jobStatus === "complete"
              ? "All done. Your files are ready."
              : jobStatus === "cancelled"
                ? "Cancelled. Some items may have completed before you cancelled."
                : "Render finished with errors."
            : "Rendering your approved clips and shorts. Keep this tab open or come back later."}
        </p>
      </div>

      {/* Sticky overall progress card */}
      <Card
        className={cn(
          "sticky top-4 z-10",
          isComplete && jobStatus === "complete" && "border-primary/40 bg-primary/5",
          isComplete && jobStatus === "failed" && "border-destructive/40 bg-destructive/5",
        )}
      >
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              {isComplete ? (
                jobStatus === "complete" ? (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  </div>
                ) : jobStatus === "cancelled" ? (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <Ban className="h-5 w-5 text-muted-foreground" />
                  </div>
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                    <XCircle className="h-5 w-5 text-destructive" />
                  </div>
                )
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                </div>
              )}
              <div>
                <p className="font-semibold text-foreground">
                  {isComplete
                    ? jobStatus === "complete"
                      ? `Rendered ${completedCount} of ${items.length}`
                      : jobStatus === "cancelled"
                        ? `Cancelled — ${completedCount} of ${items.length} completed`
                        : `Failed — ${completedCount} of ${items.length} rendered`
                    : `${completedCount} of ${items.length} complete`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isComplete
                    ? job?.actualSeconds
                      ? `Finished in ${formatDuration(job.actualSeconds)}`
                      : ""
                    : etaSeconds !== null
                      ? `≈ ${formatDuration(etaSeconds)} remaining`
                      : "Preparing…"}
                  {failedCount > 0 && ` · ${failedCount} failed`}
                </p>
              </div>
            </div>

            {!isComplete && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Ban className="h-4 w-4 mr-2" />
                )}
                {cancelling ? "Cancelling…" : "Cancel"}
              </Button>
            )}

            {isComplete && (
              <Button variant="outline" size="sm" onClick={() => setPhase("preflight")}>
                Back to queue
              </Button>
            )}
          </div>

          {/* Overall progress bar */}
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-500",
                isComplete && jobStatus === "failed"
                  ? "bg-destructive"
                  : "bg-primary",
              )}
              style={{ width: `${overallWeighted}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{Math.round(overallWeighted)}%</span>
            {runningItem && !isComplete && (
              <span className="truncate max-w-[60%]">
                Rendering: <span className="text-foreground">{runningItem.title}</span>
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Per-item rows */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Queue</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {items.map((item, idx) => (
              <RenderRow key={item.id} item={item} index={idx} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Previously rendered items — always shown */}
      {rendered.length > 0 && <RenderedHistory items={rendered} />}
    </div>
  );
}

function RenderedHistory({ items }: { items: RenderedCandidate[] }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Rendered ({items.length})</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Completed renders. Generate YouTube titles and thumbnail guidance for
          any clip.
        </p>
      </div>
      {items.map((item, idx) => (
        <Card key={item.id}>
          <CardContent className="p-4 space-y-3">
            {/* Item header row */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground font-mono w-6 shrink-0 text-right">
                {idx + 1}
              </span>
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              {item.type === "short" ? (
                <Film className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              ) : (
                <Scissors className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.title}</p>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {item.type} · {formatDuration(item.duration)}
                </span>
              </div>
              <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0">
                Done
              </span>
              {item.outputPath && (
                <Button variant="ghost" size="sm" className="h-7 px-2 shrink-0" asChild>
                  <a
                    href={`/api/video/stream?path=${encodeURIComponent(item.outputPath)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                  </a>
                </Button>
              )}
            </div>

            {/* YouTube suggestions */}
            <YouTubeSuggestionsCard
              candidateId={item.id}
              candidateTitle={item.title}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-xl font-semibold mt-1 tabular-nums">{value}</div>
    </div>
  );
}

function RenderRow({ item, index }: { item: LiveItem; index: number }) {
  const statusStyles =
    item.status === "running"
      ? "bg-primary/5 border-l-primary"
      : item.status === "done"
        ? "bg-primary/[0.03] border-l-primary/40"
        : item.status === "failed"
          ? "bg-destructive/5 border-l-destructive"
          : "border-l-transparent";

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 border-l-2 transition-colors",
        statusStyles,
      )}
    >
      <span className="text-xs text-muted-foreground font-mono w-6 shrink-0 text-right">
        {index + 1}
      </span>

      <StatusIcon status={item.status} />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {item.isVertical ? "short" : "clip"}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatDuration(item.duration)}
          </span>
          {item.errorMessage && (
            <span className="text-xs text-destructive truncate max-w-[280px]">
              {item.errorMessage}
            </span>
          )}
        </div>
        {item.status === "running" && (
          <div className="mt-2 h-1 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${item.progressPct}%` }}
            />
          </div>
        )}
      </div>

      <StatusPill status={item.status} progressPct={item.progressPct} />

      {item.status === "done" && item.outputPath && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          asChild
        >
          <a
            href={`/api/video/stream?path=${encodeURIComponent(item.outputPath)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </a>
        </Button>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: LiveItem["status"] }) {
  switch (status) {
    case "pending":
      return <Clock className="h-4 w-4 text-muted-foreground shrink-0" />;
    case "running":
      return <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />;
    case "done":
      return <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
  }
}

function StatusPill({
  status,
  progressPct,
}: {
  status: LiveItem["status"];
  progressPct: number;
}) {
  const base =
    "inline-flex items-center text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full border shrink-0";
  if (status === "pending") {
    return (
      <span className={cn(base, "bg-muted text-muted-foreground border-border")}>
        Pending
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className={cn(base, "bg-primary/10 text-primary border-primary/20")}>
        {Math.round(progressPct)}%
      </span>
    );
  }
  if (status === "done") {
    return (
      <span className={cn(base, "bg-primary/10 text-primary border-primary/20")}>
        Done
      </span>
    );
  }
  return (
    <span className={cn(base, "bg-destructive/10 text-destructive border-destructive/20")}>
      Failed
    </span>
  );
}

function fireConfetti() {
  const end = Date.now() + 800;
  const colors = ["#22c55e", "#f59e0b", "#06b6d4"];
  (function frame() {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors,
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}
