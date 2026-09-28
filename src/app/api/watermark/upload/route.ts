import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { createWriteStream } from "fs";
import path from "path";
import os from "os";

export const maxDuration = 60;

const ALLOWED_EXT = [".png", ".jpg", ".jpeg", ".webp"];

/**
 * Streams a watermark image to disk under the project's assets folder.
 * Returns the absolute path so the caller can store it on ProjectSettings
 * (watermarkPath) or on a candidate-level override.
 */
export async function POST(request: NextRequest) {
  try {
    const rawFileName = request.headers.get("x-file-name");
    const fileName = rawFileName ? decodeURIComponent(rawFileName) : null;
    const projectId = request.headers.get("x-project-id");

    if (!fileName || !projectId) {
      return NextResponse.json(
        { error: "x-file-name and x-project-id headers required" },
        { status: 400 },
      );
    }

    const ext = path.extname(fileName).toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      return NextResponse.json(
        {
          error: `Unsupported watermark format. Use one of: ${ALLOWED_EXT.join(", ")}`,
        },
        { status: 400 },
      );
    }

    const homeDir = os.homedir();
    const assetsDir = path.join(
      homeDir,
      "ClipEngine",
      "projects",
      projectId,
      "assets",
    );
    await fs.mkdir(assetsDir, { recursive: true });

    // Stable filename so repeated uploads overwrite cleanly.
    const safeName = `watermark-${Date.now()}${ext}`;
    const filePath = path.join(assetsDir, safeName);

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
        writeStream.on("finish", () => resolve());
        writeStream.on("error", reject);
      });
    }

    return NextResponse.json({
      filePath,
      fileName: safeName,
      size: bytesWritten,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: `Watermark upload failed: ${error instanceof Error ? error.message : "unknown"}`,
      },
      { status: 500 },
    );
  }
}
