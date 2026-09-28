/**
 * ClipEngine Electron main process.
 *
 * Boot sequence:
 *   1. Find a free port for the Next.js server
 *   2. Spawn `next dev` (development) or `next start` (production) as a child
 *   3. Wait for the server to be ready (poll /api/video/render/active)
 *   4. Spawn the Python sidecar on port 5001 if it's not already running
 *   5. Open the BrowserWindow pointed at http://localhost:<next-port>
 *
 * The app is a local desktop wrapper — no internet, no auth, no updates.
 * Quitting kills both child processes.
 */

const { app, BrowserWindow, shell, dialog } = require("electron");
const path = require("path");
const net = require("net");
const { spawn } = require("child_process");
const http = require("http");

const IS_DEV = !app.isPackaged;
const PROJECT_ROOT = path.resolve(__dirname, "..");
const SIDECAR_PORT = 5001;

/** @type {import('child_process').ChildProcess | null} */
let nextProcess = null;
/** @type {import('child_process').ChildProcess | null} */
let sidecarProcess = null;
/** @type {BrowserWindow | null} */
let mainWindow = null;

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

function waitForHttp(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      http
        .get(url, (res) => {
          res.resume();
          // Any response means the server is listening. Even 404 is fine.
          resolve();
        })
        .on("error", () => {
          if (Date.now() > deadline) {
            reject(new Error(`Timed out waiting for ${url}`));
          } else {
            setTimeout(tryOnce, 400);
          }
        });
    };
    tryOnce();
  });
}

function checkPortOpen(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(500);
    socket
      .once("connect", () => {
        socket.destroy();
        resolve(true);
      })
      .once("error", () => resolve(false))
      .once("timeout", () => {
        socket.destroy();
        resolve(false);
      })
      .connect(port, "127.0.0.1");
  });
}

// ---------------------------------------------------------------------------
// Child process lifecycle
// ---------------------------------------------------------------------------

async function startNextServer(port) {
  const env = {
    ...process.env,
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
    NODE_ENV: IS_DEV ? "development" : "production",
  };

  const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
  const args = IS_DEV
    ? ["run", "dev", "--", "-p", String(port)]
    : ["run", "start", "--", "-p", String(port)];

  nextProcess = spawn(npmBin, args, {
    cwd: PROJECT_ROOT,
    env,
    stdio: "pipe",
    shell: false,
  });

  nextProcess.stdout?.on("data", (buf) => {
    process.stdout.write(`[next] ${buf}`);
  });
  nextProcess.stderr?.on("data", (buf) => {
    process.stderr.write(`[next] ${buf}`);
  });
  nextProcess.on("exit", (code) => {
    console.log(`[next] exited with code ${code}`);
    nextProcess = null;
    if (mainWindow) {
      dialog.showErrorBox(
        "ClipEngine server stopped",
        `The Next.js server exited unexpectedly (code ${code}). Please restart the app.`,
      );
    }
  });

  await waitForHttp(`http://127.0.0.1:${port}/`);
  console.log(`[main] Next.js ready on port ${port}`);
}

async function startPythonSidecar() {
  const isAlreadyRunning = await checkPortOpen(SIDECAR_PORT);
  if (isAlreadyRunning) {
    console.log(`[main] Python sidecar already running on port ${SIDECAR_PORT}`);
    return;
  }

  const venvPython = path.join(
    process.env.HOME || process.env.USERPROFILE || "",
    ".clipengine-venv",
    "bin",
    "python",
  );

  if (!fs.existsSync(venvPython)) {
    console.warn(
      `[main] Python sidecar venv not found at ${venvPython}. Diarization will fail until the user runs python/setup.sh.`,
    );
    return;
  }

  const sidecarScript = path.join(PROJECT_ROOT, "python", "sidecar.py");
  if (!fs.existsSync(sidecarScript)) {
    console.warn(`[main] Python sidecar script not found: ${sidecarScript}`);
    return;
  }

  sidecarProcess = spawn(venvPython, [sidecarScript], {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      SIDECAR_PORT: String(SIDECAR_PORT),
    },
    stdio: "pipe",
  });

  sidecarProcess.stdout?.on("data", (buf) => {
    process.stdout.write(`[sidecar] ${buf}`);
  });
  sidecarProcess.stderr?.on("data", (buf) => {
    process.stderr.write(`[sidecar] ${buf}`);
  });
  sidecarProcess.on("exit", (code) => {
    console.log(`[sidecar] exited with code ${code}`);
    sidecarProcess = null;
  });

  // Best-effort wait — the sidecar takes a few seconds to import torch etc.
  try {
    await waitForHttp(`http://127.0.0.1:${SIDECAR_PORT}/health`, 30_000);
    console.log(`[main] Python sidecar ready on port ${SIDECAR_PORT}`);
  } catch (err) {
    console.warn("[main] Python sidecar did not become ready in 30s — diarization may fail until it finishes loading.");
  }
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 720,
    title: "ClipEngine",
    backgroundColor: "#0a0a0a",
    icon: path.join(__dirname, "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadURL(url);

  // External links open in the system browser, not inside the Electron window
  mainWindow.webContents.setWindowOpenHandler(({ url: openUrl }) => {
    shell.openExternal(openUrl);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

const DEV_PORT = 3000;

async function boot() {
  try {
    let port;

    // In dev mode, check if a Next.js server is already running on port 3000.
    // If so, reuse it — avoids the .next/dev/lock conflict when the developer
    // is already running `npm run dev` in a terminal.
    const devAlreadyRunning = IS_DEV && (await checkPortOpen(DEV_PORT));
    if (devAlreadyRunning) {
      port = DEV_PORT;
      console.log(`[main] Reusing existing Next.js dev server on port ${port}`);
    } else {
      port = IS_DEV ? DEV_PORT : await findFreePort();
      await startNextServer(port);
    }

    // Fire-and-forget — sidecar boot is slow, the UI can load without it
    startPythonSidecar().catch((err) => {
      console.error("[main] sidecar boot error:", err);
    });

    createWindow(`http://127.0.0.1:${port}/`);
  } catch (err) {
    console.error("[main] boot failed:", err);
    dialog.showErrorBox(
      "ClipEngine failed to start",
      err instanceof Error ? err.message : String(err),
    );
    app.quit();
  }
}

app.whenReady().then(boot);

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", () => {
  if (nextProcess && !nextProcess.killed) {
    nextProcess.kill("SIGTERM");
  }
  if (sidecarProcess && !sidecarProcess.killed) {
    sidecarProcess.kill("SIGTERM");
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    boot();
  }
});
