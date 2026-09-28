import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { db } from "@/lib/db";
import { analyzeTranscript } from "@/lib/analyze";
import { generatePreview, generateFaceCenteredPreview, probeVideo } from "@/lib/ffmpeg";
import { computeFaceLayoutForClip, computeActiveSpeakerLayout } from "@/lib/face-layout";
import { TranscriptWord } from "@/types";
import { getDefaultBumpers } from "@/actions/bumper-actions";

// Allow up to 5 minutes for Gemini analysis + preview generation
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  let projectId: string | undefined;

  try {
    const body = await request.json();
    projectId = body.projectId as string;

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    // Fetch project with transcript segments
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: {
        settings: true,
        transcript: {
          include: { segments: { orderBy: { startTime: "asc" } } },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!project.transcript) {
      return NextResponse.json(
        { error: "No transcript found. Run transcription first." },
        { status: 400 }
      );
    }

    // Mark project as analyzing
    await db.project.update({
      where: { id: projectId },
      data: { status: "analyzing" },
    });

    // Build word array from transcript segments
    const words: TranscriptWord[] = project.transcript.segments.map((seg) => ({
      word: seg.word,
      startTime: seg.startTime,
      endTime: seg.endTime,
      speaker: seg.speaker,
      confidence: seg.confidence,
    }));

    const durationMinutes = (project.duration ?? 0) / 60;

    // Run Gemini analysis
    const findExtendedShorts = project.settings?.findExtendedShorts ?? true;
    const candidates = await analyzeTranscript(words, durationMinutes, findExtendedShorts);

    // Probe the source once so stacked-layout math has source dimensions.
    let sourceDims: { width: number; height: number } | null = null;
    try {
      const probe = await probeVideo(project.sourceVideoPath);
      sourceDims = { width: probe.width, height: probe.height };
    } catch (err) {
      console.error("[analyze] Probe failed, stacked layout disabled:", err);
    }

    // Create preview directory
    const previewDir = path.join(project.outputFolder, ".clipengine-previews");
    fs.mkdirSync(previewDir, { recursive: true });

    // Clear existing candidates for this project
    await db.candidate.deleteMany({ where: { projectId } });

    // Get default bumpers to auto-assign to clips
    const defaults = await getDefaultBumpers();

    // Process each candidate: generate preview and store in DB
    let clipCount = 0;
    let shortCount = 0;

    for (const candidate of candidates) {
      const safeTitle = candidate.title
        .replace(/[^a-z0-9]/gi, "_")
        .slice(0, 40);
      const previewFileName = `${candidate.type}_${Math.round(candidate.startTime)}_${safeTitle}.mp4`;
      const previewPath = path.join(previewDir, previewFileName);

      // For ALL shorts, run face detection. Multi-speaker shorts first try
      // active speaker layout (v3), then fall back to face-centered (v2).
      let faceLayoutJson: string | null = null;
      let speakerLayout: string | null = null;
      let previewGenerated = false;

      if (
        candidate.type === "short" &&
        sourceDims &&
        sourceDims.width > 0 &&
        sourceDims.height > 0
      ) {
        // Check if multi-speaker for active speaker layout attempt.
        const clipSpeakers = new Set(
          words
            .filter(
              (w) =>
                w.startTime >= candidate.startTime &&
                w.endTime <= candidate.endTime,
            )
            .map((w) => w.speaker),
        );
        const isMultiSpeaker = clipSpeakers.size > 1;

        // Try active speaker layout first (multi-speaker only).
        if (isMultiSpeaker) {
          try {
            const asLayout = await computeActiveSpeakerLayout(
              project.sourceVideoPath,
              candidate.startTime,
              candidate.endTime,
              sourceDims.width,
              sourceDims.height,
              words,
            );
            if (asLayout) {
              faceLayoutJson = JSON.stringify(asLayout);
              speakerLayout = "active-speaker";
              // Use stacked preview for active-speaker (shows the default view).
              try {
                await generateFaceCenteredPreview(
                  project.sourceVideoPath,
                  previewPath,
                  candidate.startTime,
                  candidate.endTime,
                  {
                    version: 2,
                    mode: "stacked",
                    source: asLayout.source,
                    top: asLayout.stackedTop,
                    bottom: asLayout.stackedBottom,
                  },
                );
                previewGenerated = true;
              } catch (err) {
                console.error(
                  `[analyze] Active speaker preview failed for "${candidate.title}":`,
                  err,
                );
              }
            }
          } catch (err) {
            console.error(
              `[analyze] Active speaker layout failed for "${candidate.title}", trying Phase 1:`,
              err,
            );
          }
        }

        // Fall back to Phase 1 face layout if active speaker wasn't computed.
        if (!faceLayoutJson) {
          try {
            const layout = await computeFaceLayoutForClip(
              project.sourceVideoPath,
              candidate.startTime,
              candidate.endTime,
              sourceDims.width,
              sourceDims.height,
            );
            if (layout) {
              faceLayoutJson = JSON.stringify(layout);
              speakerLayout = layout.mode; // "single" or "stacked"
              try {
                await generateFaceCenteredPreview(
                  project.sourceVideoPath,
                  previewPath,
                  candidate.startTime,
                  candidate.endTime,
                  layout,
                );
                previewGenerated = true;
              } catch (err) {
                console.error(
                  `[analyze] Face-centered preview failed for "${candidate.title}", falling back:`,
                  err,
                );
              }
            }
          } catch (err) {
            console.error(
              `[analyze] Face layout failed for "${candidate.title}":`,
              err,
            );
          }
        }
      }

      // Fallback: plain center-crop preview if face layout wasn't computed.
      if (!previewGenerated) {
        try {
          await generatePreview(
            project.sourceVideoPath,
            previewPath,
            candidate.startTime,
            candidate.endTime,
          );
        } catch (previewErr) {
          console.error(
            `[analyze] Preview generation failed for "${candidate.title}":`,
            previewErr,
          );
          // Continue — a missing preview is non-fatal
        }
      }

      await db.candidate.create({
        data: {
          projectId: projectId!,
          type: candidate.type,
          title: candidate.title,
          startTime: candidate.startTime,
          endTime: candidate.endTime,
          trimIn: candidate.startTime,
          trimOut: candidate.endTime,
          viralityScore: Math.round(candidate.viralityScore),
          hookStrength: candidate.hookStrength != null ? Math.round(candidate.hookStrength) : null,
          completionPull: candidate.completionPull != null ? Math.round(candidate.completionPull) : null,
          platformPlay: candidate.platformPlay ?? null,
          shareTrigger: candidate.shareTrigger ?? null,
          reasoning: candidate.reasoning,
          tags: candidate.tags ? JSON.stringify(candidate.tags) : null,
          grade: candidate.grade ?? null,
          recommendation: candidate.recommendation ?? null,
          status: "candidate",
          speakerLayout,
          faceLayout: faceLayoutJson,
          previewPath: fs.existsSync(previewPath) ? previewPath : null,
          frontBumperId: candidate.type === "clip" ? (defaults.front?.id ?? null) : null,
          rearBumperId: candidate.type === "clip" ? (defaults.rear?.id ?? null) : null,
        },
      });

      if (candidate.type === "clip") clipCount++;
      else shortCount++;
    }

    // Mark project as ready
    await db.project.update({
      where: { id: projectId },
      data: { status: "ready" },
    });

    return NextResponse.json({
      clipCount,
      shortCount,
      total: clipCount + shortCount,
    });
  } catch (error) {
    console.error("[analyze] Error:", error);

    // Reset status so the user can retry
    if (projectId) {
      await db.project
        .update({
          where: { id: projectId },
          data: { status: "diarizing" },
        })
        .catch((updateErr) =>
          console.error("[analyze] Failed to reset status:", updateErr)
        );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Analysis failed",
      },
      { status: 500 }
    );
  }
}
