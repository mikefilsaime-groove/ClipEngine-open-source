import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { probeVideo } from "@/lib/ffmpeg";
import { revalidatePath } from "next/cache";

export async function POST(request: NextRequest) {
  let body: { filePath?: string; projectId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { filePath, projectId } = body;

  if (!filePath) {
    return NextResponse.json({ error: "filePath is required" }, { status: 400 });
  }

  try {
    const metadata = await probeVideo(filePath);

    // Save duration to project if projectId provided
    if (projectId) {
      await db.project.update({
        where: { id: projectId },
        data: { duration: metadata.duration },
      });
      revalidatePath(`/project/${projectId}`);
    }

    return NextResponse.json(metadata);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Probe failed: ${message}` }, { status: 500 });
  }
}
