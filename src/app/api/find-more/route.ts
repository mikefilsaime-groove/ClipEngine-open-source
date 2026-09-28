import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { db } from "@/lib/db";
import { findMoreAnalysis } from "@/lib/analyze";
import { generatePreview, generateFaceCenteredPreview, probeVideo } from "@/lib/ffmpeg";
import { computeFaceLayoutForClip, computeActiveSpeakerLayout } from "@/lib/face-layout";
import { TranscriptWord } from "@/types";
import { getDefaultBumpers } from "@/actions/bumper-actions";
import { revalidatePath } from "next/cache";

// Allow up to 5 minutes for Gemini + preview generation
export const maxDuration = 300;

const OVERLAP_MAX_RATIO = 0.2;

// Progress event types sent to the client over SSE. The modal UI reads
// these to drive its live progress list + status line.
type ProgressEvent =
  | { type: "analyzing" }
  | { type: "found"; total: number }
  | {
      type: "item_start";
      index: number;
      total: number;
      title: string;
      viralityScore: number;
    }
  | {
      type: "item_done";
      index: number;
      total: number;
      title: string;
      stacked: boolean;
    }
  | { type: "complete"; added: number; returned: number; filtered: number }
  | { type: "error"; message: string };

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const projectId = body.projectId as string | undefined;
  const type = body.type as "clip" | "short" | undefined;

  if (!projectId || !type || (type !== "clip" && type !== "short")) {
    return new Response(
      JSON.stringify({
        error: "projectId and type ('clip' | 'short') are required",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: ProgressEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      const failAndClose = (message: string) => {
        send({ type: "error", message });
        controller.close();
      };

      try {
        const project = await db.project.findUnique({
          where: { id: projectId },
          include: {
            transcript: {
              include: { segments: { orderBy: { startTime: "asc" } } },
            },
          },
        });

        if (!project) return failAndClose("Project not found");
        if (!project.transcript)
          return failAndClose("No transcript found. Run transcription first.");

        const existing = await db.candidate.findMany({
          where: { projectId },
          select: {
            type: true,
            startTime: true,
            endTime: true,
            title: true,
            viralityScore: true,
          },
        });

        const words: TranscriptWord[] = project.transcript.segments.map(
          (seg) => ({
            word: seg.word,
            startTime: seg.startTime,
            endTime: seg.endTime,
            speaker: seg.speaker,
            confidence: seg.confidence,
          }),
        );

        const durationMinutes = (project.duration ?? 0) / 60;

        send({ type: "analyzing" });

        const newCandidates = await findMoreAnalysis(
          words,
          durationMinutes,
          type,
          existing,
        );

        // Dedupe against existing candidates of the same type by time overlap.
        const sameTypeExisting = existing.filter((e) => e.type === type);
        const unique = newCandidates.filter((nc) => {
          const ncDuration = nc.endTime - nc.startTime;
          if (ncDuration <= 0) return false;
          return !sameTypeExisting.some((ex) => {
            const overlapStart = Math.max(nc.startTime, ex.startTime);
            const overlapEnd = Math.min(nc.endTime, ex.endTime);
            const overlap = Math.max(0, overlapEnd - overlapStart);
            return overlap / ncDuration > OVERLAP_MAX_RATIO;
          });
        });

        send({ type: "found", total: unique.length });

        const previewDir = path.join(
          project.outputFolder,
          ".clipengine-previews",
        );
        fs.mkdirSync(previewDir, { recursive: true });
        const defaults = await getDefaultBumpers();

        // Probe once for face-layout math on shorts.
        let sourceDims: { width: number; height: number } | null = null;
        if (type === "short") {
          try {
            const probe = await probeVideo(project.sourceVideoPath);
            sourceDims = { width: probe.width, height: probe.height };
          } catch (err) {
            console.error(
              "[find-more] Probe failed, face layout disabled:",
              err,
            );
          }
        }

        let added = 0;
        for (let i = 0; i < unique.length; i++) {
          const c = unique[i];
          send({
            type: "item_start",
            index: i,
            total: unique.length,
            title: c.title,
            viralityScore: Math.round(c.viralityScore),
          });

          const safeTitle = c.title.replace(/[^a-z0-9]/gi, "_").slice(0, 40);
          const previewFileName = `${c.type}_${Math.round(c.startTime)}_${safeTitle}.mp4`;
          const previewPath = path.join(previewDir, previewFileName);

          let faceLayoutJson: string | null = null;
          let speakerLayout: string | null = null;
          let previewGenerated = false;

          if (
            c.type === "short" &&
            sourceDims &&
            sourceDims.width > 0 &&
            sourceDims.height > 0
          ) {
            // Check multi-speaker for active speaker layout.
            const clipSpeakers = new Set(
              words
                .filter(
                  (w) => w.startTime >= c.startTime && w.endTime <= c.endTime,
                )
                .map((w) => w.speaker),
            );
            const isMultiSpeaker = clipSpeakers.size > 1;

            // Try active speaker layout first (multi-speaker only).
            if (isMultiSpeaker) {
              try {
                const asLayout = await computeActiveSpeakerLayout(
                  project.sourceVideoPath,
                  c.startTime,
                  c.endTime,
                  sourceDims.width,
                  sourceDims.height,
                  words,
                );
                if (asLayout) {
                  faceLayoutJson = JSON.stringify(asLayout);
                  speakerLayout = "active-speaker";
                  try {
                    await generateFaceCenteredPreview(
                      project.sourceVideoPath,
                      previewPath,
                      c.startTime,
                      c.endTime,
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
                      `[find-more] active speaker preview failed for "${c.title}":`,
                      err,
                    );
                  }
                }
              } catch (err) {
                console.error(
                  `[find-more] active speaker layout failed for "${c.title}":`,
                  err,
                );
              }
            }

            // Fall back to Phase 1 face layout.
            if (!faceLayoutJson) {
              try {
                const layout = await computeFaceLayoutForClip(
                  project.sourceVideoPath,
                  c.startTime,
                  c.endTime,
                  sourceDims.width,
                  sourceDims.height,
                );
                if (layout) {
                  faceLayoutJson = JSON.stringify(layout);
                  speakerLayout = layout.mode;
                  try {
                    await generateFaceCenteredPreview(
                      project.sourceVideoPath,
                      previewPath,
                      c.startTime,
                      c.endTime,
                      layout,
                    );
                    previewGenerated = true;
                  } catch (err) {
                    console.error(
                      `[find-more] face-centered preview failed for "${c.title}":`,
                      err,
                    );
                  }
                }
              } catch (err) {
                console.error(
                  `[find-more] face layout failed for "${c.title}":`,
                  err,
                );
              }
            }
          }

          if (!previewGenerated) {
            try {
              await generatePreview(
                project.sourceVideoPath,
                previewPath,
                c.startTime,
                c.endTime,
              );
            } catch (err) {
              console.error(
                `[find-more] preview failed for "${c.title}":`,
                err,
              );
            }
          }

          await db.candidate.create({
            data: {
              projectId,
              type: c.type,
              title: c.title,
              startTime: c.startTime,
              endTime: c.endTime,
              trimIn: c.startTime,
              trimOut: c.endTime,
              viralityScore: Math.round(c.viralityScore),
              hookStrength: c.hookStrength != null ? Math.round(c.hookStrength) : null,
              completionPull: c.completionPull != null ? Math.round(c.completionPull) : null,
              platformPlay: c.platformPlay ?? null,
              shareTrigger: c.shareTrigger ?? null,
              reasoning: c.reasoning,
              tags: c.tags ? JSON.stringify(c.tags) : null,
              grade: c.grade ?? null,
              recommendation: c.recommendation ?? null,
              status: "candidate",
              speakerLayout,
              faceLayout: faceLayoutJson,
              previewPath: fs.existsSync(previewPath) ? previewPath : null,
              frontBumperId:
                c.type === "clip" ? (defaults.front?.id ?? null) : null,
              rearBumperId:
                c.type === "clip" ? (defaults.rear?.id ?? null) : null,
            },
          });
          added++;

          send({
            type: "item_done",
            index: i,
            total: unique.length,
            title: c.title,
            stacked: speakerLayout === "stacked" || speakerLayout === "single",
          });
        }

        revalidatePath(
          `/project/${projectId}/${type === "clip" ? "clips" : "shorts"}`,
        );

        send({
          type: "complete",
          added,
          returned: newCandidates.length,
          filtered: newCandidates.length - unique.length,
        });
        controller.close();
      } catch (error) {
        console.error("[find-more] Error:", error);
        failAndClose(
          error instanceof Error ? error.message : "Find more failed",
        );
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disable buffering on any proxy in between (not relevant for local
      // dev but good hygiene).
      "X-Accel-Buffering": "no",
    },
  });
}
