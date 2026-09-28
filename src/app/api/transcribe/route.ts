import { NextRequest, NextResponse } from "next/server";
import os from "os";
import fs from "fs";
import path from "path";
import { db } from "@/lib/db";
import { extractAudio, transcribeAudio } from "@/lib/whisper";

// Allow up to 10 minutes for long transcription jobs
export const maxDuration = 600;

export async function POST(request: NextRequest) {
  let projectId: string | undefined;
  let tempAudioPath: string | undefined;

  try {
    const body = await request.json();
    projectId = body.projectId as string;

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    // Fetch project from DB
    const project = await db.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Mark project as transcribing
    await db.project.update({
      where: { id: projectId },
      data: { status: "transcribing" },
    });

    // Extract audio to a temp directory
    const tempDir = path.join(os.tmpdir(), `clipengine-${projectId}`);
    tempAudioPath = await extractAudio(project.sourceVideoPath, tempDir);

    // Transcribe with Whisper
    const { fullText, words } = await transcribeAudio(tempAudioPath);

    // Persist transcript + word-level segments in a single transaction
    const transcript = await db.$transaction(async (tx) => {
      // Remove any existing transcript for this project
      await tx.transcript.deleteMany({ where: { projectId } });

      const created = await tx.transcript.create({
        data: {
          projectId: projectId!,
          fullText,
          segments: {
            create: words.map((w) => ({
              word: w.word,
              startTime: w.startTime,
              endTime: w.endTime,
              speaker: w.speaker,
              confidence: w.confidence,
            })),
          },
        },
      });

      return created;
    });

    // Update project status to ready for diarization
    await db.project.update({
      where: { id: projectId },
      data: { status: "diarizing" },
    });

    return NextResponse.json({
      transcriptId: transcript.id,
      wordCount: words.length,
    });
  } catch (error) {
    console.error("[transcribe] Error:", error);

    // Reset status so the user can retry
    if (projectId) {
      await db.project
        .update({
          where: { id: projectId },
          data: { status: "importing" },
        })
        .catch((updateErr) =>
          console.error("[transcribe] Failed to reset status:", updateErr)
        );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Transcription failed",
      },
      { status: 500 }
    );
  } finally {
    // Clean up temp audio file
    if (tempAudioPath) {
      try {
        fs.rmSync(path.dirname(tempAudioPath), { recursive: true, force: true });
      } catch {
        // Non-fatal — temp files will be cleaned by OS eventually
      }
    }
  }
}
