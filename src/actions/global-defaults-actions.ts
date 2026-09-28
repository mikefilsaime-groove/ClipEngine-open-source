"use server";

import { db } from "@/lib/db";

async function ensureAppSettings() {
  let row = await db.appSettings.findUnique({ where: { id: "singleton" } });
  if (!row) {
    row = await db.appSettings.create({ data: { id: "singleton" } });
  }
  return row;
}

export async function saveGlobalCaptionDefaults(config: Record<string, unknown>) {
  await ensureAppSettings();
  await db.appSettings.update({
    where: { id: "singleton" },
    data: { defaultCaptionConfig: JSON.stringify(config) },
  });
}

export async function saveGlobalBrandingDefaults(config: Record<string, unknown>) {
  await ensureAppSettings();
  await db.appSettings.update({
    where: { id: "singleton" },
    data: { defaultBrandingConfig: JSON.stringify(config) },
  });
}

export async function saveGlobalWatermarkDefaults(config: Record<string, unknown>) {
  await ensureAppSettings();
  await db.appSettings.update({
    where: { id: "singleton" },
    data: { defaultWatermarkConfig: JSON.stringify(config) },
  });
}

export async function saveGlobalAudioDefaults(config: Record<string, unknown>) {
  await ensureAppSettings();
  await db.appSettings.update({
    where: { id: "singleton" },
    data: { defaultAudioConfig: JSON.stringify(config) },
  });
}

export async function getGlobalDefaults() {
  const row = await ensureAppSettings();
  return {
    captions: row.defaultCaptionConfig ? JSON.parse(row.defaultCaptionConfig) : null,
    branding: row.defaultBrandingConfig ? JSON.parse(row.defaultBrandingConfig) : null,
    watermark: row.defaultWatermarkConfig ? JSON.parse(row.defaultWatermarkConfig) : null,
    audio: row.defaultAudioConfig ? JSON.parse(row.defaultAudioConfig) : null,
  };
}
