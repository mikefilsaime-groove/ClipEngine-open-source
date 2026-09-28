import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import fs from "fs/promises";
import { createWriteStream } from "fs";
import path from "path";
import os from "os";

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    const rawFileName = request.headers.get("x-file-name");
    const fileName = rawFileName ? decodeURIComponent(rawFileName) : null;
    const projectId = request.headers.get("x-project-id");
    const rawProjectName = request.headers.get("x-project-name");
    const projectName = rawProjectName ? decodeURIComponent(rawProjectName) : null;

    if (!fileName || !projectId) {
      return NextResponse.json(
        { error: "x-file-name and x-project-id headers required" },
        { status: 400 },
      );
    }

    // Set up project directory
    const homeDir = os.homedir();
    const projectDir = path.join(homeDir, "ClipEngine", "projects", projectId);
    const outputDir = path.join(projectDir, "output");
    await fs.mkdir(projectDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });

    const filePath = path.join(projectDir, fileName);

    // Stream the raw body directly to disk — no buffering in memory
    const body = request.body;
    if (!body) {
      return NextResponse.json({ error: "No body received" }, { status: 400 });
    }

    const writeStream = createWriteStream(filePath);
    const reader = body.getReader();
    let bytesWritten = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        writeStream.write(value);
        bytesWritten += value.byteLength;
      }
    } finally {
      writeStream.end();
      await new Promise<void>((resolve, reject) => {
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
      });
    }

    // Auto-rename the project to the filename (without extension) when
    // it's still "Untitled Project". Saves the user a step — uploading
    // a video tells us what the project is about.
    const existing = await db.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    });
    const shouldRename = existing?.name === "Untitled Project";
    const derivedName = shouldRename ? path.parse(fileName).name : undefined;

    await db.project.update({
      where: { id: projectId },
      data: {
        sourceVideoPath: filePath,
        outputFolder: outputDir,
        ...(derivedName && { name: derivedName }),
      },
    });

    revalidatePath(`/project/${projectId}`);
    revalidatePath("/");

    return NextResponse.json({
      filePath,
      outputFolder: outputDir,
      size: bytesWritten,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: `Upload failed: ${error instanceof Error ? error.message : "unknown"}`,
      },
      { status: 500 },
    );
  }
}

