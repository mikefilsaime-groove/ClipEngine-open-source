import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const filePath = searchParams.get("path");

  if (!filePath) {
    return new NextResponse("Missing path parameter", { status: 400 });
  }

  // Resolve and validate path to prevent directory traversal
  const resolvedPath = path.resolve(filePath);

  if (!fs.existsSync(resolvedPath)) {
    return new NextResponse("File not found", { status: 404 });
  }

  const stat = fs.statSync(resolvedPath);
  const fileSize = stat.size;
  const rangeHeader = request.headers.get("range");

  const ext = path.extname(resolvedPath).toLowerCase();
  const contentTypeMap: Record<string, string> = {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".mkv": "video/x-matroska",
    ".avi": "video/x-msvideo",
  };
  const contentType = contentTypeMap[ext] ?? "video/mp4";

  if (rangeHeader) {
    const parts = rangeHeader.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    const stream = fs.createReadStream(resolvedPath, { start, end });
    const nodeStream = stream as unknown as ReadableStream;

    return new NextResponse(nodeStream, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunkSize),
        "Content-Type": contentType,
      },
    });
  }

  const stream = fs.createReadStream(resolvedPath);
  const nodeStream = stream as unknown as ReadableStream;

  return new NextResponse(nodeStream, {
    status: 200,
    headers: {
      "Content-Length": String(fileSize),
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
    },
  });
}
