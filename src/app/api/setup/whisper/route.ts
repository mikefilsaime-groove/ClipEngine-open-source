import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

export async function POST() {
  const modelsDir = path.join(
    process.cwd(),
    "node_modules",
    "whisper-node",
    "lib",
    "whisper.cpp",
    "models",
  );

  if (!fs.existsSync(modelsDir)) {
    return NextResponse.json(
      { error: "whisper-node models directory not found. Run npm install first." },
      { status: 500 },
    );
  }

  const modelFile = path.join(modelsDir, "ggml-base.en.bin");
  if (fs.existsSync(modelFile)) {
    return NextResponse.json({ message: "Model already downloaded", path: modelFile });
  }

  const downloadScript = path.join(modelsDir, "download-ggml-model.sh");
  if (!fs.existsSync(downloadScript)) {
    return NextResponse.json(
      { error: "download-ggml-model.sh not found in whisper models dir" },
      { status: 500 },
    );
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      send("status", { message: "Downloading whisper base.en model (~150 MB)…" });

      const child = spawn("bash", [downloadScript, "base.en"], {
        cwd: modelsDir,
      });

      child.stdout?.on("data", (buf: Buffer) => {
        const lines = buf.toString().split("\n").filter(Boolean);
        for (const line of lines) {
          send("log", { line });
        }
      });

      child.stderr?.on("data", (buf: Buffer) => {
        const lines = buf.toString().split("\n").filter(Boolean);
        for (const line of lines) {
          send("log", { line });
        }
      });

      child.on("close", (code) => {
        if (code === 0 && fs.existsSync(modelFile)) {
          send("complete", { success: true });
        } else {
          send("complete", { success: false, code });
        }
        controller.close();
      });

      child.on("error", (err) => {
        send("error", { message: err.message });
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
