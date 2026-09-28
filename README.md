# ClipEngine

A local-first podcast clip machine packaged as a desktop Electron app. Pick a video, run the processing pipeline, and get AI-identified clips (3-20 min landscape) and shorts (≤60s classic or 1-3 min extended, vertical 9:16) — all on your local machine, no cloud video processing costs.

## Install with an AI agent

Copy this entire prompt into your coding agent. This public repository has no prebuilt installer yet; the prompt installs and runs the source on your computer. Keep API keys in the app, never in a chat or commit.

```text
Install and run ClipEngine from:
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
- Do not download a release binary unless one is actually published in this public repository.
```

The built-in User Guide is at **`/guide`** after launch, with a **Guide** link on the dashboard and in the settings menu.

## What It Does

1. **Pick Video** — native OS file picker, file referenced in-place, project auto-named from filename
2. **Probe** — extract duration, resolution, codec with ffprobe (runs automatically after pick)
3. **Transcribe** — word-level timestamps via whisper.cpp (runs local)
4. **Diarize** — speaker identification via pyannote + face detection via mediapipe (Python sidecar)
5. **Analyze** — Gemini 3 Flash reads the transcript and identifies clips/shorts with virality scores, letter grades, content type tags, hook/completion metrics, platform recommendations, and reasoning paragraphs
6. **Review** — approve or discard candidates, preview clips, adjust trim points, assign bumpers, override branding/watermark per-candidate
7. **Render** — export approved clips with burned-in animated captions, watermark, brand strip, and bumpers
8. **Publish assets** — AI-generated YouTube titles, thumbnail concepts, and AI image prompts after render

## Key Features

- **AI clip identification** — open/close loop philosophy, 1 clip per 5 min + 1 short per 4 min density minimum
- **Content tagging** — 18 content type tags (Hot Take, Educational, Framework / Model, etc.), letter grades A+ to D, and recommendation tiers (Must Use → User Choice)
- **Extended Shorts** — Shorts page splits into Classic (≤60s) and Extended (1-3 min) tabs; extended tier enabled per-project in Settings
- **Find More** — SSE streaming second-pass analysis to surface candidates missed in the first pass, with live progress checklist and confetti on completion
- **Smart framing** — multi-speaker shorts get a stacked vstack layout (top/bottom tiles, each cropped to one speaker's face via mediapipe)
- **Per-candidate overrides** — Brand Strip and Watermark can be customized per-candidate with Apply-to-all support
- **Bumpers** — assign front/rear bumper videos per clip, with Apply-to-all in the dropdown
- **AI speaker name suggestions** — Gemini scans the transcript for introductions and direct-address cues to guess speaker names (confidence-graded)
- **Trim editor** — timeline scrubber + transcript-based word selection, with ±1 min extend-context buttons
- **Animated captions** — word-level ASS subtitles burned in at render time (Bold Impact, Clean Modern, Pop Color, Minimal presets)
- **Audio processing** — profanity bleep, dead-air removal, filler word cuts
- **YouTube title & thumbnail generation** — 5 ranked titles with CTR scores + thumbnail layout + AI image generator prompt (clips); caption hook for shorts
- **Global defaults** — App Settings → Global Defaults pre-fill caption, branding, watermark, and audio settings for every new project
- **Electron desktop app** — packaged for macOS (arm64 + x64), Windows, and Linux via GitHub Actions CI/CD

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16, React 19, TypeScript 5 |
| Styling | Tailwind 4 (OKLCH), shadcn/ui |
| Database | Prisma 7 + SQLite (local file) |
| AI | Vercel AI SDK 6 + Gemini 3 Flash (`@ai-sdk/google`) |
| Transcription | whisper-node (whisper.cpp, local) |
| Video | fluent-ffmpeg (probe, preview, render) |
| Diarization | Python sidecar — pyannote + mediapipe |

## Quick Start

### 1. Install dependencies

```bash
npm ci
```

### 2. Set up database

```bash
npx prisma generate
npm run db:setup
```

### 3. Start the app

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

### 4. Configure API keys in-app

Open **App Settings** (gear icon → App Settings) and enter:
- **Gemini API Key** — from [aistudio.google.com](https://aistudio.google.com)
- **HuggingFace Token** — from [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)

Keys are saved to the local database. Optionally, set them via `.env` as a fallback:

```bash
GEMINI_API_KEY=your_key_here
GOOGLE_GENERATIVE_AI_API_KEY=your_key_here   # same value
HF_TOKEN=your_huggingface_token              # for pyannote speaker diarization
```

### 5. Set up Python sidecar (speaker diarization + face detection)

Requires Python 3.10+. In App Settings, click **Set up Python environment** — this runs `python/setup.sh` and streams the log output live. The venv is created at `~/.clipengine-venv`.

Or run manually:

```bash
cd python && ./setup.sh
source ~/.clipengine-venv/bin/activate && python python/sidecar.py
```

Accept the pyannote model licenses at:
- https://huggingface.co/pyannote/speaker-diarization-3.1
- https://huggingface.co/pyannote/segmentation-3.0

### 6. Download whisper model

In App Settings, click **Download model** — or run:

```bash
npx whisper-node download
```

## Project Structure

```
src/
├── app/
│   ├── page.tsx               # Dashboard (search, sort, filter projects)
│   └── project/[id]/          # Project detail pages
│       ├── page.tsx            # Overview + processing pipeline
│       ├── transcript/         # Full transcript viewer + search
│       ├── clips/              # Clip candidates (3-20 min)
│       ├── shorts/             # Shorts: Classic (≤60s) + Extended (1-3 min) tabs
│       ├── render/             # Render queue
│       └── settings/           # Captions, audio, branding, speaker labels (accordion)
├── actions/
│   ├── youtube-actions.ts     # generateAndStoreYouTubeSuggestions, regenerateYouTubeSuggestions
│   ├── global-defaults-actions.ts  # saveGlobal*Defaults, getGlobalDefaults (AppSettings)
│   ├── branding-actions.ts    # Per-candidate + project branding/watermark
│   ├── bumper-actions.ts      # Bumper assignment + apply-to-all
│   └── settings-actions.ts    # Speaker labels, AI suggestions, project settings
├── lib/
│   ├── analyze.ts             # Gemini AI clip identification + find-more (tags, grades, tiers)
│   ├── branding.ts            # BrandingSettings + WatermarkSettings types + resolvers
│   ├── captions.ts            # ASS subtitle generation
│   ├── face-layout.ts         # computeStackedLayoutForClip (mediapipe → vstack math)
│   ├── ffmpeg.ts              # Video probe, preview, stacked preview, render
│   ├── whisper.ts             # Local transcription
│   └── diarize.ts             # Python sidecar client
├── components/review/
│   └── shorts-tabs.tsx        # Classic / Extended tab switcher for Shorts page
python/
├── sidecar.py                 # Flask: /diarize + /detect-faces
└── setup.sh                   # Venv installer (venv at ~/.clipengine-venv)
prisma/
└── schema.prisma              # Project, Transcript, Candidate, Speaker, BumperVideo,
                               # ProjectSettings, AppSettings, RenderJob, RenderItem
electron/
└── main.js                    # Electron main process
.github/workflows/
└── build-electron.yml         # CI/CD: builds macOS/Windows/Linux on version tag push
```

## File Storage

Videos and outputs are stored at:
```
~/ClipEngine/projects/{projectId}/
├── {video-filename}           # Original uploaded video
├── .clipengine-previews/      # 240p preview clips (auto-generated)
└── output/                    # Rendered clips
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (Turbopack) |
| `npm run build` | Build for production |
| `npm run lint` | Run ESLint |
| `npm run db:setup` | Create the local SQLite file and apply the Prisma schema |
| `npm run electron:dev` | Run Electron wrapper (dev) |
| `npm run electron:build` | Build Next.js + package Electron installers |
| `npx prisma studio` | Open database browser |
| `npx prisma db push` | Push later schema changes to an existing local database |
| `npx prisma generate` | Regenerate Prisma client |

## Releases

Maintainers can package ClipEngine for:
- macOS arm64 + x64 (`.dmg`)
- Windows x64 (`.exe` NSIS installer)
- Linux x64 (`.AppImage`)

This public repository runs build validation on pushes and pull requests. It does not contain publishing credentials or automatically publish installers. Tagged releases can include installers for each supported desktop platform. The download page at `docs/download.html` auto-detects the visitor's OS and serves the right release artifact.

## License

ClipEngine is released under the [MIT License](LICENSE).
