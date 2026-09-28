import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import { PREVIEW_QUALITY, EXPORT_QUALITIES, VERTICAL_QUALITY } from "@/lib/constants";
import type { StackedLayout, FaceLayout, ActiveSpeakerLayout, LayoutSegment, CropTrack } from "@/lib/face-layout";
import { buildCropExpression } from "@/lib/face-layout";
import type { BrandingSettings, WatermarkSettings } from "@/lib/branding";
import { BRAND_HEIGHT_PCT } from "@/lib/branding";
import fs from "fs";
import os from "os";
import path from "path";

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
}

export interface RenderClipOptions {
  inputPath: string;
  outputPath: string;
  startTime: number;
  endTime: number;
  quality: "720p" | "1080p" | "4k";
  vertical: boolean;
  stackedLayout?: StackedLayout | null;
  faceLayout?: FaceLayout | null;
  activeSpeakerLayout?: ActiveSpeakerLayout | null;
  branding?: BrandingSettings | null;
  watermark?: WatermarkSettings | null;
  assSubtitlePath?: string;
  frontBumperPath?: string;
  rearBumperPath?: string;
  onProgress?: (percent: number) => void;
}

// Common system font for drawtext. macOS paths first, fall back to a
// linux-ish path for portability. drawtext needs a fontfile argument —
// passing just a name doesn't work without fontconfig.
const SYSTEM_FONT_CANDIDATES = [
  "/System/Library/Fonts/Helvetica.ttc",
  "/System/Library/Fonts/HelveticaNeue.ttc",
  "/System/Library/Fonts/Supplemental/Arial.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
];

function resolveSystemFont(): string {
  for (const candidate of SYSTEM_FONT_CANDIDATES) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {}
  }
  return SYSTEM_FONT_CANDIDATES[0];
}

// Maps size enum to a percentage of the output width for watermark scaling.
const WATERMARK_SIZE_PCT: Record<"small" | "medium" | "large", number> = {
  small: 0.08,
  medium: 0.14,
  large: 0.2,
};

// Pixel margin for watermark placement away from the video edge.
const WATERMARK_MARGIN = 32;

interface BuildFilterChainArgs {
  outputWidth: number;
  outputHeight: number;
  vertical: boolean;
  stackedLayout?: StackedLayout | null;
  faceLayout?: FaceLayout | null;
  activeSpeakerLayout?: ActiveSpeakerLayout | null;
  branding?: BrandingSettings | null;
  assSubtitlePath?: string;
  hasWatermarkInput: boolean;
  watermark?: WatermarkSettings | null;
  brandTextFilePath?: string | null;
}

/**
 * Builds a time-dependent alpha expression from LayoutSegments.
 * alpha=1 → zoom view visible, alpha=0 → stacked view visible.
 */
function buildAlphaExpression(timeline: LayoutSegment[]): string {
  const parts: string[] = [];

  for (const seg of timeline) {
    if (seg.mode === "zoom") {
      parts.push(`between(t\\,${seg.startTime}\\,${seg.endTime})*1`);
    } else if (seg.mode === "stacked") {
      parts.push(`between(t\\,${seg.startTime}\\,${seg.endTime})*0`);
    } else if (seg.mode === "transition") {
      const dt = seg.endTime - seg.startTime;
      if (dt <= 0) continue;
      if (seg.transitionTo === "zoom") {
        // Fade in zoom: alpha 0→1
        parts.push(
          `between(t\\,${seg.startTime}\\,${seg.endTime})*((t-${seg.startTime})/${dt.toFixed(3)})`,
        );
      } else {
        // Fade out zoom: alpha 1→0
        parts.push(
          `between(t\\,${seg.startTime}\\,${seg.endTime})*(1-(t-${seg.startTime})/${dt.toFixed(3)})`,
        );
      }
    }
  }

  return parts.length > 0 ? parts.join("+") : "0";
}

/**
 * Builds a time-dependent crop expression for zoom mode that switches
 * between different speakers' crop tracks based on the timeline.
 */
function buildActiveSpeakerCropExpr(
  timeline: LayoutSegment[],
  zoomTracks: Record<string, CropTrack>,
  axis: "x" | "y",
  fallbackValue: number,
): string {
  const parts: string[] = [];

  for (const seg of timeline) {
    if (seg.mode === "zoom" && seg.activeSpeaker && zoomTracks[seg.activeSpeaker]) {
      const track = zoomTracks[seg.activeSpeaker];
      const trackExpr = buildCropExpression(track, axis);
      parts.push(`between(t\\,${seg.startTime}\\,${seg.endTime})*(${trackExpr})`);
    } else if (seg.mode === "transition" && seg.transitionTargetSpeaker && zoomTracks[seg.transitionTargetSpeaker]) {
      const track = zoomTracks[seg.transitionTargetSpeaker];
      const trackExpr = buildCropExpression(track, axis);
      parts.push(`between(t\\,${seg.startTime}\\,${seg.endTime})*(${trackExpr})`);
    }
  }

  return parts.length > 0 ? parts.join("+") : String(fallbackValue);
}

/**
 * Builds a complete filter graph for active-speaker framing. Renders
 * both a stacked view and a zoom view simultaneously, then composites
 * them with a time-dependent alpha overlay.
 */
function buildActiveSpeakerBaseFilter(
  layout: ActiveSpeakerLayout,
  outputWidth: number,
  outputHeight: number,
): string {
  const tileH = Math.floor(outputHeight / 2) - (Math.floor(outputHeight / 2) % 2);
  const tileW = outputWidth - (outputWidth % 2);

  // Stacked view (always rendered).
  const topXExpr = buildCropExpression(layout.stackedTop, "x");
  const topYExpr = buildCropExpression(layout.stackedTop, "y");
  const botXExpr = buildCropExpression(layout.stackedBottom, "x");
  const botYExpr = buildCropExpression(layout.stackedBottom, "y");

  // Zoom view (switches between speakers based on timeline).
  // Find the first zoom track to get crop dimensions.
  const firstZoomTrack = Object.values(layout.zoomTracks)[0];
  const zoomW = firstZoomTrack?.width ?? outputWidth;
  const zoomH = firstZoomTrack?.height ?? outputHeight;
  const zoomXExpr = buildActiveSpeakerCropExpr(layout.timeline, layout.zoomTracks, "x", 0);
  const zoomYExpr = buildActiveSpeakerCropExpr(layout.timeline, layout.zoomTracks, "y", 0);

  // Alpha expression for the overlay.
  const alphaExpr = buildAlphaExpression(layout.timeline);

  const parts = [
    // Split into 3 streams: zoom source, stacked top source, stacked bottom source.
    `[0:v]split=3[__zoom_src][__stack_top_src][__stack_bot_src]`,

    // Stacked view: crop + scale + vstack.
    `[__stack_top_src]crop=${layout.stackedTop.width}:${layout.stackedTop.height}:${topXExpr}:${topYExpr},scale=${tileW}:${tileH}:force_original_aspect_ratio=increase,crop=${tileW}:${tileH}[__stk_top]`,
    `[__stack_bot_src]crop=${layout.stackedBottom.width}:${layout.stackedBottom.height}:${botXExpr}:${botYExpr},scale=${tileW}:${tileH}:force_original_aspect_ratio=increase,crop=${tileW}:${tileH}[__stk_bot]`,
    `[__stk_top][__stk_bot]vstack=inputs=2[__stacked_view]`,

    // Zoom view: crop active speaker + scale to full 9:16.
    `[__zoom_src]crop=${zoomW}:${zoomH}:${zoomXExpr}:${zoomYExpr},scale=${outputWidth}:${outputHeight}[__zoom_view]`,

    // Composite: overlay zoom on stacked with time-dependent alpha.
    `[__stacked_view][__zoom_view]overlay=0:0:alpha=${alphaExpr}[base]`,
  ];

  return parts.join(";");
}

function buildRenderFilterChain(args: BuildFilterChainArgs): {
  filterGraph: string;
  outputLabel: string;
} {
  const {
    outputWidth: width,
    outputHeight: height,
    vertical,
    stackedLayout,
    faceLayout,
    activeSpeakerLayout,
    branding,
    assSubtitlePath,
    hasWatermarkInput,
    watermark,
    brandTextFilePath,
  } = args;

  const parts: string[] = [];
  let current = "0:v";

  // Step 1: base video composition
  if (vertical && activeSpeakerLayout) {
    // Active speaker layout — overlay compositing with time-dependent alpha.
    const baseFilter = buildActiveSpeakerBaseFilter(activeSpeakerLayout, width, height);
    parts.push(baseFilter);
  } else if (vertical && faceLayout?.mode === "single" && faceLayout.primary) {
    // Single-speaker face-centered crop with animated panning.
    const track = faceLayout.primary;
    const xExpr = buildCropExpression(track, "x");
    const yExpr = buildCropExpression(track, "y");
    parts.push(
      `[0:v]crop=${track.width}:${track.height}:${xExpr}:${yExpr},scale=${width}:${height}[base]`,
    );
  } else if (vertical && faceLayout?.mode === "stacked" && faceLayout.top && faceLayout.bottom) {
    // Stacked layout with animated per-tile crop tracking.
    const tileH = Math.floor(height / 2) - (Math.floor(height / 2) % 2);
    const tileW = width - (width % 2);
    const topTrack = faceLayout.top;
    const botTrack = faceLayout.bottom;
    const topXExpr = buildCropExpression(topTrack, "x");
    const topYExpr = buildCropExpression(topTrack, "y");
    const botXExpr = buildCropExpression(botTrack, "x");
    const botYExpr = buildCropExpression(botTrack, "y");
    parts.push(
      `[0:v]split=2[__v1][__v2]`,
      `[__v1]crop=${topTrack.width}:${topTrack.height}:${topXExpr}:${topYExpr},scale=${tileW}:${tileH}:force_original_aspect_ratio=increase,crop=${tileW}:${tileH}[__top]`,
      `[__v2]crop=${botTrack.width}:${botTrack.height}:${botXExpr}:${botYExpr},scale=${tileW}:${tileH}:force_original_aspect_ratio=increase,crop=${tileW}:${tileH}[__bottom]`,
      `[__top][__bottom]vstack=inputs=2[base]`,
    );
  } else if (vertical && stackedLayout) {
    // Legacy static stacked layout (old DB rows without FaceLayout).
    const tileH = Math.floor(height / 2) - (Math.floor(height / 2) % 2);
    const tileW = width - (width % 2);
    const { top, bottom } = stackedLayout;
    parts.push(
      `[0:v]split=2[__v1][__v2]`,
      `[__v1]crop=${top.width}:${top.height}:${top.x}:${top.y},scale=${tileW}:${tileH}:force_original_aspect_ratio=increase,crop=${tileW}:${tileH}[__top]`,
      `[__v2]crop=${bottom.width}:${bottom.height}:${bottom.x}:${bottom.y},scale=${tileW}:${tileH}:force_original_aspect_ratio=increase,crop=${tileW}:${tileH}[__bottom]`,
      `[__top][__bottom]vstack=inputs=2[base]`,
    );
  } else if (vertical) {
    parts.push(
      `[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}[base]`,
    );
  } else {
    parts.push(
      `[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2[base]`,
    );
  }
  current = "base";

  // Step 2: brand strip (drawbox for bg + drawtext for text)
  if (
    branding &&
    branding.enabled &&
    branding.text &&
    branding.text.trim().length > 0 &&
    brandTextFilePath
  ) {
    const heightPct = BRAND_HEIGHT_PCT[branding.height ?? "medium"] ?? 0.08;
    const stripH = Math.max(40, Math.round(height * heightPct));
    const stripY = branding.position === "top" ? 0 : height - stripH;
    const fontSize = Math.round(stripH * 0.55);
    const fontFile = resolveSystemFont();
    const bgColor = branding.bgColor.replace("#", "0x");
    const textColor = branding.textColor.replace("#", "0x");
    const bgAlpha = Math.max(0, Math.min(1, branding.opacity ?? 1)).toFixed(2);
    parts.push(
      `[${current}]drawbox=x=0:y=${stripY}:w=${width}:h=${stripH}:color=${bgColor}@${bgAlpha}:t=fill,drawtext=fontfile='${fontFile}':textfile='${brandTextFilePath}':fontcolor=${textColor}:fontsize=${fontSize}:x=(w-text_w)/2:y=${stripY}+((${stripH}-text_h)/2)[branded]`,
    );
    current = "branded";
  }

  // Step 3: watermark overlay (requires a second input stream)
  if (hasWatermarkInput && watermark && watermark.enabled && watermark.path) {
    const wmWidth = Math.max(20, Math.round(width * WATERMARK_SIZE_PCT[watermark.size]));
    const alpha = Math.max(0, Math.min(1, watermark.opacity));
    parts.push(
      `[1:v]scale=${wmWidth}:-1,format=rgba,colorchannelmixer=aa=${alpha.toFixed(3)}[__wm]`,
    );
    let wmX = "0";
    let wmY = "0";
    switch (watermark.position) {
      case "top-left":
        wmX = `${WATERMARK_MARGIN}`;
        wmY = `${WATERMARK_MARGIN}`;
        break;
      case "top-middle":
        wmX = `(W-w)/2`;
        wmY = `${WATERMARK_MARGIN}`;
        break;
      case "top-right":
        wmX = `W-w-${WATERMARK_MARGIN}`;
        wmY = `${WATERMARK_MARGIN}`;
        break;
      case "bottom-left":
        wmX = `${WATERMARK_MARGIN}`;
        wmY = `H-h-${WATERMARK_MARGIN}`;
        break;
      case "bottom-middle":
        wmX = `(W-w)/2`;
        wmY = `H-h-${WATERMARK_MARGIN}`;
        break;
      case "bottom-right":
      default:
        wmX = `W-w-${WATERMARK_MARGIN}`;
        wmY = `H-h-${WATERMARK_MARGIN}`;
        break;
    }
    parts.push(`[${current}][__wm]overlay=${wmX}:${wmY}[watermarked]`);
    current = "watermarked";
  }

  // Step 4: captions (ASS)
  if (assSubtitlePath) {
    // ffmpeg's ass filter takes the path directly; no need to escape.
    parts.push(`[${current}]ass=${assSubtitlePath}[subbed]`);
    current = "subbed";
  }

  return { filterGraph: parts.join(";"), outputLabel: `[${current}]` };
}

/**
 * Writes the brand strip text to a tmp file so we can reference it from
 * drawtext via textfile=PATH — avoids all the filter-graph escaping pain
 * that comes from putting text inline.
 */
function writeBrandTextFile(text: string): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "clipengine-brand-"));
  const filePath = path.join(tmpDir, "brand.txt");
  fs.writeFileSync(filePath, text, "utf-8");
  return filePath;
}

/**
 * Builds an ffmpeg complex filter graph that crops two face regions from
 * the source and stacks them vertically into a 9:16 canvas. Each tile is
 * scaled to half the target height. Includes a pad to guarantee exact
 * output dimensions even after rounding.
 */
function buildStackedFilter(
  layout: StackedLayout,
  outputWidth: number,
  outputHeight: number,
): string {
  const tileHeight = Math.floor(outputHeight / 2);
  // Force even dimensions for libx264.
  const tileH = tileHeight - (tileHeight % 2);
  const tileW = outputWidth - (outputWidth % 2);

  const { top, bottom } = layout;
  // prettier-ignore
  return (
    `[0:v]split=2[v1][v2];` +
    `[v1]crop=${top.width}:${top.height}:${top.x}:${top.y},scale=${tileW}:${tileH}:force_original_aspect_ratio=increase,crop=${tileW}:${tileH}[top];` +
    `[v2]crop=${bottom.width}:${bottom.height}:${bottom.x}:${bottom.y},scale=${tileW}:${tileH}:force_original_aspect_ratio=increase,crop=${tileW}:${tileH}[bottom];` +
    `[top][bottom]vstack=inputs=2[stacked]`
  );
}

/**
 * Converts an ffmpeg timemark string (HH:MM:SS.ms) to seconds.
 */
export function parseTimemark(timemark: string): number {
  const parts = timemark.split(":");
  if (parts.length !== 3) return 0;
  const hours = parseFloat(parts[0]);
  const minutes = parseFloat(parts[1]);
  const seconds = parseFloat(parts[2]);
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Probes a video file and returns metadata: duration, width, height, fps, codec.
 */
export function probeVideo(filePath: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(new Error(`ffprobe failed: ${err.message}`));
        return;
      }

      const videoStream = metadata.streams.find((s) => s.codec_type === "video");
      if (!videoStream) {
        reject(new Error("No video stream found in file"));
        return;
      }

      const duration = metadata.format.duration ?? 0;
      const width = videoStream.width ?? 0;
      const height = videoStream.height ?? 0;
      const codec = videoStream.codec_name ?? "unknown";

      // Parse fps from r_frame_rate or avg_frame_rate (e.g. "30/1" or "30000/1001")
      let fps = 0;
      const frameRateStr = videoStream.r_frame_rate ?? videoStream.avg_frame_rate ?? "0/1";
      const [num, den] = frameRateStr.split("/").map(Number);
      if (den && den !== 0) {
        fps = Math.round((num / den) * 100) / 100;
      }

      resolve({ duration, width, height, fps, codec });
    });
  });
}

/**
 * Generates a 240p preview clip from startTime to endTime.
 * Uses ultrafast preset, crf 35, 64k audio for fast encoding.
 */
export function generatePreview(
  inputPath: string,
  outputPath: string,
  startTime: number,
  endTime: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const duration = endTime - startTime;
    const { width, height } = PREVIEW_QUALITY;

    ffmpeg(inputPath)
      .seekInput(startTime)
      .duration(duration)
      .videoFilters([
        `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`,
      ])
      .videoCodec("libx264")
      .outputOptions(["-preset ultrafast", "-crf 35"])
      .audioCodec("aac")
      .audioBitrate("64k")
      .output(outputPath)
      .on("end", () => resolve(outputPath))
      .on("error", (err) => reject(new Error(`Preview generation failed: ${err.message}`)))
      .run();
  });
}

/**
 * Generates a 240p stacked vertical preview for multi-speaker shorts.
 * Output is the same 240p canvas (approx 135x240 in 9:16) but the content
 * is two cropped speaker tiles stacked top/bottom, matching what the
 * final render will look like.
 */
export function generateStackedPreview(
  inputPath: string,
  outputPath: string,
  startTime: number,
  endTime: number,
  layout: StackedLayout,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const duration = endTime - startTime;
    // 240-tall 9:16 canvas ≈ 135x240. Force even dimensions.
    const outHeight = 240;
    const outWidth = Math.round((outHeight * 9) / 16);
    const evenW = outWidth - (outWidth % 2);
    const filter = buildStackedFilter(layout, evenW, outHeight);

    ffmpeg(inputPath)
      .seekInput(startTime)
      .duration(duration)
      .complexFilter(filter)
      .outputOptions([
        "-map",
        "[stacked]",
        "-map",
        "0:a?",
        "-preset ultrafast",
        "-crf 35",
      ])
      .videoCodec("libx264")
      .audioCodec("aac")
      .audioBitrate("64k")
      .output(outputPath)
      .on("end", () => resolve(outputPath))
      .on("error", (err) =>
        reject(new Error(`Stacked preview generation failed: ${err.message}`)),
      )
      .run();
  });
}

/**
 * Generates a 240p face-centered vertical preview for single-speaker shorts.
 * Uses the median keyframe position as a static crop for fast encoding.
 */
export function generateFaceCenteredPreview(
  inputPath: string,
  outputPath: string,
  startTime: number,
  endTime: number,
  layout: FaceLayout,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const duration = endTime - startTime;
    // 240-tall 9:16 canvas ≈ 135x240. Force even dimensions.
    const outHeight = 240;
    const outWidth = Math.round((outHeight * 9) / 16);
    const evenW = outWidth - (outWidth % 2);

    if (layout.mode === "single" && layout.primary) {
      // Use median keyframe for a static preview crop.
      const track = layout.primary;
      const midIdx = Math.floor(track.keyframes.length / 2);
      const kf = track.keyframes[midIdx];

      ffmpeg(inputPath)
        .seekInput(startTime)
        .duration(duration)
        .videoFilters([
          `crop=${track.width}:${track.height}:${kf.x}:${kf.y}`,
          `scale=${evenW}:${outHeight}`,
        ])
        .videoCodec("libx264")
        .outputOptions(["-preset ultrafast", "-crf 35"])
        .audioCodec("aac")
        .audioBitrate("64k")
        .output(outputPath)
        .on("end", () => resolve(outputPath))
        .on("error", (err) =>
          reject(new Error(`Face-centered preview failed: ${err.message}`)),
        )
        .run();
    } else if (layout.mode === "stacked" && layout.top && layout.bottom) {
      // Stacked preview using median keyframes for each tile.
      const topKf = layout.top.keyframes[Math.floor(layout.top.keyframes.length / 2)];
      const botKf = layout.bottom.keyframes[Math.floor(layout.bottom.keyframes.length / 2)];
      const tileH = Math.floor(outHeight / 2) - (Math.floor(outHeight / 2) % 2);
      const tileW = evenW - (evenW % 2);

      const filter =
        `[0:v]split=2[v1][v2];` +
        `[v1]crop=${layout.top.width}:${layout.top.height}:${topKf.x}:${topKf.y},scale=${tileW}:${tileH}:force_original_aspect_ratio=increase,crop=${tileW}:${tileH}[top];` +
        `[v2]crop=${layout.bottom.width}:${layout.bottom.height}:${botKf.x}:${botKf.y},scale=${tileW}:${tileH}:force_original_aspect_ratio=increase,crop=${tileW}:${tileH}[bottom];` +
        `[top][bottom]vstack=inputs=2[stacked]`;

      ffmpeg(inputPath)
        .seekInput(startTime)
        .duration(duration)
        .complexFilter(filter)
        .outputOptions([
          "-map", "[stacked]",
          "-map", "0:a?",
          "-preset ultrafast",
          "-crf 35",
        ])
        .videoCodec("libx264")
        .audioCodec("aac")
        .audioBitrate("64k")
        .output(outputPath)
        .on("end", () => resolve(outputPath))
        .on("error", (err) =>
          reject(new Error(`Face-centered stacked preview failed: ${err.message}`)),
        )
        .run();
    } else {
      reject(new Error("Invalid FaceLayout for preview generation"));
    }
  });
}

/**
 * Renders a full-quality clip with configurable quality, orientation, and optional ASS subtitles.
 * If front/rear bumper paths are provided, concatenates them around the main clip.
 */
export async function renderClip(options: RenderClipOptions): Promise<string> {
  const {
    inputPath,
    outputPath,
    startTime,
    endTime,
    quality,
    vertical,
    stackedLayout,
    faceLayout,
    activeSpeakerLayout,
    branding,
    watermark,
    assSubtitlePath,
    frontBumperPath,
    rearBumperPath,
    onProgress,
  } = options;

  const hasBumpers = frontBumperPath || rearBumperPath;

  // If we have bumpers, render the main clip to a temp file first, then concat
  const mainClipPath = hasBumpers
    ? outputPath.replace(/\.mp4$/, ".main.mp4")
    : outputPath;

  // The watermark image becomes a second ffmpeg input. We only wire it up
  // when the watermark is actually enabled and the file exists.
  const watermarkEnabled =
    !!watermark &&
    watermark.enabled &&
    !!watermark.path &&
    (() => {
      try {
        return fs.existsSync(watermark.path!);
      } catch {
        return false;
      }
    })();

  // Brand text needs a tmp file so drawtext can read it via textfile=PATH
  // without us having to escape every special character in the graph.
  let brandTextFilePath: string | null = null;
  if (
    branding &&
    branding.enabled &&
    branding.text &&
    branding.text.trim().length > 0
  ) {
    brandTextFilePath = writeBrandTextFile(branding.text);
  }

  // Step 1: Render main clip
  await new Promise<void>((resolve, reject) => {
    const duration = endTime - startTime;
    const qualityMap = vertical ? VERTICAL_QUALITY : EXPORT_QUALITIES;
    const { width, height } = qualityMap[quality];

    const { filterGraph, outputLabel } = buildRenderFilterChain({
      outputWidth: width,
      outputHeight: height,
      vertical,
      stackedLayout,
      faceLayout,
      activeSpeakerLayout,
      branding,
      assSubtitlePath,
      hasWatermarkInput: watermarkEnabled,
      watermark,
      brandTextFilePath,
    });

    const command = ffmpeg(inputPath).seekInput(startTime).duration(duration);

    if (watermarkEnabled && watermark?.path) {
      command.input(watermark.path);
    }

    command
      .complexFilter(filterGraph)
      .outputOptions(["-map", outputLabel, "-map", "0:a?"])
      .videoCodec("libx264")
      .outputOptions(["-preset medium", "-crf 18"])
      .audioCodec("aac")
      .audioBitrate("192k")
      .output(mainClipPath);

    if (onProgress && !hasBumpers) {
      command.on("progress", (progress) => {
        const elapsed = parseTimemark(progress.timemark ?? "00:00:00.00");
        const percent = duration > 0 ? Math.min((elapsed / duration) * 100, 100) : 0;
        onProgress(Math.round(percent));
      });
    }

    let stderrOutput = "";
    command
      .on("stderr", (line: string) => {
        stderrOutput += line + "\n";
      })
      .on("end", () => resolve())
      .on("error", (err) => {
        const last200 = stderrOutput.slice(-500);
        reject(new Error(`Render failed: ${err.message}\nffmpeg stderr (last 500 chars):\n${last200}`));
      })
      .run();
  });

  // Clean up the brand-text tmp file regardless of success/failure above.
  if (brandTextFilePath) {
    try {
      fs.unlinkSync(brandTextFilePath);
      fs.rmdirSync(path.dirname(brandTextFilePath));
    } catch {}
  }

  // Step 2: Concatenate bumpers if provided
  if (hasBumpers) {
    if (onProgress) onProgress(90);
    await concatWithBumpers(mainClipPath, outputPath, frontBumperPath, rearBumperPath);
    // Clean up temp main clip
    try { fs.unlinkSync(mainClipPath); } catch {}
    if (onProgress) onProgress(100);
  }

  return outputPath;
}

/**
 * Concatenates front bumper + main clip + rear bumper using ffmpeg concat demuxer.
 * All inputs must have compatible codecs (re-encodes if needed via concat filter).
 */
function concatWithBumpers(
  mainClipPath: string,
  outputPath: string,
  frontBumperPath?: string,
  rearBumperPath?: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Build concat list file
    const concatDir = path.dirname(outputPath);
    const concatListPath = path.join(concatDir, `.concat-${Date.now()}.txt`);

    const lines: string[] = [];
    if (frontBumperPath) lines.push(`file '${frontBumperPath}'`);
    lines.push(`file '${mainClipPath}'`);
    if (rearBumperPath) lines.push(`file '${rearBumperPath}'`);

    fs.writeFileSync(concatListPath, lines.join("\n"));

    // Use concat filter for better compatibility across different codecs
    const inputs: string[] = [];
    if (frontBumperPath) inputs.push(frontBumperPath);
    inputs.push(mainClipPath);
    if (rearBumperPath) inputs.push(rearBumperPath);

    const command = ffmpeg();
    inputs.forEach((input) => command.input(input));

    const filterParts = inputs.map((_, i) => `[${i}:v:0][${i}:a:0]`).join("");
    const concatFilter = `${filterParts}concat=n=${inputs.length}:v=1:a=1[outv][outa]`;

    command
      .complexFilter(concatFilter)
      .outputOptions(["-map", "[outv]", "-map", "[outa]"])
      .videoCodec("libx264")
      .outputOptions(["-preset medium", "-crf 18"])
      .audioCodec("aac")
      .audioBitrate("192k")
      .output(outputPath)
      .on("end", () => {
        // Clean up concat list
        try { fs.unlinkSync(concatListPath); } catch {}
        resolve();
      })
      .on("error", (err) => {
        try { fs.unlinkSync(concatListPath); } catch {}
        reject(new Error(`Bumper concat failed: ${err.message}`));
      })
      .run();
  });
}
