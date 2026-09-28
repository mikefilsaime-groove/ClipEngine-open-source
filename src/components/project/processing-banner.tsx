"use client";

import { useEffect, useState } from "react";
import { Loader2, Clock, AlertTriangle } from "lucide-react";

type StepKey = "probe" | "transcribe" | "diarize" | "analyze";

interface ProcessingBannerProps {
  step: StepKey;
  startedAt: number;
  videoDurationSeconds?: number | null;
}

interface StepCopy {
  title: string;
  body: string;
  estimate: (durationSeconds: number | null | undefined) => string;
}

const STEP_COPY: Record<StepKey, StepCopy> = {
  probe: {
    title: "Probing video…",
    body: "Reading video metadata. This is usually instant.",
    estimate: () => "under 5 seconds",
  },
  transcribe: {
    title: "Transcribing audio with Whisper…",
    body:
      "The medium model runs locally on your machine — it's slow but accurate. " +
      "Don't close this tab. You can safely switch to other windows.",
    estimate: (dur) => {
      if (!dur) return "5–15 minutes";
      // whisper medium on CPU ≈ 0.3x–0.6x realtime. Give a generous range.
      const lowMin = Math.max(1, Math.round((dur * 0.3) / 60));
      const highMin = Math.max(2, Math.round((dur * 0.6) / 60));
      return `${lowMin}–${highMin} minutes`;
    },
  },
  diarize: {
    title: "Identifying speakers with pyannote…",
    body:
      "Detecting who's talking and when. Uses the Apple Silicon GPU when available. " +
      "Don't close this tab.",
    estimate: (dur) => {
      if (!dur) return "1–3 minutes";
      const lowMin = Math.max(1, Math.round((dur * 0.05) / 60));
      const highMin = Math.max(2, Math.round((dur * 0.15) / 60));
      return `${lowMin}–${highMin} minutes`;
    },
  },
  analyze: {
    title: "Finding clip candidates with Gemini…",
    body: "Asking Gemini 3 Flash to spot clippable moments in the transcript.",
    estimate: () => "under a minute",
  },
};

function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

export function ProcessingBanner({ step, startedAt, videoDurationSeconds }: ProcessingBannerProps) {
  const [elapsed, setElapsed] = useState(() => Math.floor((Date.now() - startedAt) / 1000));

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const copy = STEP_COPY[step];
  const estimate = copy.estimate(videoDurationSeconds);

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-4">
      <div className="flex items-start gap-3">
        <Loader2 className="h-5 w-5 text-primary animate-spin mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-medium text-foreground">{copy.title}</p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums shrink-0">
              <Clock className="h-3.5 w-3.5" />
              {formatElapsed(elapsed)}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">{copy.body}</p>
          <p className="text-xs text-muted-foreground/80 mt-2">
            Estimated time: <span className="font-medium text-foreground">{estimate}</span>
          </p>
        </div>
      </div>

      {elapsed > 30 && (
        <div className="mt-3 pt-3 border-t border-primary/20 flex items-start gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
          <span>
            Still processing — this is normal. Leave this tab open. If your machine is sleeping,
            processing pauses until you wake it.
          </span>
        </div>
      )}
    </div>
  );
}
