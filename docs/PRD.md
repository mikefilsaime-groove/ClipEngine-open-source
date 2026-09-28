# ClipEngine — Product Requirements Document

**Product:** ClipEngine
**Owner:** Mike Filsaime
**Platform:** Local-only, Mac (M1 Max Mac Studio)
**Status:** In Development
**Last Updated:** April 2026

---

## Overview

ClipEngine is a local-first video clip extraction tool built for podcast producers, distributed as a native desktop Electron application. It ingests a full podcast episode and uses AI to identify the best moments for long-form clips (3-20 min landscape) and short-form content — Classic Shorts (≤60s) and Extended Shorts (1-3 min) — all in vertical 9:16. Everything runs on the local machine — no cloud video processing costs.

**Primary use case:** The Wicked Smart Podcast (weekly episode, ~60-90 min) → 3-5 clips + 5-10 shorts per episode.

---

## Goals

- Replace Opus Clip with a free, local alternative distributed as a desktop app
- Produce publication-ready clips with animated captions, branding, and speaker detection
- Support the open/close loop content philosophy (hook → value → CTA)
- Generate publishing assets (YouTube titles, thumbnail concepts) automatically after render

---

## User Personas

**Mike (primary user):** Podcast host. Wants a simple dashboard, minimal friction. Uploads one video per week, reviews AI suggestions, approves the best ones, and exports.

---

## Core Features

### 1. Project Dashboard

- Create, rename, clone, archive, delete projects
- Search by name, sort (newest/oldest/A-Z/Z-A), filter (all/active/archived)
- Project status badge reflecting pipeline stage

### 2. Video Pick

- Native OS file picker opened via `POST /api/video/pick` (macOS: AppleScript `choose file`; future: cross-platform dialog)
- Supported formats: `.mp4`, `.mov`, `.mkv`, `.avi`, `.webm`, `.m4v`
- File **referenced in-place** — not copied into the project folder
- Output folder created at `~/ClipEngine/projects/{projectId}/output/`
- Max file size: 10GB (large podcast recordings)
- **Auto-rename:** if the project name is still "Untitled Project", it is renamed to `path.parse(filePath).name`
- **Auto-probe:** ffprobe runs immediately after pick; duration stored in `Project.duration`

### 3. Processing Pipeline

Sequential steps, each triggerable via the Overview page:

| Step | Technology | Output |
|------|-----------|--------|
| Probe Video | ffprobe (fluent-ffmpeg) | Duration, resolution, codec |
| Transcribe | whisper.cpp (whisper-node) | Word-level timestamps + speaker IDs |
| Speaker Detection | pyannote + mediapipe (Python sidecar) | Speaker labels, face bounding boxes |
| AI Analysis | Gemini 3 Flash | Clip candidates with virality scores + reasoning paragraphs |

**Density targets:** Minimum 1 clip per 5 minutes, 1 short per 4 minutes of content (computed as `Math.max(floor, Math.ceil(durationMinutes / period))`).

### 4. Clip Review

- Separate tabs for Clips (landscape, 3-20 min) and Shorts (vertical 9:16)
- Shorts tab is split into **Classic** (≤60s) and **Extended** (61-180s) sub-tabs
- Each candidate card shows:
  - Title, duration
  - Virality score (0-100) badge
  - Letter grade (A+ to D)
  - Recommendation tier (Must Use / Highly Recommended / Recommended / Worth Considering / User Choice)
  - Content type tags (1-5 per candidate, from the 18-tag taxonomy)
  - Hook Strength (0-100) and Completion Pull (0-100) scores
  - Platform Play (one sentence: best platform + why)
  - Share Trigger (if present)
  - AI reasoning paragraph (2-4 sentences: topic, hook, payoff)
- Inline 240p preview player per card
- Actions: Approve, Discard, Edit (Trim Editor)
- Per-candidate Front Bumper / Rear Bumper selectors (clips only)
- Per-candidate Brand Strip override with Apply-to-all
- Per-candidate Watermark override with Apply-to-all
- Bulk approve/discard

**Content type tag taxonomy (18 tags):**
Hot Take, Humor, Actionable Advice, Personal Story, Educational, Quotable One-Liner, Controversial, Newsworthy, Behind the Scenes, Data / Stats, Vulnerability, Framework / Model, Debate / Tension, Transformational, Motivational, Inspirational, Strategy / Tactic, Hidden Gem

### 5. Find More Candidates

- On-demand second-pass analysis via `POST /api/find-more` (SSE streaming endpoint)
- Gemini re-reads transcript with existing candidate time ranges marked as off-limits
- New candidates deduped against existing ones: overlap > 20% of new clip's duration is filtered
- Each new candidate: preview generated (stacked if multi-speaker short), saved to DB
- Progress events streamed: `analyzing` → `found` → `item_start` / `item_done` → `complete`
- `FindMoreDialog` shows live checklist, progress bar, elapsed timer
- Confetti fires on success; dialog auto-closes after 3.5 seconds
- Dialog cannot be force-closed while a run is in progress
- Max server timeout: 5 minutes (`maxDuration = 300`)
- Targets: 8 additional clips, 10 additional shorts per call

### 6. Smart Framing for Multi-Speaker Shorts

When the Python sidecar detects 2+ speakers in a short candidate:

1. Extract a sub-clip of the candidate's time range (codec-copy)
2. Run `/detect-faces` at 1 fps via the Python sidecar
3. Cluster per-frame face detections by proximity (radius = 10% source width)
4. Filter to persistent faces: present in ≥ 1/3 of sampled frames
5. Pick the 2 largest persistent faces, sort by X (left on top, right on bottom)
6. Compute 9:8 aspect-ratio crop regions (each tile = half of 1080×1920 canvas)
7. Generate a stacked vstack preview using `generateStackedPreview()`
8. Store `Candidate.speakerLayout = "stacked"` and `Candidate.faceLayout = JSON`
9. Fall back to standard center-crop if fewer than 2 persistent faces are found

### 7. Trim Editor

- Timeline scrubber with draggable IN/OUT handles
- **Extend context buttons:** `− 1 min` (before) and `+ 1 min` (after) expand the visible window by fetching an additional minute of source context in either direction; disabled when the view already starts at 0
- Transcript-based trim: click a word to set trim start, Shift-click to set trim end
- Context words (before/after the active trim window) shown in muted style
- Save Trim button persists in/out points to DB via `updateCandidateTrim`

### 8. Captions

Burned-in ASS subtitles with word-level animation:

| Preset | Style |
|--------|-------|
| Bold Impact | All caps, bold, outline, animated active word (Hormozi style) |
| Clean Modern | Sentence case, background bar, no animation |
| Pop Color | Mixed case, bold, highlighted keywords + animation (GaryVee style) |
| Minimal | Sentence case, no effects |

Configurable: enabled toggle, position (auto/top/middle/bottom), size, font, active word color, stress word color.

### 9. Branding

#### Brand Strip

- Project-level defaults stored in `ProjectSettings` columns (`brandStrip*`)
- Per-candidate override stored as JSON in `Candidate.brandingOverride`
- Toggle on/off, position (top/bottom), brand text
- Presets: Dark Classic, Light Clean, Brand Pink, Brand Blue, Brand Green, Custom
- Custom bg/text color pickers with hex inputs
- Live preview in the settings UI
- **Apply-to-all:** overwrites `brandingOverride` on all candidates of the same type in the project
- **Reset to project default:** clears the per-candidate override

#### Watermark

- Project-level defaults stored in `ProjectSettings` columns (`watermark*`)
- Per-candidate override stored as JSON in `Candidate.watermarkOverride`
- Toggle on/off (requires uploaded image)
- Upload PNG/JPG/JPEG/WebP via `POST /api/watermark/upload`
- Position: 6-way grid (top/bottom × left/middle/right)
- Size: Small (8% of frame width), Medium (14%), Large (20%)
- Opacity: 10%–100% slider
- **Apply-to-all** and **Reset to project default** same as Brand Strip

### 10. Audio Processing

- **Profanity filter:** Bleep configured words (editable word list)
- **Dead-air removal:** Cut silences longer than threshold (configurable seconds)
- **Filler word removal:** Cut "um", "uh", etc. (editable word list)

### 11. Speaker Labels

- After diarization, auto-detected speakers (SPEAKER_0, SPEAKER_1, …) can be renamed
- Manual rename: edit input field, saved on blur
- **AI Name Suggestions:** Gemini scans the transcript for introductions and direct addresses, returns confidence-graded guesses (high/medium/low) with evidence quotes
- Suggestions can be applied individually or all at once
- Labels persist and are used in captions and layout decisions

### 12. Bumpers

- `BumperVideo` model: name, file path, tag (front/rear/both), duration, isDefaultFront/Rear
- Managed globally via the `/bumpers` page (upload, tag, set defaults)
- Per-candidate assignment via the `BumperSelector` dropdown on clip cards
- **Apply-to-all** in the dropdown propagates the selection to all clip candidates in the project
- Front/rear bumpers are pre-pended/appended at render time

### 13. Transcript Viewer

- Full searchable transcript with word-level timestamps
- Speaker labels reflected from Settings
- Click any segment to seek the video preview
- Highlighted search results with context windows

### 14. Render Queue

- Approved candidates queue for batch rendering
- Per-item quality selector: 720p, 1080p, 4K
- Clips render landscape; shorts render vertical (9:16, smart framing applied)
- Captions, branding, watermark, and bumpers burned in
- Output to `~/ClipEngine/projects/{projectId}/output/`
- After each item renders, `generateAndStoreYouTubeSuggestions()` runs automatically

### 15. YouTube Title & Thumbnail Generation

Triggered automatically after each render. Uses Gemini 3 Flash.

**For clips:**
- 5 YouTube titles ranked by predicted CTR, each with: `viralityScore`, `emotionalPolarity`, `rationale`
- Thumbnail layout: subject placement, facial expression, text overlay, color palette, visual style
- AI image generator prompt (ready-to-paste for Imager.gg, Midjourney, etc.)

**For shorts:**
- 5 YouTube titles (same scoring, optimized for under 40 characters)
- Caption hook: first 5-8 words for silent autoplay (the Short's "thumbnail")

Stored as JSON in `Candidate.youtubeSuggestions`. On-demand regeneration available via `regenerateYouTubeSuggestions(candidateId)` server action.

### 16. Global Defaults (AppSettings)

A singleton `AppSettings` row stores default JSON configs for caption, branding, watermark, and audio settings. New projects inherit these defaults when their `ProjectSettings` row is created.

- Saved via `saveGlobal*Defaults()` actions, triggered by "Save as default for new projects" button in each Project Settings accordion section
- Retrieved via `getGlobalDefaults()`
- Stored columns: `defaultCaptionConfig`, `defaultBrandingConfig`, `defaultWatermarkConfig`, `defaultAudioConfig`

### 17. Settings Accordion

All Project Settings sections (Speaker Labels, Captions, Audio, Extended Shorts, Brand Strip, Watermark) render as collapsed accordions. Each expandable section has a "Save as default for new projects" button that calls the corresponding `saveGlobal*Defaults()` action.

### 18. Appearance

- Light/Dark mode (via `next-themes`)
- Warm (brown) / Cool (blue) color palette (via CSS class on `<html>`)

### 19. Electron Distribution

ClipEngine is packaged as a native desktop app via `electron-builder`:

| Platform | Format | Architectures |
|----------|--------|---------------|
| macOS | `.dmg` | arm64 (Apple Silicon), x64 (Intel) |
| Windows | `.exe` (NSIS one-click) | x64 |
| Linux | `.AppImage` | x64 |

The CI workflow (`.github/workflows/ci.yml`) validates every change. Maintainers can add a release workflow for `v*` tags:
1. Builds Next.js
2. Packages Electron for all platforms in a matrix strategy
3. Creates a release in the open-source repository
4. Attaches installers to the release

The download page (`docs/download.html`) auto-detects the visitor's OS and serves the latest release artifacts.

---

## Technical Architecture

### Stack

```
Next.js 16 (App Router)
└── React 19 Server + Client Components
    └── Tailwind 4 OKLCH + shadcn/ui
        └── Prisma 7 + SQLite (dev.db)

AI Services
├── Gemini 3 Flash (Vercel AI SDK v6) — clip analysis, find-more, speaker name suggestions
└── whisper.cpp (whisper-node) — local transcription

Python Sidecar (Flask :5001)
├── pyannote.audio — speaker diarization
└── mediapipe + OpenCV — face detection (used for stacked layout)

Video Processing
└── fluent-ffmpeg (probe, 240p preview, stacked preview, full render)

Caption Format
└── ASS (Advanced SubStation Alpha) — word-level animation
```

### Database Models

| Model | Purpose |
|-------|---------|
| `Project` | Core entity: name, video path, status, archived flag, duration |
| `ProjectSettings` | Per-project captions, audio, brand strip defaults, watermark defaults, `findExtendedShorts` flag |
| `Transcript` | Full text of transcription |
| `TranscriptSegment` | Per-word: word, startTime, endTime, speaker, confidence |
| `Speaker` | Speaker ID → human label mapping |
| `Candidate` | AI-identified clip/short: times, virality score, grade, recommendation, tags, hookStrength, completionPull, platformPlay, shareTrigger, reasoning, status, speakerLayout, faceLayout, brandingOverride, watermarkOverride, youtubeSuggestions, output path |
| `BumperVideo` | Global bumper library: file path, tag, duration, default flags |
| `AppSettings` | Singleton row: global defaults for caption/branding/watermark/audio configs |
| `RenderJob` | Batch render job: status, item counts, timing, quality, cancelRequested |
| `RenderItem` | Per-candidate render status within a job: progress, output path, error |

### API Routes

| Method + Path | Purpose |
|--------------|---------|
| `POST /api/video/pick` | Open native OS file picker, reference in-place, auto-rename project, auto-probe |
| `POST /api/video/probe` | Run ffprobe, store duration (manual fallback) |
| `GET /api/video/stream` | Stream video for preview player |
| `POST /api/video/render` | Render approved candidate with captions, then generate YouTube suggestions |
| `POST /api/transcribe` | Run whisper, save segments to DB |
| `POST /api/diarize` | Call Python sidecar, save speakers |
| `POST /api/analyze` | Run Gemini analysis, save candidates (with tags, grade, recommendation, hookStrength, etc.) |
| `POST /api/find-more` | SSE stream: find additional candidates + generate previews |
| `POST /api/watermark/upload` | Save watermark image to project folder |
| `GET /api/search` | Full-text transcript search |

### Server Actions

| File | Actions |
|------|---------|
| `project-actions.ts` | createUntitledProject, renameProject, cloneProject, archiveProject, unarchiveProject, deleteProject, getProject, getProjects |
| `candidate-actions.ts` | getCandidates, updateCandidateStatus, updateCandidateTrim |
| `settings-actions.ts` | getProjectSettings, updateProjectSettings, updateSpeakerLabel, suggestSpeakerNames |
| `render-actions.ts` | getApprovedCandidates, getRenderQueue, startRender, markRendered, markRenderFailed |
| `branding-actions.ts` | updateCandidateBranding, updateCandidateWatermark, applyBrandingToAll, applyWatermarkToAll, updateProjectBrandingDefaults, updateProjectWatermarkDefaults |
| `bumper-actions.ts` | getBumpersForSlot, assignBumperToCandidate, applyBumperToAllClips, getDefaultBumpers |
| `youtube-actions.ts` | generateAndStoreYouTubeSuggestions, getYouTubeSuggestions, regenerateYouTubeSuggestions |
| `global-defaults-actions.ts` | saveGlobalCaptionDefaults, saveGlobalBrandingDefaults, saveGlobalWatermarkDefaults, saveGlobalAudioDefaults, getGlobalDefaults |

---

## Non-Functional Requirements

- **Local-only:** No external video processing. Runs entirely on localhost.
- **Desktop distribution:** Packaged as Electron app for macOS (arm64 + x64), Windows, and Linux
- **Hardware:** Optimized for M1 Max (whisper.cpp uses Metal/CoreML acceleration)
- **File size:** Supports up to 10GB videos (long podcast recordings)
- **No auth:** Single-user app, no login required
- **Storage:** `~/ClipEngine/projects/` for all project files
- **Find-more timeout:** 5-minute max for Gemini + preview generation (`maxDuration = 300`)
- **CI/CD:** GitHub Actions validates changes; maintainers can publish installers from tagged releases

---

## Out of Scope

- Multi-user / cloud deployment
- Direct social media publishing
- Audio-only podcast support
- Mobile interface
