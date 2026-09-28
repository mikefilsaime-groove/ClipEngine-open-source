"use client";

import { useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TimelineTrimProps {
  duration: number;
  trimIn: number;
  trimOut: number;
  currentTime: number;
  onTrimChange: (trimIn: number, trimOut: number) => void;
  onSeek: (time: number) => void;
  onExtendBefore: () => void;
  onExtendAfter: () => void;
  canExtendBefore: boolean;
  extending: "before" | "after" | null;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

type DragMode = "in" | "out" | "seek" | null;

export function TimelineTrim({
  duration,
  trimIn,
  trimOut,
  currentTime,
  onTrimChange,
  onSeek,
  onExtendBefore,
  onExtendAfter,
  canExtendBefore,
  extending,
}: TimelineTrimProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragMode = useRef<DragMode>(null);

  const getTimeFromEvent = useCallback(
    (e: React.MouseEvent | MouseEvent): number => {
      const track = trackRef.current;
      if (!track) return 0;
      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      return ratio * duration;
    },
    [duration],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragMode.current) return;
      const t = getTimeFromEvent(e);
      if (dragMode.current === "in") {
        onTrimChange(Math.min(t, trimOut - 0.1), trimOut);
      } else if (dragMode.current === "out") {
        onTrimChange(trimIn, Math.max(t, trimIn + 0.1));
      } else if (dragMode.current === "seek") {
        onSeek(Math.max(trimIn, Math.min(t, trimOut)));
      }
    },
    [getTimeFromEvent, trimIn, trimOut, onTrimChange, onSeek],
  );

  const handleMouseUp = useCallback(() => {
    dragMode.current = null;
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
  }, [handleMouseMove]);

  const startDrag = useCallback(
    (mode: DragMode) => (e: React.MouseEvent) => {
      e.preventDefault();
      dragMode.current = mode;
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [handleMouseMove, handleMouseUp],
  );

  const handleTrackClick = useCallback(
    (e: React.MouseEvent) => {
      if (dragMode.current) return;
      onSeek(getTimeFromEvent(e));
    },
    [getTimeFromEvent, onSeek],
  );

  const inPct = duration > 0 ? (trimIn / duration) * 100 : 0;
  const outPct = duration > 0 ? (trimOut / duration) * 100 : 100;
  const playPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const clipDuration = trimOut - trimIn;

  return (
    <div className="select-none space-y-2">
      {/* Extend + track row */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onExtendBefore}
          disabled={!canExtendBefore || extending !== null}
          className="shrink-0 h-10 text-xs"
          title="Load 1 minute of context before this clip"
        >
          {extending === "before" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <>− 1 min</>
          )}
        </Button>

        {/* Track */}
        <div
          ref={trackRef}
          className="relative h-10 flex-1 bg-muted rounded cursor-pointer"
          onClick={handleTrackClick}
        >
        {/* Active region */}
        <div
          className="absolute inset-y-0 bg-primary/20 rounded"
          style={{ left: `${inPct}%`, right: `${100 - outPct}%` }}
        />

        {/* IN handle */}
        <div
          className="absolute inset-y-0 w-0.5 bg-primary cursor-ew-resize z-10 group"
          style={{ left: `${inPct}%` }}
          onMouseDown={startDrag("in")}
        >
          <div className="absolute -top-1 -bottom-1 -left-2 -right-2" />
          <div className="absolute top-0 left-1 text-[9px] font-bold text-primary leading-none select-none">
            IN
          </div>
        </div>

        {/* OUT handle */}
        <div
          className="absolute inset-y-0 w-0.5 bg-primary cursor-ew-resize z-10"
          style={{ left: `${outPct}%` }}
          onMouseDown={startDrag("out")}
        >
          <div className="absolute -top-1 -bottom-1 -left-2 -right-2" />
          <div className="absolute top-0 left-1 text-[9px] font-bold text-primary leading-none select-none">
            OUT
          </div>
        </div>

        {/* Playhead */}
        <div
          className="absolute inset-y-0 w-px bg-white/80 z-20 pointer-events-none"
          style={{ left: `${playPct}%` }}
        />
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onExtendAfter}
          disabled={extending !== null}
          className="shrink-0 h-10 text-xs"
          title="Load 1 minute of context after this clip"
        >
          {extending === "after" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <>+ 1 min</>
          )}
        </Button>
      </div>

      {/* Time labels */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>IN {formatTime(trimIn)}</span>
        <span>{formatTime(clipDuration)} clip</span>
        <span>OUT {formatTime(trimOut)}</span>
      </div>
    </div>
  );
}
