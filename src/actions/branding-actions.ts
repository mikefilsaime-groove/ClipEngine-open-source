"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import {
  type BrandingSettings,
  type WatermarkSettings,
  stringifyBranding,
  stringifyWatermark,
} from "@/lib/branding";

// ---------------------------------------------------------------------------
// Per-candidate overrides
// ---------------------------------------------------------------------------

export async function updateCandidateBranding(
  candidateId: string,
  branding: BrandingSettings | null,
) {
  const data = {
    brandingOverride: branding ? stringifyBranding(branding) : null,
  };
  const candidate = await db.candidate.update({
    where: { id: candidateId },
    data,
  });
  revalidatePath(`/project/${candidate.projectId}`);
  return candidate;
}

export async function updateCandidateWatermark(
  candidateId: string,
  watermark: WatermarkSettings | null,
) {
  const data = {
    watermarkOverride: watermark ? stringifyWatermark(watermark) : null,
  };
  const candidate = await db.candidate.update({
    where: { id: candidateId },
    data,
  });
  revalidatePath(`/project/${candidate.projectId}`);
  return candidate;
}

// ---------------------------------------------------------------------------
// Apply-to-all (optionally scoped to clips or shorts only)
// ---------------------------------------------------------------------------

export async function applyBrandingToAll(
  projectId: string,
  branding: BrandingSettings | null,
  scope: "clip" | "short" | "all" = "all",
) {
  const data = {
    brandingOverride: branding ? stringifyBranding(branding) : null,
  };
  const where =
    scope === "all"
      ? { projectId }
      : { projectId, type: scope };

  const result = await db.candidate.updateMany({ where, data });
  revalidatePath(`/project/${projectId}`);
  revalidatePath(`/project/${projectId}/clips`);
  revalidatePath(`/project/${projectId}/shorts`);
  return { updated: result.count };
}

export async function applyWatermarkToAll(
  projectId: string,
  watermark: WatermarkSettings | null,
  scope: "clip" | "short" | "all" = "all",
) {
  const data = {
    watermarkOverride: watermark ? stringifyWatermark(watermark) : null,
  };
  const where =
    scope === "all"
      ? { projectId }
      : { projectId, type: scope };

  const result = await db.candidate.updateMany({ where, data });
  revalidatePath(`/project/${projectId}`);
  revalidatePath(`/project/${projectId}/clips`);
  revalidatePath(`/project/${projectId}/shorts`);
  return { updated: result.count };
}

// ---------------------------------------------------------------------------
// Project-level defaults (reuses existing ProjectSettings columns)
// ---------------------------------------------------------------------------

export async function updateProjectBrandingDefaults(
  projectId: string,
  branding: BrandingSettings,
) {
  await db.projectSettings.update({
    where: { projectId },
    data: {
      brandStripEnabled: branding.enabled,
      brandStripPosition: branding.position,
      brandStripText: branding.text,
      brandStripBgColor: branding.bgColor,
      brandStripTextColor: branding.textColor,
      brandStripFont: branding.font,
      brandStripPreset: branding.preset ?? "dark-classic",
    },
  });
  revalidatePath(`/project/${projectId}/settings`);
}

export async function updateProjectWatermarkDefaults(
  projectId: string,
  watermark: WatermarkSettings,
) {
  await db.projectSettings.update({
    where: { projectId },
    data: {
      watermarkEnabled: watermark.enabled,
      watermarkPath: watermark.path,
      watermarkPosition: watermark.position,
      watermarkOpacity: watermark.opacity,
      watermarkSize: watermark.size,
    },
  });
  revalidatePath(`/project/${projectId}/settings`);
}
