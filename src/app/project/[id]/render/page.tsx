import { db } from "@/lib/db";
import { RenderClient } from "@/components/render/render-client";
import { estimateTotalSeconds, type EstimateItem } from "@/lib/render-estimate";
import { parseFaceLayout } from "@/lib/face-layout";

export const dynamic = "force-dynamic";

export default async function RenderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const project = await db.project.findUnique({
    where: { id },
    include: { settings: true },
  });
  if (!project) {
    return <div className="p-8">Project not found</div>;
  }

  const approved = await db.candidate.findMany({
    where: { projectId: id, status: "approved" },
    orderBy: { createdAt: "asc" },
  });

  // Already rendered candidates — always visible on the render page
  const rendered = await db.candidate.findMany({
    where: { projectId: id, status: "rendered" },
    orderBy: { createdAt: "asc" },
  });

  const activeJob = await db.renderJob.findFirst({
    where: {
      projectId: id,
      status: { in: ["queued", "running"] },
    },
    orderBy: { createdAt: "desc" },
  });

  const settings = project.settings;
  const defaultQuality = settings?.defaultExportQuality ?? "1080p";

  const estimateItems: EstimateItem[] = approved.map((c) => {
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

  return (
    <RenderClient
      projectId={id}
      defaultQuality={defaultQuality}
      approved={approved.map((c) => ({
        id: c.id,
        title: c.title,
        type: c.type,
        duration: c.trimOut - c.trimIn,
        viralityScore: c.viralityScore,
        exportQuality: c.exportQuality,
      }))}
      rendered={rendered.map((c) => ({
        id: c.id,
        title: c.title,
        type: c.type,
        duration: c.trimOut - c.trimIn,
        viralityScore: c.viralityScore,
        outputPath: c.outputPath,
        previewPath: c.previewPath,
      }))}
      existingJobId={activeJob?.id ?? null}
      estimatedSeconds={estimatedSeconds}
    />
  );
}
