import { NextRequest, NextResponse } from "next/server";
import { createBumper } from "@/actions/bumper-actions";
import { probeVideo } from "@/lib/ffmpeg";
import fs from "fs/promises";
import { createWriteStream } from "fs";
import path from "path";
import os from "os";

export async function POST(request: NextRequest) {
  try {
    const rawFileName = request.headers.get("x-file-name");
    const fileName = rawFileName ? decodeURIComponent(rawFileName) : null;
    const rawBumperName = request.headers.get("x-bumper-name");
    const bumperName = rawBumperName ? decodeURIComponent(rawBumperName) : (fileName || "Untitled Bumper");
    const tag = request.headers.get("x-bumper-tag") || "both";

    if (!fileName) {
      return NextResponse.json(
        { error: "x-file-name header required" },
        { status: 400 },
      );
    }

    // Store bumpers in ~/ClipEngine/bumpers/
    const homeDir = os.homedir();
    const bumperDir = path.join(homeDir, "ClipEngine", "bumpers");
    await fs.mkdir(bumperDir, { recursive: true });

    const filePath = path.join(bumperDir, fileName);

    // Stream body to disk
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

    // Probe for duration
    let duration: number | undefined;
    try {
      const meta = await probeVideo(filePath);
      duration = meta.duration;
    } catch {
      // Duration is optional — don't fail the upload
    }

    // Create DB record
    const bumper = await createBumper({
      name: bumperName,
      filePath,
      tag,
      duration,
    });

    return NextResponse.json({
      id: bumper.id,
      name: bumper.name,
      filePath: bumper.filePath,
      tag: bumper.tag,
      duration: bumper.duration,
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
