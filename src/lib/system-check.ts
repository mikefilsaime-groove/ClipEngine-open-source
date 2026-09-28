import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

export interface SystemStatus {
  ffmpeg: CheckResult;
  python: CheckResult;
  venv: CheckResult;
  whisperModel: CheckResult;
  sidecar: CheckResult;
  allReady: boolean;
}

export interface CheckResult {
  ok: boolean;
  detail?: string;
}

function checkFile(p: string): CheckResult {
  try {
    fs.accessSync(p, fs.constants.R_OK);
    return { ok: true };
  } catch {
    return { ok: false, detail: `Not found: ${p}` };
  }
}

function checkBinary(name: string): Promise<CheckResult> {
  return new Promise((resolve) => {
    execFile("which", [name], (err, stdout) => {
      if (err || !stdout.trim()) {
        resolve({ ok: false, detail: `${name} not found on PATH` });
      } else {
        resolve({ ok: true, detail: stdout.trim() });
      }
    });
  });
}

function checkPython(): Promise<CheckResult> {
  return new Promise((resolve) => {
    execFile("python3", ["--version"], (err, stdout) => {
      if (err) {
        resolve({ ok: false, detail: "python3 not found on PATH" });
      } else {
        resolve({ ok: true, detail: stdout.trim() });
      }
    });
  });
}

async function checkSidecar(): Promise<CheckResult> {
  try {
    const res = await fetch("http://127.0.0.1:5001/health", {
      signal: AbortSignal.timeout(2_000),
    });
    if (res.ok) return { ok: true, detail: "Running on port 5001" };
    return { ok: false, detail: `HTTP ${res.status}` };
  } catch {
    return { ok: false, detail: "Not running" };
  }
}

function checkFfmpeg(): CheckResult {
  try {
    const ffmpegStatic = require("ffmpeg-static") as string;
    if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
      return { ok: true, detail: `Bundled: ${ffmpegStatic}` };
    }
  } catch {}
  // Fall back to system ffmpeg
  const result = checkFile("/usr/local/bin/ffmpeg");
  if (result.ok) return { ok: true, detail: "/usr/local/bin/ffmpeg" };
  // Check via PATH
  try {
    const { execFileSync } = require("child_process");
    const p = execFileSync("which", ["ffmpeg"], { encoding: "utf-8" }).trim();
    if (p) return { ok: true, detail: p };
  } catch {}
  return { ok: false, detail: "ffmpeg not found (bundled or system)" };
}

function checkVenv(): CheckResult {
  const venvPython = path.join(os.homedir(), ".clipengine-venv", "bin", "python");
  return checkFile(venvPython);
}

function checkWhisperModel(): CheckResult {
  // Try multiple strategies to find the whisper models dir.
  // Turbopack's server runtime breaks require.resolve, so we try
  // several fallbacks.
  const candidates = [
    process.env.PWD && path.join(process.env.PWD, "node_modules", "whisper-node", "lib", "whisper.cpp", "models"),
    path.join(process.cwd(), "node_modules", "whisper-node", "lib", "whisper.cpp", "models"),
  ].filter(Boolean) as string[];

  try {
    const pkg = require.resolve("whisper-node/package.json");
    candidates.unshift(path.join(path.dirname(pkg), "lib", "whisper.cpp", "models"));
  } catch {}

  for (const modelsDir of candidates) {
    if (!fs.existsSync(modelsDir)) continue;
    try {
      const files = fs.readdirSync(modelsDir).filter((f) => f.startsWith("ggml-") && f.endsWith(".bin"));
      if (files.length > 0) {
        return { ok: true, detail: files.join(", ") };
      }
    } catch {}
  }

  return { ok: false, detail: "No ggml-*.bin model found in any whisper-node location" };
}

export async function getSystemStatus(): Promise<SystemStatus> {
  const [python, sidecar] = await Promise.all([checkPython(), checkSidecar()]);
  const ffmpeg = checkFfmpeg();
  const venv = checkVenv();
  const whisperModel = checkWhisperModel();

  return {
    ffmpeg,
    python,
    venv,
    whisperModel,
    sidecar,
    allReady: ffmpeg.ok && python.ok && venv.ok && whisperModel.ok,
  };
}
