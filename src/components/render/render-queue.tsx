"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RenderItem } from "./render-item";
import { startRender } from "@/actions/render-actions";
import { Loader2, Play } from "lucide-react";
import type { Candidate } from "@/generated/prisma/client";

interface RenderQueueProps {
  projectId: string;
  candidates: Candidate[];
}

export function RenderQueue({ projectId, candidates }: RenderQueueProps) {
  const router = useRouter();
  const [isRendering, setIsRendering] = useState(false);

  const approved = candidates.filter((c) => c.status === "approved");
  const queued = candidates.filter((c) => c.status === "rendering").length;
  const done = candidates.filter((c) => c.status === "rendered").length;
  const failed = candidates.filter((c) => c.status === "failed").length;

  const handleRender = async () => {
    if (isRendering || approved.length === 0) return;
    setIsRendering(true);

    try {
      await startRender(projectId);

      const res = await fetch("/api/video/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("Render API error:", err);
      }
    } catch (err) {
      console.error("Render failed:", err);
    } finally {
      setIsRendering(false);
      router.refresh();
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats + action bar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-6 text-sm text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground">{queued}</span> rendering
          </span>
          <span>
            <span className="font-semibold text-green-600">{done}</span> done
          </span>
          <span>
            <span className="font-semibold text-red-500">{failed}</span> failed
          </span>
        </div>

        <Button
          onClick={handleRender}
          disabled={isRendering || approved.length === 0}
        >
          {isRendering ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Rendering…
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Render {approved.length} Approved
            </>
          )}
        </Button>
      </div>

      {/* Queue list */}
      {candidates.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">
          No items in the render queue. Approve candidates in Clips or Shorts first.
        </p>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Render Queue</CardTitle>
          </CardHeader>
          <CardContent>
            {candidates.map((candidate) => (
              <RenderItem key={candidate.id} candidate={candidate} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
