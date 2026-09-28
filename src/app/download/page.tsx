"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Download, Github, ArrowLeft, ExternalLink, Shield, Copy, Check, BookOpen, Terminal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

/* ── Constants ── */

const REPO = "mikefilsaime-groove/ClipEngine-open-source"

const INSTALL_PROMPT = `Install and run ClipEngine from:
https://github.com/mikefilsaime-groove/ClipEngine-open-source

Work through this checklist:
1. Check my operating system and whether Node.js 22, npm, Git, Python 3.10+, and FFmpeg are available. Read the repository README and the in-app User Guide first.
2. Clone the public repository into a new local folder, or use an existing clean checkout.
3. Run npm ci, npx prisma generate, and npm run db:setup.
4. Set up the Python helper with bash python/setup.sh on macOS/Linux. On Windows, use an available Bash environment or explain the platform blocker clearly.
5. Start the app with npm run dev and give me the local URL. If I ask for the desktop wrapper, use npm run electron:dev after the source setup works.
6. Have me enter my own Gemini API key and Hugging Face token in App Settings, and have me accept the pyannote model terms in my browser.
7. Use App Settings to download the Whisper model, then verify the app loads, the built-in /guide opens, and the setup status is clear.

Safety rules:
- Do not ask me to paste secrets into chat.
- Do not put secrets in source files, commit them, or publish them.
- If a dependency or platform step fails, explain the exact blocker and next action; do not claim success until verified.
- Do not download a release binary unless one is actually published in this public repository.`

const WAVE_BARS = [
  50, 72, 38, 85, 55, 68, 42, 80, 48, 75, 35, 88, 52, 65, 40, 78,
  56, 70, 34, 82, 46, 73, 36, 86, 54, 62, 44, 76, 50, 68, 42, 84,
]

type Asset = { name: string; url: string } | null
type DetectedOS = "mac-arm" | "mac-intel" | "windows" | "linux" | "unknown"

type Assets = {
  macArm: Asset
  macIntel: Asset
  windows: Asset
  linux: Asset
}

const PLATFORMS: Array<{
  id: DetectedOS
  label: string
  sub: string
  ext: string
  key: keyof Assets
}> = [
  { id: "mac-arm", label: "macOS", sub: "Apple Silicon (M1\u2013M4)", ext: ".dmg", key: "macArm" },
  { id: "mac-intel", label: "macOS", sub: "Intel (2015\u20132020)", ext: ".dmg", key: "macIntel" },
  { id: "windows", label: "Windows", sub: "64-bit", ext: ".exe", key: "windows" },
  { id: "linux", label: "Linux", sub: "64-bit", ext: ".AppImage", key: "linux" },
]

/* ── Helpers ── */

function findAsset(
  assets: Array<{ name: string; browser_download_url: string }>,
  ext: string,
  arch?: string,
): Asset {
  const found = assets.find((a) => {
    const name = a.name.toLowerCase()
    if (!name.endsWith(ext)) return false
    if (arch && !name.includes(arch)) return false
    return true
  })
  return found ? { name: found.name, url: found.browser_download_url } : null
}

function getPrimary(os: DetectedOS, assets: Assets) {
  switch (os) {
    case "mac-arm":
      return { asset: assets.macArm, label: "Download for Mac (Apple Silicon)", detected: "macOS Apple Silicon" }
    case "mac-intel":
      return { asset: assets.macIntel, label: "Download for Mac (Intel)", detected: "macOS Intel" }
    case "windows":
      return { asset: assets.windows, label: "Download for Windows", detected: "Windows" }
    case "linux":
      return { asset: assets.linux, label: "Download for Linux", detected: "Linux" }
    default:
      return { asset: assets.macArm, label: "Download ClipEngine", detected: null }
  }
}

/* ══════════════════════════════════════════════════════════════════ */

export default function DownloadPage() {
  const [assets, setAssets] = useState<Assets>({
    macArm: null,
    macIntel: null,
    windows: null,
    linux: null,
  })
  const [detectedOS, setDetectedOS] = useState<DetectedOS>("unknown")
  const [loading, setLoading] = useState(true)
  const [noRelease, setNoRelease] = useState(false)
  const [promptCopied, setPromptCopied] = useState(false)

  async function copyInstallPrompt() {
    await navigator.clipboard.writeText(INSTALL_PROMPT)
    setPromptCopied(true)
    window.setTimeout(() => setPromptCopied(false), 2000)
  }

  useEffect(() => {
    // Detect OS
    const ua = navigator.userAgent.toLowerCase()
    if (ua.includes("mac")) {
      const isArm = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1
      setDetectedOS(isArm ? "mac-arm" : "mac-intel")
    } else if (ua.includes("win")) {
      setDetectedOS("windows")
    } else if (ua.includes("linux")) {
      setDetectedOS("linux")
    }

    // Fetch latest release from GitHub
    fetch(`https://api.github.com/repos/${REPO}/releases/latest`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("No release"))))
      .then((release) => {
        const a = (release.assets as Array<{ name: string; browser_download_url: string }>) || []
        setAssets({
          macArm: findAsset(a, ".dmg", "arm64"),
          macIntel: findAsset(a, ".dmg", "x64"),
          windows: findAsset(a, ".exe"),
          linux: findAsset(a, ".appimage"),
        })
        setLoading(false)
      })
      .catch(() => {
        setNoRelease(true)
        setLoading(false)
      })
  }, [])

  const primary = getPrimary(detectedOS, assets)
  const fallbackUrl = `https://github.com/${REPO}/releases`

  return (
    <div className="min-h-screen relative overflow-hidden">

      {/* ── Ambient background ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/3 w-[500px] h-[500px] rounded-full bg-primary/[0.05] dark:bg-primary/[0.10] blur-[120px]" />
        <div className="absolute -bottom-20 right-1/3 w-[350px] h-[350px] rounded-full bg-chart-1/[0.04] dark:bg-chart-1/[0.07] blur-[100px]" />
      </div>

      <div className="relative z-10">

        {/* ── Nav ── */}
        <nav className="container mx-auto max-w-3xl px-4 flex items-center justify-between pt-6 pb-2">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back
          </Link>
          <a
            href={`https://github.com/${REPO}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Github className="size-4" />
            GitHub
          </a>
          <Link
            href="/guide"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <BookOpen className="size-4" />
            User Guide
          </Link>
        </nav>

        <div className="container mx-auto max-w-3xl px-4">

          {/* ── Hero ── */}
          <section className="relative pt-16 pb-10 text-center">

            {/* Waveform */}
            <div
              className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center gap-[3px] h-20 opacity-[0.07] dark:opacity-[0.12] pointer-events-none select-none"
              aria-hidden="true"
            >
              {WAVE_BARS.map((h, i) => (
                <div
                  key={i}
                  className="w-[3px] rounded-full bg-primary origin-center"
                  style={{
                    height: `${h}%`,
                    animation: `waveform-pulse ${1.6 + (i % 5) * 0.3}s ease-in-out ${i * 0.06}s infinite`,
                  }}
                />
              ))}
            </div>

            {/* Logo */}
            <div className="relative">
              <div className="flex justify-center mb-6 animate-fade-in-up">
                <svg viewBox="0 0 32 32" className="w-16 h-16">
                  <rect width="32" height="32" rx="7" fill="var(--color-primary)" />
                  <path d="M8 8h16v3H8z" fill="#fff" opacity="0.9" />
                  <rect x="9" y="8" width="2" height="3" rx="0.3" fill="var(--color-primary)" transform="rotate(-20 10 9.5)" />
                  <rect x="14" y="8" width="2" height="3" rx="0.3" fill="var(--color-primary)" transform="rotate(-20 15 9.5)" />
                  <rect x="19" y="8" width="2" height="3" rx="0.3" fill="var(--color-primary)" transform="rotate(-20 20 9.5)" />
                  <rect x="8" y="12" width="16" height="13" rx="1.5" fill="#fff" opacity="0.9" />
                  <polygon points="14,15 14,22 21,18.5" fill="var(--color-primary)" />
                </svg>
              </div>

              <h1
                className="font-display text-4xl sm:text-5xl font-bold tracking-tighter hero-gradient-text animate-fade-in-up"
                style={{ animationDelay: "0.08s" }}
              >
                Download ClipEngine
              </h1>
              <p
                className="mt-3 text-base text-muted-foreground max-w-md mx-auto animate-fade-in-up"
                style={{ animationDelay: "0.16s" }}
              >
                Your podcast clips, rendered locally. No cloud. No subscription. No limits.
              </p>
            </div>

            {/* ── Primary CTA ── */}
            <div className="mt-8 animate-fade-in-up" style={{ animationDelay: "0.24s" }}>
              {loading ? (
                <Button size="lg" disabled className="text-base px-8 h-12">
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
                  Checking releases...
                </Button>
              ) : noRelease ? (
                <Button size="lg" asChild className="text-base px-8 h-12">
                  <a href={fallbackUrl} target="_blank" rel="noopener noreferrer">
                    <Github className="size-5 mr-2" />
                    View Releases on GitHub
                  </a>
                </Button>
              ) : primary.asset ? (
                <Button
                  size="lg"
                  asChild
                  className="relative group text-base px-8 h-12 shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <a href={primary.asset.url}>
                    <span className="absolute inset-0 rounded-lg bg-primary/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <Download className="size-5 mr-2" />
                    {primary.label}
                  </a>
                </Button>
              ) : (
                <Button size="lg" asChild className="text-base px-8 h-12">
                  <a href={fallbackUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-5 mr-2" />
                    View All Releases
                  </a>
                </Button>
              )}

              {primary.detected && !loading && !noRelease && (
                <p className="mt-3 text-xs text-muted-foreground">Detected: {primary.detected}</p>
              )}
              {noRelease && (
                <p className="mt-3 text-xs text-muted-foreground">
                  No builds available yet — first release is in progress.
                </p>
              )}
            </div>
          </section>

          {/* ── All Platforms ── */}
          {!noRelease && (
            <section className="pb-10 animate-fade-in-up" style={{ animationDelay: "0.32s" }}>
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest text-center mb-4">
                All Platforms
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PLATFORMS.map((p) => {
                  const asset = assets[p.key]
                  const isCurrent = p.id === detectedOS
                  return (
                    <a
                      key={p.id}
                      href={asset?.url || fallbackUrl}
                      target={asset ? undefined : "_blank"}
                      rel={asset ? undefined : "noopener noreferrer"}
                      className={cn(
                        "rounded-xl border bg-card/60 backdrop-blur-sm p-4 transition-all duration-200",
                        "hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5",
                        isCurrent && "border-primary/20 ring-1 ring-primary/10",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-sm text-foreground">{p.label}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {p.sub} &mdash; {p.ext}
                          </div>
                        </div>
                        {isCurrent && (
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            Your system
                          </Badge>
                        )}
                      </div>
                    </a>
                  )
                })}
              </div>
            </section>
          )}

          {/* ── Agent install prompt ── */}
          <section className="pb-10 animate-fade-in-up" style={{ animationDelay: "0.36s" }}>
            <div className="rounded-xl border border-primary/20 bg-primary/[0.04] dark:bg-primary/[0.07] p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Terminal className="size-4 text-primary" />
                    <h2 className="text-base font-semibold text-foreground">Install with your AI agent</h2>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Copy this prompt into Claude Code, Codex, Cursor, or another coding agent to install the open-source version safely.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={copyInstallPrompt} className="shrink-0">
                  {promptCopied ? <Check className="size-4 mr-1.5" /> : <Copy className="size-4 mr-1.5" />}
                  {promptCopied ? "Copied" : "Copy prompt"}
                </Button>
              </div>
              <pre className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border bg-background/80 p-4 text-xs leading-relaxed text-muted-foreground">
                {INSTALL_PROMPT}
              </pre>
              <p className="mt-3 text-xs text-muted-foreground">
                The prompt tells the agent to keep your Gemini and Hugging Face credentials local, never commit them, and verify each setup step.
              </p>
            </div>
          </section>

          {/* ── Unsigned Build Notes ── */}
          <section className="pb-16 animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
            <div className="rounded-xl border bg-card/40 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="size-4 text-muted-foreground" />
                <h3 className="text-sm font-medium text-foreground">Unsigned builds</h3>
              </div>
              <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
                <p>
                  <span className="font-medium text-foreground/80">macOS:</span>{" "}
                  Right-click the app &rarr; Open to bypass Gatekeeper
                </p>
                <p>
                  <span className="font-medium text-foreground/80">Windows:</span>{" "}
                  Click &ldquo;More info&rdquo; &rarr; &ldquo;Run anyway&rdquo; on SmartScreen
                </p>
                <p>
                  <span className="font-medium text-foreground/80">Linux:</span>{" "}
                  Run{" "}
                  <code className="font-mono bg-muted px-1 py-0.5 rounded text-[11px]">
                    chmod +x ClipEngine-*.AppImage
                  </code>{" "}
                  before launching
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-border/50">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <a
                    href={fallbackUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    <Github className="size-3" />
                    All releases on GitHub
                    <ExternalLink className="size-2.5" />
                  </a>
                  <span className="text-muted-foreground/30">&middot;</span>
                  <span>User guide is built into the app</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
