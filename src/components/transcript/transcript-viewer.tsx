"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface Segment {
  id: string;
  word: string;
  startTime: number;
  endTime: number;
  speaker: string;
}

interface TranscriptViewerProps {
  segments: Segment[];
  currentTime: number;
  onWordClick: (time: number) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function TranscriptViewer({ segments, currentTime, onWordClick }: TranscriptViewerProps) {
  const activeRef = useRef<HTMLSpanElement | null>(null);

  // Find the active segment index
  const activeIndex = segments.findIndex(
    (seg) => currentTime >= seg.startTime && currentTime < seg.endTime,
  );

  // Auto-scroll active word into view
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [activeIndex]);

  if (segments.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic p-4">
        No transcript available.
      </div>
    );
  }

  // Group segments, inserting speaker headers when speaker changes
  const rendered: React.ReactNode[] = [];
  let lastSpeaker: string | null = null;
  let lineBuffer: React.ReactNode[] = [];

  const flushLine = () => {
    if (lineBuffer.length > 0) {
      rendered.push(
        <p key={`line-${rendered.length}`} className="leading-relaxed mb-1">
          {lineBuffer}
        </p>,
      );
      lineBuffer = [];
    }
  };

  segments.forEach((seg, i) => {
    const isActive = i === activeIndex;

    if (seg.speaker !== lastSpeaker) {
      flushLine();
      lastSpeaker = seg.speaker;
      rendered.push(
        <div key={`speaker-${i}`} className="flex items-center gap-2 mt-4 mb-1 first:mt-0">
          <span className="text-xs font-semibold text-primary">{seg.speaker}</span>
          <span className="text-xs text-muted-foreground font-mono">
            {formatTime(seg.startTime)}
          </span>
        </div>,
      );
    }

    lineBuffer.push(
      <span
        key={seg.id}
        ref={isActive ? activeRef : null}
        className={cn(
          "inline cursor-pointer rounded px-0.5 transition-colors hover:bg-primary/20",
          isActive && "bg-primary/30 font-semibold text-foreground",
          !isActive && "text-muted-foreground",
        )}
        onClick={() => onWordClick(seg.startTime)}
      >
        {seg.word}{" "}
      </span>,
    );
  });

  flushLine();

  return (
    <div className="text-sm overflow-y-auto max-h-[60vh] px-1">
      {rendered}
    </div>
  );
}
