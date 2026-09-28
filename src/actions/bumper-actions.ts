"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getBumpers() {
  return db.bumperVideo.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function getBumper(id: string) {
  return db.bumperVideo.findUniqueOrThrow({ where: { id } });
}

export async function createBumper(data: {
  name: string;
  filePath: string;
  tag: string;
  duration?: number;
}) {
  const bumper = await db.bumperVideo.create({ data });
  revalidatePath("/bumpers");
  return bumper;
}

export async function updateBumper(
  id: string,
  data: { name?: string; tag?: string },
) {
  const bumper = await db.bumperVideo.update({ where: { id }, data });
  revalidatePath("/bumpers");
  return bumper;
}

export async function deleteBumper(id: string) {
  await db.bumperVideo.delete({ where: { id } });
  revalidatePath("/bumpers");
}

export async function setDefaultFrontBumper(id: string) {
  // Clear existing default, then set new one
  await db.bumperVideo.updateMany({
    where: { isDefaultFront: true },
    data: { isDefaultFront: false },
  });
  await db.bumperVideo.update({
    where: { id },
    data: { isDefaultFront: true },
  });
  revalidatePath("/bumpers");
}

export async function setDefaultRearBumper(id: string) {
  await db.bumperVideo.updateMany({
    where: { isDefaultRear: true },
    data: { isDefaultRear: false },
  });
  await db.bumperVideo.update({
    where: { id },
    data: { isDefaultRear: true },
  });
  revalidatePath("/bumpers");
}

export async function clearDefaultFrontBumper() {
  await db.bumperVideo.updateMany({
    where: { isDefaultFront: true },
    data: { isDefaultFront: false },
  });
  revalidatePath("/bumpers");
}

export async function clearDefaultRearBumper() {
  await db.bumperVideo.updateMany({
    where: { isDefaultRear: true },
    data: { isDefaultRear: false },
  });
  revalidatePath("/bumpers");
}

export async function getDefaultBumpers() {
  const [front, rear] = await Promise.all([
    db.bumperVideo.findFirst({ where: { isDefaultFront: true } }),
    db.bumperVideo.findFirst({ where: { isDefaultRear: true } }),
  ]);
  return { front, rear };
}

/** Get bumpers available for a specific slot (front or rear) */
export async function getBumpersForSlot(slot: "front" | "rear") {
  return db.bumperVideo.findMany({
    where: {
      OR: [{ tag: slot }, { tag: "both" }],
    },
    orderBy: { name: "asc" },
  });
}

/** Assign a bumper to a candidate's front or rear slot */
export async function assignBumperToCandidate(
  candidateId: string,
  slot: "front" | "rear",
  bumperId: string | null,
) {
  const data =
    slot === "front"
      ? { frontBumperId: bumperId }
      : { rearBumperId: bumperId };

  const candidate = await db.candidate.update({
    where: { id: candidateId },
    data,
  });
  revalidatePath(`/project/${candidate.projectId}`);
  return candidate;
}

/**
 * Applies a bumper to the given slot on every clip candidate in the project.
 * Shorts are skipped since they never use bumpers. Returns the number of
 * candidates updated.
 */
export async function applyBumperToAllClips(
  projectId: string,
  slot: "front" | "rear",
  bumperId: string | null,
) {
  const data =
    slot === "front"
      ? { frontBumperId: bumperId }
      : { rearBumperId: bumperId };

  const result = await db.candidate.updateMany({
    where: { projectId, type: "clip" },
    data,
  });
  revalidatePath(`/project/${projectId}`);
  revalidatePath(`/project/${projectId}/clips`);
  return { updated: result.count };
}
