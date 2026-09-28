import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getJobProgress } from "@/lib/render-worker";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ jobId: string }>;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const { jobId } = await context.params;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {}
      };

      const job = await db.renderJob.findUnique({
        where: { id: jobId },
        include: { items: { orderBy: { orderIndex: "asc" } } },
      });

      if (!job) {
        send("error", { message: "Job not found" });
        close();
        return;
      }

      send("snapshot", {
        job: {
          id: job.id,
          status: job.status,
          totalItems: job.totalItems,
          completedItems: job.completedItems,
          failedItems: job.failedItems,
          estimatedSeconds: job.estimatedSeconds,
          actualSeconds: job.actualSeconds,
          startedAt: job.startedAt,
          finishedAt: job.finishedAt,
        },
        items: job.items.map((it) => ({
          id: it.id,
          candidateId: it.candidateId,
          title: it.title,
          duration: it.duration,
          isVertical: it.isVertical,
          status: it.status,
          progressPct: it.progressPct,
          outputPath: it.outputPath,
          errorMessage: it.errorMessage,
        })),
      });

      if (job.status === "complete" || job.status === "failed" || job.status === "cancelled") {
        send("complete", { status: job.status });
        close();
        return;
      }

      const interval = setInterval(async () => {
        try {
          const snapshot = await db.renderJob.findUnique({
            where: { id: jobId },
            include: { items: { orderBy: { orderIndex: "asc" } } },
          });
          if (!snapshot) {
            send("error", { message: "Job disappeared" });
            clearInterval(interval);
            close();
            return;
          }

          const memoryProgress = getJobProgress(jobId);

          send("update", {
            job: {
              status: snapshot.status,
              completedItems: snapshot.completedItems,
              failedItems: snapshot.failedItems,
              actualSeconds: snapshot.actualSeconds,
              finishedAt: snapshot.finishedAt,
            },
            items: snapshot.items.map((it) => {
              const livePct = memoryProgress?.itemProgress[it.id]?.pct;
              return {
                id: it.id,
                status: it.status,
                progressPct:
                  it.status === "running" && livePct !== undefined
                    ? livePct
                    : it.progressPct,
                outputPath: it.outputPath,
                errorMessage: it.errorMessage,
              };
            }),
          });

          if (
            snapshot.status === "complete" ||
            snapshot.status === "failed" ||
            snapshot.status === "cancelled"
          ) {
            send("complete", { status: snapshot.status });
            clearInterval(interval);
            close();
          }
        } catch (err) {
          console.error("[render-stream] tick error:", err);
        }
      }, 500);

      const abortListener = () => {
        clearInterval(interval);
        close();
      };
      _req.signal.addEventListener("abort", abortListener);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
