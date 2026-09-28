"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { TimelineTrim } from "./timeline-trim";
import { TranscriptTrim } from "./transcript-trim";
import { updateCandidateTrim } from "@/actions/candidate-actions";

interface Word {
  word: string;
  startTime: number;
  endTime: number;
  speaker?: string;
}

interface TrimEditorProps {
  candidateId: string;
  viewStart: number;
  viewEnd: number;
  trimIn: number;
  trimOut: number;
  words: Word[];
  contextBefore: Word[];
  contextAfter: Word[];
  onSeek: (time: number) => void;
  currentTime: number;
  onExtendBefore: () => void;
  onExtendAfter: () => void;
  canExtendBefore: boolean;
  extending: "before" | "after" | null;
  onSaved?: () => void;
}

type Mode = "timeline" | "transcript";

export function TrimEditor({
  candidateId,
  viewStart,
  viewEnd,
  trimIn: initialTrimIn,
  trimOut: initialTrimOut,
  words,
  contextBefore,
  contextAfter,
  onSeek,
  currentTime,
  onExtendBefore,
  onExtendAfter,
  canExtendBefore,
  extending,
  onSaved,
}: TrimEditorProps) {
  const [mode, setMode] = useState<Mode>("transcript");
  const [trimIn, setTrimIn] = useState(initialTrimIn);
  const [trimOut, setTrimOut] = useState(initialTrimOut);
  const [isPending, startTransition] = useTransition();

  const duration = viewEnd - viewStart;

  const handleTrimChange = (newIn: number, newOut: number) => {
    setTrimIn(newIn);
    setTrimOut(newOut);
  };

  const handleSave = () => {
    startTransition(async () => {
      await updateCandidateTrim(candidateId, trimIn, trimOut);
      onSaved?.();
    });
  };

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={mode === "timeline" ? "default" : "outline"}
            onClick={() => setMode("timeline")}
          >
            Timeline
          </Button>
          <Button
            size="sm"
            variant={mode === "transcript" ? "default" : "outline"}
            onClick={() => setMode("transcript")}
          >
            Transcript
          </Button>
        </div>
        <Button size="sm" onClick={handleSave} disabled={isPending}>
          {isPending ? "Saving…" : "Save Trim"}
        </Button>
      </div>

      {/* Editor */}
      {mode === "timeline" ? (
        <TimelineTrim
          duration={duration}
          trimIn={trimIn - viewStart}
          trimOut={trimOut - viewStart}
          currentTime={currentTime - viewStart}
          onTrimChange={(inOff, outOff) =>
            handleTrimChange(viewStart + inOff, viewStart + outOff)
          }
          onSeek={(offset) => onSeek(viewStart + offset)}
          onExtendBefore={onExtendBefore}
          onExtendAfter={onExtendAfter}
          canExtendBefore={canExtendBefore}
          extending={extending}
        />
      ) : (
        <TranscriptTrim
          words={words}
          trimIn={trimIn}
          trimOut={trimOut}
          contextBefore={contextBefore}
          contextAfter={contextAfter}
          onTrimChange={handleTrimChange}
          onWordClick={onSeek}
          onExtendBefore={onExtendBefore}
          onExtendAfter={onExtendAfter}
          canExtendBefore={canExtendBefore}
          extending={extending}
        />
      )}
    </div>
  );
}
