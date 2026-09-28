import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { probeVideo } from "@/lib/ffmpeg";
import { revalidatePath } from "next/cache";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

const SUPPORTED_EXTENSIONS = [".mp4", ".mov", ".mkv", ".avi", ".webm", ".m4v"];

export async function POST(request: NextRequest) {
  try {
    const { projectId } = (await request.json()) as { projectId?: string };

    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    // Open native macOS file picker
    const script = `
      set theFile to choose file with prompt "Select a video file" of type {"public.movie", "public.mpeg-4", "com.apple.quicktime-movie"}
      return POSIX path of theFile
    `;

    let filePath: string;
    try {
      filePath = execSync(`osascript -e '${script}'`, {
        encoding: "utf-8",
        timeout: 120000, // 2 min to pick a file
      }).trim();
    } catch {
      // User cancelled the dialog
      return NextResponse.json({ cancelled: true });
    }

    // Validate extension
    const ext = path.extname(filePath).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported format "${ext}". Use: ${SUPPORTED_EXTENSIONS.join(", ")}` },
        { status: 400 },
      );
    }

    // Verify file exists
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "File not found" }, { status: 400 });
    }

    const stats = fs.statSync(filePath);

    // Create output directory for this project
    const homeDir = os.homedir();
    const outputDir = path.join(homeDir, "ClipEngine", "projects", projectId, "output");
    fs.mkdirSync(outputDir, { recursive: true });

    // Auto-rename the project to the video filename (without extension)
    // when it's still "Untitled Project"
    const existing = await db.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    });
    const derivedName =
      existing?.name === "Untitled Project"
        ? path.parse(filePath).name
        : undefined;

    // Update project — reference the file in-place, no copying
    await db.project.update({
      where: { id: projectId },
      data: {
        sourceVideoPath: filePath,
        outputFolder: outputDir,
        ...(derivedName && { name: derivedName }),
      },
    });

    // Auto-probe the video so the user doesn't have to click "Run"
    let duration: number | undefined;
    try {
      const metadata = await probeVideo(filePath);
      duration = metadata.duration;
      await db.project.update({
        where: { id: projectId },
        data: { duration: metadata.duration },
      });
    } catch {
      // Probe failure is non-fatal — user can retry from the pipeline
    }

    revalidatePath(`/project/${projectId}`);

    return NextResponse.json({
      filePath,
      fileName: path.basename(filePath),
      size: stats.size,
      duration,
      outputFolder: outputDir,
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed: ${error instanceof Error ? error.message : "unknown"}` },
      { status: 500 },
    );
  }
}
