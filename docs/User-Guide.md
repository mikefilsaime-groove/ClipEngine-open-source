# ClipEngine — User Guide

**Version:** April 2026
**Platform:** Desktop (Electron app — macOS, Windows, Linux)

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [First-Run Setup](#2-first-run-setup)
3. [Dashboard](#3-dashboard)
4. [Creating a Project](#4-creating-a-project)
5. [Processing Pipeline](#5-processing-pipeline)
6. [Reviewing Clips](#6-reviewing-clips)
7. [Reviewing Shorts](#7-reviewing-shorts)
8. [Find More Candidates](#8-find-more-candidates)
9. [Trim Editor](#9-trim-editor)
10. [Project Settings](#10-project-settings)
11. [App Settings (API Keys & System Deps)](#11-app-settings-api-keys--system-deps)
12. [Bumpers Library](#12-bumpers-library)
13. [Render Queue](#13-render-queue)
14. [YouTube Title & Thumbnail Generation](#14-youtube-title--thumbnail-generation)
15. [Transcript Viewer](#15-transcript-viewer)
16. [Appearance Settings](#16-appearance-settings)
17. [Troubleshooting](#17-troubleshooting)

---

## 1. Getting Started

### Installing ClipEngine

Download the installer for your platform from the download page. ClipEngine runs as a native desktop app (Electron).

| Platform | File |
|----------|------|
| macOS Apple Silicon (M1/M2/M3/M4) | `ClipEngine-x.x.x-arm64.dmg` |
| macOS Intel | `ClipEngine-x.x.x-x64.dmg` |
| Windows 10/11 | `ClipEngine-Setup-x.x.x.exe` |
| Linux | `ClipEngine-x.x.x-x64.AppImage` |

**macOS:** Right-click the `.dmg` → Open to bypass Gatekeeper on first launch.
**Windows:** Click "More info" → "Run anyway" on the SmartScreen prompt.
**Linux:** Run `chmod +x ClipEngine-*.AppImage` then execute it.

### What happens on launch

When you launch ClipEngine, the Electron wrapper:

1. Starts the Next.js server (or reuses an existing dev server on port 3000)
2. Automatically launches the Python sidecar on port 5001 (required for speaker diarization and face detection)
3. Opens the app window at `http://127.0.0.1:<port>/`

The Python sidecar starts in the background — it may take 10-30 seconds to fully load (torch initialization). The diarization step on the pipeline page will show the sidecar as "not running" until it finishes loading.

### Running from source (developers)

```bash
npm ci
npx prisma generate
npm run db:setup
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

To also run the Python sidecar manually (in case Electron auto-launch isn't used):

```bash
source ~/.clipengine-venv/bin/activate && python python/sidecar.py
```

---

## 2. First-Run Setup

On first launch, open **App Settings** (gear icon ⚙ → App Settings) to configure the two required API keys.

### API Keys

| Key | Required For | Where to Get It |
|-----|-------------|-----------------|
| **Gemini API Key** | AI Analysis, Find More, Speaker Name Suggestions, YouTube Title Generation | [aistudio.google.com](https://aistudio.google.com) |
| **HuggingFace Token** | Speaker diarization (pyannote) | [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) |

Keys are saved to the local SQLite database — you only need to enter them once. They can also be set via `.env` file (see README) and will be read from the environment if no DB value is present.

After saving a key you can click **Test** to verify it's valid before running the pipeline.

### System Dependencies

The App Settings page shows a **System Status** card with checks for:

- **ffmpeg** — bundled with the app (ffmpeg-static), no action needed
- **Python 3** — must be installed separately (3.10+ recommended); download from [python.org](https://python.org)
- **Python venv** — the `~/.clipengine-venv` virtual environment; click **Set up Python environment** to run `python/setup.sh` (takes a few minutes)
- **Whisper model** — the `ggml-base.en.bin` model file; click **Download model** to fetch it automatically
- **Python sidecar** — the Flask server on port 5001; started automatically by the Electron wrapper

Click the **Refresh** button after fixing any item to recheck status.

### Accept pyannote model licenses

Before diarization will work, you must accept the license agreements on HuggingFace for:
- https://huggingface.co/pyannote/speaker-diarization-3.1
- https://huggingface.co/pyannote/segmentation-3.0

Log in with your HuggingFace account and click "Agree" on each model page.

---

## 3. Dashboard

The dashboard shows all your projects.

**Toolbar:**
- **Search** — filter projects by name as you type
- **Sort** — Newest first, Oldest first, A→Z, Z→A
- **Filter tabs** — All / Active / Archived

**Each project row shows:**
- Project name and status badge
- Video file path, clip count, creation date
- Three-dot menu (⋯) for project actions

**Project actions (⋯ menu):**
- **Rename** — opens a dialog to rename the project
- **Clone** — duplicates the project (settings copied, pipeline re-runs)
- **Archive** — hides from Active view (still accessible in All/Archived)
- **Unarchive** — moves back to Active
- **Delete** — permanently deletes (confirmation required)

---

## 4. Creating a Project

1. Click **New Project** in the top right
2. You're taken to the project overview with "Untitled Project" as the name
3. Click **Pick Video** to open the native file browser and select your video file
4. The project automatically renames itself to the video filename (without extension) — so picking `WickedSmart-Ep42.mp4` names the project "WickedSmart-Ep42"
5. You can still rename it anytime via the **⋯ menu → Rename** from the dashboard

---

## 5. Processing Pipeline

The Overview page for each project shows the 4-step pipeline. Steps must be run in order.

### Step 1 — Probe Video

Click **Pick Video** to open the native macOS file picker. Supported formats: `.mp4`, `.mov`, `.mkv`, `.avi`, `.webm`, `.m4v`.

The file is referenced in-place (not copied) and ffprobe immediately extracts duration, resolution, and codec. The project name is auto-set from the filename if it's still "Untitled Project".

> **Note (macOS):** The file picker uses AppleScript and opens a native macOS dialog. On Windows/Linux, use the drag-and-drop upload in the Overview page instead.

### Step 2 — Transcribe

Click **Run** next to "Transcribe". whisper.cpp runs locally on your machine — this may take several minutes for a long episode. Word-level timestamps are saved to the database.

The whisper model (`ggml-base.en.bin`) must be downloaded before this step works. See [Section 2](#2-first-run-setup).

### Step 3 — Speaker Detection

Click **Run** next to "Speaker Detection". The Python sidecar uses pyannote to identify who is speaking at each moment, and YOLOv8-face (or MediaPipe as a fallback) to detect and track face positions. The sidecar must be running (check the System Status card in App Settings).

> **Optional upgrade:** For the most accurate face tracking, place `yolov8n-face.pt` at `~/.clipengine-models/yolov8n-face.pt` before running this step. The sidecar automatically uses YOLO when the model file is found and falls back to MediaPipe if it isn't.

### Step 4 — AI Analysis

Click **Run** next to "AI Analysis". Gemini 3 Flash reads the full transcript and identifies the best clips and shorts. A valid Gemini API key must be configured.

Each candidate receives:
- **Virality score** (0-100)
- **Hook Strength** (0-100) — how well the opening grabs attention in the first 3s (shorts) or 30s (clips)
- **Completion Pull** (0-100) — likelihood viewers watch to the end
- **Letter grade** (A+ to D)
- **Recommendation tier** (Must Use → User Choice)
- **Content type tags** (1-5 per candidate)
- **Platform Play** — which platform this performs best on and why
- **Share Trigger** — if the clip has a re-watch or tag-a-friend moment
- **AI reasoning** paragraph

The AI is calibrated to produce a minimum of **1 clip per 5 minutes** and **1 short per 4 minutes** of content. When Extended Shorts are enabled, a minimum of **1 extended short per 8 minutes** is also produced.

When all 4 steps are complete, the project status changes to **Ready**.

---

## 6. Reviewing Clips

Navigate to the **Clips** tab. Clips are 3-20 minute segments in landscape format.

Each candidate card shows:
- **Title** — AI-generated descriptive title
- **Duration** — length of the segment
- **Virality score** badge (color-coded: green = high, yellow = mid, red = low)
- **Letter grade** (A+ to D) and **Recommendation tier**
- **Content type tags** — up to 5 tags such as "Hot Take", "Actionable Advice", "Personal Story", "Educational", "Framework / Model", etc.
- **Hook Strength** and **Completion Pull** scores
- **Platform Play** — best platform for this clip and why
- **Share Trigger** (if present)
- **AI reasoning** — 2-4 sentence paragraph explaining the clip, its hook, and why it's worth publishing
- **Video preview** — 240p preview player (inline in the card)

**Content type tags (full list):**
Hot Take, Humor, Actionable Advice, Personal Story, Educational, Quotable One-Liner, Controversial, Newsworthy, Behind the Scenes, Data / Stats, Vulnerability, Framework / Model, Debate / Tension, Transformational, Motivational, Inspirational, Strategy / Tactic, Hidden Gem

**Recommendation tiers:**
| Tier | Grade | Meaning |
|------|-------|---------|
| Must Use | A+ / A | Would be negligent to skip |
| Highly Recommended | A- / B+ | Strong candidate, publish unless you have too many |
| Recommended | B / B- | Solid, worth publishing in most batches |
| Worth Considering | C+ / C | Has merit, evaluate carefully |
| User Choice | C- / D | Included for completeness, user decides |

**Actions per candidate:**
- **Approve** — marks for rendering (green border appears)
- **Discard** — grays out the card
- **Edit** — opens the Trim Editor
- **Front Bumper / Rear Bumper** — select intro/outro bumper videos to attach (clips only)
- **Branding** — override the project-level brand strip for this candidate
- **Watermark** — override the project-level watermark for this candidate

Use **Bulk Actions** at the top to approve or discard all candidates at once.

**Find More** button triggers an additional AI pass to surface candidates missed in the first analysis (see section 8).

---

## 7. Reviewing Shorts

Navigate to the **Shorts** tab. Shorts are exported in vertical 9:16 format.

The Shorts page is split into two tabs:

### Classic Shorts (≤60s)

Traditional short-form content, 15-60 seconds. Punchy, one hook, one payoff. Best for TikTok, Instagram Reels, and YouTube Shorts.

### Extended Shorts (1-3 min)

Longer-form vertical content, 61-180 seconds. YouTube Shorts now supports up to 3 minutes. Extended shorts work well for multi-step explanations, stories with setup/conflict/resolution, and educational walkthroughs.

**Enabling Extended Shorts:** Go to **Project Settings → Extended Shorts** and toggle "Find extended shorts" on before running AI Analysis.

**Smart Framing:** ClipEngine automatically applies face-based framing to every short using one of three modes:

- **Face-Centered Zoom** — single speaker detected: the short is cropped and tracked tightly to that person's face for a polished 9:16 result
- **Stacked Layout** — two speakers detected: the vertical video is split into top and bottom tiles, one per speaker. Cards with this layout show a "STACKED" badge on the preview.
- **Active Speaker Mode** — when speaker identity data is available alongside two-face detection: zooms in on whoever is talking and smoothly transitions to the stacked view during exchanges

If no face data is available (sidecar was not running during Step 3), shorts fall back to a simple center crop.

Same review workflow as Clips (Approve, Discard, Edit, Branding, Watermark overrides), plus Find More.

---

## 8. Find More Candidates

On the Clips or Shorts tab, click **Find More** to ask Gemini for additional candidates beyond the initial analysis.

**How it works:**
1. A modal dialog opens showing live progress
2. Gemini re-reads the full transcript, treating all existing candidate time ranges as off-limits to avoid duplicates
3. New candidates are deduped against existing ones (any overlap > 20% is filtered out)
4. Previews are generated for each new candidate in real time — the modal shows a live checklist with each item ticking off as it finishes
5. On success, a confetti animation fires and the dialog auto-closes after 3.5 seconds

The modal shows:
- Elapsed timer
- Progress bar (X of N processed)
- Per-item checklist with virality score and STACKED badge where applicable

The dialog cannot be closed while a run is in progress. If something goes wrong, an error state is shown with a close button.

Targets: 8 additional clips or 10 additional shorts per Find More run.

---

## 9. Trim Editor

Open the trim editor by clicking **Edit** on any candidate card.

**Two editing modes (toggle at top):**

### Timeline mode
- Drag the **IN** handle (left) to set the clip start point
- Drag the **OUT** handle (right) to set the clip end point
- Click anywhere on the track to seek the preview player
- **− 1 min** button: expands the visible window by loading 1 minute of context before the current view
- **+ 1 min** button: expands the visible window by loading 1 minute of context after the current view
- IN / OUT / clip duration are shown below the track

### Transcript mode
- Words inside the active trim window are highlighted
- Context words (before and after the clip) are shown in a muted style
- Click any word to set it as the trim start
- Shift-click any word to set it as the trim end
- **− 1 min** / **+ 1 min** buttons expand the context window the same way as timeline mode

Click **Save Trim** to save the adjusted in/out points to the database.

---

## 10. Project Settings

Navigate to the **Settings** tab for per-project configuration. All sections are collapsed by default — click any section header to expand it.

Each settings section has a **"Save as default for new projects"** button that saves the current values as global defaults (applied to every future project).

### Speaker Labels

After diarization, detected speakers appear as SPEAKER_0, SPEAKER_1, etc.

- **Rename manually** — click any label field and type a human name; saved on blur
- **AI Name Suggestions** — click **Suggest names with AI** to let Gemini scan the transcript for introductions, direct addresses, and host lead-ins. Each suggestion shows:
  - Guessed name
  - Confidence: high / medium / low (color-coded)
  - Evidence quote from the transcript
  - **Apply** button to accept a single suggestion
  - **Apply all** button to accept all suggestions at once

Speaker labels are used in captions and inform layout decisions.

### Captions

| Setting | Options |
|---------|---------|
| Enable | Toggle on/off |
| Preset | Bold Impact, Clean Modern, Pop Color, Minimal |
| Position | Auto, Top, Middle, Bottom |
| Size | Small, Medium, Large |
| Font | Inter, Montserrat, Oswald, Space Grotesk |
| Active Word Color | Color picker (word being spoken) |
| Stress Word Color | Color picker (emphasized words) |

**Caption Presets:**
- **Bold Impact** — All caps, bold with outline, animated active word (Hormozi style)
- **Clean Modern** — Sentence case, background bar, no animation
- **Pop Color** — Mixed case, bold, highlighted keywords + animated active word (GaryVee/WickedSmart style)
- **Minimal** — Sentence case, no effects

### Audio Processing

| Setting | Description |
|---------|-------------|
| Profanity Filter | Bleeps configured words. Edit the word list to add/remove terms. |
| Dead-Air Removal | Cuts silences longer than the configured threshold (seconds) |
| Filler Word Removal | Cuts "um", "uh", "you know", etc. Edit the word list to customize. |
| Default Export Quality | 720p, 1080p, or 4K |

### Extended Shorts

Toggle **"Find extended shorts"** to include 61-180 second shorts in AI Analysis. When enabled, Gemini is required to find a minimum of 1 extended short per 8 minutes of content. Extended shorts appear in the **Extended** tab on the Shorts page.

This setting must be enabled **before** running AI Analysis.

### Brand Strip (project default)

Sets the default brand strip applied to every rendered clip and short in this project. Individual candidates can override this setting on their card.

| Setting | Options |
|---------|---------|
| Enable | Toggle on/off |
| Position | Top / Bottom |
| Preset | Dark Classic, Light Clean, Brand Pink, Brand Blue, Brand Green, Custom |
| Brand text | Your channel name, URL, or CTA |
| Background color | Color picker + hex input |
| Text color | Color picker + hex input |

A live preview is shown below the controls.

### Watermark (project default)

Sets the default watermark applied to every rendered clip and short in this project. Individual candidates can override this setting on their card.

| Setting | Options |
|---------|---------|
| Enable | Toggle on/off (requires an uploaded image) |
| Image | Upload PNG, JPG, JPEG, or WebP |
| Position | 2×3 grid: top-left / top-middle / top-right / bottom-left / bottom-middle / bottom-right |
| Size | Small (8%) / Medium (14%) / Large (20%) |
| Opacity | Slider 10%–100% |

---

## 11. App Settings (API Keys & System Deps)

Click the **gear icon** (⚙) in the top-right corner of any page, then choose **App Settings**.

### API Keys

Enter and save your Gemini API Key and HuggingFace token here. Keys are stored in the local database and persist across sessions.

- Click **Test** next to any key to verify it's valid without running the full pipeline
- Keys can also be set via `.env` file (the DB value takes priority)

### System Status

A checklist shows the status of all required dependencies:

| Item | What it checks |
|------|---------------|
| ffmpeg | Bundled binary (ffmpeg-static) or system ffmpeg |
| Python | `python3` on PATH |
| Python venv | `~/.clipengine-venv` exists and has dependencies |
| Whisper model | `ggml-base.en.bin` model file present |
| Python sidecar | HTTP health check at `http://127.0.0.1:5001/health` |

**Set up Python environment** — runs `python/setup.sh` via a streaming SSE log. Watch the live log output to see progress. Takes 2-10 minutes depending on your internet connection (downloads pyannote and required dependencies).

**Download whisper model** — runs `download-ggml-model.sh` from the whisper-node package to fetch the `base.en` model (~150MB).

Click **Refresh** after completing any setup step to recheck all statuses.

### Appearance

**Mode:**
- **Light** — white background
- **Dark** — dark background

**Theme:**
- **Warm** — brown/amber primary color (default)
- **Cool** — blue primary color

The active option is marked with a checkmark. Preferences are saved in localStorage and persist between sessions.

---

## 12. Bumpers Library

Navigate to **Bumpers** (in the navigation or via the gear menu) to manage your intro and outro video clips.

Bumpers are short video clips that can be prepended (front bumper) or appended (rear bumper) to clips during render.

**Managing bumpers:**
- Click **Upload Bumper** to add a new video (any format supported by ffmpeg)
- Each bumper has a **Name** and a **Tag**: Front, Rear, or Both
- Use the ⋯ menu on each bumper to rename, change tag, or delete it
- Mark a bumper as **Default Front** or **Default Rear** — new clips automatically get these assigned

**Assigning bumpers to clips:**
- On any clip card, click the **Front Bumper** or **Rear Bumper** selector
- Pick a bumper from the dropdown, or clear the current selection
- Click **Apply to all clips** to assign the selected bumper to every clip in the project at once

---

## 13. Render Queue

Navigate to the **Render** tab to see the render queue.

### Before rendering

Approved candidates appear here with their current quality setting. You can change the quality per-candidate from the dropdown before starting.

Click **Render** to start the batch. An estimated time is shown based on total duration, quality settings, and features enabled (captions, bumpers, watermark).

### What gets burned in during render

- Animated word-level captions (using the project's caption preset)
- Brand strip (project default, unless a per-candidate override is set)
- Watermark (project default, unless a per-candidate override is set)
- Front and rear bumper videos (clips only, if assigned)
- Audio processing: profanity bleep, dead-air removal, filler word cuts

### Output location

```
~/ClipEngine/projects/{projectId}/output/
```

Clips render at landscape resolution. Shorts render at vertical 9:16 resolution using Smart Framing: face-centered zoom for single speakers, stacked two-tile layout for two-speaker conversations, or active-speaker mode that zooms on whoever is talking. Falls back to center crop when no face data is available.

### Render job progress

The render page shows a live progress bar and per-item status. The render worker runs in the background — you can navigate away and return to the render page to check progress. The job continues even if you close the tab.

To cancel a running job, click **Cancel** on the render page.

### After render

After each item finishes rendering, ClipEngine automatically generates **YouTube title suggestions** and thumbnail concepts. See section 14.

---

## 14. YouTube Title & Thumbnail Generation

After a clip or short renders successfully, Gemini generates publishing assets automatically.

### For Clips
- **5 ranked YouTube titles** — each with a virality/CTR score, emotional polarity analysis ("curiosity + fear"), and a one-sentence rationale explaining why someone would click
- **Thumbnail layout** — detailed description of subject placement, facial expression, text overlay, colors, and visual style
- **AI thumbnail prompt** — ready-to-paste prompt for AI image generators (Imager.gg, Midjourney, etc.)

### For Shorts
- **5 ranked YouTube titles** — same scoring and rationale as clips, optimized for under 40 characters
- **Caption hook** — the first 5-8 words to show on screen before the viewer unmutes (the Short's equivalent of a thumbnail)

### Viewing suggestions

After render, click on any rendered candidate to expand it on the Render page. A **YouTube** panel shows the generated titles ranked by predicted CTR, along with the thumbnail concept or caption hook.

You can click **Regenerate** to ask Gemini for a fresh set of titles if you're not satisfied with the first batch.

### Creating thumbnails

For clip thumbnails, use [Imager.gg](https://imager.gg) or your preferred AI image generator. Paste the AI thumbnail prompt directly into the generator. The layout description gives you speaker positioning, expression direction, text overlay copy, background style, and color guidance.

---

## 15. Transcript Viewer

Navigate to the **Transcript** tab.

- Full searchable transcript with speaker labels
- Search bar at the top — results highlight in context with surrounding sentences
- Click any segment to seek the preview player to that moment
- Speaker labels assigned in Settings are reflected here

---

## 16. Appearance Settings

Click the **gear icon** (⚙) in the top right corner. Appearance controls are in the dropdown directly.

**Mode:**
- **Light** — white background
- **Dark** — dark background

**Theme:**
- **Warm** — brown/amber primary color (default)
- **Cool** — blue primary color

The active option is marked with a checkmark. Preferences are saved in localStorage and persist between sessions.

---

## 17. Troubleshooting

### API key prompts on every analysis run
Keys configured in App Settings persist in the database. If you're still prompted, check that the key was saved (App Settings shows a masked version if saved). Environment variable values from `.env` are only used as a fallback if no DB value exists.

### Diarization step fails
Make sure the Python sidecar is running. The Electron app launches it automatically on startup, but it can take 30+ seconds to be ready. Check App Settings → System Status → Python sidecar. If it shows "Not running", wait a moment and click Refresh, or start it manually:
```bash
source ~/.clipengine-venv/bin/activate && python python/sidecar.py
```
Check it's healthy at [http://localhost:5001/health](http://localhost:5001/health).

### Transcription hangs or crashes
The whisper model must be downloaded. Check App Settings → System Status → Whisper model. Click **Download model** if it shows as missing.

### Analysis returns no candidates
Check that a valid Gemini API key is saved in App Settings → API Keys. Click **Test** to verify the key is accepted. Also confirm the transcription step completed and the transcript is not empty (check the Transcript tab).

### No extended shorts generated
Make sure **"Find extended shorts"** is toggled on in Project Settings **before** running AI Analysis. If the toggle was off, re-run Step 4 (AI Analysis) to generate extended shorts.

### "Find More" dialog shows an error
The find-more route has a 5-minute timeout. If your video is very long and Gemini is slow, try again. Check the server console for detailed errors.

### Upload fails for large files
The app supports up to 10GB via `POST /api/video/upload`. Check that `bodySizeLimit: "10gb"` is in `next.config.ts`.

### Turbopack cache error ("range start index out of range")
```bash
rm -rf .next && npm run dev
```

### Port 3000 already in use
```bash
lsof -ti:3000 | xargs kill -9
npm run dev
```

### Watermark upload fails
Only PNG, JPG, JPEG, and WebP files are accepted. The file is saved to the project's folder on disk. Check the browser console for the specific error from `/api/watermark/upload`.

### Smart Framing not applying to shorts (center crop instead of face tracking)
The Python sidecar must have been running during Step 3 — Speaker Detection, since face data is collected at that step. Re-run Step 3 with the sidecar active, then re-run Step 4 to regenerate shorts with Smart Framing. For the best face detection accuracy, place `yolov8n-face.pt` at `~/.clipengine-models/yolov8n-face.pt` before running Step 3 (see Section 2). The sidecar uses MediaPipe automatically if the YOLO model is not installed — stacked and face-centered framing still works with MediaPipe, just with slightly lower tracking accuracy.

### YouTube titles not generating after render
YouTube suggestions are generated automatically after render completes. If they're missing, open the candidate on the Render page and click **Regenerate** to trigger generation on demand. Check that your Gemini API key is valid (App Settings → API Keys → Test).

### Python environment setup fails
If `setup.sh` fails, check:
1. Python 3.10+ is installed: `python3 --version`
2. You have internet access (pyannote downloads ~1GB of model weights)
3. Your HuggingFace token is valid and you've accepted the pyannote model licenses
