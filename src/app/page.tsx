"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  getProjects, createUntitledProject, renameProject,
  cloneProject, archiveProject, unarchiveProject, deleteProject,
} from "@/actions/project-actions"
import { SettingsDropdown } from "@/components/layout/settings-dropdown"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
  DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  Plus, Search, MoreHorizontal, Pencil, Copy, Archive,
  ArchiveRestore, Trash2, Film, BookOpen, AlertTriangle,
  KeyRound, Terminal, Download, Upload, Mic, Sparkles,
  Users, HardDrive, ArrowRight,
} from "lucide-react"
import { fetchApiKeyStatus } from "@/actions/api-keys-actions"
import { fetchSystemStatus } from "@/actions/system-actions"
import type { ApiKeyStatus } from "@/lib/api-keys"
import type { SystemStatus } from "@/lib/system-check"

/* ── Types ── */

type Project = {
  id: string
  name: string
  sourceVideoPath: string
  status: string
  archived: boolean
  createdAt: Date
  updatedAt: Date
  _count: { candidates: number }
}

type SortOption = "newest" | "oldest" | "az" | "za"
type FilterOption = "all" | "active" | "archived"

/* ── Deterministic waveform heights (30-92%) ── */
const WAVE_BARS = [
  45, 68, 35, 82, 50, 72, 38, 88, 55, 65, 42, 78, 32, 90, 48, 75,
  58, 30, 85, 52, 70, 40, 86, 46, 62, 36, 76, 54, 84, 44, 66, 38,
  80, 50, 72, 34, 88, 56, 64, 42, 78, 48, 70, 36, 92, 52, 60, 44,
]

/* ── Pipeline steps ── */
const PIPELINE_STEPS = [
  { icon: Upload, title: "Drop", desc: "Drag in your episode — any format, up to 10 GB" },
  { icon: Mic, title: "Transcribe", desc: "Accurate transcription with speaker labels — runs locally, nothing uploaded" },
  { icon: Sparkles, title: "Analyze", desc: "AI picks the best moments and tells you exactly why each one will perform" },
  { icon: Download, title: "Export", desc: "Rendered with captions, branding, and bumpers — publish-ready" },
]

/* ── Feature cards (empty-state pitch) ── */
const FEATURES = [
  {
    icon: Sparkles,
    title: "Approve With Confidence, Not Guesswork",
    desc: "Every clip gets a virality score and a written breakdown — hook strength, emotional peaks, quotability. You'll know exactly why each one will perform before you hit export.",
  },
  {
    icon: Users,
    title: "Two Speakers. Two Frames. Zero Work.",
    desc: "Each speaker gets their own perfectly cropped frame — top and bottom, stacked automatically. No templates. No manual cropping. Just drop and render.",
  },
  {
    icon: HardDrive,
    title: "Your Machine. Your Content.",
    desc: "Everything runs locally — transcription, rendering, the whole pipeline. Your video never leaves your hard drive. No upload queue. No per-minute charges. No monthly fee.",
  },
]

/* ══════════════════════════════════════════════════════════════════ */

export default function DashboardPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus | null>(null)
  const [sysStatus, setSysStatus] = useState<SystemStatus | null>(null)
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<SortOption>("newest")
  const [filter, setFilter] = useState<FilterOption>("active")
  const [isPending, startTransition] = useTransition()

  // Rename state
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameName, setRenameName] = useState("")

  // Delete confirmation state
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteProjectName, setDeleteProjectName] = useState("")

  /* ── Data loading ── */

  async function loadProjects() {
    setLoading(true)
    const data = await getProjects(true)
    setProjects(data as Project[])
    setLoading(false)
  }

  useEffect(() => {
    loadProjects()
    fetchApiKeyStatus().then(setApiKeyStatus)
    fetchSystemStatus().then(setSysStatus)
  }, [])

  /* ── Setup readiness ── */

  const keysReady = apiKeyStatus?.allConfigured ?? false
  const systemReady = sysStatus?.allReady ?? false
  const allReady = keysReady && systemReady

  const missingItems: Array<{ label: string; icon: React.ReactNode }> = []
  if (apiKeyStatus && !apiKeyStatus.geminiConfigured)
    missingItems.push({ label: "Gemini API key", icon: <KeyRound className="h-3.5 w-3.5" /> })
  if (apiKeyStatus && !apiKeyStatus.hfConfigured)
    missingItems.push({ label: "HuggingFace token", icon: <KeyRound className="h-3.5 w-3.5" /> })
  if (sysStatus && !sysStatus.python.ok)
    missingItems.push({ label: "Python 3", icon: <Terminal className="h-3.5 w-3.5" /> })
  if (sysStatus && !sysStatus.venv.ok)
    missingItems.push({ label: "Python components", icon: <Download className="h-3.5 w-3.5" /> })
  if (sysStatus && !sysStatus.whisperModel.ok)
    missingItems.push({ label: "Whisper model", icon: <Download className="h-3.5 w-3.5" /> })

  /* ── Handlers ── */

  async function handleNewProject() {
    if (!allReady) {
      router.push("/settings")
      return
    }
    startTransition(async () => {
      const project = await createUntitledProject()
      router.push(`/project/${project.id}`)
    })
  }

  async function handleRename(id: string, name: string) {
    await renameProject(id, name)
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)))
    setRenameId(null)
  }

  async function handleClone(id: string) {
    const clone = await cloneProject(id)
    setProjects((prev) => [clone as unknown as Project, ...prev])
  }

  async function handleArchive(id: string) {
    await archiveProject(id)
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, archived: true } : p)))
  }

  async function handleUnarchive(id: string) {
    await unarchiveProject(id)
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, archived: false } : p)))
  }

  async function handleDelete(id: string) {
    await deleteProject(id)
    setProjects((prev) => prev.filter((p) => p.id !== id))
    setDeleteId(null)
  }

  /* ── Filter & sort ── */

  const filtered = projects
    .filter((p) => {
      if (filter === "active") return !p.archived
      if (filter === "archived") return p.archived
      return true
    })
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      if (sort === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      if (sort === "az") return a.name.localeCompare(b.name)
      if (sort === "za") return b.name.localeCompare(a.name)
      return 0
    })

  const hasProjects = projects.length > 0
  const showFeatures = !loading && !hasProjects

  /* ════════════════════════════════════════════════════════════════ */

  return (
    <div className="min-h-screen relative overflow-hidden">

      {/* ── Ambient background orbs ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/4 w-[600px] h-[600px] rounded-full bg-primary/[0.04] dark:bg-primary/[0.08] blur-[120px]" />
        <div className="absolute -bottom-20 right-1/4 w-[400px] h-[400px] rounded-full bg-chart-1/[0.03] dark:bg-chart-1/[0.06] blur-[100px]" />
      </div>

      <div className="relative z-10">

        {/* ── Navigation ── */}
        <nav className="container mx-auto max-w-5xl px-4 flex items-center justify-between pt-6 pb-2">
          <div className="flex items-center gap-2.5">
            <svg viewBox="0 0 32 32" className="w-8 h-8 shrink-0">
              <rect width="32" height="32" rx="7" fill="var(--color-primary)" />
              <path d="M8 8h16v3H8z" fill="#fff" opacity="0.9" />
              <rect x="9" y="8" width="2" height="3" rx="0.3" fill="var(--color-primary)" transform="rotate(-20 10 9.5)" />
              <rect x="14" y="8" width="2" height="3" rx="0.3" fill="var(--color-primary)" transform="rotate(-20 15 9.5)" />
              <rect x="19" y="8" width="2" height="3" rx="0.3" fill="var(--color-primary)" transform="rotate(-20 20 9.5)" />
              <rect x="8" y="12" width="16" height="13" rx="1.5" fill="#fff" opacity="0.9" />
              <polygon points="14,15 14,22 21,18.5" fill="var(--color-primary)" />
            </svg>
            <span className="font-semibold text-lg tracking-tight text-foreground">ClipEngine</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/guide">
                <BookOpen className="size-4 mr-1.5" />
                Guide
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/bumpers">
                <Film className="size-4 mr-1.5" />
                Bumpers
              </Link>
            </Button>
            <SettingsDropdown />
          </div>
        </nav>

        <div className="container mx-auto max-w-5xl px-4">

          {/* ── Setup Banner ── */}
          {missingItems.length > 0 && (
            <div className="mt-4 mb-2 rounded-xl border border-primary/20 bg-primary/[0.04] dark:bg-primary/[0.06] p-4 animate-fade-in">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <AlertTriangle className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm text-foreground">
                    Setup required — {missingItems.length} item{missingItems.length > 1 ? "s" : ""} to configure
                  </h3>
                  <ul className="mt-1.5 space-y-0.5">
                    {missingItems.map((item) => (
                      <li key={item.label} className="flex items-center gap-2 text-xs text-muted-foreground">
                        {item.icon}
                        {item.label}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2.5">
                    <Button size="sm" variant="outline" asChild>
                      <Link href="/settings">
                        Open settings
                        <ArrowRight className="ml-1.5 size-3" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Hero Section ── */}
          <section className="relative pt-14 pb-12 text-center">

            {/* Waveform backdrop */}
            <div
              className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center gap-[3px] h-24 opacity-[0.08] dark:opacity-[0.14] pointer-events-none select-none"
              aria-hidden="true"
            >
              {WAVE_BARS.map((h, i) => (
                <div
                  key={i}
                  className="w-[3px] rounded-full bg-primary origin-center"
                  style={{
                    height: `${h}%`,
                    animation: `waveform-pulse ${1.6 + (i % 5) * 0.3}s ease-in-out ${i * 0.055}s infinite`,
                  }}
                />
              ))}
            </div>

            {/* Hero text */}
            <div className="relative">
              <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tighter hero-gradient-text animate-fade-in-up">
                One Episode In.
                <br />
                Dozens of Clips Out.
              </h1>
              <p
                className="mt-4 text-lg sm:text-xl text-foreground/70 max-w-md mx-auto animate-fade-in-up"
                style={{ animationDelay: "0.1s" }}
              >
                What used to take 4 hours now takes 4 minutes.
              </p>

              {/* Extended pitch — only when no projects exist */}
              {showFeatures && (
                <p
                  className="mt-3 text-sm text-muted-foreground max-w-lg mx-auto animate-fade-in-up"
                  style={{ animationDelay: "0.2s" }}
                >
                  You recorded a great episode. Now you're staring down hours of scrubbing timelines,
                  cropping faces, and adding captions by hand. Drop it here instead — ClipEngine finds every
                  clip-worthy moment, scores it for virality, and renders them publish-ready with captions,
                  speaker framing, and your branding.
                </p>
              )}
            </div>

            {/* CTA button */}
            <div className="mt-8 animate-fade-in-up" style={{ animationDelay: "0.25s" }}>
              <Button
                onClick={handleNewProject}
                disabled={isPending || !allReady}
                title={!allReady ? "Complete setup first" : undefined}
                size="lg"
                className="relative group text-base px-8 h-12 shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <span className="absolute inset-0 rounded-lg bg-primary/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <Plus className="size-5 mr-2" />
                {hasProjects ? "New Project" : "Drop Your First Episode"}
              </Button>
            </div>
          </section>

          {/* ── Pipeline Steps ── */}
          <section className="relative pb-10 animate-fade-in-up" style={{ animationDelay: "0.35s" }}>
            {/* Connecting line (desktop only) */}
            <div className="absolute top-5 left-[15%] right-[15%] h-px bg-border hidden sm:block" />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-0">
              {PIPELINE_STEPS.map((step, i) => (
                <div key={i} className="relative flex flex-col items-center text-center px-2">
                  <div className="relative z-10 w-10 h-10 rounded-full bg-background border-2 border-primary/20 flex items-center justify-center text-primary mb-3 shadow-sm">
                    <step.icon className="size-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[160px]">{step.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Feature Cards — visible only when no projects ── */}
          {showFeatures && (
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-12">
              {FEATURES.map((feat, i) => (
                <div
                  key={i}
                  className="rounded-xl border bg-card/60 backdrop-blur-sm p-6 transition-all duration-200 hover:border-primary/20 hover:shadow-md animate-fade-in-up"
                  style={{ animationDelay: `${0.4 + i * 0.08}s` }}
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4">
                    <feat.icon className="size-4" />
                  </div>
                  <h3 className="font-semibold text-sm text-foreground">{feat.title}</h3>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{feat.desc}</p>
                </div>
              ))}
            </section>
          )}

          {/* ── Project List ── */}
          {(hasProjects || loading) && (
            <section className="pb-12">

              {/* Search / Sort / Filter bar */}
              <div className="flex flex-col sm:flex-row gap-3 mb-5">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Search projects..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortOption)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="az">A &rarr; Z</option>
                  <option value="za">Z &rarr; A</option>
                </select>
                <div className="flex rounded-md border border-input overflow-hidden h-9">
                  {(["all", "active", "archived"] as FilterOption[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={cn(
                        "px-3 text-sm capitalize transition-colors",
                        filter === f
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Project cards */}
              {loading ? (
                <div className="text-center py-16">
                  <div className="inline-flex items-center gap-2.5 text-sm text-muted-foreground">
                    <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    Loading projects...
                  </div>
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <p className="text-base">
                    {search ? "No projects match your search" : "No projects here"}
                  </p>
                  <p className="text-sm mt-1 text-muted-foreground/70">
                    {search ? "Try a different search term" : "Create a project to get started"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filtered.map((project, i) => (
                    <div
                      key={project.id}
                      className={cn(
                        "group relative flex items-center gap-4 rounded-xl border bg-card/80 backdrop-blur-sm p-4",
                        "transition-all duration-200 hover:shadow-md hover:border-primary/20 hover:-translate-y-0.5",
                        "cursor-pointer animate-fade-in-up",
                        project.archived && "opacity-50",
                      )}
                      style={{ animationDelay: `${i * 0.04}s` }}
                      onClick={() => router.push(`/project/${project.id}`)}
                    >
                      {/* Status accent bar */}
                      <div
                        className={cn(
                          "absolute left-0 top-4 bottom-4 w-0.5 rounded-full",
                          project.status === "ready"
                            ? "bg-emerald-500 dark:bg-emerald-400"
                            : "bg-primary/30",
                        )}
                      />

                      <div className="flex-1 min-w-0 pl-2">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={cn(
                              "font-medium truncate",
                              project.name === "Untitled Project" && "text-muted-foreground italic",
                            )}
                          >
                            {project.name}
                          </span>
                          {project.archived && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              Archived
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {project.sourceVideoPath
                              ? project.sourceVideoPath.split("/").pop()
                              : "No video"}
                          </span>
                          <span className="text-muted-foreground/30 text-xs">&middot;</span>
                          <span className="text-xs text-muted-foreground">
                            {project._count.candidates} clip
                            {project._count.candidates !== 1 ? "s" : ""}
                          </span>
                          <span className="text-muted-foreground/30 text-xs">&middot;</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(project.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {/* Context menu — visible on hover */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem
                            onClick={() => {
                              setRenameId(project.id)
                              setRenameName(project.name)
                            }}
                          >
                            <Pencil className="mr-2 size-4" /> Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleClone(project.id)}>
                            <Copy className="mr-2 size-4" /> Clone
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {project.archived ? (
                            <DropdownMenuItem onClick={() => handleUnarchive(project.id)}>
                              <ArchiveRestore className="mr-2 size-4" /> Unarchive
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleArchive(project.id)}>
                              <Archive className="mr-2 size-4" /> Archive
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => {
                              setDeleteId(project.id)
                              setDeleteProjectName(project.name)
                            }}
                          >
                            <Trash2 className="mr-2 size-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      {/* ── Rename Dialog ── */}
      <Dialog open={!!renameId} onOpenChange={(open) => !open && setRenameId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Project</DialogTitle>
          </DialogHeader>
          <Input
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && renameId) handleRename(renameId, renameName)
            }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameId(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => renameId && handleRename(renameId, renameName)}
              disabled={!renameName.trim()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ── */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deleteProjectName}&rdquo;? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
