"use server";

import { db } from "@/lib/db";
import { DEFAULT_PROFANITY_WORDS, DEFAULT_FILLER_WORDS } from "@/lib/constants";
import { revalidatePath } from "next/cache";
import { getGlobalDefaults } from "./global-defaults-actions";

export async function getProjects(includeArchived = false) {
  return db.project.findMany({
    where: includeArchived ? undefined : { archived: false },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { candidates: true } },
    },
  });
}

export async function getProject(id: string) {
  return db.project.findUniqueOrThrow({
    where: { id },
    include: {
      settings: true,
      transcript: true,
      speakers: true,
      _count: {
        select: { candidates: true },
      },
    },
  });
}

export async function createProject(data: {
  name: string;
  sourceVideoPath: string;
  outputFolder: string;
}) {
  const project = await db.project.create({
    data: {
      name: data.name,
      sourceVideoPath: data.sourceVideoPath,
      outputFolder: data.outputFolder,
      settings: {
        create: {
          profanityWordList: JSON.stringify(DEFAULT_PROFANITY_WORDS),
          fillerWordList: JSON.stringify(DEFAULT_FILLER_WORDS),
        },
      },
    },
    include: { settings: true },
  });

  revalidatePath("/");
  return project;
}

export async function createUntitledProject() {
  // Seed new project settings from global defaults (if the user has saved any)
  const globals = await getGlobalDefaults();

  const settingsData: Record<string, unknown> = {
    profanityWordList: JSON.stringify(DEFAULT_PROFANITY_WORDS),
    fillerWordList: JSON.stringify(DEFAULT_FILLER_WORDS),
  };

  // Apply saved caption defaults
  if (globals.captions) {
    const c = globals.captions;
    if (c.captionsEnabled !== undefined) settingsData.captionsEnabled = c.captionsEnabled;
    if (c.captionPreset) settingsData.captionPreset = c.captionPreset;
    if (c.captionPosition) settingsData.captionPosition = c.captionPosition;
    if (c.captionSize) settingsData.captionSize = c.captionSize;
    if (c.captionFont) settingsData.captionFont = c.captionFont;
    if (c.captionColor) settingsData.captionColor = c.captionColor;
    if (c.captionActiveWordColor) settingsData.captionActiveWordColor = c.captionActiveWordColor;
    if (c.captionStressWordColor) settingsData.captionStressWordColor = c.captionStressWordColor;
  }

  // Apply saved branding defaults
  if (globals.branding) {
    const b = globals.branding;
    if (b.enabled !== undefined) settingsData.brandStripEnabled = b.enabled;
    if (b.position) settingsData.brandStripPosition = b.position;
    if (b.text) settingsData.brandStripText = b.text;
    if (b.bgColor) settingsData.brandStripBgColor = b.bgColor;
    if (b.textColor) settingsData.brandStripTextColor = b.textColor;
    if (b.font) settingsData.brandStripFont = b.font;
    if (b.preset) settingsData.brandStripPreset = b.preset;
  }

  // Apply saved watermark defaults
  if (globals.watermark) {
    const w = globals.watermark;
    if (w.enabled !== undefined) settingsData.watermarkEnabled = w.enabled;
    if (w.path) settingsData.watermarkPath = w.path;
    if (w.position) settingsData.watermarkPosition = w.position;
    if (w.opacity !== undefined) settingsData.watermarkOpacity = w.opacity;
    if (w.size) settingsData.watermarkSize = w.size;
  }

  // Apply saved audio defaults
  if (globals.audio) {
    const a = globals.audio;
    if (a.profanityFilterEnabled !== undefined) settingsData.profanityFilterEnabled = a.profanityFilterEnabled;
    if (a.profanityWordList) settingsData.profanityWordList = a.profanityWordList;
    if (a.fastCutsEnabled !== undefined) settingsData.fastCutsEnabled = a.fastCutsEnabled;
    if (a.fastCutsThreshold !== undefined) settingsData.fastCutsThreshold = a.fastCutsThreshold;
    if (a.fillerRemovalEnabled !== undefined) settingsData.fillerRemovalEnabled = a.fillerRemovalEnabled;
    if (a.fillerWordList) settingsData.fillerWordList = a.fillerWordList;
    if (a.defaultExportQuality) settingsData.defaultExportQuality = a.defaultExportQuality;
  }

  const project = await db.project.create({
    data: {
      name: "Untitled Project",
      sourceVideoPath: "",
      outputFolder: "",
      settings: {
        create: settingsData,
      },
    },
    include: { settings: true },
  });

  revalidatePath("/");
  return project;
}

export async function renameProject(id: string, name: string) {
  const project = await db.project.update({
    where: { id },
    data: { name },
  });
  revalidatePath("/");
  revalidatePath(`/project/${id}`);
  return project;
}

export async function cloneProject(id: string) {
  const original = await db.project.findUniqueOrThrow({
    where: { id },
    include: { settings: true },
  });

  const clone = await db.project.create({
    data: {
      name: `Copy of ${original.name}`,
      sourceVideoPath: original.sourceVideoPath,
      outputFolder: original.outputFolder,
      status: "importing",
      settings: original.settings
        ? {
            create: {
              captionsEnabled: original.settings.captionsEnabled,
              captionPreset: original.settings.captionPreset,
              captionPosition: original.settings.captionPosition,
              captionSize: original.settings.captionSize,
              captionFont: original.settings.captionFont,
              captionColor: original.settings.captionColor,
              captionActiveWordColor: original.settings.captionActiveWordColor,
              captionStressWordColor: original.settings.captionStressWordColor,
              profanityFilterEnabled: original.settings.profanityFilterEnabled,
              profanityWordList: original.settings.profanityWordList,
              fastCutsEnabled: original.settings.fastCutsEnabled,
              fastCutsThreshold: original.settings.fastCutsThreshold,
              fillerRemovalEnabled: original.settings.fillerRemovalEnabled,
              fillerWordList: original.settings.fillerWordList,
              defaultExportQuality: original.settings.defaultExportQuality,
              watermarkEnabled: original.settings.watermarkEnabled,
              watermarkPath: original.settings.watermarkPath,
              watermarkPosition: original.settings.watermarkPosition,
              watermarkOpacity: original.settings.watermarkOpacity,
              watermarkSize: original.settings.watermarkSize,
              brandStripEnabled: original.settings.brandStripEnabled,
              brandStripPosition: original.settings.brandStripPosition,
              brandStripPreset: original.settings.brandStripPreset,
              brandStripBgColor: original.settings.brandStripBgColor,
              brandStripTextColor: original.settings.brandStripTextColor,
              brandStripText: original.settings.brandStripText,
              brandStripFont: original.settings.brandStripFont,
            },
          }
        : {
            create: {
              profanityWordList: JSON.stringify(DEFAULT_PROFANITY_WORDS),
              fillerWordList: JSON.stringify(DEFAULT_FILLER_WORDS),
            },
          },
    },
  });

  revalidatePath("/");
  return clone;
}

export async function archiveProject(id: string) {
  const project = await db.project.update({
    where: { id },
    data: { archived: true },
  });
  revalidatePath("/");
  return project;
}

export async function unarchiveProject(id: string) {
  const project = await db.project.update({
    where: { id },
    data: { archived: false },
  });
  revalidatePath("/");
  return project;
}

export async function deleteProject(id: string) {
  await db.project.delete({ where: { id } });
  revalidatePath("/");
}

export async function updateProjectStatus(id: string, status: string) {
  await db.project.update({
    where: { id },
    data: { status },
  });
  revalidatePath(`/project/${id}`);
}

export async function updateVideoPath(id: string, sourceVideoPath: string, outputFolder: string) {
  const project = await db.project.update({
    where: { id },
    data: { sourceVideoPath, outputFolder },
  });
  revalidatePath(`/project/${id}`);
  return project;
}
