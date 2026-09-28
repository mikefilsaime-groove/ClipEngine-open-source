import fs from "fs/promises";
import path from "path";
import type { TranscriptWord, CaptionPosition, CaptionSize } from "@/types";
import { CAPTION_PRESETS } from "@/lib/constants";

export interface CaptionConfig {
  presetId: string;
  position: CaptionPosition;
  size: CaptionSize;
  font: string;
  color: string;
  activeWordColor: string;
  stressWordColor: string;
}

const SIZE_MAP: Record<CaptionSize, number> = {
  small: 32,
  medium: 48,
  large: 64,
};

// ASS alignment values for vertical position
const POSITION_MAP: Record<string, number> = {
  top: 8,
  middle: 5,
  bottom: 2,
  auto: 2, // default to bottom
};

/**
 * Convert a CSS hex color (#RRGGBB) to ASS color format (&HBBGGRR&).
 */
export function hexToASSColor(hex: string): string {
  const clean = hex.replace("#", "").padStart(6, "0");
  const r = clean.slice(0, 2);
  const g = clean.slice(2, 4);
  const b = clean.slice(4, 6);
  return `&H${b}${g}${r}&`;
}

/**
 * Format seconds to ASS time format: H:MM:SS.cc
 */
export function formatASSTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.round((seconds % 1) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "00")}`;
}

interface Phrase {
  words: TranscriptWord[];
  startTime: number;
  endTime: number;
  wordIndices: number[]; // original indices into the full word array
}

/**
 * Group words into phrases of 3–5 words each.
 */
function groupIntoPhrases(words: TranscriptWord[]): Phrase[] {
  const phrases: Phrase[] = [];
  let i = 0;

  while (i < words.length) {
    // Pick 3-5 words per phrase
    const count = Math.min(4, words.length - i);
    const slice = words.slice(i, i + count);
    const indices = Array.from({ length: count }, (_, k) => i + k);

    phrases.push({
      words: slice,
      startTime: slice[0].startTime,
      endTime: slice[slice.length - 1].endTime,
      wordIndices: indices,
    });

    i += count;
  }

  return phrases;
}

/**
 * Build the [Script Info] section.
 */
function buildScriptInfo(width: number, height: number): string {
  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    "Collisions: Normal",
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    "ScaledBorderAndShadow: yes",
    "",
  ].join("\n");
}

/**
 * Build a single ASS style line.
 */
function buildStyle(
  name: string,
  font: string,
  fontSize: number,
  primaryColor: string,
  outlineColor: string,
  hasOutline: boolean,
  bold: boolean,
  alignment: number
): string {
  const boldFlag = bold ? "-1" : "0";
  const outlineWidth = hasOutline ? "2" : "0";
  const shadowDepth = hasOutline ? "1" : "0";
  const backColor = "&H80000000&"; // semi-transparent shadow
  const borderStyle = "1";
  const marginV = "30";

  return (
    `Style: ${name},${font},${fontSize},${primaryColor},&H00FFFFFF&,` +
    `${outlineColor},${backColor},${boldFlag},0,0,0,100,100,0,0,` +
    `${borderStyle},${outlineWidth},${shadowDepth},${alignment},10,10,${marginV},1`
  );
}

/**
 * Build the [V4+ Styles] section.
 */
function buildStyles(config: CaptionConfig, preset: (typeof CAPTION_PRESETS)[0], fontSize: number, alignment: number): string {
  const primaryColor = hexToASSColor(config.color);
  const outlineColor = "&H00000000&"; // black outline
  const hasOutline = preset.style.outline;
  const bold = preset.style.fontWeight === "bold";

  const lines = [
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    buildStyle("Default", config.font, fontSize, primaryColor, outlineColor, hasOutline, bold, alignment),
  ];

  if (preset.style.highlightKeywords || preset.style.animateActiveWord) {
    const highlightColor = hexToASSColor(config.activeWordColor);
    lines.push(buildStyle("Highlight", config.font, fontSize, highlightColor, outlineColor, hasOutline, bold, alignment));
  }

  lines.push("");
  return lines.join("\n");
}

/**
 * Build a single Dialogue line.
 */
function buildDialogue(
  style: string,
  startTime: number,
  endTime: number,
  text: string,
  layer = 0
): string {
  return `Dialogue: ${layer},${formatASSTime(startTime)},${formatASSTime(endTime)},${style},,0,0,0,,${text}`;
}

/**
 * Apply text transform based on preset.
 */
function applyTransform(word: string, transform: "uppercase" | "none"): string {
  return transform === "uppercase" ? word.toUpperCase() : word;
}

/**
 * Generate the [Events] section for non-animated presets (clean-modern, minimal).
 * Each phrase gets a single Dialogue event with all words concatenated.
 */
function buildEventsSimple(
  phrases: Phrase[],
  config: CaptionConfig,
  preset: (typeof CAPTION_PRESETS)[0],
  stressWordIndices: Set<number>
): string {
  const lines = [
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];

  for (const phrase of phrases) {
    const text = phrase.words
      .map((w) => applyTransform(w.word, preset.style.textTransform))
      .join(" ");
    lines.push(buildDialogue("Default", phrase.startTime, phrase.endTime, text));
  }

  lines.push("");
  return lines.join("\n");
}

/**
 * Generate the [Events] section for animated presets (bold-impact, pop-color).
 * Each word in a phrase gets its own Dialogue event.
 * The active word scales up using \fscx120\fscy120 and uses activeWordColor.
 * Stress words use stressWordColor.
 */
function buildEventsAnimated(
  phrases: Phrase[],
  config: CaptionConfig,
  preset: (typeof CAPTION_PRESETS)[0],
  stressWordIndices: Set<number>,
  fontSize: number
): string {
  const lines = [
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];

  const activeColor = hexToASSColor(config.activeWordColor);
  const stressColor = hexToASSColor(config.stressWordColor);
  const defaultColor = hexToASSColor(config.color);

  for (const phrase of phrases) {
    const phraseStart = phrase.startTime;
    const phraseEnd = phrase.endTime;

    // Build the full phrase text for background context (shown in Default style)
    const phraseText = phrase.words
      .map((w) => applyTransform(w.word, preset.style.textTransform))
      .join(" ");

    // One background Dialogue spanning the whole phrase
    lines.push(buildDialogue("Default", phraseStart, phraseEnd, phraseText, 0));

    // Per-word active highlight events on a higher layer
    for (let wi = 0; wi < phrase.words.length; wi++) {
      const w = phrase.words[wi];
      const globalIdx = phrase.wordIndices[wi];
      const wordText = applyTransform(w.word, preset.style.textTransform);
      const wordDuration = w.endTime - w.startTime;

      // Determine color for this word
      let wordColor: string;
      if (stressWordIndices.has(globalIdx)) {
        wordColor = stressColor;
      } else {
        wordColor = activeColor;
      }

      // Build surrounding words (grayed out / default color) + active word scaled up
      const parts = phrase.words.map((pw, pwi) => {
        const pwText = applyTransform(pw.word, preset.style.textTransform);
        if (pwi === wi) {
          // Active word: color override + scale animation
          const fadeInDur = Math.round(Math.min(wordDuration * 0.2, 0.1) * 1000);
          const scaleTag = `{\\c${wordColor}\\fscx120\\fscy120\\t(0,${fadeInDur},\\fscx100\\fscy100)}`;
          return `${scaleTag}${pwText}`;
        } else {
          return `{\\c${defaultColor}}${pwText}`;
        }
      });

      const composedText = parts.join("{\\r} ");
      lines.push(buildDialogue("Default", w.startTime, w.endTime, composedText, 1));
    }
  }

  lines.push("");
  return lines.join("\n");
}

/**
 * Generate an ASS subtitle file for burning captions into a video.
 *
 * @param words - Transcript words with timing
 * @param config - Caption configuration (preset, position, size, colors, font)
 * @param outputPath - Where to write the .ass file
 * @param videoWidth - Video width in pixels
 * @param videoHeight - Video height in pixels
 * @param stressWordIndices - Optional indices of stress words (highlighted in stressWordColor)
 * @returns The resolved output path
 */
export async function generateASSSubtitles(
  words: TranscriptWord[],
  config: CaptionConfig,
  outputPath: string,
  videoWidth: number,
  videoHeight: number,
  stressWordIndices: number[] = []
): Promise<string> {
  if (words.length === 0) {
    throw new Error("No words provided for subtitle generation");
  }

  const preset = CAPTION_PRESETS.find((p) => p.id === config.presetId);
  if (!preset) {
    throw new Error(`Unknown caption preset: ${config.presetId}`);
  }

  const fontSize = SIZE_MAP[config.size] ?? SIZE_MAP.medium;
  const alignment = POSITION_MAP[config.position] ?? POSITION_MAP.bottom;
  const stressSet = new Set(stressWordIndices);

  const phrases = groupIntoPhrases(words);

  const scriptInfo = buildScriptInfo(videoWidth, videoHeight);
  const styles = buildStyles(config, preset, fontSize, alignment);

  let events: string;
  if (preset.style.animateActiveWord) {
    events = buildEventsAnimated(phrases, config, preset, stressSet, fontSize);
  } else {
    events = buildEventsSimple(phrases, config, preset, stressSet);
  }

  const assContent = [scriptInfo, styles, events].join("\n");

  const resolvedPath = path.resolve(outputPath);
  await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
  await fs.writeFile(resolvedPath, assContent, "utf-8");

  return resolvedPath;
}
