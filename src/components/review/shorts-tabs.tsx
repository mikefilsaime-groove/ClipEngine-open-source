"use client";

import { useState } from "react";
import { CandidateList } from "./candidate-list";
import { cn } from "@/lib/utils";
import type { Candidate } from "@/generated/prisma/client";

type CandidateWithExtras = Candidate & {
  multiSpeaker: boolean;
  frontBumper?: { id: string; name: string } | null;
  rearBumper?: { id: string; name: string } | null;
};

interface ShortsTabsProps {
  projectId: string;
  classic: CandidateWithExtras[];
  extended: CandidateWithExtras[];
  sourceVideoPath: string;
}

export function ShortsTabs({
  projectId,
  classic,
  extended,
  sourceVideoPath,
}: ShortsTabsProps) {
  const [tab, setTab] = useState<"classic" | "extended">("classic");
  const current = tab === "classic" ? classic : extended;

  return (
    <div className="space-y-4">
      <div className="flex rounded-md border border-input overflow-hidden w-fit">
        <button
          onClick={() => setTab("classic")}
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors",
            tab === "classic"
              ? "bg-primary text-primary-foreground"
              : "bg-background text-muted-foreground hover:text-foreground",
          )}
        >
          Classic
          <span className="ml-1.5 text-xs opacity-70">
            &le;60s ({classic.length})
          </span>
        </button>
        <button
          onClick={() => setTab("extended")}
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors",
            tab === "extended"
              ? "bg-primary text-primary-foreground"
              : "bg-background text-muted-foreground hover:text-foreground",
          )}
        >
          Extended
          <span className="ml-1.5 text-xs opacity-70">
            1-3 min ({extended.length})
          </span>
        </button>
      </div>

      {current.length === 0 ? (
        <p className="text-muted-foreground text-center py-8 text-sm">
          {tab === "classic"
            ? "No classic shorts found (under 60 seconds)."
            : "No extended shorts found (1-3 minutes). Enable 'Find extended shorts' in Project Settings before processing."}
        </p>
      ) : (
        <CandidateList
          projectId={projectId}
          type="short"
          candidates={current}
          sourceVideoPath={sourceVideoPath}
        />
      )}
    </div>
  );
}
