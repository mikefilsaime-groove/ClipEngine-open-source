import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runRenderJob } from "@/lib/render-worker";
import { estimateTotalSeconds, type EstimateItem } from "@/lib/render-estimate";
import { parseFaceLayout } from "@/lib/face-layout";

export async function POST(request: NextRequest) {
  let body: { projectId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { projectId } = body;
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { settings: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Pull all approved candidates — they become the job's items.
  const candidates = await db.candidate.findMany({
    where: { projectId, status: "approved" },
    orderBy: { createdAt: "asc" },
  });

  if (candidates.length === 0) {
    return NextResponse.json(
      { error: "No approved candidates to render" },
      { status: 400 },
    );
  }

  const settings = project.settings;
  const defaultQuality = (settings?.defaultExportQuality ?? "1080p") as
    | "720p"
    | "1080p"
    | "4k";

  // Build the estimate input based on each candidate's resolved quality
  // and feature flags.
  const estimateItems: EstimateItem[] = candidates.map((c) => {
    const quality = (c.exportQuality ?? defaultQuality) as "720p" | "1080p" | "4k";
    const isVertical = c.type === "short";
    return {
      duration: c.trimOut - c.trimIn,
      quality,
      hasCaptions: settings?.captionsEnabled ?? false,
      hasBumpers: !isVertical && (!!c.frontBumperId || !!c.rearBumperId),
      hasWatermark: !!c.watermarkOverride || (settings?.watermarkEnabled ?? false),
      hasBranding: !!c.brandingOverride || (settings?.brandStripEnabled ?? false),
      isStacked: isVertical && parseFaceLayout(c.faceLayout) !== null,
    };
  });

  const estimatedSeconds = estimateTotalSeconds(estimateItems);

  // Flip all approved candidates to "rendering" so the UI badges update.
  await db.candidate.updateMany({
    where: { projectId, status: "approved" },
    data: { status: "rendering" },
  });

  // Create the job + items in a single transaction.
  const job = await db.renderJob.create({
    data: {
      projectId,
      status: "queued",
      totalItems: candidates.length,
      quality: defaultQuality,
      estimatedSeconds,
      items: {
        create: candidates.map((c, idx) => ({
          candidateId: c.id,
          orderIndex: idx,
          title: c.title,
          duration: c.trimOut - c.trimIn,
          isVertical: c.type === "short",
          status: "pending",
        })),
      },
    },
  });

  await db.project.update({
    where: { id: projectId },
    data: { status: "rendering" },
  });

  // Fire-and-forget — the worker runs in the background, client reconnects
  // via the /stream SSE endpoint and doesn't need to hold this request open.
  runRenderJob(job.id).catch((err) => {
    console.error(`[render] worker crashed for job ${job.id}:`, err);
  });

  return NextResponse.json({
    jobId: job.id,
    totalItems: job.totalItems,
    estimatedSeconds: job.estimatedSeconds,
  });
}
