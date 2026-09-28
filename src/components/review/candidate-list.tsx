"use client";

import { CandidateCard } from "./candidate-card";
import { BulkActions } from "./bulk-actions";
import { usePreviewSize, getGridClasses } from "./preview-size-picker";
import type { Candidate } from "@/generated/prisma/client";

type CandidateWithExtras = Candidate & {
  multiSpeaker: boolean;
  frontBumper?: { id: string; name: string } | null;
  rearBumper?: { id: string; name: string } | null;
};

interface CandidateListProps {
  projectId: string;
  type: "clip" | "short";
  candidates: CandidateWithExtras[];
  sourceVideoPath: string;
}

export function CandidateList({ projectId, type, candidates, sourceVideoPath }: CandidateListProps) {
  const size = usePreviewSize();
  const approvedCount = candidates.filter((c) => c.status === "approved").length;
  const discardedCount = candidates.filter((c) => c.status === "discarded").length;

  return (
    <div className="space-y-4">
      <BulkActions
        projectId={projectId}
        type={type}
        totalCount={candidates.length}
        approvedCount={approvedCount}
        discardedCount={discardedCount}
      />
      <div className={`grid gap-4 ${getGridClasses(size)}`}>
        {candidates.map((candidate) => (
          <CandidateCard
            key={candidate.id}
            candidate={candidate}
            type={type}
            sourceVideoPath={sourceVideoPath}
            projectId={projectId}
          />
        ))}
      </div>
    </div>
  );
}
