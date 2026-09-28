import path from "path";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import { TranscriptWord } from "@/types";

// whisper-node calls process.chdir() into its own directory during
// transcription and never restores it, so process.cwd() is unreliable
// across HMR reloads. PWD is set by the shell at process spawn and is
// never mutated by chdir, so it always points at the real project root.
const PROJECT_ROOT = process.env.PWD || process.cwd();

// whisper-node loaded lazily to prevent build-time side effects
// (the module tries to compile whisper.cpp on require())
async function getWhisper(): Promise<(path: string, opts: Record<string, unknown>) => Promise<WhisperSegment[]>> {
  const mod = await import("whisper-node");
  return (mod as { whisper?: typeof mod.default; default?: typeof mod.default }).whisper ?? mod.default;
}

/**
 * Returns the absolute path to the ggml model file whisper-node will use.
 * Resolved against the captured project root, not process.cwd().
 */
function resolveModelPath(modelName: string): string {
  return path.join(
    PROJECT_ROOT,
    "node_modules",
    "whisper-node",
    "lib",
    "whisper.cpp",
    "models",
    `ggml-${modelName}.bin`
  );
}

export interface WhisperOptions {
  modelName?: string;
  language?: string;
}

// Shape returned by whisper-node's tsToArray parser
interface WhisperSegment {
  start: string; // e.g. "00:00:01.000"
  end: string;
  speech: string;
}

/** Convert "HH:MM:SS.mmm" timestamp string to seconds */
function tsToSeconds(ts: string): number {
  const parts = ts.split(":");
  if (parts.length !== 3) return 0;
  const hours = parseFloat(parts[0]);
  const minutes = parseFloat(parts[1]);
  const seconds = parseFloat(parts[2]);
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Transcribes an audio file using whisper.cpp via whisper-node.
 * Returns the full text and word-level timestamps estimated from segment boundaries.
 */
export async function transcribeAudio(
  audioPath: string,
  options: WhisperOptions = {}
): Promise<{ fullText: string; words: TranscriptWord[] }> {
  const modelName = options.modelName ?? "medium";
  const language = options.language;

  // Preflight: verify the ggml model file exists. whisper-node otherwise
  // prints "Problem: '<name>' not found" to stdout and returns an empty
  // array, which silently looks like "transcription succeeded but empty".
  const modelPath = resolveModelPath(modelName);
  if (!fs.existsSync(modelPath)) {
    throw new Error(
      `Whisper model "${modelName}" not found at ${modelPath}. ` +
        `Download it with: cd node_modules/whisper-node/lib/whisper.cpp/models && ./download-ggml-model.sh ${modelName}`
    );
  }

  const whisperOptions: Record<string, unknown> = {
    word_timestamps: true,
  };
  if (language) {
    whisperOptions.language = language;
  }

  const whisperFn = await getWhisper();
  const segments: WhisperSegment[] = await whisperFn(audioPath, {
    modelName,
    whisperOptions,
  });

  if (!segments || segments.length === 0) {
    throw new Error(
      `Whisper returned no segments for ${audioPath}. ` +
        `The audio may be silent, corrupted, or the model failed to load.`
    );
  }

  const words: TranscriptWord[] = [];

  for (const segment of segments) {
    const segStart = tsToSeconds(segment.start);
    const segEnd = tsToSeconds(segment.end);
    const segDuration = Math.max(segEnd - segStart, 0);

    // Split segment text into individual words
    const rawWords = segment.speech
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0);

    if (rawWords.length === 0) continue;

    // Evenly distribute the segment duration across words
    const wordDuration = rawWords.length > 0 ? segDuration / rawWords.length : 0;

    rawWords.forEach((word, i) => {
      const wordStart = segStart + i * wordDuration;
      const wordEnd = wordStart + wordDuration;
      words.push({
        word,
        startTime: Math.round(wordStart * 1000) / 1000,
        endTime: Math.round(wordEnd * 1000) / 1000,
        speaker: "SPEAKER_0", // diarization assigns real speaker in Task 7
        confidence: 1.0,
      });
    });
  }

  const fullText = words.map((w) => w.word).join(" ");
  return { fullText, words };
}

/**
 * Extracts audio from a video file as a 16 kHz mono WAV — the format
 * whisper.cpp requires. Returns the path to the extracted WAV file.
 */
export async function extractAudio(
  videoPath: string,
  outputDir: string
): Promise<string> {
  // Use a stable simple filename — whisper-node shells out to whisper.cpp
  // without escaping special characters (spaces, commas, em-dashes, etc.),
  // so we avoid them entirely by naming the extracted WAV "audio.wav".
  const outputPath = path.join(outputDir, "audio.wav");

  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  return new Promise<string>((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      .audioChannels(1)
      .audioFrequency(16000)
      .audioCodec("pcm_s16le")
      .format("wav")
      .output(outputPath)
      .on("end", () => resolve(outputPath))
      .on("error", (err: Error) =>
        reject(new Error(`ffmpeg audio extraction failed: ${err.message}`))
      )
      .run();
  });
}
