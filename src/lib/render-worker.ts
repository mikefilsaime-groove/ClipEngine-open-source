/**
 * Background render worker.
 *
 * Called from the render API route as a fire-and-forget task. The worker
 * loops through RenderItems, calls renderClip with a progress callback,
 * and writes state into both the DB (durable) and an in-memory progress
 * map (for sub-second UI updates via the SSE stream).
 *
 * The worker is NOT tied to any HTTP request — it keeps running when the
 * client closes the tab. On page refresh the client checks for an active
 * job and re-attaches to the SSE stream.
 */

import { db } from "./db";
import { renderClip } from "./ffmpeg";
import { parseFaceLayout, type ActiveSpeakerLayout, type FaceLayout } from "./face-layout";
import { resolveBranding, resolveWatermark } from "./branding";
import { generateASSSubtitles } from "./captions";
import { generateAndStoreYouTubeSuggestions } from "@/actions/youtube-actions";
import path from "path";
import fs from "fs/promises";

interface InMemoryProgress {
  itemProgress: Record<string, { pct: number; updatedAt: number }>;
  cancelRequested: boolean;
}

const progressByJob = new Map<string, InMemoryProgress>();

export function getJobProgress(jobId: string): InMemoryProgress | undefined {
  return progressByJob.get(jobId);
}

export function requestCancel(jobId: string) {
  const entry = progressByJob.get(jobId);
  if (entry) entry.cancelRequested = true;
}

export async function runRenderJob(jobId: string): Promise<void> {
  const job = await db.renderJob.findUnique({
    where: { id: jobId },
    include: {
      items: { orderBy: { orderIndex: "asc" } },
    },
  });

  if (!job) {
    console.error(`[render-worker] job ${jobId} not found`);
    return;
  }

  progressByJob.set(jobId, { itemProgress: {}, cancelRequested: false });

  const project = await db.project.findUnique({
    where: { id: job.projectId },
    include: {
      settings: true,
      transcript: {
        include: {
          segments: { orderBy: { startTime: "asc" } },
        },
      },
    },
  });

  if (!project) {
    await db.renderJob.update({
      where: { id: jobId },
      data: { status: "failed", finishedAt: new Date() },
    });
    progressByJob.delete(jobId);
    return;
  }

  const settings = project.settings;
  const captionsEnabled = settings?.captionsEnabled ?? false;
  const startedAt = Date.now();

  await db.renderJob.update({
    where: { id: jobId },
    data: { status: "running", startedAt: new Date() },
  });

  let completed = 0;
  let failed = 0;

  for (const item of job.items) {
    const memory = progressByJob.get(jobId);
    if (memory?.cancelRequested) {
      await db.renderJob.update({
        where: { id: jobId },
        data: { status: "cancelled", cancelRequested: true, finishedAt: new Date() },
      });
      break;
    }

    const candidate = await db.candidate.findUnique({
      where: { id: item.candidateId },
      include: { frontBumper: true, rearBumper: true },
    });

    if (!candidate) {
      await db.renderItem.update({
        where: { id: item.id },
        data: { status: "failed", errorMessage: "Candidate not found", finishedAt: new Date() },
      });
      failed++;
      continue;
    }

    await db.renderItem.update({
      where: { id: item.id },
      data: { status: "running", startedAt: new Date(), progressPct: 0 },
    });

    const quality = (candidate.exportQuality ?? job.quality) as "720p" | "1080p" | "4k";
    const isVertical = candidate.type === "short";
    const slug = candidate.id;
    const subFolder = isVertical ? "shorts" : "clips";
    const outputPath = path.join(project.outputFolder, subFolder, `${slug}.mp4`);
    let assPath: string | undefined;

    try {
      await fs.mkdir(path.dirname(outputPath), { recursive: true });

      const clipWords =
        project.transcript?.segments.filter(
          (seg) => seg.startTime >= candidate.trimIn && seg.endTime <= candidate.trimOut,
        ) ?? [];

      if (captionsEnabled && settings && clipWords.length > 0) {
        assPath = path.join(project.outputFolder, "tmp", `${slug}.ass`);
        const captionConfig = {
          presetId: settings.captionPreset,
          position: settings.captionPosition as "auto" | "top" | "middle" | "bottom",
          size: settings.captionSize as "small" | "medium" | "large",
          font: settings.captionFont,
          color: settings.captionColor,
          activeWordColor: settings.captionActiveWordColor,
          stressWordColor: settings.captionStressWordColor,
        };
        const transcriptWords = clipWords.map((seg) => ({
          word: seg.word,
          startTime: seg.startTime,
          endTime: seg.endTime,
          speaker: seg.speaker,
          confidence: seg.confidence,
        }));
        const videoWidth = isVertical ? 1080 : 1920;
        const videoHeight = isVertical ? 1920 : 1080;
        await generateASSSubtitles(
          transcriptWords,
          captionConfig,
          assPath,
          videoWidth,
          videoHeight,
        );
      }

      const parsedLayout = isVertical
        ? parseFaceLayout(candidate.faceLayout)
        : null;
      // Dispatch between v2 (FaceLayout) and v3 (ActiveSpeakerLayout).
      const faceLayout = parsedLayout && parsedLayout.version === 2
        ? (parsedLayout as FaceLayout)
        : null;
      const activeSpeakerLayout = parsedLayout && (parsedLayout as { version: number }).version === 3
        ? (parsedLayout as ActiveSpeakerLayout)
        : null;

      const branding = resolveBranding({
        override: candidate.brandingOverride,
        projectSettings: settings
          ? {
              brandStripEnabled: settings.brandStripEnabled,
              brandStripPosition: settings.brandStripPosition,
              brandStripPreset: settings.brandStripPreset,
              brandStripBgColor: settings.brandStripBgColor,
              brandStripTextColor: settings.brandStripTextColor,
              brandStripText: settings.brandStripText,
              brandStripFont: settings.brandStripFont,
            }
          : null,
      });
      const watermark = resolveWatermark({
        override: candidate.watermarkOverride,
        projectSettings: settings
          ? {
              watermarkEnabled: settings.watermarkEnabled,
              watermarkPath: settings.watermarkPath,
              watermarkPosition: settings.watermarkPosition,
              watermarkOpacity: settings.watermarkOpacity,
              watermarkSize: settings.watermarkSize,
            }
          : null,
      });

      // Kick off YouTube suggestions in parallel with the ffmpeg render.
      // Gemini only needs the transcript + metadata, not the rendered file.
      // Reuses clipWords from the captions step above.
      const speakerIds = [...new Set(clipWords.map((w) => w.speaker))];
      const speakers = await db.speaker.findMany({
        where: { projectId: project.id },
      });
      const speakerNames = speakerIds.map((id) => {
        const s = speakers.find((sp) => sp.speakerId === id);
        return s?.label ?? id;
      });

      const youtubePromise = generateAndStoreYouTubeSuggestions({
        candidateId: candidate.id,
        title: candidate.title,
        type: candidate.type as "clip" | "short",
        reasoning: candidate.reasoning,
        trimIn: candidate.trimIn,
        trimOut: candidate.trimOut,
        transcriptExcerpt: clipWords.map((w) => w.word).join(" "),
        speakerNames,
      }).catch((err) => {
        console.warn(
          `[render-worker] YouTube suggestions failed for ${candidate.id}:`,
          err,
        );
        // Non-fatal — render succeeded, suggestions are a bonus
      });

      const renderPromise = renderClip({
        inputPath: project.sourceVideoPath,
        outputPath,
        startTime: candidate.trimIn,
        endTime: candidate.trimOut,
        quality,
        vertical: isVertical,
        faceLayout,
        activeSpeakerLayout,
        branding,
        watermark,
        assSubtitlePath: assPath,
        frontBumperPath: (!isVertical && candidate.frontBumper?.filePath) || undefined,
        rearBumperPath: (!isVertical && candidate.rearBumper?.filePath) || undefined,
        onProgress: (percent) => {
          const entry = progressByJob.get(jobId);
          if (entry) {
            entry.itemProgress[item.id] = { pct: percent, updatedAt: Date.now() };
          }
        },
      });

      // Wait for both — ffmpeg is the long pole, Gemini finishes first
      await Promise.all([renderPromise, youtubePromise]);

      await db.candidate.update({
        where: { id: candidate.id },
        data: { status: "rendered", outputPath },
      });

      await db.renderItem.update({
        where: { id: item.id },
        data: {
          status: "done",
          progressPct: 100,
          outputPath,
          finishedAt: new Date(),
        },
      });
      completed++;
    } catch (err) {
      console.error(`[render-worker] item ${item.id} failed:`, err);
      await db.candidate.update({
        where: { id: candidate.id },
        data: { status: "failed" },
      });
      await db.renderItem.update({
        where: { id: item.id },
        data: {
          status: "failed",
          errorMessage: err instanceof Error ? err.message : "Unknown error",
          finishedAt: new Date(),
        },
      });
      failed++;
    } finally {
      if (assPath) {
        await fs.unlink(assPath).catch(() => {});
      }
    }

    await db.renderJob.update({
      where: { id: jobId },
      data: { completedItems: completed, failedItems: failed },
    });
  }

  const elapsed = Math.round((Date.now() - startedAt) / 1000);
  const finalStatus = progressByJob.get(jobId)?.cancelRequested
    ? "cancelled"
    : failed === job.items.length
      ? "failed"
      : "complete";

  await db.renderJob.update({
    where: { id: jobId },
    data: {
      status: finalStatus,
      actualSeconds: elapsed,
      finishedAt: new Date(),
    },
  });

  await db.project.update({
    where: { id: job.projectId },
    data: { status: "ready" },
  });

  progressByJob.delete(jobId);
}
