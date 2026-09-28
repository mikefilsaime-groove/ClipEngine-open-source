"use client";

import { useState } from "react";
import { TranscriptSearch } from "@/components/transcript/transcript-search";
import { TranscriptViewer } from "@/components/transcript/transcript-viewer";

interface Segment {
  id: string;
  word: string;
  startTime: number;
  endTime: number;
  speaker: string;
}

interface TranscriptClientProps {
  projectId: string;
  segments: Segment[];
}

export function TranscriptClient({ projectId, segments }: TranscriptClientProps) {
  const [currentTime, setCurrentTime] = useState(0);

  return (
    <div className="space-y-6">
      <TranscriptSearch
        projectId={projectId}
        onResultClick={(timestamp) => setCurrentTime(timestamp)}
      />
      <TranscriptViewer
        segments={segments}
        currentTime={currentTime}
        onWordClick={(time) => setCurrentTime(time)}
      />
    </div>
  );
}
