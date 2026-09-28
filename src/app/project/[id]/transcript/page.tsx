import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { TranscriptClient } from "./transcript-client";

export default async function TranscriptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const project = await db.project.findUnique({
    where: { id },
    select: { id: true, name: true },
  });

  if (!project) notFound();

  const transcript = await db.transcript.findUnique({
    where: { projectId: id },
    select: { id: true },
  });

  const segments = transcript
    ? await db.transcriptSegment.findMany({
        where: { transcriptId: transcript.id },
        orderBy: { startTime: "asc" },
        select: {
          id: true,
          word: true,
          startTime: true,
          endTime: true,
          speaker: true,
        },
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Transcript</h1>
        <p className="text-sm text-muted-foreground mt-1">{project.name}</p>
      </div>

      <TranscriptClient projectId={id} segments={segments} />
    </div>
  );
}
