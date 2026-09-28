"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  BookOpen,
  Rocket,
  LayoutDashboard,
  Cpu,
  FileText,
  Scissors,
  Film,
  SearchIcon,
  Edit3,
  Users,
  Mic,
  Image,
  Type,
  Volume2,
  Download,
  HelpCircle,
  Play,
  PlayCircle,
  CheckCircle2,
  Lightbulb,
  Zap,
  Settings,
  Upload,
  Eye,
  Star,
  Clock,
  Target,
  Layers,
  Sliders,
  AlertCircle,
  ChevronRight,
  Video,
  Wand2,
  BarChart2,
  Palette,
  Volume,
  FlipVertical,
  Sparkles,
  GraduationCap,
  KeyRound,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

// ============================================
// Types
// ============================================

interface GuideSection {
  id: string
  title: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  description: string
}

interface FeatureCardProps {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  colorClass?: string
  iconClass?: string
}

interface StepProps {
  number: number
  title: string
  description: string
  tip?: string
  isLast?: boolean
}

interface TipBoxProps {
  children: React.ReactNode
  title?: string
}

interface SectionHeaderProps {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  badgeLabel: string
  badgeClass: string
  iconClass: string
}

// ============================================
// Guide Sections Configuration
// ============================================

const GUIDE_SECTIONS: GuideSection[] = [
  { id: "getting-started", title: "Getting Started", icon: Rocket, color: "violet", description: "Set up and launch ClipEngine" },
  { id: "api-keys", title: "API Keys", icon: KeyRound, color: "primary", description: "Free keys needed to run the app" },
  { id: "dashboard", title: "Dashboard", icon: LayoutDashboard, color: "blue", description: "Manage all your projects" },
  { id: "pipeline", title: "Processing Pipeline", icon: Cpu, color: "emerald", description: "Probe, transcribe, detect, analyze" },
  { id: "transcript", title: "Transcript & Search", icon: FileText, color: "cyan", description: "Read, search, and navigate" },
  { id: "clips", title: "Reviewing Clips", icon: Scissors, color: "orange", description: "Approve landscape highlights" },
  { id: "shorts", title: "Reviewing Shorts", icon: Film, color: "pink", description: "Classic and Extended vertical content" },
  { id: "find-more", title: "Find More Candidates", icon: SearchIcon, color: "purple", description: "Surface hidden highlights" },
  { id: "trim-editor", title: "Trim Editor", icon: Edit3, color: "yellow", description: "Fine-tune start and end points" },
  { id: "speaker-labels", title: "Speaker Labels & AI", icon: Users, color: "teal", description: "Name your speakers" },
  { id: "bumpers", title: "Bumpers", icon: Play, color: "indigo", description: "Intro & outro video clips" },
  { id: "brand-strip", title: "Brand Strip", icon: Type, color: "rose", description: "Your name on every export" },
  { id: "watermark", title: "Watermark", icon: Image, color: "amber", description: "Logo overlay on every export" },
  { id: "captions", title: "Captions", icon: Mic, color: "lime", description: "Animated word-level subtitles" },
  { id: "audio", title: "Audio Processing", icon: Volume2, color: "sky", description: "Bleeps, fillers, and silence" },
  { id: "project-settings", title: "Project Settings", icon: Settings, color: "slate", description: "Accordion sections & project defaults" },
  { id: "global-defaults", title: "Global Defaults", icon: Star, color: "primary", description: "Pre-fill settings for every new project" },
  { id: "render", title: "Render & Export", icon: Download, color: "emerald", description: "Produce your final files" },
  { id: "youtube-titles", title: "YouTube Titles & Thumbnails", icon: Sparkles, color: "red", description: "AI publishing assets after render" },
  { id: "faq", title: "FAQ", icon: HelpCircle, color: "slate", description: "Common questions answered" },
]

// ============================================
// Reusable Sub-Components
// ============================================

const SectionHeader = ({ icon: Icon, title, description, badgeLabel, badgeClass, iconClass }: SectionHeaderProps) => (
  <div className="mb-8">
    <div className={cn("inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium mb-4", badgeClass)}>
      <Icon className="h-4 w-4" />
      {badgeLabel}
    </div>
    <h2 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h2>
    <p className="text-lg text-muted-foreground mt-2">{description}</p>
  </div>
)

const FeatureCard = ({ icon: Icon, title, description, colorClass = "bg-primary/10", iconClass = "text-primary" }: FeatureCardProps) => (
  <div className="flex items-start gap-4 p-4 rounded-xl bg-card border shadow-sm">
    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", colorClass)}>
      <Icon className={cn("h-5 w-5", iconClass)} />
    </div>
    <div>
      <h4 className="font-semibold text-sm">{title}</h4>
      <p className="text-sm text-muted-foreground mt-1">{description}</p>
    </div>
  </div>
)

const Step = ({ number, title, description, tip, isLast = false }: StepProps) => (
  <div className="flex gap-4">
    <div className="flex flex-col items-center">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
        {number}
      </div>
      {!isLast && <div className="w-px flex-1 mt-2 bg-border min-h-[1rem]" />}
    </div>
    <div className={cn("flex-1 pb-6", isLast && "pb-0")}>
      <h4 className="font-semibold">{title}</h4>
      <p className="text-sm text-muted-foreground mt-1">{description}</p>
      {tip && <TipBox>{tip}</TipBox>}
    </div>
  </div>
)

const TipBox = ({ children, title = "Pro Tip" }: TipBoxProps) => (
  <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm font-medium">
      <Lightbulb className="h-4 w-4" />
      {title}
    </div>
    <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">{children}</p>
  </div>
)

// ============================================
// Main Page Component
// ============================================

export default function GuidePage() {
  const [activeSection, setActiveSection] = useState("getting-started")

  const scrollToSection = useCallback((id: string) => {
    setActiveSection(id)
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  // Intersection observer to highlight active sidebar item on scroll
  useEffect(() => {
    const sectionIds = GUIDE_SECTIONS.map((s) => s.id)
    const observers: IntersectionObserver[] = []

    sectionIds.forEach((id) => {
      const el = document.getElementById(id)
      if (!el) return
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveSection(id)
        },
        { rootMargin: "-20% 0px -70% 0px" }
      )
      obs.observe(el)
      observers.push(obs)
    })

    return () => observers.forEach((o) => o.disconnect())
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* ── Sticky Header ── */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground font-black text-lg shadow-md">
              CE
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base">ClipEngine</span>
              <Badge variant="secondary" className="text-xs hidden sm:inline-flex">User Guide</Badge>
            </div>
          </div>

          {/* Back button */}
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-10">

          {/* ── Sticky Left Sidebar ── */}
          <aside className="lg:w-60 shrink-0">
            <div className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto pr-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-3">Contents</p>
              <nav className="space-y-0.5">
                {GUIDE_SECTIONS.map((section) => {
                  const Icon = section.icon
                  const isActive = activeSection === section.id
                  return (
                    <button
                      key={section.id}
                      onClick={() => scrollToSection(section.id)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{section.title}</span>
                    </button>
                  )
                })}
              </nav>
            </div>
          </aside>

          {/* ── Main Content ── */}
          <main className="flex-1 min-w-0 space-y-20">

            {/* Hero */}
            <section className="text-center py-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                <GraduationCap className="h-4 w-4" />
                Complete Documentation
              </div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                Master{" "}
                <span className="bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
                  ClipEngine
                </span>
              </h1>
              <p className="text-xl text-muted-foreground mt-4 max-w-2xl mx-auto">
                Everything you need to turn long-form video into polished, publish-ready clips and shorts — step by step.
              </p>
            </section>

            {/* Video placeholder */}
            <Card className="overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5">
              <CardContent className="p-0">
                <div className="aspect-video bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center relative group cursor-pointer">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute bottom-6 left-6 text-white">
                    <p className="font-semibold text-lg">Welcome to ClipEngine</p>
                    <p className="text-sm text-white/80">Full walkthrough video — coming soon</p>
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm p-5 rounded-full group-hover:scale-110 transition-transform shadow-2xl">
                    <PlayCircle className="h-14 w-14 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ===========================
                1. GETTING STARTED
            =========================== */}
            <section id="getting-started" className="scroll-mt-24">
              <SectionHeader
                icon={Rocket}
                title="Getting Started"
                description="ClipEngine runs locally on your Mac, Windows PC, or Linux machine — no internet subscription required. Here's what you need to do before your first project."
                badgeLabel="Getting Started"
                badgeClass="bg-violet-500/10 text-violet-600 dark:text-violet-400"
                iconClass="text-violet-600 dark:text-violet-400"
              />

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Download className="h-5 w-5 text-violet-600" />
                      Download and Install ClipEngine
                    </CardTitle>
                    <CardDescription>ClipEngine is a desktop app you install on your computer — not a website</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                      ClipEngine is a native desktop application (built with Electron) that runs on your Mac, Windows PC, or Linux machine. Everything — the transcription and video rendering — happens locally. Your videos never leave your computer. Gemini and Hugging Face are contacted only for the AI features that need them.
                    </p>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <FeatureCard
                        icon={Download}
                        title="macOS (Apple Silicon M1/M2/M3/M4)"
                        description="Download ClipEngine-x.x.x-arm64.dmg. Right-click → Open to bypass the macOS security prompt on first launch."
                        colorClass="bg-violet-100 dark:bg-violet-900/30"
                        iconClass="text-violet-600 dark:text-violet-400"
                      />
                      <FeatureCard
                        icon={Download}
                        title="macOS (Intel)"
                        description="Download ClipEngine-x.x.x-x64.dmg. Same installation process as Apple Silicon."
                        colorClass="bg-violet-100 dark:bg-violet-900/30"
                        iconClass="text-violet-600 dark:text-violet-400"
                      />
                      <FeatureCard
                        icon={Download}
                        title="Windows 10 / 11"
                        description="Download ClipEngine-Setup-x.x.x.exe. If Windows SmartScreen appears, click 'More info' → 'Run anyway'."
                        colorClass="bg-blue-100 dark:bg-blue-900/30"
                        iconClass="text-blue-600 dark:text-blue-400"
                      />
                      <FeatureCard
                        icon={Download}
                        title="Linux"
                        description="Download ClipEngine-x.x.x-x64.AppImage. In your terminal, make it executable with: chmod +x ClipEngine-*.AppImage — then double-click to launch."
                        colorClass="bg-slate-100 dark:bg-slate-900/30"
                        iconClass="text-slate-600 dark:text-slate-400"
                      />
                    </div>
                    <TipBox title="First Launch on macOS">
                      macOS may warn you that ClipEngine is from an unidentified developer. This is normal for desktop apps downloaded outside the Mac App Store. Right-click the .dmg file and choose Open (rather than double-clicking) to bypass the warning and proceed.
                    </TipBox>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Cpu className="h-5 w-5 text-violet-600" />
                      What You Need Before Processing Your First Video
                    </CardTitle>
                    <CardDescription>One extra step — install the Python helper for speaker detection</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                      ClipEngine's speaker detection and face layout features rely on a Python helper called the "sidecar." Set it up once in App Settings. The desktop app starts it automatically after setup; when running the source in a browser, start it from a terminal.
                    </p>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <FeatureCard
                        icon={Zap}
                        title="ClipEngine App"
                        description="The main app you installed. Double-click to open it just like any other desktop app — that's all you need for most things."
                        colorClass="bg-violet-100 dark:bg-violet-900/30"
                        iconClass="text-violet-600 dark:text-violet-400"
                      />
                      <FeatureCard
                        icon={Cpu}
                        title="Python Sidecar"
                        description="A small helper running on port 5001 that handles speaker identification and face detection. Must be running before you run Step 3 — Speaker Detection."
                        colorClass="bg-blue-100 dark:bg-blue-900/30"
                        iconClass="text-blue-600 dark:text-blue-400"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Play className="h-5 w-5 text-emerald-600" />
                      Starting the Python Sidecar
                    </CardTitle>
                    <CardDescription>Manual steps for running ClipEngine from source in a browser</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Step
                      number={1}
                      title="First time only: run the setup script"
                      description="Open a terminal window and navigate to your ClipEngine folder. Run: cd python && ./setup.sh — this creates a Python environment and installs all required packages. It takes a few minutes the first time."
                      tip="You only need to run setup.sh once. After that, skip straight to step 2 every time you want to use ClipEngine."
                    />
                    <Step
                      number={2}
                      title="Start the sidecar"
                      description="Run: source ~/.clipengine-venv/bin/activate && python python/sidecar.py — you'll see a message that it's listening on port 5001."
                    />
                    <Step
                      number={3}
                      title="Verify it's running (optional)"
                      description="Open a browser and go to http://localhost:5001/health — you should see a simple OK response. If you do, the sidecar is ready."
                      isLast
                    />
                    <TipBox title="Keep the Terminal Open">
                      When running ClipEngine from source in a browser, keep this terminal window open while you use speaker detection. The Electron desktop app starts the sidecar for you after setup.
                    </TipBox>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <KeyRound className="h-5 w-5 text-primary" />
                      One-Time API Key Setup
                    </CardTitle>
                    <CardDescription>
                      ClipEngine needs two free API keys before you can process
                      any video. You enter them directly in the app.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-muted-foreground">
                      On first launch you will see a setup banner on the
                      dashboard. Click <strong>Configure API keys</strong> and
                      you'll be taken to App Settings where you can paste in
                      your <strong>Google Gemini</strong> and{" "}
                      <strong>HuggingFace</strong> keys. See the{" "}
                      <a href="#api-keys" className="text-primary hover:underline font-medium">
                        API Keys
                      </a>{" "}
                      section below for step-by-step instructions on creating
                      each one.
                    </p>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <FeatureCard
                        icon={Sparkles}
                        title="Google Gemini"
                        description="Powers clip analysis, Find More, and AI speaker name suggestions. Free key at ai.google.dev."
                        colorClass="bg-primary/10"
                        iconClass="text-primary"
                      />
                      <FeatureCard
                        icon={Mic}
                        title="HuggingFace"
                        description="Used for speaker diarization. Free token at huggingface.co + one-time model terms acceptance."
                        colorClass="bg-primary/10"
                        iconClass="text-primary"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* ===========================
                1b. API KEYS
            =========================== */}
            <section id="api-keys" className="scroll-mt-24">
              <SectionHeader
                icon={KeyRound}
                title="API Keys"
                description="ClipEngine uses two external AI services. Both have free tiers. Your keys are stored in the local app database and used for requests to those services."
                badgeLabel="Required Setup"
                badgeClass="bg-primary/10 text-primary border border-primary/20"
                iconClass="text-primary"
              />

              <div className="space-y-6">
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-semibold text-sm">
                          Both keys are required to create projects
                        </p>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          You will see a setup banner on the dashboard until
                          both keys are configured. The <strong>New Project</strong> button
                          stays disabled until setup is complete — this
                          prevents uploading a video only to have processing fail
                          midway through.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Gemini */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      Google Gemini API Key
                    </CardTitle>
                    <CardDescription>
                      Powers clip and short analysis, Find More Candidates, and
                      AI speaker name suggestions. ClipEngine uses the{" "}
                      <code className="text-xs">gemini-3-flash-preview</code> model.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Step
                      number={1}
                      title="Open Google AI Studio"
                      description="Go to aistudio.google.com/app/apikey and sign in with any Google account."
                    />
                    <Step
                      number={2}
                      title="Create API key"
                      description="Click 'Create API key'. Pick any Google Cloud project — a new one is fine. The key starts with AIzaSy…"
                    />
                    <Step
                      number={3}
                      title="Paste into ClipEngine"
                      description="Open the dashboard, click 'Configure API keys', paste the key into the Gemini field, click Test, then Save."
                      tip="The free tier includes a generous daily quota — typical single-podcast usage stays well below the limit."
                    />
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Get your Gemini key at aistudio.google.com
                    </a>
                  </CardContent>
                </Card>

                {/* HuggingFace */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Mic className="h-5 w-5 text-primary" />
                      HuggingFace Token
                    </CardTitle>
                    <CardDescription>
                      Used by the Python sidecar for pyannote speaker diarization —
                      the step that identifies who is talking in multi-speaker
                      recordings. Free, no credit card required.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Step
                      number={1}
                      title="Create a HuggingFace account"
                      description="Go to huggingface.co and sign up for a free account if you don't already have one."
                    />
                    <Step
                      number={2}
                      title="Generate a read token"
                      description="Visit huggingface.co/settings/tokens and click 'New token'. Name it 'clipengine', set role to 'read', and copy the hf_… token."
                    />
                    <Step
                      number={3}
                      title="Accept the pyannote model terms"
                      description="Visit both pyannote/speaker-diarization-3.1 and pyannote/segmentation-3.0 and click 'Agree and access repository' on each. This is a one-time consent step — the models are free."
                      tip="If you skip this step, diarization will fail with a 403 error when you try to analyze a video."
                    />
                    <Step
                      number={4}
                      title="Paste into ClipEngine"
                      description="Back in the dashboard, paste the token into the HuggingFace field, click Test, then Save."
                    />
                    <div className="space-y-1.5">
                      <a
                        href="https://huggingface.co/settings/tokens"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Get your HuggingFace token
                      </a>
                      <a
                        href="https://huggingface.co/pyannote/speaker-diarization-3.1"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary hover:underline"
                      >
                        → Accept pyannote/speaker-diarization-3.1
                      </a>
                      <a
                        href="https://huggingface.co/pyannote/segmentation-3.0"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary hover:underline"
                      >
                        → Accept pyannote/segmentation-3.0
                      </a>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Where your keys live</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p>
                      Keys are stored in ClipEngine's local SQLite database on
                      your computer — the same file that holds your projects.
                      Nothing is uploaded to any ClipEngine server because
                      there is no ClipEngine server. The only time your key
                      leaves your computer is when you make a request directly
                      to Google or HuggingFace.
                    </p>
                    <p>
                      You can change or clear your keys at any time from{" "}
                      <strong>App Settings → API Keys</strong> in the top-right
                      dropdown.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* ===========================
                2. DASHBOARD
            =========================== */}
            <section id="dashboard" className="scroll-mt-24">
              <SectionHeader
                icon={LayoutDashboard}
                title="Dashboard"
                description="The dashboard is your home base — it shows all your projects and gives you quick access to create new ones."
                badgeLabel="Dashboard"
                badgeClass="bg-blue-500/10 text-blue-600 dark:text-blue-400"
                iconClass="text-blue-600 dark:text-blue-400"
              />

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <SearchIcon className="h-5 w-5 text-blue-600" />
                      Finding and Sorting Your Projects
                    </CardTitle>
                    <CardDescription>The toolbar keeps your project list manageable as it grows</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                      At the top of your project list, you'll see three controls that work together to help you find what you need quickly.
                    </p>
                    <div className="grid sm:grid-cols-3 gap-4">
                      <FeatureCard
                        icon={SearchIcon}
                        title="Search"
                        description="Type any part of a project name to instantly filter the list. Great when you have dozens of projects."
                        colorClass="bg-blue-100 dark:bg-blue-900/30"
                        iconClass="text-blue-600 dark:text-blue-400"
                      />
                      <FeatureCard
                        icon={Sliders}
                        title="Sort"
                        description="Choose Newest first, Oldest first, A→Z, or Z→A. ClipEngine remembers your choice."
                        colorClass="bg-purple-100 dark:bg-purple-900/30"
                        iconClass="text-purple-600 dark:text-purple-400"
                      />
                      <FeatureCard
                        icon={Layers}
                        title="Filter tabs"
                        description="Switch between All, Active (current work), and Archived (older projects you want to keep but not see daily)."
                        colorClass="bg-teal-100 dark:bg-teal-900/30"
                        iconClass="text-teal-600 dark:text-teal-400"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Edit3 className="h-5 w-5 text-blue-600" />
                      Project Actions (the ⋯ Menu)
                    </CardTitle>
                    <CardDescription>Right-click the three dots on any project row to manage it</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                      Each project row has a three-dot button on the right side. Click it to see everything you can do with that project.
                    </p>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <FeatureCard
                        icon={Edit3}
                        title="Rename"
                        description="Opens a text box so you can give the project a clear, memorable name."
                        colorClass="bg-slate-100 dark:bg-slate-900/30"
                        iconClass="text-slate-600 dark:text-slate-400"
                      />
                      <FeatureCard
                        icon={Layers}
                        title="Clone"
                        description="Duplicates the project including all its settings. The pipeline re-runs on the copy."
                        colorClass="bg-blue-100 dark:bg-blue-900/30"
                        iconClass="text-blue-600 dark:text-blue-400"
                      />
                      <FeatureCard
                        icon={Download}
                        title="Archive"
                        description="Hides the project from the Active view but keeps everything safe. Use for completed podcasts."
                        colorClass="bg-amber-100 dark:bg-amber-900/30"
                        iconClass="text-amber-600 dark:text-amber-400"
                      />
                      <FeatureCard
                        icon={AlertCircle}
                        title="Delete"
                        description="Permanently removes the project and all its files. You'll see a confirmation before anything is deleted."
                        colorClass="bg-red-100 dark:bg-red-900/30"
                        iconClass="text-red-600 dark:text-red-400"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-emerald-600" />
                      Creating a New Project
                    </CardTitle>
                    <CardDescription>Get a new podcast ready to process in seconds</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Step
                      number={1}
                      title="Click 'New Project' in the top right corner"
                      description="ClipEngine creates a blank project called 'Untitled Project' and takes you straight to its Overview page."
                    />
                    <Step
                      number={2}
                      title="Click 'Pick Video' to select your video file"
                      description="A file browser opens so you can navigate to your video file. Once you select the file, ClipEngine automatically renames the project to match the filename — for example, picking 'WickedSmart-Ep42.mp4' instantly names the project 'WickedSmart-Ep42'. No manual naming needed!"
                      tip="The auto-rename only happens while the project is still called 'Untitled Project'. If you've already given it a custom name, picking a video file won't overwrite your name."
                    />
                    <Step
                      number={3}
                      title="Rename it anytime if you want"
                      description="If you'd like a friendlier name than the filename, use the ⋯ menu → Rename from the dashboard at any point. You can also click the project title directly on the Overview page."
                      isLast
                    />
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* ===========================
                3. PROCESSING PIPELINE
            =========================== */}
            <section id="pipeline" className="scroll-mt-24">
              <SectionHeader
                icon={Cpu}
                title="Processing Pipeline"
                description="Every project goes through four steps that transform your raw video into a collection of clip and short candidates ready for review."
                badgeLabel="Processing Pipeline"
                badgeClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                iconClass="text-emerald-600 dark:text-emerald-400"
              />

              <div className="space-y-6">
                <TipBox title="Important">
                  The four steps must be run in order. Each one builds on the results of the previous step. You'll see a progress indicator on the Overview page — all four must reach the checkmark before your project status changes to Ready.
                </TipBox>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Upload className="h-5 w-5 text-emerald-600" />
                      Step 1 — Upload & Probe Video
                    </CardTitle>
                    <CardDescription>Add your video file and let ClipEngine read its technical details</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                      The first thing you'll see on a fresh project is a big drag-and-drop area. This is where you bring in your video file.
                    </p>
                    <Step
                      number={1}
                      title="Drag your video file onto the upload zone — or click to browse"
                      description="ClipEngine accepts .mp4, .mov, .mkv, .avi, .webm, and .m4v files up to 10GB. Your file is copied to a dedicated folder on your Mac — the original is never moved or deleted."
                    />
                    <Step
                      number={2}
                      title="Click 'Start Processing'"
                      description="Once the file is uploaded, you'll see a Start Processing button appear. Click it to confirm you're ready to begin."
                    />
                    <Step
                      number={3}
                      title="Click 'Run' next to 'Probe Video'"
                      description="This reads your video's technical details — duration, resolution, and the video format. It takes just a few seconds and prepares ClipEngine for the transcription step."
                      isLast
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-cyan-600" />
                      Step 2 — Transcribe
                    </CardTitle>
                    <CardDescription>Convert your spoken words into text with precise timestamps</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                      Click <strong>Run</strong> next to "Transcribe". ClipEngine uses Whisper (an open-source speech-to-text engine from OpenAI) that runs entirely on your Mac — your audio never leaves your computer.
                    </p>
                    <p className="text-muted-foreground">
                      Every single word gets a precise timestamp. This is what powers the word-level caption animation and lets you click on any word in the Transcript view to jump to that moment in the video.
                    </p>
                    <TipBox>
                      Transcription time depends on your video length and your Mac's speed. A 60-minute podcast typically takes 5–10 minutes. You can leave this running and come back.
                    </TipBox>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-teal-600" />
                      Step 3 — Speaker Detection
                    </CardTitle>
                    <CardDescription>Identify who is speaking and where their face is in the frame</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                      Click <strong>Run</strong> next to "Speaker Detection". This step uses the Python sidecar to do two things:
                    </p>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <FeatureCard
                        icon={Mic}
                        title="Speaker Diarization"
                        description="Figures out WHO is speaking at every moment — so the transcript shows 'SPEAKER_0 said X, SPEAKER_1 said Y' instead of one big block of text."
                        colorClass="bg-teal-100 dark:bg-teal-900/30"
                        iconClass="text-teal-600 dark:text-teal-400"
                      />
                      <FeatureCard
                        icon={Eye}
                        title="Face Detection & Tracking"
                        description="Tracks WHERE each face is across every frame. This powers Smart Framing for vertical shorts — face-centered zoom for single speakers, stacked layout for two-person conversations. Uses YOLOv8 (when the model file is installed) or MediaPipe as a fallback."
                        colorClass="bg-blue-100 dark:bg-blue-900/30"
                        iconClass="text-blue-600 dark:text-blue-400"
                      />
                    </div>
                    <TipBox title="Remember">
                      The Python sidecar must be running before you click Run on this step. If you see an error, open a terminal and start it: source ~/.clipengine-venv/bin/activate && python python/sidecar.py
                    </TipBox>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-purple-600" />
                      Step 4 — AI Analysis
                    </CardTitle>
                    <CardDescription>Let Gemini find your best clips and shorts automatically</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                      Click <strong>Run</strong> next to "AI Analysis". This sends your full transcript to Gemini (Google's AI) which reads through the entire conversation and identifies the moments most likely to perform well as standalone clips or short-form videos.
                    </p>
                    <p className="text-muted-foreground">
                      Every candidate gets a rich set of ratings and information to help you decide what to publish:
                    </p>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <FeatureCard
                        icon={BarChart2}
                        title="Virality Score (0–100)"
                        description="Overall performance potential — color-coded green, yellow, or red."
                        colorClass="bg-amber-100 dark:bg-amber-900/30"
                        iconClass="text-amber-600 dark:text-amber-400"
                      />
                      <FeatureCard
                        icon={Star}
                        title="Letter Grade (A+ to D)"
                        description="A quick quality rating so you know at a glance whether to prioritize or skip."
                        colorClass="bg-green-100 dark:bg-green-900/30"
                        iconClass="text-green-600 dark:text-green-400"
                      />
                      <FeatureCard
                        icon={Layers}
                        title="Recommendation Tier"
                        description="Must Use / Highly Recommended / Recommended / Worth Considering / User Choice."
                        colorClass="bg-blue-100 dark:bg-blue-900/30"
                        iconClass="text-blue-600 dark:text-blue-400"
                      />
                      <FeatureCard
                        icon={Target}
                        title="Hook Strength & Completion Pull"
                        description="Two separate 0–100 scores for how well the clip opens and how likely viewers are to watch to the end."
                        colorClass="bg-purple-100 dark:bg-purple-900/30"
                        iconClass="text-purple-600 dark:text-purple-400"
                      />
                      <FeatureCard
                        icon={Zap}
                        title="Content Type Tags (1–5 per clip)"
                        description="Up to 5 tags like 'Hot Take', 'Actionable Advice', 'Personal Story', 'Educational', etc. — 18 types in total."
                        colorClass="bg-slate-100 dark:bg-slate-900/30"
                        iconClass="text-slate-600 dark:text-slate-400"
                      />
                      <FeatureCard
                        icon={Sparkles}
                        title="Platform Play & Share Trigger"
                        description="Which platform this clip fits best and why — plus a callout if the clip has a re-watch or tag-a-friend moment."
                        colorClass="bg-rose-100 dark:bg-rose-900/30"
                        iconClass="text-rose-600 dark:text-rose-400"
                      />
                    </div>
                    <p className="text-muted-foreground">
                      The virality score is built on five core criteria:
                    </p>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <FeatureCard
                        icon={Target}
                        title="Hook Strength"
                        description="Does it open a compelling loop in the first few seconds? Does it close satisfyingly?"
                        colorClass="bg-purple-100 dark:bg-purple-900/30"
                        iconClass="text-purple-600 dark:text-purple-400"
                      />
                      <FeatureCard
                        icon={Zap}
                        title="Insight Density"
                        description="How much useful, actionable, or surprising information is packed into the time?"
                        colorClass="bg-amber-100 dark:bg-amber-900/30"
                        iconClass="text-amber-600 dark:text-amber-400"
                      />
                      <FeatureCard
                        icon={Star}
                        title="Emotional Moments"
                        description="Personal stories, vulnerability, humor, or genuine surprise — things that make people stop scrolling."
                        colorClass="bg-rose-100 dark:bg-rose-900/30"
                        iconClass="text-rose-600 dark:text-rose-400"
                      />
                      <FeatureCard
                        icon={CheckCircle2}
                        title="Quotability"
                        description="Memorable one-liners or phrases that people want to share. High-quotability moments make great thumbnails too."
                        colorClass="bg-green-100 dark:bg-green-900/30"
                        iconClass="text-green-600 dark:text-green-400"
                      />
                    </div>
                    <TipBox>
                      The AI is calibrated to produce at least 1 clip per 5 minutes of content and 1 short per 4 minutes — so a 60-minute podcast gives you at least 12 clip candidates and 15 short candidates to review.
                    </TipBox>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* ===========================
                4. TRANSCRIPT & SEARCH
            =========================== */}
            <section id="transcript" className="scroll-mt-24">
              <SectionHeader
                icon={FileText}
                title="Transcript & Search"
                description="The Transcript tab gives you the full text of your video — searchable, clickable, and labelled by speaker."
                badgeLabel="Transcript & Search"
                badgeClass="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
                iconClass="text-cyan-600 dark:text-cyan-400"
              />

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <SearchIcon className="h-5 w-5 text-cyan-600" />
                      Searching Your Transcript
                    </CardTitle>
                    <CardDescription>Find any moment in a 60-minute podcast in seconds</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                      Click the <strong>Transcript</strong> tab in the project navigation. At the top you'll see a search bar.
                    </p>
                    <Step
                      number={1}
                      title="Type your search term"
                      description="Type any word or phrase you're looking for — for example, 'return on investment' or 'my biggest mistake'. Results appear immediately as you type."
                    />
                    <Step
                      number={2}
                      title="Review results in context"
                      description="Each result shows the matching text highlighted, plus the surrounding sentences so you can judge whether it's the moment you're thinking of."
                    />
                    <Step
                      number={3}
                      title="Click any segment to jump to it"
                      description="Clicking on any paragraph in the transcript jumps the video preview player to that exact moment. This is a great way to spot-check segments before approving them."
                      isLast
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-cyan-600" />
                      Speaker Labels in the Transcript
                    </CardTitle>
                    <CardDescription>See who said what at a glance</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      After Speaker Detection runs, each paragraph in the transcript is labeled with the speaker (initially SPEAKER_0, SPEAKER_1, etc.). Once you rename speakers in <strong>Settings → Speaker Labels</strong>, those names are reflected here automatically — making long conversations much easier to read.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* ===========================
                5. CLIPS
            =========================== */}
            <section id="clips" className="scroll-mt-24">
              <SectionHeader
                icon={Scissors}
                title="Reviewing Clips"
                description="Clips are landscape-format highlights, typically 3–20 minutes, designed for YouTube, podcast audiograms, or your website."
                badgeLabel="Reviewing Clips"
                badgeClass="bg-orange-500/10 text-orange-600 dark:text-orange-400"
                iconClass="text-orange-600 dark:text-orange-400"
              />

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="h-5 w-5 text-orange-600" />
                      What's on Each Candidate Card
                    </CardTitle>
                    <CardDescription>Understanding everything ClipEngine shows you for each potential clip</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                      Navigate to the <strong>Clips</strong> tab. You'll see a card for every clip candidate the AI found. Each card is packed with information to help you decide quickly — here's what it all means:
                    </p>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <FeatureCard
                        icon={Edit3}
                        title="AI-Generated Title"
                        description="A descriptive name for what the clip is about. Gives you a quick preview without having to watch it."
                        colorClass="bg-orange-100 dark:bg-orange-900/30"
                        iconClass="text-orange-600 dark:text-orange-400"
                      />
                      <FeatureCard
                        icon={Clock}
                        title="Duration"
                        description="How long the clip runs. Clips are typically 3–20 minutes — long enough to deliver real value."
                        colorClass="bg-slate-100 dark:bg-slate-900/30"
                        iconClass="text-slate-600 dark:text-slate-400"
                      />
                      <FeatureCard
                        icon={BarChart2}
                        title="Virality Score (0–100)"
                        description="A color-coded badge: green (70+) = strong candidate, yellow = decent, red = weaker pick. This is the AI's overall confidence that this clip will perform well."
                        colorClass="bg-amber-100 dark:bg-amber-900/30"
                        iconClass="text-amber-600 dark:text-amber-400"
                      />
                      <FeatureCard
                        icon={Star}
                        title="Letter Grade (A+ to D)"
                        description="A quick at-a-glance quality rating alongside the virality score. A+ and A are the strongest picks. D-grade clips are included for completeness but probably aren't worth publishing."
                        colorClass="bg-green-100 dark:bg-green-900/30"
                        iconClass="text-green-600 dark:text-green-400"
                      />
                      <FeatureCard
                        icon={Target}
                        title="Hook Strength"
                        description="A 0–100 score measuring how compellingly the clip opens. For clips, the AI evaluates the first 30 seconds. A high hook score means viewers are very likely to keep watching past the opening."
                        colorClass="bg-blue-100 dark:bg-blue-900/30"
                        iconClass="text-blue-600 dark:text-blue-400"
                      />
                      <FeatureCard
                        icon={CheckCircle2}
                        title="Completion Pull"
                        description="A 0–100 score estimating how likely viewers are to watch all the way to the end. High completion rates help YouTube's algorithm recommend your content more."
                        colorClass="bg-purple-100 dark:bg-purple-900/30"
                        iconClass="text-purple-600 dark:text-purple-400"
                      />
                      <FeatureCard
                        icon={Zap}
                        title="Platform Play"
                        description="Which platform this clip is best suited for (YouTube, LinkedIn, podcast audiogram, etc.) and a brief explanation of why it fits that platform's audience."
                        colorClass="bg-cyan-100 dark:bg-cyan-900/30"
                        iconClass="text-cyan-600 dark:text-cyan-400"
                      />
                      <FeatureCard
                        icon={Sparkles}
                        title="Share Trigger"
                        description="If the clip has a strong re-watch or tag-a-friend moment, this field calls it out — for example, 'the stat at 1:42 is highly shareable'. Not every clip will have one."
                        colorClass="bg-rose-100 dark:bg-rose-900/30"
                        iconClass="text-rose-600 dark:text-rose-400"
                      />
                    </div>
                    <TipBox>
                      The 240p video preview plays right inside the card — you don't need to click away to watch it. Watch the first 10–15 seconds to judge the hook quickly.
                    </TipBox>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Star className="h-5 w-5 text-orange-600" />
                      Recommendation Tiers — At a Glance
                    </CardTitle>
                    <CardDescription>ClipEngine groups clips into tiers so you can prioritize your review time</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                      Every candidate card also shows a <strong>recommendation tier</strong> — a plain-English label that maps to the letter grade and tells you how strongly the AI recommends publishing this clip.
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Tier</th>
                            <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Grade</th>
                            <th className="text-left py-2 font-medium text-muted-foreground">What it means</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          <tr>
                            <td className="py-2 pr-4 font-semibold text-green-600">Must Use</td>
                            <td className="py-2 pr-4 text-muted-foreground">A+ / A</td>
                            <td className="py-2 text-muted-foreground">Would be negligent to skip — publish this one.</td>
                          </tr>
                          <tr>
                            <td className="py-2 pr-4 font-semibold text-emerald-600">Highly Recommended</td>
                            <td className="py-2 pr-4 text-muted-foreground">A− / B+</td>
                            <td className="py-2 text-muted-foreground">Strong candidate — publish unless your queue is already full.</td>
                          </tr>
                          <tr>
                            <td className="py-2 pr-4 font-semibold text-blue-600">Recommended</td>
                            <td className="py-2 pr-4 text-muted-foreground">B / B−</td>
                            <td className="py-2 text-muted-foreground">Solid clip — worth publishing in most content batches.</td>
                          </tr>
                          <tr>
                            <td className="py-2 pr-4 font-semibold text-amber-600">Worth Considering</td>
                            <td className="py-2 pr-4 text-muted-foreground">C+ / C</td>
                            <td className="py-2 text-muted-foreground">Has merit — take a look and decide based on your content goals.</td>
                          </tr>
                          <tr>
                            <td className="py-2 pr-4 font-semibold text-slate-500">User Choice</td>
                            <td className="py-2 pr-4 text-muted-foreground">C− / D</td>
                            <td className="py-2 text-muted-foreground">Included for completeness — the AI says you decide.</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Layers className="h-5 w-5 text-orange-600" />
                      Content Type Tags
                    </CardTitle>
                    <CardDescription>Each clip gets 1–5 tags describing what kind of content it is</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                      Tags help you understand the character of each clip at a glance — and choose what to publish based on the mix of content you want in your feed. A clip might be tagged "Educational" + "Data / Stats" + "Actionable Advice", meaning it's a data-driven how-to moment.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {["Hot Take", "Humor", "Actionable Advice", "Personal Story", "Educational", "Quotable One-Liner", "Controversial", "Newsworthy", "Behind the Scenes", "Data / Stats", "Vulnerability", "Framework / Model", "Debate / Tension", "Transformational", "Motivational", "Inspirational", "Strategy / Tactic", "Hidden Gem"].map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                    <TipBox>
                      "Hidden Gem" is a special tag for moments that scored below the top tier on raw virality but contain unusually deep insight or a genuinely memorable line. Don't sleep on Hidden Gem clips — they often perform surprisingly well with engaged audiences.
                    </TipBox>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      Taking Action on Each Clip
                    </CardTitle>
                    <CardDescription>Approve what you want, discard what you don't, and refine the rest</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <FeatureCard
                        icon={CheckCircle2}
                        title="Approve"
                        description="Marks this clip for rendering. A green border appears on the card. Approved clips show up in the Render Queue automatically."
                        colorClass="bg-green-100 dark:bg-green-900/30"
                        iconClass="text-green-600 dark:text-green-400"
                      />
                      <FeatureCard
                        icon={AlertCircle}
                        title="Discard"
                        description="Grays out the card so it's out of the way. Discarded clips don't appear in the Render Queue."
                        colorClass="bg-slate-100 dark:bg-slate-900/30"
                        iconClass="text-slate-600 dark:text-slate-400"
                      />
                      <FeatureCard
                        icon={Edit3}
                        title="Edit"
                        description="Opens the Trim Editor so you can fine-tune the exact start and end point of the clip."
                        colorClass="bg-blue-100 dark:bg-blue-900/30"
                        iconClass="text-blue-600 dark:text-blue-400"
                      />
                      <FeatureCard
                        icon={Play}
                        title="Front / Rear Bumper"
                        description="Attach an intro video before the clip and/or an outro video at the end. Only available for Clips (not Shorts)."
                        colorClass="bg-indigo-100 dark:bg-indigo-900/30"
                        iconClass="text-indigo-600 dark:text-indigo-400"
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      You can also set a <strong>per-candidate Brand Strip or Watermark override</strong> directly on each card — useful when you want different branding for a specific clip without changing your project defaults.
                    </p>
                    <TipBox>
                      Use the <strong>Bulk Actions</strong> button at the top of the Clips tab to approve or discard all candidates at once. This is a great starting point — approve everything, then go through and discard the weaker ones.
                    </TipBox>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* ===========================
                6. SHORTS
            =========================== */}
            <section id="shorts" className="scroll-mt-24">
              <SectionHeader
                icon={Film}
                title="Reviewing Shorts"
                description="Shorts are vertical 9:16 videos for platforms like TikTok, Instagram Reels, and YouTube Shorts. The Shorts tab is split into two sub-tabs: Classic and Extended."
                badgeLabel="Reviewing Shorts"
                badgeClass="bg-pink-500/10 text-pink-600 dark:text-pink-400"
                iconClass="text-pink-600 dark:text-pink-400"
              />

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Film className="h-5 w-5 text-pink-600" />
                      Classic Shorts vs. Extended Shorts
                    </CardTitle>
                    <CardDescription>Two types of vertical content for different platforms and purposes</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                      When you open the <strong>Shorts</strong> tab, you'll see two tabs at the top of the content area: <strong>Classic</strong> and <strong>Extended</strong>. These represent two different styles of short-form vertical content.
                    </p>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <FeatureCard
                        icon={Zap}
                        title="Classic Shorts (≤60 seconds)"
                        description="Traditional short-form content — 15 to 60 seconds long. Punchy, one hook, one payoff. Best for TikTok, Instagram Reels, and YouTube Shorts. This is where the AI puts its most snappy, standalone moments."
                        colorClass="bg-pink-100 dark:bg-pink-900/30"
                        iconClass="text-pink-600 dark:text-pink-400"
                      />
                      <FeatureCard
                        icon={Clock}
                        title="Extended Shorts (1–3 minutes)"
                        description="Longer vertical content — 61 to 180 seconds. YouTube Shorts now supports up to 3 minutes. Great for multi-step explanations, stories with a setup and payoff, and educational walkthroughs that need more breathing room."
                        colorClass="bg-purple-100 dark:bg-purple-900/30"
                        iconClass="text-purple-600 dark:text-purple-400"
                      />
                    </div>
                    <TipBox title="How to Enable Extended Shorts">
                      Extended Shorts are opt-in. Go to <strong>Settings → Extended Shorts</strong> and toggle "Find extended shorts" ON <em>before</em> running AI Analysis (Step 4). If you run Analysis with the toggle off, you'll only get Classic Shorts — you'd need to re-run Step 4 to get Extended Shorts added.
                    </TipBox>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FlipVertical className="h-5 w-5 text-pink-600" />
                      Smart Framing — Automatic Face-Based Cropping for Every Short
                    </CardTitle>
                    <CardDescription>ClipEngine crops all shorts to the right face — single speaker or two-person podcast</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                      Every short you produce gets automatic Smart Framing. ClipEngine's Python sidecar uses face detection during Speaker Detection (Step 3) to track where people are in the frame, so shorts are always cropped to the speaker — not just to the center of the screen. There are three framing modes depending on how many faces are detected:
                    </p>
                    <div className="grid sm:grid-cols-1 gap-4">
                      <FeatureCard
                        icon={Target}
                        title="Single Speaker — Face-Centered Zoom"
                        description="When one face is found, the short is cropped tightly to that person's face and tracks smoothly as they move. The result is a polished 9:16 vertical video that feels intentionally framed — not accidentally cropped."
                        colorClass="bg-blue-100 dark:bg-blue-900/30"
                        iconClass="text-blue-600 dark:text-blue-400"
                      />
                      <FeatureCard
                        icon={Users}
                        title="Two Speakers — Stacked Layout"
                        description="When two faces are found, the vertical video is split into top and bottom tiles — one speaker per tile. Cards with this layout show a STACKED badge on the preview. This looks excellent on mobile and keeps both speakers visible at once."
                        colorClass="bg-pink-100 dark:bg-pink-900/30"
                        iconClass="text-pink-600 dark:text-pink-400"
                      />
                      <FeatureCard
                        icon={Zap}
                        title="Two Speakers — Active Speaker Mode"
                        description="When speaker identity data is available, ClipEngine can zoom in on whoever is talking at each moment and smoothly transition to the stacked view during back-and-forth exchanges. This is the highest-quality framing option for two-person conversations."
                        colorClass="bg-purple-100 dark:bg-purple-900/30"
                        iconClass="text-purple-600 dark:text-purple-400"
                      />
                    </div>
                    <TipBox title="Better Face Detection with YOLO">
                      ClipEngine's Python sidecar now uses a YOLOv8 face detection model for more accurate tracking when the optional model file is present at <code className="text-xs bg-amber-100 dark:bg-amber-900/50 px-1 rounded">~/.clipengine-models/yolov8n-face.pt</code>. If the YOLO model isn't found, it automatically falls back to the MediaPipe detector — so Smart Framing always works, even without the optional upgrade. Check the setup guide for instructions on adding the YOLO model.
                    </TipBox>
                    <TipBox>
                      If shorts are coming out center-cropped with no face tracking, make sure the Python sidecar was running during Step 3 — Speaker Detection. Face data is collected during that step. If you re-run Step 3, the face data will be refreshed and new shorts will use the improved framing.
                    </TipBox>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-pink-600" />
                      Reviewing Shorts — Same Workflow as Clips
                    </CardTitle>
                    <CardDescription>Approve, discard, edit, and customize — just like clips</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Both the Classic and Extended tabs work exactly like the Clips tab. Each card shows the title, duration, virality score, letter grade, recommendation tier, content type tags, Hook Strength, Completion Pull, and a preview. Use Approve, Discard, and Edit the same way. You can also set per-candidate Brand Strip and Watermark overrides on individual short cards.
                    </p>
                    <p className="text-muted-foreground mt-3">
                      Note: Shorts don't have Front/Rear Bumper options — those are for Clips only.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* ===========================
                7. FIND MORE CANDIDATES
            =========================== */}
            <section id="find-more" className="scroll-mt-24">
              <SectionHeader
                icon={SearchIcon}
                title="Find More Candidates"
                description="Sometimes the first AI pass misses a gem. The Find More feature runs a second AI pass specifically to surface moments that were overlooked."
                badgeLabel="Find More"
                badgeClass="bg-purple-500/10 text-purple-600 dark:text-purple-400"
                iconClass="text-purple-600 dark:text-purple-400"
              />

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-purple-600" />
                      How Find More Works
                    </CardTitle>
                    <CardDescription>A smart second pass that respects what's already been found</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                      Click the <strong>Find More</strong> button at the top of either the Clips or Shorts tab. A progress dialog will appear and walk you through what's happening in real time.
                    </p>
                    <Step
                      number={1}
                      title="Gemini re-reads your entire transcript"
                      description="The AI does a fresh pass — but this time it's told to treat all the time ranges that are already covered by existing candidates as off-limits. This forces it to look in different parts of the conversation."
                    />
                    <Step
                      number={2}
                      title="New candidates are de-duplicated"
                      description="Any new suggestion that overlaps more than 20% with an existing candidate is automatically filtered out — so you won't see the same moment twice."
                    />
                    <Step
                      number={3}
                      title="Previews are generated in real time"
                      description="You'll see a live checklist in the dialog as each new candidate's preview is rendered. Watch the progress bar and timer — you'll know exactly where things stand."
                    />
                    <Step
                      number={4}
                      title="Confetti fires when it's done!"
                      description="A little celebration animation plays, then the dialog closes automatically after a few seconds. Your new candidates are added to the Clips or Shorts list."
                      isLast
                    />
                  </CardContent>
                </Card>

                <TipBox title="Good to Know">
                  The Find More dialog can't be closed while a run is in progress — this is intentional to prevent accidental interruptions. If something goes wrong, an error message will appear with a Close button so you can exit and try again.
                </TipBox>
              </div>
            </section>

            {/* ===========================
                8. TRIM EDITOR
            =========================== */}
            <section id="trim-editor" className="scroll-mt-24">
              <SectionHeader
                icon={Edit3}
                title="Trim Editor"
                description="The Trim Editor lets you fine-tune exactly where a clip starts and ends — using a visual timeline or by clicking directly on words in the transcript."
                badgeLabel="Trim Editor"
                badgeClass="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                iconClass="text-yellow-600 dark:text-yellow-400"
              />

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Video className="h-5 w-5 text-yellow-600" />
                      Opening the Trim Editor
                    </CardTitle>
                    <CardDescription>Access it from any candidate card</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      On any Clip or Short candidate card, click the <strong>Edit</strong> button. The Trim Editor opens in a panel below (or on the same page). At the top you'll see two tabs: <strong>Timeline</strong> and <strong>Transcript</strong>. Use whichever feels more natural to you — both do the same job.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sliders className="h-5 w-5 text-yellow-600" />
                      Timeline Mode
                    </CardTitle>
                    <CardDescription>Drag handles to set start and end points visually</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                      The timeline shows a visual representation of your clip's time range with two draggable handles.
                    </p>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <FeatureCard
                        icon={ChevronRight}
                        title="IN Handle (left side)"
                        description="Drag this to the right to trim the beginning of the clip. The clip will start at wherever you drop the handle."
                        colorClass="bg-green-100 dark:bg-green-900/30"
                        iconClass="text-green-600 dark:text-green-400"
                      />
                      <FeatureCard
                        icon={ChevronRight}
                        title="OUT Handle (right side)"
                        description="Drag this to the left to trim the end. The clip will end at wherever you drop the handle."
                        colorClass="bg-red-100 dark:bg-red-900/30"
                        iconClass="text-red-600 dark:text-red-400"
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      The current IN time, OUT time, and total clip duration are displayed below the track. Click anywhere on the track to seek the preview player to that point.
                    </p>
                    <TipBox>
                      Use the <strong>− 1 min</strong> and <strong>+ 1 min</strong> buttons to expand how much of the video is visible in the timeline window. This is helpful when you want to grab a bit of context before or after the AI's suggested start/end points.
                    </TipBox>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-yellow-600" />
                      Transcript Mode
                    </CardTitle>
                    <CardDescription>Set trim points by clicking on words in the text</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                      Some people find it easier to work with the transcript text than a visual waveform. Transcript mode shows all the words in your clip, with the active portion highlighted and context words shown in a muted style.
                    </p>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <FeatureCard
                        icon={Play}
                        title="Set the Start Point"
                        description="Click any word to make it the new start of the clip. The word will become the new IN point."
                        colorClass="bg-green-100 dark:bg-green-900/30"
                        iconClass="text-green-600 dark:text-green-400"
                      />
                      <FeatureCard
                        icon={Play}
                        title="Set the End Point"
                        description="Hold Shift and click any word to set it as the new end of the clip. The word becomes the new OUT point."
                        colorClass="bg-red-100 dark:bg-red-900/30"
                        iconClass="text-red-600 dark:text-red-400"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      Saving Your Trim
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      When you're happy with the start and end points, click the <strong>Save Trim</strong> button. Your adjusted in/out points are saved to the database. The card in the Clips or Shorts tab will reflect the new duration.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* ===========================
                9. SPEAKER LABELS & AI
            =========================== */}
            <section id="speaker-labels" className="scroll-mt-24">
              <SectionHeader
                icon={Users}
                title="Speaker Labels & AI Suggestions"
                description="After diarization, ClipEngine knows WHO is speaking but not their actual names. This section is how you fix that — manually or with AI help."
                badgeLabel="Speaker Labels"
                badgeClass="bg-teal-500/10 text-teal-600 dark:text-teal-400"
                iconClass="text-teal-600 dark:text-teal-400"
              />

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Edit3 className="h-5 w-5 text-teal-600" />
                      Renaming Speakers Manually
                    </CardTitle>
                    <CardDescription>Quick and easy — just click and type</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                      Go to <strong>Settings → Speaker Labels</strong>. You'll see all the speakers detected (SPEAKER_0, SPEAKER_1, etc.) listed with an editable name field next to each one.
                    </p>
                    <Step
                      number={1}
                      title="Click any label field"
                      description="The field becomes editable. Type the speaker's actual name — for example, 'Sarah' or 'Host'."
                    />
                    <Step
                      number={2}
                      title="Click somewhere else (or press Tab)"
                      description="As soon as you move focus away from the field, the name is saved automatically. You'll see it reflected in the Transcript view right away."
                      isLast
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wand2 className="h-5 w-5 text-teal-600" />
                      AI Name Suggestions
                    </CardTitle>
                    <CardDescription>Let Gemini scan the transcript for name clues</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                      Don't want to listen back to figure out who's who? Click <strong>Suggest names with AI</strong>. Gemini scans the full transcript for introductions ("today I'm joined by..."), direct address ("so Sarah, what do you think?"), and host lead-ins to guess each speaker's name.
                    </p>
                    <p className="text-muted-foreground">
                      Each suggestion shows you:
                    </p>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <FeatureCard
                        icon={Star}
                        title="Guessed Name + Confidence"
                        description="High (green), Medium (yellow), or Low (red) confidence — so you know how much to trust the suggestion."
                        colorClass="bg-teal-100 dark:bg-teal-900/30"
                        iconClass="text-teal-600 dark:text-teal-400"
                      />
                      <FeatureCard
                        icon={FileText}
                        title="Evidence Quote"
                        description="The exact line from the transcript that the AI used to make its guess. Click through to verify if you want."
                        colorClass="bg-slate-100 dark:bg-slate-900/30"
                        iconClass="text-slate-600 dark:text-slate-400"
                      />
                    </div>
                    <TipBox>
                      Click <strong>Apply all</strong> to accept all suggestions at once, or click <strong>Apply</strong> on individual suggestions if you only trust some of them.
                    </TipBox>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* ===========================
                10. BUMPERS
            =========================== */}
            <section id="bumpers" className="scroll-mt-24">
              <SectionHeader
                icon={Play}
                title="Bumpers"
                description="Bumpers are short intro and outro video clips that get attached to the beginning and/or end of your exported Clips — a professional touch that reinforces your brand."
                badgeLabel="Bumpers"
                badgeClass="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                iconClass="text-indigo-600 dark:text-indigo-400"
              />

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Upload className="h-5 w-5 text-indigo-600" />
                      Managing Your Bumper Library
                    </CardTitle>
                    <CardDescription>Upload bumper videos once, use them across all projects</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                      Click <strong>Bumpers</strong> in the top bar on the dashboard. This takes you to a library where you can upload and manage your bumper video files.
                    </p>
                    <Step
                      number={1}
                      title="Click 'Upload Bumper'"
                      description="Upload your intro or outro video file. Any standard video format is accepted (.mp4, .mov, etc.)."
                    />
                    <Step
                      number={2}
                      title="Name your bumper"
                      description="Give it a descriptive name like 'Brand Intro 2024' or 'Short Outro' so you can identify it when assigning to clips."
                      isLast
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Layers className="h-5 w-5 text-indigo-600" />
                      Assigning Bumpers to Clips
                    </CardTitle>
                    <CardDescription>Attach different intros/outros to different clips if you want</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                      On any Clip candidate card (in the Clips tab), you'll see <strong>Front Bumper</strong> and <strong>Rear Bumper</strong> selectors. Click either one to pick from your bumper library.
                    </p>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <FeatureCard
                        icon={Play}
                        title="Front Bumper"
                        description="Plays at the very beginning of the exported clip, before your content starts."
                        colorClass="bg-indigo-100 dark:bg-indigo-900/30"
                        iconClass="text-indigo-600 dark:text-indigo-400"
                      />
                      <FeatureCard
                        icon={Play}
                        title="Rear Bumper"
                        description="Plays at the very end of the exported clip, after your content finishes."
                        colorClass="bg-purple-100 dark:bg-purple-900/30"
                        iconClass="text-purple-600 dark:text-purple-400"
                      />
                    </div>
                    <TipBox>
                      Bumpers are only available for Clips — not Shorts. Short-form social content typically doesn't use intro/outro bumpers since they hurt retention on platforms like TikTok and Reels.
                    </TipBox>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* ===========================
                11. BRAND STRIP
            =========================== */}
            <section id="brand-strip" className="scroll-mt-24">
              <SectionHeader
                icon={Type}
                title="Brand Strip"
                description="A brand strip is a colored bar along the top or bottom of your video that displays your channel name, website, or a call to action — burned permanently into the exported video."
                badgeLabel="Brand Strip"
                badgeClass="bg-rose-500/10 text-rose-600 dark:text-rose-400"
                iconClass="text-rose-600 dark:text-rose-400"
              />

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5 text-rose-600" />
                      Setting Your Project Default
                    </CardTitle>
                    <CardDescription>Configure brand strip settings that apply to every clip and short in this project</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                      Go to <strong>Settings → Brand Strip</strong>. Toggle the <strong>Enable</strong> switch on to see a live preview appear below the controls.
                    </p>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <FeatureCard
                        icon={Layers}
                        title="Position"
                        description="Top or Bottom — where the bar appears on the video frame."
                        colorClass="bg-rose-100 dark:bg-rose-900/30"
                        iconClass="text-rose-600 dark:text-rose-400"
                      />
                      <FeatureCard
                        icon={Palette}
                        title="Preset Colors"
                        description="Choose from Dark Classic, Light Clean, Brand Pink, Brand Blue, Brand Green, or set a fully Custom color."
                        colorClass="bg-pink-100 dark:bg-pink-900/30"
                        iconClass="text-pink-600 dark:text-pink-400"
                      />
                      <FeatureCard
                        icon={Type}
                        title="Brand Text"
                        description="Your channel name, website URL, or a short call to action. Keep it under 40 characters for best readability."
                        colorClass="bg-slate-100 dark:bg-slate-900/30"
                        iconClass="text-slate-600 dark:text-slate-400"
                      />
                      <FeatureCard
                        icon={Palette}
                        title="Custom Colors"
                        description="Use the color pickers and hex input fields to set a precise background color and text color that matches your brand."
                        colorClass="bg-amber-100 dark:bg-amber-900/30"
                        iconClass="text-amber-600 dark:text-amber-400"
                      />
                    </div>
                    <TipBox>
                      Any individual clip or short card can override the project-level brand strip setting. Look for the <strong>Branding</strong> button on each candidate card in the Clips or Shorts tab.
                    </TipBox>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* ===========================
                12. WATERMARK
            =========================== */}
            <section id="watermark" className="scroll-mt-24">
              <SectionHeader
                icon={Image}
                title="Watermark"
                description="A watermark is your logo (or any image) overlaid in a corner of the video. It's a subtle but effective way to brand every piece of content you publish."
                badgeLabel="Watermark"
                badgeClass="bg-amber-500/10 text-amber-600 dark:text-amber-400"
                iconClass="text-amber-600 dark:text-amber-400"
              />

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Upload className="h-5 w-5 text-amber-600" />
                      Uploading and Configuring Your Watermark
                    </CardTitle>
                    <CardDescription>Go to Settings → Watermark</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Step
                      number={1}
                      title="Upload your watermark image"
                      description="Click the upload area and choose your file. Accepted formats: PNG (recommended for transparent backgrounds), JPG, JPEG, or WebP. Keep it under a few hundred KB for best results."
                    />
                    <Step
                      number={2}
                      title="Toggle Enable on"
                      description="The watermark won't be applied until you turn it on. This means you can have an image uploaded but keep it off for certain projects."
                    />
                    <Step
                      number={3}
                      title="Choose the position"
                      description="Use the 2×3 grid of position options: top-left, top-center, top-right, bottom-left, bottom-center, or bottom-right. Most podcasters use bottom-right."
                    />
                    <Step
                      number={4}
                      title="Set size and opacity"
                      description="Size controls how big the watermark appears: Small (8%), Medium (14%), or Large (20%) of the frame width. Opacity ranges from 10% (very faint) to 100% (fully visible). A setting of 50–70% opacity usually looks clean without being distracting."
                      isLast
                    />
                  </CardContent>
                </Card>

                <TipBox>
                  PNG files with a transparent background look best — the transparency is preserved and the logo sits cleanly on top of your video without a visible box around it.
                </TipBox>
              </div>
            </section>

            {/* ===========================
                13. CAPTIONS
            =========================== */}
            <section id="captions" className="scroll-mt-24">
              <SectionHeader
                icon={Mic}
                title="Captions"
                description="ClipEngine generates animated word-level captions — each word highlights as it's spoken. This dramatically increases viewer retention, especially on social media where videos autoplay silently."
                badgeLabel="Captions"
                badgeClass="bg-lime-500/10 text-lime-600 dark:text-lime-400"
                iconClass="text-lime-600 dark:text-lime-400"
              />

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Palette className="h-5 w-5 text-lime-600" />
                      Caption Presets
                    </CardTitle>
                    <CardDescription>Four distinct styles — pick the one that matches your brand</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                      Go to <strong>Settings → Captions</strong> and toggle <strong>Enable</strong> on. Then choose a preset:
                    </p>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <FeatureCard
                        icon={Zap}
                        title="Bold Impact"
                        description="All caps, bold text with an outline, animated active word. High energy — the 'Alex Hormozi' style. Great for motivational content or business advice."
                        colorClass="bg-orange-100 dark:bg-orange-900/30"
                        iconClass="text-orange-600 dark:text-orange-400"
                      />
                      <FeatureCard
                        icon={Type}
                        title="Clean Modern"
                        description="Sentence case, background bar behind the text, no animation. Professional and easy to read. Works for any topic."
                        colorClass="bg-blue-100 dark:bg-blue-900/30"
                        iconClass="text-blue-600 dark:text-blue-400"
                      />
                      <FeatureCard
                        icon={Star}
                        title="Pop Color"
                        description="Mixed case, bold text, highlighted keywords with an animated active word. Vibrant and social-native — the 'GaryVee' style."
                        colorClass="bg-pink-100 dark:bg-pink-900/30"
                        iconClass="text-pink-600 dark:text-pink-400"
                      />
                      <FeatureCard
                        icon={CheckCircle2}
                        title="Minimal"
                        description="Sentence case, no animation, no effects. Clean and unobtrusive. Good for interview-style content where the words should do the talking."
                        colorClass="bg-slate-100 dark:bg-slate-900/30"
                        iconClass="text-slate-600 dark:text-slate-400"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sliders className="h-5 w-5 text-lime-600" />
                      Caption Settings
                    </CardTitle>
                    <CardDescription>Fine-tune position, size, font, and colors</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Setting</th>
                            <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Options</th>
                            <th className="text-left py-2 font-medium text-muted-foreground">When to use</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          <tr>
                            <td className="py-2 pr-4 font-medium">Position</td>
                            <td className="py-2 pr-4 text-muted-foreground">Auto, Top, Middle, Bottom</td>
                            <td className="py-2 text-muted-foreground">Auto works well. Use Top for shorts with a stacked layout so captions don't overlap the speaker tiles.</td>
                          </tr>
                          <tr>
                            <td className="py-2 pr-4 font-medium">Size</td>
                            <td className="py-2 pr-4 text-muted-foreground">Small, Medium, Large</td>
                            <td className="py-2 text-muted-foreground">Medium is good for most content. Large works well for shorts viewed on mobile.</td>
                          </tr>
                          <tr>
                            <td className="py-2 pr-4 font-medium">Font</td>
                            <td className="py-2 pr-4 text-muted-foreground">Inter, Montserrat, Oswald, Space Grotesk</td>
                            <td className="py-2 text-muted-foreground">Oswald is bold and impactful. Inter and Montserrat are clean and readable. Space Grotesk is modern.</td>
                          </tr>
                          <tr>
                            <td className="py-2 pr-4 font-medium">Active Word Color</td>
                            <td className="py-2 pr-4 text-muted-foreground">Color picker</td>
                            <td className="py-2 text-muted-foreground">The color of the word currently being spoken. Yellow and cyan are popular choices.</td>
                          </tr>
                          <tr>
                            <td className="py-2 pr-4 font-medium">Stress Word Color</td>
                            <td className="py-2 pr-4 text-muted-foreground">Color picker</td>
                            <td className="py-2 text-muted-foreground">Emphasized or keyword words get this color treatment. Matches your brand accent color well.</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* ===========================
                14. AUDIO PROCESSING
            =========================== */}
            <section id="audio" className="scroll-mt-24">
              <SectionHeader
                icon={Volume2}
                title="Audio Processing"
                description="ClipEngine can automatically clean up your audio during export — removing filler words, cutting dead air, and bleeping profanity — without any manual editing work."
                badgeLabel="Audio Processing"
                badgeClass="bg-sky-500/10 text-sky-600 dark:text-sky-400"
                iconClass="text-sky-600 dark:text-sky-400"
              />

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Volume2 className="h-5 w-5 text-sky-600" />
                      Audio Processing Options
                    </CardTitle>
                    <CardDescription>Go to Settings → Audio Processing to configure these</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid sm:grid-cols-1 gap-4">
                      <FeatureCard
                        icon={Volume}
                        title="Profanity Filter"
                        description="Automatically bleeps words from your configured list. Click the word list to add or remove any words you want filtered out. Useful when repurposing content for a professional or family-friendly audience."
                        colorClass="bg-red-100 dark:bg-red-900/30"
                        iconClass="text-red-600 dark:text-red-400"
                      />
                      <FeatureCard
                        icon={Clock}
                        title="Dead-Air Removal"
                        description="Cuts silences that are longer than your configured threshold (in seconds). This tightens up the pacing of your clip significantly — a 3-second or longer pause in a podcast rarely adds value to a short highlight clip."
                        colorClass="bg-slate-100 dark:bg-slate-900/30"
                        iconClass="text-slate-600 dark:text-slate-400"
                      />
                      <FeatureCard
                        icon={Mic}
                        title="Filler Word Removal"
                        description="Cuts 'um', 'uh', 'you know', 'like', and any other filler words from your custom list. This makes your speakers sound more polished and confident without any re-recording needed."
                        colorClass="bg-sky-100 dark:bg-sky-900/30"
                        iconClass="text-sky-600 dark:text-sky-400"
                      />
                    </div>
                    <TipBox>
                      Enable Dead-Air Removal for Shorts especially — viewers on TikTok and Reels are conditioned to fast-paced content and will scroll past any noticeable pauses. For long-form Clips, be more conservative to preserve the natural flow of conversation.
                    </TipBox>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* ===========================
                PROJECT SETTINGS
            =========================== */}
            <section id="project-settings" className="scroll-mt-24">
              <SectionHeader
                icon={Settings}
                title="Project Settings"
                description="The Settings tab for each project lets you customize captions, audio, branding, watermarks, speaker labels, and more. Sections are collapsed by default — click any header to expand it."
                badgeLabel="Project Settings"
                badgeClass="bg-slate-500/10 text-slate-600 dark:text-slate-400"
                iconClass="text-slate-600 dark:text-slate-400"
              />

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Layers className="h-5 w-5 text-slate-600" />
                      How the Settings Accordion Works
                    </CardTitle>
                    <CardDescription>All sections start collapsed so you only see what you need</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                      When you open <strong>Settings</strong> for a project, you'll see a list of section headers — Captions, Audio Processing, Brand Strip, Watermark, Extended Shorts, Speaker Labels, and so on. All of them start <em>collapsed</em> so the page isn't overwhelming.
                    </p>
                    <Step
                      number={1}
                      title="Click any section header to expand it"
                      description="The section opens up and shows all its controls. Click the header again to collapse it. Only one or two sections need to be open at a time — the rest stay out of your way."
                    />
                    <Step
                      number={2}
                      title="Make your changes inside the expanded section"
                      description="Each section has its own save button. Changes in one section don't affect the others."
                    />
                    <Step
                      number={3}
                      title="Look for the 'Save as default for new projects' button"
                      description="At the bottom of each settings section, you'll see a button labeled 'Save as default for new projects'. Click this to save the current settings as the global starting point for every future project you create."
                      tip="This is a huge time-saver. Set up your captions, branding, and audio the way you like them once, then click 'Save as default for new projects' in each section — and every new project you create will start with those settings pre-filled."
                      isLast
                    />
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* ===========================
                GLOBAL DEFAULTS
            =========================== */}
            <section id="global-defaults" className="scroll-mt-24">
              <SectionHeader
                icon={Star}
                title="Global Defaults"
                description="Global defaults are the settings that get pre-filled automatically for every new project you create. Set them once and stop repeating yourself."
                badgeLabel="Global Defaults"
                badgeClass="bg-primary/10 text-primary border border-primary/20"
                iconClass="text-primary"
              />

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Star className="h-5 w-5 text-primary" />
                      Why Global Defaults Matter
                    </CardTitle>
                    <CardDescription>Stop re-entering the same settings on every project</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                      If you process a new podcast episode every week, you probably want the same captions, the same brand strip, the same watermark, and the same audio settings every time. Without global defaults, you'd have to configure all of this from scratch on every new project.
                    </p>
                    <p className="text-muted-foreground">
                      Global defaults solve this. Once you configure your ideal settings on any project, click <strong>"Save as default for new projects"</strong> in each settings section. From that point on, every new project starts with those values pre-filled — you only need to change something if it's different for a specific episode.
                    </p>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <FeatureCard
                        icon={Mic}
                        title="Default Captions"
                        description="Your preferred preset, font, size, position, and colors — ready on every new project."
                        colorClass="bg-lime-100 dark:bg-lime-900/30"
                        iconClass="text-lime-600 dark:text-lime-400"
                      />
                      <FeatureCard
                        icon={Type}
                        title="Default Brand Strip"
                        description="Your channel name and brand colors — baked into every project from the start."
                        colorClass="bg-rose-100 dark:bg-rose-900/30"
                        iconClass="text-rose-600 dark:text-rose-400"
                      />
                      <FeatureCard
                        icon={Image}
                        title="Default Watermark"
                        description="Your logo, position, size, and opacity — no re-uploading or repositioning for each project."
                        colorClass="bg-amber-100 dark:bg-amber-900/30"
                        iconClass="text-amber-600 dark:text-amber-400"
                      />
                      <FeatureCard
                        icon={Volume2}
                        title="Default Audio Processing"
                        description="Your preferred filler word list, dead-air threshold, and profanity filter settings carry over automatically."
                        colorClass="bg-sky-100 dark:bg-sky-900/30"
                        iconClass="text-sky-600 dark:text-sky-400"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5 text-primary" />
                      How to Set Your Global Defaults
                    </CardTitle>
                    <CardDescription>Two ways to access this — from Project Settings or App Settings</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Step
                      number={1}
                      title="Open any project and go to its Settings tab"
                      description="Choose a project that already has settings configured the way you like them — or set up one project perfectly first."
                    />
                    <Step
                      number={2}
                      title="Click a section header to expand it (e.g., Captions)"
                      description="Remember, all sections are collapsed by default — click the header for the section you want to save."
                    />
                    <Step
                      number={3}
                      title="Click 'Save as default for new projects' at the bottom of that section"
                      description="You'll see a confirmation that the defaults have been saved. Repeat this for each section you want to save: Captions, Brand Strip, Watermark, Audio Processing."
                    />
                    <Step
                      number={4}
                      title="You can also manage global defaults from App Settings"
                      description="Click the gear icon (⚙) in the top-right corner and look for Global Defaults. You can review and update your defaults from here without needing to open a specific project."
                      isLast
                    />
                    <TipBox>
                      Global defaults only apply to <em>new</em> projects created after you save them. Existing projects keep their current settings — they won't be changed.
                    </TipBox>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* ===========================
                15. RENDER & EXPORT
            =========================== */}
            <section id="render" className="scroll-mt-24">
              <SectionHeader
                icon={Download}
                title="Render & Export"
                description="The Render tab is the final step — this is where ClipEngine assembles everything and produces your finished video files."
                badgeLabel="Render & Export"
                badgeClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                iconClass="text-emerald-600 dark:text-emerald-400"
              />

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Play className="h-5 w-5 text-emerald-600" />
                      How to Render Your Clips
                    </CardTitle>
                    <CardDescription>Turn approved candidates into finished video files</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Step
                      number={1}
                      title="Navigate to the Render tab"
                      description="Click Render in the project navigation. You'll see all your approved candidates listed here — both Clips and Shorts."
                    />
                    <Step
                      number={2}
                      title="Choose your export quality"
                      description="Each item has a quality selector: 720p, 1080p, or 4K. Use 1080p for most social media publishing. 4K is good if you're publishing to YouTube and want maximum quality. 720p is faster to render if you're in a hurry."
                    />
                    <Step
                      number={3}
                      title="Click 'Render'"
                      description="The status changes from 'queued' to 'rendering'. You can see progress in real time. Rendering is done locally on your Mac using ffmpeg — no files leave your computer."
                    />
                    <Step
                      number={4}
                      title="Find your finished files"
                      description="When the status changes to 'done', your file is ready. Rendered files are saved to: ~/ClipEngine/projects/{projectId}/output/ — find them in Finder and upload them wherever you publish."
                      isLast
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Layers className="h-5 w-5 text-emerald-600" />
                      What Gets Burned into the Final File
                    </CardTitle>
                    <CardDescription>Everything you configured is baked in automatically</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                      You don't need to apply effects manually — ClipEngine assembles everything during render based on your settings:
                    </p>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <FeatureCard
                        icon={Mic}
                        title="Animated Captions"
                        description="Word-level animated subtitles using your chosen preset, font, colors, size, and position."
                        colorClass="bg-lime-100 dark:bg-lime-900/30"
                        iconClass="text-lime-600 dark:text-lime-400"
                      />
                      <FeatureCard
                        icon={Type}
                        title="Brand Strip"
                        description="Your channel name bar, using either the project default or the per-candidate override you set."
                        colorClass="bg-rose-100 dark:bg-rose-900/30"
                        iconClass="text-rose-600 dark:text-rose-400"
                      />
                      <FeatureCard
                        icon={Image}
                        title="Watermark"
                        description="Your logo overlay, using either the project default or the per-candidate override you set."
                        colorClass="bg-amber-100 dark:bg-amber-900/30"
                        iconClass="text-amber-600 dark:text-amber-400"
                      />
                      <FeatureCard
                        icon={Play}
                        title="Bumpers (Clips only)"
                        description="Front and rear bumper videos are stitched to the beginning and end of clips that have them assigned."
                        colorClass="bg-indigo-100 dark:bg-indigo-900/30"
                        iconClass="text-indigo-600 dark:text-indigo-400"
                      />
                      <FeatureCard
                        icon={Volume2}
                        title="Audio Processing"
                        description="Profanity bleeps, dead-air cuts, and filler word cuts are applied in the audio stream."
                        colorClass="bg-sky-100 dark:bg-sky-900/30"
                        iconClass="text-sky-600 dark:text-sky-400"
                      />
                      <FeatureCard
                        icon={FlipVertical}
                        title="Smart Framing (Shorts)"
                        description="Shorts are rendered at 9:16 vertical resolution with automatic face-based cropping: face-centered zoom for single speakers, stacked two-tile layout for two-speaker conversations, or active-speaker mode that zooms on whoever is talking."
                        colorClass="bg-pink-100 dark:bg-pink-900/30"
                        iconClass="text-pink-600 dark:text-pink-400"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* ===========================
                YOUTUBE TITLES & THUMBNAILS
            =========================== */}
            <section id="youtube-titles" className="scroll-mt-24">
              <SectionHeader
                icon={Sparkles}
                title="YouTube Titles & Thumbnail Concepts"
                description="After a clip or short finishes rendering, ClipEngine automatically generates ready-to-use YouTube titles and thumbnail guidance — so you can go straight from render to publish."
                badgeLabel="YouTube Titles & Thumbnails"
                badgeClass="bg-red-500/10 text-red-600 dark:text-red-400"
                iconClass="text-red-600 dark:text-red-400"
              />

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-red-600" />
                      What Gets Generated Automatically After Render
                    </CardTitle>
                    <CardDescription>No extra steps — ClipEngine generates publishing assets the moment your render finishes</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                      As soon as a clip or short finishes rendering, Gemini generates a set of publishing assets tailored to that specific piece of content. You don't need to click anything — it happens automatically in the background.
                    </p>
                    <div className="grid sm:grid-cols-1 gap-4">
                      <FeatureCard
                        icon={Edit3}
                        title="For Clips: 5 Ranked YouTube Titles"
                        description="Each title comes with a virality/CTR score, an emotional analysis (e.g. 'curiosity + fear'), and a one-sentence rationale explaining exactly why someone would click on it. Titles are ranked from highest to lowest predicted click-through rate."
                        colorClass="bg-red-100 dark:bg-red-900/30"
                        iconClass="text-red-600 dark:text-red-400"
                      />
                      <FeatureCard
                        icon={Image}
                        title="For Clips: Thumbnail Layout & AI Prompt"
                        description="A detailed description of your thumbnail's recommended layout — subject placement, facial expression, text overlay, background colors, and visual style. Plus a ready-to-paste prompt for AI image generators like Midjourney or Imager.gg."
                        colorClass="bg-orange-100 dark:bg-orange-900/30"
                        iconClass="text-orange-600 dark:text-orange-400"
                      />
                      <FeatureCard
                        icon={Film}
                        title="For Shorts: 5 Ranked YouTube Titles"
                        description="Same ranked title format as clips, but optimized for YouTube Shorts — titles are kept under 40 characters, punchy, and designed for mobile browsing where only a few words show before being cut off."
                        colorClass="bg-pink-100 dark:bg-pink-900/30"
                        iconClass="text-pink-600 dark:text-pink-400"
                      />
                      <FeatureCard
                        icon={Zap}
                        title="For Shorts: Caption Hook"
                        description="The first 5–8 words to show on screen before the viewer unmutes — the Shorts equivalent of a thumbnail. This is what needs to stop the scroll, so it's written to create immediate curiosity or promise a specific payoff."
                        colorClass="bg-purple-100 dark:bg-purple-900/30"
                        iconClass="text-purple-600 dark:text-purple-400"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="h-5 w-5 text-red-600" />
                      How to View Your YouTube Suggestions
                    </CardTitle>
                    <CardDescription>Find them right on the candidate card after render completes</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Step
                      number={1}
                      title="Render a clip or short"
                      description="Go to the Render tab, find an approved candidate, and click Render. Wait for the status to change to 'done'."
                    />
                    <Step
                      number={2}
                      title="Go back to the Clips or Shorts tab"
                      description="Navigate back to the Clips or Shorts tab and find the card for the clip you just rendered."
                    />
                    <Step
                      number={3}
                      title="Look for the YouTube panel on the card"
                      description="After render, a YouTube panel appears at the bottom of the candidate card. You'll see your titles ranked by predicted CTR, plus the thumbnail concept or caption hook depending on the type."
                    />
                    <Step
                      number={4}
                      title="Copy your favorite title and thumbnail prompt"
                      description="Pick the title that feels most like your voice, or mix and match — these are suggestions, not requirements. Copy the thumbnail prompt and paste it into Imager.gg, Midjourney, or your preferred AI image tool."
                      tip="If you don't love the first batch of titles, click Regenerate to ask Gemini for a fresh set. It uses the same clip content but approaches the angle differently."
                      isLast
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Image className="h-5 w-5 text-orange-600" />
                      Creating Your Thumbnail
                    </CardTitle>
                    <CardDescription>Use the AI thumbnail prompt with any image generator</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                      For clip thumbnails, ClipEngine gives you two pieces: a <strong>layout description</strong> and a <strong>ready-to-paste AI prompt</strong>.
                    </p>
                    <p className="text-muted-foreground">
                      The <strong>layout description</strong> tells you where to position the speaker in the frame, what facial expression works best, what text to overlay, and what background colors and style to use. You can use this as a brief for a designer or as a reference when creating it yourself in Canva.
                    </p>
                    <p className="text-muted-foreground">
                      The <strong>AI prompt</strong> is formatted to work directly in image generators. Just copy and paste it in — the prompt already includes the subject positioning, expression direction, text overlay suggestions, background style, and color guidance.
                    </p>
                    <TipBox>
                      <strong>Imager.gg</strong> is a good free starting point for YouTube-style thumbnails. Simply paste the prompt into the generator and it handles the rest. For more control over the final look, try Midjourney or Adobe Firefly.
                    </TipBox>
                  </CardContent>
                </Card>

                <TipBox title="Titles Not Appearing After Render?">
                  YouTube title suggestions generate automatically after each render — but if they're missing, open the candidate card and click <strong>Regenerate</strong>. This triggers generation on demand. If it still doesn't work, check that your Gemini API key is valid in App Settings → API Keys.
                </TipBox>
              </div>
            </section>

            {/* ===========================
                16. FAQ
            =========================== */}
            <section id="faq" className="scroll-mt-24">
              <SectionHeader
                icon={HelpCircle}
                title="Frequently Asked Questions"
                description="Common questions and their answers. If something's not working, start here."
                badgeLabel="FAQ"
                badgeClass="bg-slate-500/10 text-slate-600 dark:text-slate-400"
                iconClass="text-slate-600 dark:text-slate-400"
              />

              <div className="space-y-4">
                {[
                  {
                    q: "The Speaker Detection step failed — what do I do?",
                    a: "The most common cause is that the Python sidecar isn't running. Open a terminal and start it: source python/venv/bin/activate && python python/sidecar.py. Then check it's healthy by visiting http://localhost:5001/health in your browser — you should see a simple 'OK' response.",
                  },
                  {
                    q: "Transcription seems to be stuck or took too long — what now?",
                    a: "Whisper needs a downloaded model to run. If you haven't done this yet, open a terminal and run: npx whisper-node download. This is a one-time setup step. After it completes, try the Transcribe step again.",
                  },
                  {
                    q: "The AI Analysis found zero candidates — is something wrong?",
                    a: "Open App Settings → API Keys from the top-right dropdown and verify your Google Gemini key is entered and tests successfully. The Test button hits Google's API to confirm the key is valid. You can get a free key at aistudio.google.com/app/apikey.",
                  },
                  {
                    q: "The 'Find More' dialog showed an error — what happened?",
                    a: "The Find More process has a 5-minute timeout. If your video is very long and Gemini's response is slow, the request may have timed out. Simply try clicking Find More again. If errors persist, check the terminal window where you ran npm run dev for detailed error messages.",
                  },
                  {
                    q: "My video upload failed — is there a file size limit?",
                    a: "ClipEngine supports uploads up to 10GB. If you're hitting the limit, check that next.config.ts has bodySizeLimit: '10gb' in its serverActions configuration. For most podcast recordings this won't be an issue.",
                  },
                  {
                    q: "My shorts aren't getting face tracking — they look like a plain center crop. Why?",
                    a: "Smart Framing requires the Python sidecar to have been running during the Speaker Detection step (Step 3). Face data is collected at that point — if the sidecar wasn't running, no face data is available and ClipEngine can't crop to a face. Re-run Step 3 with the sidecar running to collect face data, then re-run Step 4 (AI Analysis) to generate new shorts with Smart Framing applied. For the best results with a YOLOv8 face model, place the yolov8n-face.pt file at ~/.clipengine-models/yolov8n-face.pt before running Step 3.",
                  },
                  {
                    q: "The app won't load — I get a Turbopack cache error",
                    a: "Run this in your terminal: rm -rf .next && npm run dev. This clears the Turbopack build cache and restarts fresh. You'll see a slightly longer startup time the first time.",
                  },
                  {
                    q: "Port 3000 is already in use — how do I fix it?",
                    a: "Something else is using port 3000. Run this to free it: lsof -ti:3000 | xargs kill -9 — then try npm run dev again.",
                  },
                  {
                    q: "My watermark upload failed",
                    a: "Only PNG, JPG, JPEG, and WebP files are accepted for watermarks. Make sure your file is one of those formats. Also check the browser's developer console (right-click → Inspect → Console) for a more specific error message.",
                  },
                  {
                    q: "How do I change the light/dark mode or color theme?",
                    a: "Click the gear icon (⚙) in the top right of the Dashboard. You'll see Mode options (Light / Dark) and Theme options (Warm / Cool). Your preference is saved automatically and will be remembered the next time you open ClipEngine.",
                  },
                  {
                    q: "I don't see any Extended Shorts — did something go wrong?",
                    a: "Extended Shorts are opt-in. Go to Settings → Extended Shorts for the project and make sure 'Find extended shorts' is toggled ON. This setting must be enabled BEFORE you run Step 4 — AI Analysis. If it was off when you ran the analysis, you'll need to re-run Step 4 to generate extended shorts.",
                  },
                  {
                    q: "How do I save my branding and caption settings so I don't have to set them up on every project?",
                    a: "Open any project's Settings tab and configure your settings the way you want them. Then, in each section (Captions, Brand Strip, Watermark, Audio Processing), click the 'Save as default for new projects' button at the bottom of that section. Every new project you create after that will start with those settings pre-filled.",
                  },
                  {
                    q: "My project got named something weird — can I rename it?",
                    a: "Yes! When you pick a video file, ClipEngine automatically names the project after the video filename. If you'd prefer a different name, use the ⋯ menu → Rename from the dashboard, or click the project name directly on the Overview page and type a new name.",
                  },
                  {
                    q: "YouTube titles didn't appear after my render finished — what do I do?",
                    a: "Titles generate automatically after render, but if they're missing, open the candidate card in the Clips or Shorts tab and click Regenerate. This triggers generation on demand. Make sure your Gemini API key is valid by going to App Settings → API Keys and clicking Test.",
                  },
                  {
                    q: "What do the letter grades and recommendation tiers mean on each card?",
                    a: "The letter grade (A+ to D) is ClipEngine's quick quality rating for each candidate. The recommendation tier is a plain-English label: 'Must Use' (A+/A) means publish this one, 'Highly Recommended' (A−/B+) means it's a strong pick, 'Recommended' (B/B−) means solid content, 'Worth Considering' (C+/C) means take a careful look, and 'User Choice' (C−/D) means the AI leaves it up to you.",
                  },
                ].map((item, i) => (
                  <Card key={i}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-start gap-3">
                        <HelpCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        {item.q}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{item.a}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            {/* Footer */}
            <div className="border-t pt-8 pb-4 text-center text-sm text-muted-foreground">
              <p>ClipEngine User Guide · April 2026</p>
              <p className="mt-1">Running locally at <code className="text-xs bg-muted px-1.5 py-0.5 rounded">localhost:3000</code></p>
            </div>

          </main>
        </div>
      </div>
    </div>
  )
}
