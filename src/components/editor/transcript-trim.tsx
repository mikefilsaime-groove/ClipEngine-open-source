"use client";

import { useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Word {
  word: string;
  startTime: number;
  endTime: number;
  speaker?: string;
}

interface TranscriptTrimProps {
  words: Word[];
  trimIn: number;
  trimOut: number;
  contextBefore: Word[];
  contextAfter: Word[];
  onTrimChange: (trimIn: number, trimOut: number) => void;
  onWordClick: (time: number) => void;
  onExtendBefore: () => void;
  onExtendAfter: () => void;
  canExtendBefore: boolean;
  extending: "before" | "after" | null;
}

type DragMode = "in" | "out" | null;

export function TranscriptTrim({
  words,
  trimIn,
  trimOut,
  contextBefore,
  contextAfter,
  onTrimChange,
  onWordClick,
  onExtendBefore,
  onExtendAfter,
  canExtendBefore,
  extending,
}: TranscriptTrimProps) {
  const dragMode = useRef<DragMode>(null);
  const dragStartTime = useRef<number | null>(null);

  const handleWordMouseDown = useCallback(
    (word: Word) => (e: React.MouseEvent) => {
      e.preventDefault();
      // Decide which handle to grab based on where the word sits relative to
      // the current active range. Words before trimIn always move the IN
      // handle (earlier start), words after trimOut always move OUT (later
      // end). Words inside the range fall back to whichever edge is closer.
      if (word.startTime < trimIn) {
        dragMode.current = "in";
      } else if (word.startTime > trimOut) {
        dragMode.current = "out";
      } else {
        const midpoint = (trimIn + trimOut) / 2;
        dragMode.current = word.startTime < midpoint ? "in" : "out";
      }
      dragStartTime.current = word.startTime;

      // Apply the chosen endpoint immediately on mousedown so a plain click
      // (without dragging) still moves the boundary.
      if (dragMode.current === "in") {
        onTrimChange(Math.min(word.startTime, trimOut - 0.1), trimOut);
      } else {
        onTrimChange(trimIn, Math.max(word.endTime, trimIn + 0.1));
      }

      const handleMouseUp = () => {
        dragMode.current = null;
        dragStartTime.current = null;
        window.removeEventListener("mouseup", handleMouseUp);
      };
      window.addEventListener("mouseup", handleMouseUp);
    },
    [trimIn, trimOut, onTrimChange],
  );

  const handleWordMouseEnter = useCallback(
    (word: Word) => () => {
      if (!dragMode.current) return;
      if (dragMode.current === "in") {
        const newIn = Math.min(word.startTime, trimOut - 0.1);
        onTrimChange(newIn, trimOut);
      } else {
        const newOut = Math.max(word.endTime, trimIn + 0.1);
        onTrimChange(trimIn, newOut);
      }
    },
    [trimIn, trimOut, onTrimChange],
  );

  // Merge all words into a single ordered list. Dimming is now purely a
  // function of the current trim range — words inside light up, words
  // outside dim, regardless of whether they started as "context" or
  // "clip". That way dragging the in/out boundary into the ghost region
  // visually re-includes those words.
  const allWords = [...contextBefore, ...words, ...contextAfter];

  const renderWord = (word: Word, index: number) => {
    const isActive = word.startTime >= trimIn && word.endTime <= trimOut;
    return (
      <span
        key={`${word.startTime}-${index}`}
        className={cn(
          "inline cursor-pointer rounded px-0.5 py-px transition-colors",
          isActive
            ? "bg-primary/20 text-foreground"
            : "text-muted-foreground/40",
          "hover:bg-primary/30 hover:text-foreground",
        )}
        onMouseDown={handleWordMouseDown(word)}
        onMouseEnter={handleWordMouseEnter(word)}
        onClick={() => onWordClick(word.startTime)}
      >
        {word.word}{" "}
      </span>
    );
  };

  return (
    <div className="rounded-md border bg-muted/30 p-4 text-sm leading-relaxed select-none max-h-96 overflow-y-auto">
      {canExtendBefore && (
        <button
          type="button"
          onClick={onExtendBefore}
          disabled={extending !== null}
          className="inline-flex items-center gap-1 mr-1.5 mb-1 rounded border border-dashed border-muted-foreground/40 px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed align-baseline"
        >
          {extending === "before" ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading…
            </>
          ) : (
            <>← Load 1 min earlier</>
          )}
        </button>
      )}
      {allWords.map((w, i) => renderWord(w, i))}
      <button
        type="button"
        onClick={onExtendAfter}
        disabled={extending !== null}
        className="inline-flex items-center gap-1 ml-1 rounded border border-dashed border-muted-foreground/40 px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed align-baseline"
      >
        {extending === "after" ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading…
          </>
        ) : (
          <>Load 1 min later →</>
        )}
      </button>
    </div>
  );
}
