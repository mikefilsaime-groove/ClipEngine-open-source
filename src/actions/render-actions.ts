"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getApprovedCandidates(projectId: string) {
  return db.candidate.findMany({
    where: { projectId, status: "approved" },
    orderBy: { createdAt: "asc" },
  });
}

export async function getRenderQueue(projectId: string) {
  return db.candidate.findMany({
    where: {
      projectId,
      status: { in: ["approved", "rendering", "rendered", "failed"] },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function startRender(projectId: string) {
  await db.candidate.updateMany({
    where: { projectId, status: "approved" },
    data: { status: "rendering" },
  });

  await db.project.update({
    where: { id: projectId },
    data: { status: "rendering" },
  });

  revalidatePath(`/project/${projectId}/render`);
}

export async function markRendered(candidateId: string, outputPath: string) {
  const candidate = await db.candidate.update({
    where: { id: candidateId },
    data: { status: "rendered", outputPath },
  });
  revalidatePath(`/project/${candidate.projectId}/render`);
  return candidate;
}

export async function markRenderFailed(candidateId: string) {
  const candidate = await db.candidate.update({
    where: { id: candidateId },
    data: { status: "failed" },
  });
  revalidatePath(`/project/${candidate.projectId}/render`);
  return candidate;
}
