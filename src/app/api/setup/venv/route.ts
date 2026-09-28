import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";

export async function POST() {
  const setupScript = path.join(process.cwd(), "python", "setup.sh");
  if (!fs.existsSync(setupScript)) {
    return NextResponse.json({ error: "setup.sh not found" }, { status: 500 });
  }

  const pythonCheck = new Promise<boolean>((resolve) => {
    const { execFile } = require("child_process");
    execFile("python3", ["--version"], (err: Error | null) => resolve(!err));
  });
  const hasPython = await pythonCheck;
  if (!hasPython) {
    return NextResponse.json(
      { error: "python3 not found. Install Python 3.9+ from python.org first." },
      { status: 400 },
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

      send("status", { message: "Starting Python environment setup…" });

      const child = spawn("bash", [setupScript], {
        cwd: path.join(process.cwd(), "python"),
        env: {
          ...process.env,
          HOME: os.homedir(),
        },
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
        if (code === 0) {
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
