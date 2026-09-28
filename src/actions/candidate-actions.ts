"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getCandidates(projectId: string, type: "clip" | "short") {
  const candidates = await db.candidate.findMany({
    where: { projectId, type },
    orderBy: { viralityScore: "desc" },
    include: {
      frontBumper: { select: { id: true, name: true } },
      rearBumper: { select: { id: true, name: true } },
    },
  });

  if (candidates.length === 0) return [];

  // Derive multi-speaker flag per candidate from the diarized transcript so
  // the UI can swap the fixed center-crop preview for a "smart framing"
  // badge when the export will track the active speaker.
  const transcript = await db.transcript.findUnique({
    where: { projectId },
    select: { id: true },
  });

  if (!transcript) {
    return candidates.map((c) => ({ ...c, multiSpeaker: false }));
  }

  const segments = await db.transcriptSegment.findMany({
    where: { transcriptId: transcript.id },
    select: { startTime: true, speaker: true },
    orderBy: { startTime: "asc" },
  });

  return candidates.map((c) => {
    const speakers = new Set<string>();
    for (const s of segments) {
      if (s.startTime < c.startTime) continue;
      if (s.startTime > c.endTime) break;
      speakers.add(s.speaker);
      if (speakers.size > 1) break;
    }
    return { ...c, multiSpeaker: speakers.size > 1 };
  });
}

export async function getCandidateForEditing(
  id: string,
  contextBeforeSeconds: number = 20,
  contextAfterSeconds: number = 20,
) {
  const candidate = await db.candidate.findUnique({
    where: { id },
  });
  if (!candidate) return null;

  const transcript = await db.transcript.findUnique({
    where: { projectId: candidate.projectId },
    select: { id: true },
  });
  if (!transcript) return { candidate, words: [], contextBefore: [], contextAfter: [] };

  const rangeStart = Math.max(0, candidate.startTime - contextBeforeSeconds);
  const rangeEnd = candidate.endTime + contextAfterSeconds;

  const segments = await db.transcriptSegment.findMany({
    where: {
      transcriptId: transcript.id,
      startTime: { gte: rangeStart, lte: rangeEnd },
    },
    orderBy: { startTime: "asc" },
    select: {
      word: true,
      startTime: true,
      endTime: true,
      speaker: true,
    },
  });

  const words = segments.filter(
    (s) => s.startTime >= candidate.startTime && s.endTime <= candidate.endTime,
  );
  const contextBefore = segments.filter((s) => s.endTime < candidate.startTime);
  const contextAfter = segments.filter((s) => s.startTime > candidate.endTime);

  return { candidate, words, contextBefore, contextAfter };
}

export async function updateCandidateStatus(id: string, status: string) {
  const candidate = await db.candidate.update({
    where: { id },
    data: { status },
  });
  revalidatePath(`/project/${candidate.projectId}`);
  return candidate;
}

export async function updateCandidateTrim(id: string, trimIn: number, trimOut: number) {
  const candidate = await db.candidate.update({
    where: { id },
    data: { trimIn, trimOut },
  });
  revalidatePath(`/project/${candidate.projectId}`);
  return candidate;
}

export async function updateCandidateQuality(id: string, exportQuality: string | null) {
  const candidate = await db.candidate.update({
    where: { id },
    data: { exportQuality },
  });
  revalidatePath(`/project/${candidate.projectId}`);
  return candidate;
}

export async function bulkUpdateStatus(
  projectId: string,
  type: "clip" | "short",
  filter: { minScore?: number; maxScore?: number },
  status: string,
) {
  // Build where clause with score filters
  const where: any = { projectId, type };
  if (filter.minScore !== undefined) {
    where.viralityScore = { ...where.viralityScore, gte: filter.minScore };
  }
  if (filter.maxScore !== undefined) {
    where.viralityScore = { ...where.viralityScore, lte: filter.maxScore };
  }

  await db.candidate.updateMany({ where, data: { status } });
  revalidatePath(`/project/${projectId}`);
}
