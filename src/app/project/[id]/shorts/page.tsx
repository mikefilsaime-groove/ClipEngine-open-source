import { notFound } from "next/navigation";
import { getCandidates } from "@/actions/candidate-actions";
import { PreviewQualityBanner } from "@/components/review/preview-quality-banner";
import { PreviewSizeWrapper } from "@/components/review/preview-size-picker";
import { ShortsTabs } from "@/components/review/shorts-tabs";
import { db } from "@/lib/db";

export default async function ShortsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await db.project.findUnique({
    where: { id },
    select: { sourceVideoPath: true },
  });
  if (!project) notFound();

  const candidates = await getCandidates(id, "short");

  const classic = candidates.filter((c) => (c.trimOut - c.trimIn) <= 60);
  const extended = candidates.filter((c) => (c.trimOut - c.trimIn) > 60);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Shorts</h1>
        <p className="text-muted-foreground mt-1">
          {candidates.length} candidates &middot; Classic (&le;60s) and Extended (1-3 min)
        </p>
      </div>

      <PreviewQualityBanner projectId={id} />

      {candidates.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">
          No shorts generated yet. Run the processing pipeline first.
        </p>
      ) : (
        <PreviewSizeWrapper defaultSize="large">
          <ShortsTabs
            projectId={id}
            classic={classic}
            extended={extended}
            sourceVideoPath={project.sourceVideoPath}
          />
        </PreviewSizeWrapper>
      )}
    </div>
  );
}
