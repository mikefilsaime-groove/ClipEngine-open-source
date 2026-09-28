"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchResultWord {
  word: string;
  startTime: number;
  endTime: number;
  speaker: string;
}

interface SearchResult {
  segmentId: string;
  word: string;
  startTime: number;
  endTime: number;
  speaker: string;
  contextBefore: SearchResultWord[];
  contextAfter: SearchResultWord[];
}

interface TranscriptSearchProps {
  projectId: string;
  onResultClick: (timestamp: number) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function TranscriptSearch({ projectId, onResultClick }: TranscriptSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ projectId, q: query });
        const res = await fetch(`/api/search?${params}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results ?? []);
        }
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, projectId]);

  return (
    <div className="space-y-3">
      <Input
        placeholder="Search transcript…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {isLoading && (
        <p className="text-xs text-muted-foreground animate-pulse">Searching…</p>
      )}

      {!isLoading && query.length >= 2 && results.length === 0 && (
        <p className="text-xs text-muted-foreground">No results for &ldquo;{query}&rdquo;</p>
      )}

      {results.length > 0 && (
        <ul className="space-y-1">
          {results.map((result) => (
            <li
              key={result.segmentId}
              className="rounded-md border bg-card px-3 py-2 text-sm cursor-pointer hover:bg-accent transition-colors"
              onClick={() => onResultClick(result.startTime)}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-primary">
                  {formatTime(result.startTime)}
                </span>
                <span className="text-xs text-muted-foreground">{result.speaker}</span>
              </div>
              <p className="text-muted-foreground/60 leading-snug">
                {result.contextBefore.map((w) => w.word).join(" ")}{" "}
                <span className="font-semibold text-foreground bg-primary/20 rounded px-0.5">
                  {result.word}
                </span>{" "}
                {result.contextAfter.map((w) => w.word).join(" ")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
