"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface VideoPreviewProps {
  previewPath: string;
  vertical?: boolean;
  multiSpeaker?: boolean;
  stacked?: boolean;
}

// For a 16:9 source center-cropped to 9:16, the safe-area width is
// (9/16) / (16/9) = 81/256 ≈ 31.64% of the source width.
const VERTICAL_SAFE_WIDTH_PCT = (81 / 256) * 100;
const VERTICAL_SIDE_MASK_PCT = (100 - VERTICAL_SAFE_WIDTH_PCT) / 2;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VideoPreview({
  previewPath,
  vertical = false,
  multiSpeaker = false,
  stacked = false,
}: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const isScrubbing = useRef(false);
  const wasPlayingBeforeScrub = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

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

  const restart = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    video.play();
    setPlaying(true);
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration);
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || isScrubbing.current) return;
    setCurrentTime(video.currentTime);
  };

  const handleEnded = () => setPlaying(false);

  const seekFromEvent = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      const video = videoRef.current;
      if (!track || !video || !Number.isFinite(video.duration)) return;
      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const newTime = ratio * video.duration;
      video.currentTime = newTime;
      setCurrentTime(newTime);
    },
    [],
  );

  const handleScrubStart = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const video = videoRef.current;
    if (!video) return;
    isScrubbing.current = true;
    wasPlayingBeforeScrub.current = !video.paused;
    if (!video.paused) {
      video.pause();
      setPlaying(false);
    }
    seekFromEvent(e.clientX);
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!isScrubbing.current) return;
      seekFromEvent(e.clientX);
    };
    const handleUp = () => {
      if (!isScrubbing.current) return;
      isScrubbing.current = false;
      const video = videoRef.current;
      if (video && wasPlayingBeforeScrub.current) {
        video.play();
        setPlaying(true);
      }
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [seekFromEvent]);

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="relative">
        <video
          ref={videoRef}
          src={`/api/video/stream?path=${encodeURIComponent(previewPath)}`}
          className="w-full rounded-md bg-black block"
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onClick={togglePlayPause}
        />

        {vertical && !stacked && (
          <>
            {/* Non-interactive center-crop visualization */}
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
                className="absolute inset-y-0 border-2 border-green-500 shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
                style={{
                  left: `${VERTICAL_SIDE_MASK_PCT}%`,
                  width: `${VERTICAL_SAFE_WIDTH_PCT}%`,
                }}
              />
            </div>
            {/* Clickable label with explanation popover */}
            <div className="absolute top-1 left-1/2 -translate-x-1/2 z-10">
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded leading-none hover:bg-green-600 transition-colors cursor-help"
                    aria-label="What does 9:16 EXPORT mean?"
                  >
                    9:16 EXPORT
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-72 text-xs" align="center">
                  <p className="font-semibold text-sm mb-1">
                    9:16 Vertical Export
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    This short will be center-cropped from your landscape
                    source to vertical 9:16. The green outline shows the
                    safe area that will be included in the final export —
                    everything in the dark side bars will be cut.
                  </p>
                </PopoverContent>
              </Popover>
            </div>
          </>
        )}

        {vertical && stacked && (
          // Preview is already rendered in the stacked 9:16 layout.
          <div className="absolute top-1 left-1/2 -translate-x-1/2 z-10">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1 bg-blue-600 text-white text-[9px] font-bold px-2 py-0.5 rounded leading-none shadow-lg hover:bg-blue-700 transition-colors cursor-help"
                  aria-label="What does STACKED 9:16 mean?"
                >
                  <Layers className="h-2.5 w-2.5" />
                  <span>STACKED 9:16</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 text-xs" align="center">
                <p className="font-semibold text-sm mb-1">
                  Stacked 9:16 Layout
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  This short has two speakers in the source frame. Instead
                  of a center crop that would lose one of the faces, we
                  detected both speakers and stacked them vertically —
                  speaker on the left goes on top, speaker on the right
                  goes on bottom. The preview you&apos;re watching is
                  already in the final stacked layout.
                </p>
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      {/* Scrub bar */}
      <div
        ref={trackRef}
        className="relative h-2 bg-muted rounded-full cursor-pointer group select-none"
        onMouseDown={handleScrubStart}
      >
        {/* Hit area expansion for easier grabbing */}
        <div className="absolute -top-2 -bottom-2 inset-x-0" />
        {/* Fill */}
        <div
          className="absolute inset-y-0 left-0 bg-primary rounded-full pointer-events-none"
          style={{ width: `${progressPct}%` }}
        />
        {/* Handle */}
        <div
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
          style={{ left: `${progressPct}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={togglePlayPause}>
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            <span className="ml-1">{playing ? "Pause" : "Play"}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={restart}>
            <RotateCcw className="h-4 w-4" />
            <span className="ml-1">Restart</span>
          </Button>
        </div>
        <div className="text-xs text-muted-foreground tabular-nums">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>
    </div>
  );
}
