import { notFound } from "next/navigation";
import { getCandidates } from "@/actions/candidate-actions";
import { CandidateList } from "@/components/review/candidate-list";
import { PreviewQualityBanner } from "@/components/review/preview-quality-banner";
import { PreviewSizeWrapper } from "@/components/review/preview-size-picker";
import { db } from "@/lib/db";

export default async function ClipsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await db.project.findUnique({
    where: { id },
    select: { sourceVideoPath: true },
  });
  if (!project) notFound();

  const candidates = await getCandidates(id, "clip");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Clips</h1>
        <p className="text-muted-foreground mt-1">
          {candidates.length} candidates &middot; 3-20 minutes, landscape
        </p>
      </div>

      <PreviewQualityBanner projectId={id} />

      {candidates.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">
          No clips generated yet. Run the processing pipeline first.
        </p>
      ) : (
        <PreviewSizeWrapper defaultSize="large">
          <CandidateList
            projectId={id}
            type="clip"
            candidates={candidates}
            sourceVideoPath={project.sourceVideoPath}
          />
        </PreviewSizeWrapper>
      )}
    </div>
  );
}
