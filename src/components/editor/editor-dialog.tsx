"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Play, Pause, Loader2, Layers } from "lucide-react";
import { getCandidateForEditing } from "@/actions/candidate-actions";
import { TrimEditor } from "./trim-editor";

interface Word {
  word: string;
  startTime: number;
  endTime: number;
  speaker?: string;
}

interface EditorDialogProps {
  candidateId: string;
  sourceVideoPath: string;
  vertical: boolean;
  multiSpeaker?: boolean;
  stacked?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

interface LoadedData {
  candidateId: string;
  startTime: number;
  endTime: number;
  trimIn: number;
  trimOut: number;
  words: Word[];
  contextBefore: Word[];
  contextAfter: Word[];
}

const INITIAL_CONTEXT_SECONDS = 20;
const EXTEND_STEP_SECONDS = 60;

const VERTICAL_SAFE_WIDTH_PCT = (81 / 256) * 100;
const VERTICAL_SIDE_MASK_PCT = (100 - VERTICAL_SAFE_WIDTH_PCT) / 2;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function EditorDialog({
  candidateId,
  sourceVideoPath,
  vertical,
  multiSpeaker = false,
  stacked = false,
  open,
  onOpenChange,
  onSaved,
}: EditorDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [data, setData] = useState<LoadedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [contextBeforeSec, setContextBeforeSec] = useState(INITIAL_CONTEXT_SECONDS);
  const [contextAfterSec, setContextAfterSec] = useState(INITIAL_CONTEXT_SECONDS);
  const [extending, setExtending] = useState<"before" | "after" | null>(null);

  // Load candidate editing data when dialog opens
  useEffect(() => {
    if (!open) {
      setData(null);
      setPlaying(false);
      setContextBeforeSec(INITIAL_CONTEXT_SECONDS);
      setContextAfterSec(INITIAL_CONTEXT_SECONDS);
      setExtending(null);
      return;
    }
    setLoading(true);
    getCandidateForEditing(candidateId, INITIAL_CONTEXT_SECONDS, INITIAL_CONTEXT_SECONDS)
      .then((result) => {
        if (!result) {
          setData(null);
          return;
        }
        setData({
          candidateId: result.candidate.id,
          startTime: result.candidate.startTime,
          endTime: result.candidate.endTime,
          trimIn: result.candidate.trimIn,
          trimOut: result.candidate.trimOut,
          words: result.words,
          contextBefore: result.contextBefore,
          contextAfter: result.contextAfter,
        });
        setCurrentTime(result.candidate.trimIn);
      })
      .finally(() => setLoading(false));
  }, [open, candidateId]);

  const handleExtend = useCallback(
    async (direction: "before" | "after") => {
      if (!data || extending) return;
      const nextBefore =
        direction === "before" ? contextBeforeSec + EXTEND_STEP_SECONDS : contextBeforeSec;
      const nextAfter =
        direction === "after" ? contextAfterSec + EXTEND_STEP_SECONDS : contextAfterSec;
      setExtending(direction);
      try {
        const result = await getCandidateForEditing(candidateId, nextBefore, nextAfter);
        if (!result || !("candidate" in result) || !result.candidate) return;
        setData((prev) =>
          prev
            ? {
                ...prev,
                words: result.words,
                contextBefore: result.contextBefore,
                contextAfter: result.contextAfter,
              }
            : prev,
        );
        if (direction === "before") setContextBeforeSec(nextBefore);
        else setContextAfterSec(nextAfter);
      } finally {
        setExtending(null);
      }
    },
    [candidateId, contextBeforeSec, contextAfterSec, data, extending],
  );

  // The view range spans all currently-loaded context, not the candidate's
  // original bounds. Derive from the earliest/latest loaded word so the
  // timeline accurately reflects what the user can scrub through.
  const viewStart = data
    ? (data.contextBefore[0]?.startTime ??
      data.words[0]?.startTime ??
      data.startTime)
    : 0;
  const viewEnd = data
    ? (data.contextAfter[data.contextAfter.length - 1]?.endTime ??
      data.words[data.words.length - 1]?.endTime ??
      data.endTime)
    : 0;

  const canExtendBefore = data ? data.startTime - contextBeforeSec > 0 : false;

  // Seek the video element when currentTime changes from outside
  const onSeek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
    setCurrentTime(time);
  }, []);

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
    // Auto-pause when we run past the trim-out edge
    if (data && video.currentTime >= data.trimOut) {
      video.pause();
      setPlaying(false);
      video.currentTime = data.trimIn;
    }
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video || !data) return;
    video.currentTime = data.trimIn;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Edit trim</DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading transcript…
          </div>
        )}

        {!loading && !data && (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Could not load this candidate.
          </p>
        )}

        {!loading && data && (
          <div className="space-y-4">
            {/* Video with trim-range playback + optional vertical overlay */}
            <div className="relative">
              <video
                ref={videoRef}
                src={`/api/video/stream?path=${encodeURIComponent(sourceVideoPath)}`}
                className="w-full rounded-md bg-black block max-h-[45vh]"
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
                onClick={togglePlayPause}
              />

              {vertical && !stacked && (
                <div className="absolute inset-0 pointer-events-none rounded-md overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-black/70"
                    style={{ width: `${VERTICAL_SIDE_MASK_PCT}%` }}
                  />
                  <div
                    className="absolute inset-y-0 right-0 bg-black/70"
                    style={{ width: `${VERTICAL_SIDE_MASK_PCT}%` }}
                  />
                  <div
                    className="absolute inset-y-0 border-2 border-green-500"
                    style={{
                      left: `${VERTICAL_SIDE_MASK_PCT}%`,
                      width: `${VERTICAL_SAFE_WIDTH_PCT}%`,
                    }}
                  />
                  <div className="absolute top-1 left-1/2 -translate-x-1/2 bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded leading-none">
                    9:16 EXPORT
                  </div>
                </div>
              )}

              {vertical && stacked && (
                <div className="absolute inset-0 pointer-events-none rounded-md overflow-hidden">
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-blue-600 text-white text-[10px] font-bold px-2.5 py-1 rounded leading-none shadow-lg">
                    <Layers className="h-3 w-3" />
                    <span>STACKED 9:16 EXPORT</span>
                  </div>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/75 text-white/90 text-[10px] px-2 py-0.5 rounded leading-none whitespace-nowrap">
                    Final export stacks the two speakers top/bottom
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <Button variant="outline" size="sm" onClick={togglePlayPause}>
                {playing ? <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
                {playing ? "Pause" : "Play clip"}
              </Button>
              <div className="text-xs text-muted-foreground tabular-nums">
                {formatTime(currentTime - data.startTime)} /{" "}
                {formatTime(data.endTime - data.startTime)}
              </div>
            </div>

            <TrimEditor
              candidateId={data.candidateId}
              viewStart={viewStart}
              viewEnd={viewEnd}
              trimIn={data.trimIn}
              trimOut={data.trimOut}
              words={data.words}
              contextBefore={data.contextBefore}
              contextAfter={data.contextAfter}
              onSeek={onSeek}
              currentTime={currentTime}
              onExtendBefore={() => handleExtend("before")}
              onExtendAfter={() => handleExtend("after")}
              canExtendBefore={canExtendBefore}
              extending={extending}
              onSaved={() => {
                onSaved?.();
                onOpenChange(false);
              }}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
