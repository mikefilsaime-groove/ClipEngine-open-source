"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { bulkUpdateStatus } from "@/actions/candidate-actions";
import { FindMoreDialog } from "./find-more-dialog";

interface BulkActionsProps {
  projectId: string;
  type: "clip" | "short";
  totalCount: number;
  approvedCount: number;
  discardedCount: number;
}

export function BulkActions({ projectId, type, totalCount, approvedCount, discardedCount }: BulkActionsProps) {
  const router = useRouter();
  const [threshold, setThreshold] = useState(75);
  const [findMoreOpen, setFindMoreOpen] = useState(false);

  async function approveAbove() {
    await bulkUpdateStatus(projectId, type, { minScore: threshold }, "approved");
    router.refresh();
  }

  async function discardBelow() {
    await bulkUpdateStatus(projectId, type, { maxScore: threshold - 1 }, "discarded");
    router.refresh();
  }

  const typeLabel = type === "clip" ? "clips" : "shorts";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 p-4 rounded-lg border bg-card flex-wrap">
        <div className="text-sm text-muted-foreground">
          {totalCount} total &middot; {approvedCount} approved &middot; {discardedCount} discarded
        </div>
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={() => setFindMoreOpen(true)}>
          <Sparkles className="h-4 w-4 mr-1" />
          Find more {typeLabel}
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm">Score threshold:</span>
          <Input
            type="number"
            min={0}
            max={100}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="w-20"
          />
          <Button size="sm" variant="outline" onClick={approveAbove}>
            Approve &ge; {threshold}
          </Button>
          <Button size="sm" variant="outline" onClick={discardBelow}>
            Discard &lt; {threshold}
          </Button>
        </div>
      </div>

      <FindMoreDialog
        open={findMoreOpen}
        onOpenChange={setFindMoreOpen}
        projectId={projectId}
        type={type}
        onComplete={() => router.refresh()}
      />
    </div>
  );
}
