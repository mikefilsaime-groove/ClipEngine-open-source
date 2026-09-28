import { NextRequest, NextResponse } from "next/server";
import os from "os";
import fs from "fs";
import path from "path";
import { db } from "@/lib/db";
import { extractAudio } from "@/lib/whisper";
import { diarizeAudio, assignSpeakersToWords, checkSidecarHealth } from "@/lib/diarize";

// Allow up to 10 minutes for long diarization jobs
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

    // Fetch project with transcript and segments
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: {
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

    // Preflight: verify the Python sidecar is reachable before extracting
    // audio. This avoids a wasted ffmpeg pass and returns a clear error.
    const sidecarReady = await checkSidecarHealth();
    if (!sidecarReady) {
      return NextResponse.json(
        {
          error:
            "Python sidecar not running on http://127.0.0.1:5001. Start it with: cd python && source venv/bin/activate && python sidecar.py",
        },
        { status: 503 }
      );
    }

    const { transcript } = project;

    // Mark project as diarizing
    await db.project.update({
      where: { id: projectId },
      data: { status: "diarizing" },
    });

    // Extract audio to a temp directory
    const tempDir = path.join(os.tmpdir(), `clipengine-diarize-${projectId}`);
    tempAudioPath = await extractAudio(project.sourceVideoPath, tempDir);

    // Run pyannote speaker diarization via the Python sidecar
    const diarizationResult = await diarizeAudio(tempAudioPath);

    // Map each transcript word to a speaker using midpoint matching
    const speakerLabels = assignSpeakersToWords(
      transcript.segments,
      diarizationResult.segments
    );

    // Update each segment's speaker field in the DB (batch)
    await db.$transaction(
      transcript.segments.map((seg, i) =>
        db.transcriptSegment.update({
          where: { id: seg.id },
          data: { speaker: speakerLabels[i] },
        })
      )
    );

    // Upsert Speaker records so the UI can display human-friendly labels
    await db.$transaction(
      diarizationResult.speakers.map((speakerId) =>
        db.speaker.upsert({
          where: { projectId_speakerId: { projectId: projectId!, speakerId } },
          create: {
            projectId: projectId!,
            speakerId,
            label: speakerId, // default label; user can rename later
          },
          update: {},
        })
      )
    );

    // Update project status to ready
    await db.project.update({
      where: { id: projectId },
      data: { status: "ready" },
    });

    return NextResponse.json({
      speakerCount: diarizationResult.speakerCount,
      speakers: diarizationResult.speakers,
    });
  } catch (error) {
    console.error("[diarize] Error:", error);

    // Reset status so the user can retry
    if (projectId) {
      await db.project
        .update({
          where: { id: projectId },
          data: { status: "transcribed" },
        })
        .catch((updateErr) =>
          console.error("[diarize] Failed to reset status:", updateErr)
        );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Diarization failed",
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
