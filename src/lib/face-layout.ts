import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import os from "os";
import path from "path";
import { detectFaces, type FaceBoundingBox, type FaceDetectionResult } from "./diarize";

// ---------------------------------------------------------------------------
// Types — v1 (legacy static) and v2 (animated crop tracks)
// ---------------------------------------------------------------------------

export interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Legacy format — static crop per face, stored in older DB rows. */
export interface StackedLayout {
  source: { width: number; height: number };
  top: CropRegion; // leftmost primary speaker
  bottom: CropRegion; // rightmost primary speaker
}

/** A single keyframe in a crop track. */
export interface CropKeyframe {
  t: number; // seconds relative to clip start
  x: number; // crop X origin (source pixels)
  y: number; // crop Y origin (source pixels)
}

/** Fixed-dimension crop window with animated position. */
export interface CropTrack {
  width: number; // constant crop width
  height: number; // constant crop height
  keyframes: CropKeyframe[]; // sorted by t, smoothed
}

/** v2 layout — replaces StackedLayout for all new candidates. */
export interface FaceLayout {
  version: 2;
  mode: "single" | "stacked";
  source: { width: number; height: number };
  primary?: CropTrack; // single-speaker mode
  top?: CropTrack; // stacked mode (left speaker)
  bottom?: CropTrack; // stacked mode (right speaker)
}

// ---------------------------------------------------------------------------
// Phase 2 types — Active Speaker Layout (v3)
// ---------------------------------------------------------------------------

export interface SpeakerFaceMapping {
  speakerId: string; // e.g. "SPEAKER_00"
  faceClusterX: number; // center x of the face cluster
  confidence: number; // 0-1
}

export interface LayoutSegment {
  startTime: number;
  endTime: number;
  mode: "zoom" | "stacked" | "transition";
  activeSpeaker?: string; // speakerId when mode=zoom
  transitionFrom?: "zoom" | "stacked";
  transitionTo?: "zoom" | "stacked";
  transitionTargetSpeaker?: string;
}

export interface ActiveSpeakerLayout {
  version: 3;
  source: { width: number; height: number };
  speakerFaces: SpeakerFaceMapping[];
  timeline: LayoutSegment[];
  // Crop tracks for each speaker's zoom view (9:16)
  zoomTracks: Record<string, CropTrack>;
  // Crop tracks for stacked tiles
  stackedTop: CropTrack;
  stackedBottom: CropTrack;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Each stacked tile targets 1080 x 960 (half of a 1080x1920 9:16 canvas),
// aspect = 9:8. Crop regions follow that ratio so the final vstack has
// exactly the right shape with no letterboxing.
const TILE_ASPECT_W_OVER_H = 9 / 8;

// Full-frame 9:16 aspect for single-speaker shorts.
const SINGLE_ASPECT_W_OVER_H = 9 / 16;

// Crop padding around each detected face — how much source height to show
// around the face. 2.2x face height is enough to include shoulders without
// looking awkwardly zoomed in.
const FACE_PADDING_FACTOR = 2.2;

// EMA smoothing alpha — higher = more responsive, lower = smoother.
const EMA_ALPHA = 0.3;

// Deadzone — skip face movements smaller than this fraction of source width.
const DEADZONE_FRACTION = 0.01;

// Face detection sample rate (fps) for the new pipeline.
const SAMPLE_FPS = 3.0;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Extracts a short sub-clip of the source video with codec-copy so face
 * detection runs on just the candidate's range instead of the whole source.
 * Returns the tmp file path — caller must delete it when done.
 */
async function extractSubClip(
  inputPath: string,
  startTime: number,
  endTime: number,
): Promise<string> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "clipengine-face-"));
  const outputPath = path.join(tmpDir, "clip.mp4");
  const duration = endTime - startTime;

  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .seekInput(startTime)
      .duration(duration)
      .outputOptions(["-c copy", "-avoid_negative_ts make_zero"])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });

  return outputPath;
}

// ---------------------------------------------------------------------------
// Face clustering — used for MediaPipe data (no persistent IDs)
// ---------------------------------------------------------------------------

interface AggregatedFace {
  x: number; // center x
  y: number; // center y
  width: number;
  height: number;
  frameCount: number;
}

/**
 * Merges per-frame face detections into distinct persistent faces by
 * clustering on center distance. Returns averaged positions.
 */
function aggregateFaces(
  frames: Array<{ faces: FaceBoundingBox[] }>,
  sourceWidth: number,
): AggregatedFace[] {
  const clusters: Array<{
    centerXSum: number;
    centerYSum: number;
    widthSum: number;
    heightSum: number;
    count: number;
  }> = [];

  // Cluster radius: 10% of source width. Faces farther apart than this
  // are treated as distinct speakers.
  const clusterRadius = sourceWidth * 0.1;

  for (const frame of frames) {
    for (const face of frame.faces) {
      const cx = face.noseX ?? face.x + face.width / 2;
      const cy = face.noseY ?? face.y + face.height / 2;

      let matched = false;
      for (const cluster of clusters) {
        const avgCx = cluster.centerXSum / cluster.count;
        const avgCy = cluster.centerYSum / cluster.count;
        const dx = cx - avgCx;
        const dy = cy - avgCy;
        if (Math.sqrt(dx * dx + dy * dy) < clusterRadius) {
          cluster.centerXSum += cx;
          cluster.centerYSum += cy;
          cluster.widthSum += face.width;
          cluster.heightSum += face.height;
          cluster.count += 1;
          matched = true;
          break;
        }
      }
      if (!matched) {
        clusters.push({
          centerXSum: cx,
          centerYSum: cy,
          widthSum: face.width,
          heightSum: face.height,
          count: 1,
        });
      }
    }
  }

  return clusters
    .filter((c) => c.count >= 1)
    .map((c) => ({
      x: c.centerXSum / c.count,
      y: c.centerYSum / c.count,
      width: c.widthSum / c.count,
      height: c.heightSum / c.count,
      frameCount: c.count,
    }));
}

/**
 * Uses YOLO ByteTrack persistent track IDs to aggregate faces — no manual
 * clustering needed. Each trackId is already a persistent face. Falls back
 * to the old center-distance clustering when tracks are not available.
 */
function aggregateFacesFromTracks(
  result: FaceDetectionResult,
  sourceWidth: number,
): AggregatedFace[] {
  if (!result.tracks || Object.keys(result.tracks).length === 0) {
    // No track data (MediaPipe fallback) — use old clustering.
    return aggregateFaces(result.frames, sourceWidth);
  }

  const trackFaces: Record<string, {
    cxSum: number; cySum: number;
    wSum: number; hSum: number;
    count: number;
    confSum: number;
  }> = {};

  for (const frame of result.frames) {
    for (const face of frame.faces) {
      const tid = String(face.trackId ?? face.id);
      const cx = face.noseX ?? face.x + face.width / 2;
      const cy = face.noseY ?? face.y + face.height / 2;
      const conf = face.confidence ?? 0.5;

      if (!trackFaces[tid]) {
        trackFaces[tid] = { cxSum: 0, cySum: 0, wSum: 0, hSum: 0, count: 0, confSum: 0 };
      }
      trackFaces[tid].cxSum += cx;
      trackFaces[tid].cySum += cy;
      trackFaces[tid].wSum += face.width;
      trackFaces[tid].hSum += face.height;
      trackFaces[tid].count += 1;
      trackFaces[tid].confSum += conf;
    }
  }

  return Object.values(trackFaces)
    .filter((t) => t.count >= 1)
    .map((t) => ({
      x: t.cxSum / t.count,
      y: t.cySum / t.count,
      width: t.wSum / t.count,
      height: t.hSum / t.count,
      frameCount: t.count,
    }));
}

// ---------------------------------------------------------------------------
// Crop computation — static (legacy) and animated (new)
// ---------------------------------------------------------------------------


/**
 * Builds a smoothed CropTrack from per-frame face detections for a given
 * face cluster. Uses EMA smoothing with a deadzone to produce stable
 * keyframes at ~1/second.
 */
function computeCropTrack(
  frames: Array<{ timestamp: number; faces: FaceBoundingBox[] }>,
  cluster: AggregatedFace,
  sourceWidth: number,
  sourceHeight: number,
  aspect: number,
  clipStartTime: number,
): CropTrack {
  // Determine fixed crop dimensions from average face size.
  let cropHeight = Math.round(cluster.height * FACE_PADDING_FACTOR);
  cropHeight = Math.min(cropHeight, sourceHeight);
  let cropWidth = Math.round(cropHeight * aspect);
  if (cropWidth > sourceWidth) {
    cropWidth = sourceWidth;
    cropHeight = Math.round(cropWidth / aspect);
    if (cropHeight > sourceHeight) cropHeight = sourceHeight;
  }
  if (cropWidth % 2 === 1) cropWidth -= 1;
  if (cropHeight % 2 === 1) cropHeight -= 1;

  const clusterRadius = sourceWidth * 0.1;
  const deadzone = sourceWidth * DEADZONE_FRACTION;

  // Collect per-frame face centers for this cluster.
  interface RawSample {
    t: number;
    cx: number;
    cy: number;
  }
  const rawSamples: RawSample[] = [];

  for (const frame of frames) {
    // Find the detection closest to the cluster center in this frame.
    let bestDist = Infinity;
    let bestFace: FaceBoundingBox | null = null;
    for (const face of frame.faces) {
      const cx = face.noseX ?? face.x + face.width / 2;
      const cy = face.noseY ?? face.y + face.height / 2;
      const dx = cx - cluster.x;
      const dy = cy - cluster.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < clusterRadius && dist < bestDist) {
        bestDist = dist;
        bestFace = face;
      }
    }
    if (bestFace) {
      rawSamples.push({
        t: frame.timestamp - clipStartTime,
        cx: bestFace.noseX ?? bestFace.x + bestFace.width / 2,
        cy: bestFace.noseY ?? bestFace.y + bestFace.height / 2,
      });
    }
  }

  if (rawSamples.length === 0) {
    // No detections matched — single keyframe at cluster center.
    const cropX = clamp(Math.round(cluster.x - cropWidth / 2), 0, sourceWidth - cropWidth);
    const cropY = clamp(Math.round(cluster.y - cropHeight / 2), 0, sourceHeight - cropHeight);
    return { width: cropWidth, height: cropHeight, keyframes: [{ t: 0, x: cropX, y: cropY }] };
  }

  // EMA smoothing pass.
  const smoothed: RawSample[] = [];
  let prevCx = rawSamples[0].cx;
  let prevCy = rawSamples[0].cy;

  for (const sample of rawSamples) {
    const dx = Math.abs(sample.cx - prevCx);
    const dy = Math.abs(sample.cy - prevCy);

    // Apply deadzone — only update if movement exceeds threshold.
    if (dx > deadzone || dy > deadzone) {
      prevCx = EMA_ALPHA * sample.cx + (1 - EMA_ALPHA) * prevCx;
      prevCy = EMA_ALPHA * sample.cy + (1 - EMA_ALPHA) * prevCy;
    }

    smoothed.push({ t: sample.t, cx: prevCx, cy: prevCy });
  }

  // Downsample to ~1 keyframe per second.
  const keyframes: CropKeyframe[] = [];
  let lastKeyframeT = -Infinity;

  for (const s of smoothed) {
    if (s.t - lastKeyframeT >= 0.9) {
      const cropX = clamp(Math.round(s.cx - cropWidth / 2), 0, sourceWidth - cropWidth);
      const cropY = clamp(Math.round(s.cy - cropHeight / 2), 0, sourceHeight - cropHeight);
      keyframes.push({ t: Math.round(s.t * 100) / 100, x: cropX, y: cropY });
      lastKeyframeT = s.t;
    }
  }

  // Ensure at least the first and last samples are included.
  if (keyframes.length === 0) {
    const first = smoothed[0];
    const cropX = clamp(Math.round(first.cx - cropWidth / 2), 0, sourceWidth - cropWidth);
    const cropY = clamp(Math.round(first.cy - cropHeight / 2), 0, sourceHeight - cropHeight);
    keyframes.push({ t: 0, x: cropX, y: cropY });
  }

  return { width: cropWidth, height: cropHeight, keyframes };
}

// ---------------------------------------------------------------------------
// buildCropExpression — generates ffmpeg piecewise-linear expression
// ---------------------------------------------------------------------------

/**
 * Converts a CropTrack's keyframes into an ffmpeg piecewise-linear
 * expression string for the given axis. Returns a constant value if only
 * one keyframe exists.
 */
export function buildCropExpression(
  track: CropTrack,
  axis: "x" | "y",
): string {
  const kfs = track.keyframes;
  if (kfs.length === 0) return "0";
  if (kfs.length === 1) return String(kfs[0][axis]);

  // Build a nested if(lt(t,...), lerp, ...) chain.
  // For keyframes [k0, k1, k2, ...], the expression is:
  //   if(lt(t, k1.t), k0.v + (k1.v - k0.v) * (t - k0.t) / (k1.t - k0.t),
  //     if(lt(t, k2.t), k1.v + (k2.v - k1.v) * (t - k1.t) / (k2.t - k1.t),
  //       kN.v))
  let expr = String(kfs[kfs.length - 1][axis]); // final fallback value

  for (let i = kfs.length - 2; i >= 0; i--) {
    const k0 = kfs[i];
    const k1 = kfs[i + 1];
    const v0 = k0[axis];
    const v1 = k1[axis];
    const dt = k1.t - k0.t;

    if (dt <= 0 || v0 === v1) {
      // No movement in this segment — just hold the value.
      expr = `if(lt(t\\,${k1.t})\\,${v0}\\,${expr})`;
    } else {
      // Linear interpolation: v0 + (v1 - v0) * (t - t0) / dt
      const slope = ((v1 - v0) / dt).toFixed(4);
      expr = `if(lt(t\\,${k1.t})\\,${v0}+${slope}*(t-${k0.t})\\,${expr})`;
    }
  }

  return expr;
}

// ---------------------------------------------------------------------------
// Main entry point — replaces computeStackedLayoutForClip()
// ---------------------------------------------------------------------------

/**
 * Runs face detection on a candidate's time range and computes a FaceLayout
 * with smooth animated crop tracks.
 *
 * Returns:
 * - mode "single" with a primary CropTrack when 1 persistent face found
 * - mode "stacked" with top + bottom CropTracks when 2+ persistent faces
 * - null when no persistent faces found (caller falls back to center-crop)
 */
export async function computeFaceLayoutForClip(
  sourcePath: string,
  startTime: number,
  endTime: number,
  sourceWidth: number,
  sourceHeight: number,
): Promise<FaceLayout | null> {
  let subClipPath: string | null = null;
  try {
    subClipPath = await extractSubClip(sourcePath, startTime, endTime);
    const detectionResult = await detectFaces(subClipPath, SAMPLE_FPS);
    const { frames } = detectionResult;

    if (frames.length === 0) {
      console.warn("[face-layout] No frames returned from face detection");
      return null;
    }

    // Use track-based aggregation if YOLO tracks available, else cluster.
    const aggregated = aggregateFacesFromTracks(detectionResult, sourceWidth);
    const minFrames = Math.max(1, Math.floor(frames.length / 5));
    const persistent = aggregated.filter((f) => f.frameCount >= minFrames);

    console.log(
      `[face-layout] ${aggregated.length} faces aggregated, ${persistent.length} persistent (threshold: ${minFrames}/${frames.length} frames)`,
    );

    if (persistent.length === 0) {
      console.warn("[face-layout] No persistent faces found");
      return null;
    }

    if (persistent.length === 1) {
      // Single-speaker mode — face-centered crop for the full 9:16 frame.
      const track = computeCropTrack(
        frames,
        persistent[0],
        sourceWidth,
        sourceHeight,
        SINGLE_ASPECT_W_OVER_H,
        startTime,
      );

      console.log(
        `[face-layout] Single-speaker layout: ${track.keyframes.length} keyframes, crop ${track.width}x${track.height}`,
      );

      return {
        version: 2,
        mode: "single",
        source: { width: sourceWidth, height: sourceHeight },
        primary: track,
      };
    }

    // Multi-speaker — pick the 2 largest, order by x (left→top, right→bottom).
    const top2 = [...persistent]
      .sort((a, b) => b.width * b.height - a.width * a.height)
      .slice(0, 2)
      .sort((a, b) => a.x - b.x);

    const topTrack = computeCropTrack(
      frames,
      top2[0],
      sourceWidth,
      sourceHeight,
      TILE_ASPECT_W_OVER_H,
      startTime,
    );

    const bottomTrack = computeCropTrack(
      frames,
      top2[1],
      sourceWidth,
      sourceHeight,
      TILE_ASPECT_W_OVER_H,
      startTime,
    );

    console.log(
      `[face-layout] Stacked layout: top ${topTrack.keyframes.length} kf, bottom ${bottomTrack.keyframes.length} kf`,
    );

    return {
      version: 2,
      mode: "stacked",
      source: { width: sourceWidth, height: sourceHeight },
      top: topTrack,
      bottom: bottomTrack,
    };
  } catch (err) {
    console.error("[face-layout] computeFaceLayoutForClip failed:", err);
    return null;
  } finally {
    if (subClipPath) {
      try {
        fs.unlinkSync(subClipPath);
        fs.rmdirSync(path.dirname(subClipPath));
      } catch {
        // best-effort cleanup
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Legacy wrapper — keeps old call-sites working during migration
// ---------------------------------------------------------------------------

/**
 * @deprecated Use computeFaceLayoutForClip() instead. This wrapper converts
 * the new FaceLayout back to the old StackedLayout shape for callers that
 * haven't been updated yet.
 */
export async function computeStackedLayoutForClip(
  sourcePath: string,
  startTime: number,
  endTime: number,
  sourceWidth: number,
  sourceHeight: number,
): Promise<StackedLayout | null> {
  const layout = await computeFaceLayoutForClip(
    sourcePath,
    startTime,
    endTime,
    sourceWidth,
    sourceHeight,
  );

  if (!layout || layout.mode !== "stacked" || !layout.top || !layout.bottom) {
    return null;
  }

  // Convert CropTrack → static CropRegion using first keyframe.
  const topKf = layout.top.keyframes[0];
  const botKf = layout.bottom.keyframes[0];

  return {
    source: layout.source,
    top: { x: topKf.x, y: topKf.y, width: layout.top.width, height: layout.top.height },
    bottom: { x: botKf.x, y: botKf.y, width: layout.bottom.width, height: layout.bottom.height },
  };
}

// ---------------------------------------------------------------------------
// parseFaceLayout — handles both legacy StackedLayout and new FaceLayout
// ---------------------------------------------------------------------------

/**
 * Parses the JSON string stored in Candidate.faceLayout. Returns a
 * FaceLayout (v2), ActiveSpeakerLayout (v3), or converts legacy
 * StackedLayout into a FaceLayout. Returns null if missing/malformed.
 */
export function parseFaceLayout(value: string | null | undefined): FaceLayout | ActiveSpeakerLayout | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);

    // v3 active-speaker format.
    if (parsed && parsed.version === 3 && parsed.timeline) {
      return parsed as ActiveSpeakerLayout;
    }

    // v2 format — has a version field.
    if (parsed && parsed.version === 2) {
      return parsed as FaceLayout;
    }

    // Legacy StackedLayout format — convert to FaceLayout with static
    // single-keyframe tracks.
    if (
      parsed &&
      parsed.source &&
      parsed.top &&
      parsed.bottom &&
      typeof parsed.top.x === "number"
    ) {
      const legacy = parsed as StackedLayout;
      return {
        version: 2,
        mode: "stacked",
        source: legacy.source,
        top: {
          width: legacy.top.width,
          height: legacy.top.height,
          keyframes: [{ t: 0, x: legacy.top.x, y: legacy.top.y }],
        },
        bottom: {
          width: legacy.bottom.width,
          height: legacy.bottom.height,
          keyframes: [{ t: 0, x: legacy.bottom.x, y: legacy.bottom.y }],
        },
      };
    }

    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Phase 2: Active Speaker functions
// ---------------------------------------------------------------------------

/** Minimum solo-speaking duration (seconds) to trigger zoom mode. */
const MIN_ZOOM_DURATION = 3;
/** Duration of cross-fade transition between zoom and stacked (seconds). */
const TRANSITION_DURATION = 0.4;
/** Minimum segment duration after transition subtraction. */
const MIN_SEGMENT_DURATION = 2;
/** If speakers alternate faster than this, stay stacked. */
const RAPID_SWITCH_THRESHOLD = 1.5;

export interface DiarizationSegment {
  start: number;
  end: number;
  speaker: string;
}

/**
 * Derives diarization-style segments from word-level speaker labels by
 * grouping consecutive words with the same speaker.
 */
export function deriveDiarizationSegments(
  words: Array<{ startTime: number; endTime: number; speaker: string }>,
): DiarizationSegment[] {
  if (words.length === 0) return [];

  const segments: DiarizationSegment[] = [];
  let currentSpeaker = words[0].speaker;
  let segStart = words[0].startTime;
  let segEnd = words[0].endTime;

  for (let i = 1; i < words.length; i++) {
    const w = words[i];
    if (w.speaker === currentSpeaker) {
      segEnd = w.endTime;
    } else {
      segments.push({ start: segStart, end: segEnd, speaker: currentSpeaker });
      currentSpeaker = w.speaker;
      segStart = w.startTime;
      segEnd = w.endTime;
    }
  }
  segments.push({ start: segStart, end: segEnd, speaker: currentSpeaker });
  return segments;
}

interface AggregatedFaceInternal {
  x: number;
  y: number;
  width: number;
  height: number;
  frameCount: number;
}

/**
 * Maps face clusters to speaker IDs using positional heuristic + temporal
 * validation. For the 2-speaker podcast case, correlates diarization solo
 * segments with face presence to resolve left/right → speaker mapping.
 *
 * Returns an array of mappings sorted by face X position.
 */
export function mapFacesToSpeakers(
  faceClusters: AggregatedFaceInternal[],
  frames: Array<{ timestamp: number; faces: FaceBoundingBox[] }>,
  diarizationSegments: DiarizationSegment[],
  sourceWidth: number,
): SpeakerFaceMapping[] {
  if (faceClusters.length < 2) return [];

  // Pick the 2 largest faces, sort by X.
  const top2 = [...faceClusters]
    .sort((a, b) => b.width * b.height - a.width * a.height)
    .slice(0, 2)
    .sort((a, b) => a.x - b.x);

  const leftFace = top2[0];
  const rightFace = top2[1];
  const clusterRadius = sourceWidth * 0.1;

  // Get unique speakers from diarization.
  const speakers = [...new Set(diarizationSegments.map((s) => s.speaker))].sort();
  if (speakers.length !== 2) {
    // Can't map without exactly 2 speakers — fall back to positional.
    return [
      { speakerId: speakers[0] ?? "SPEAKER_00", faceClusterX: leftFace.x, confidence: 0.5 },
      { speakerId: speakers[1] ?? "SPEAKER_01", faceClusterX: rightFace.x, confidence: 0.5 },
    ];
  }

  // Temporal correlation: for each solo-speaking segment > 2s, check which
  // face cluster has more presence in those frames.
  let leftVoteForSpeaker0 = 0;
  let leftVoteForSpeaker1 = 0;

  for (const seg of diarizationSegments) {
    if (seg.end - seg.start < 2) continue;

    // Find frames within this segment's time range.
    const segFrames = frames.filter(
      (f) => f.timestamp >= seg.start && f.timestamp <= seg.end,
    );
    if (segFrames.length === 0) continue;

    // Count how many frames have a face near the left vs right cluster.
    let leftCount = 0;
    let rightCount = 0;
    for (const frame of segFrames) {
      for (const face of frame.faces) {
        const cx = face.noseX ?? face.x + face.width / 2;
        const leftDist = Math.abs(cx - leftFace.x);
        const rightDist = Math.abs(cx - rightFace.x);
        if (leftDist < clusterRadius) leftCount++;
        if (rightDist < clusterRadius) rightCount++;
      }
    }

    // The face with more presence during this speaker's solo segments
    // is likely that speaker.
    if (seg.speaker === speakers[0]) {
      if (leftCount >= rightCount) leftVoteForSpeaker0++;
      else leftVoteForSpeaker1++;
    } else {
      if (leftCount >= rightCount) leftVoteForSpeaker1++;
      else leftVoteForSpeaker0++;
    }
  }

  const totalVotes = leftVoteForSpeaker0 + leftVoteForSpeaker1;
  const confidence = totalVotes > 0
    ? Math.max(leftVoteForSpeaker0, leftVoteForSpeaker1) / totalVotes
    : 0.5;

  if (leftVoteForSpeaker0 >= leftVoteForSpeaker1) {
    // Left face = speakers[0], Right face = speakers[1].
    return [
      { speakerId: speakers[0], faceClusterX: leftFace.x, confidence },
      { speakerId: speakers[1], faceClusterX: rightFace.x, confidence },
    ];
  } else {
    // Left face = speakers[1], Right face = speakers[0].
    return [
      { speakerId: speakers[1], faceClusterX: leftFace.x, confidence },
      { speakerId: speakers[0], faceClusterX: rightFace.x, confidence },
    ];
  }
}

/**
 * Computes a layout timeline that alternates between zoom (single speaker)
 * and stacked (both speakers) based on diarization segments.
 */
export function computeLayoutTimeline(
  diarizationSegments: DiarizationSegment[],
  clipStartTime: number,
  clipEndTime: number,
): LayoutSegment[] {
  // Filter to segments overlapping the clip range.
  const relevant = diarizationSegments
    .filter((s) => s.end > clipStartTime && s.start < clipEndTime)
    .map((s) => ({
      start: Math.max(s.start, clipStartTime) - clipStartTime,
      end: Math.min(s.end, clipEndTime) - clipStartTime,
      speaker: s.speaker,
    }));

  if (relevant.length === 0) {
    return [{ startTime: 0, endTime: clipEndTime - clipStartTime, mode: "stacked" as const }];
  }

  // Build raw layout segments: solo speaking > MIN_ZOOM_DURATION = zoom,
  // everything else = stacked.
  const raw: Array<{ start: number; end: number; mode: "zoom" | "stacked"; speaker?: string }> = [];

  for (const seg of relevant) {
    const dur = seg.end - seg.start;
    if (dur >= MIN_ZOOM_DURATION) {
      raw.push({ start: seg.start, end: seg.end, mode: "zoom", speaker: seg.speaker });
    } else {
      raw.push({ start: seg.start, end: seg.end, mode: "stacked" });
    }
  }

  // Merge adjacent same-mode segments (or segments < RAPID_SWITCH_THRESHOLD apart).
  const merged: typeof raw = [];
  for (const seg of raw) {
    const last = merged[merged.length - 1];
    if (
      last &&
      last.mode === seg.mode &&
      last.speaker === seg.speaker &&
      seg.start - last.end < RAPID_SWITCH_THRESHOLD
    ) {
      last.end = seg.end;
    } else if (
      last &&
      last.mode === "stacked" &&
      seg.mode === "stacked" &&
      seg.start - last.end < RAPID_SWITCH_THRESHOLD
    ) {
      last.end = seg.end;
    } else {
      merged.push({ ...seg });
    }
  }

  // Filter out segments that are too short after merging.
  const filtered = merged.filter((s) => s.end - s.start >= MIN_SEGMENT_DURATION);
  if (filtered.length === 0) {
    return [{ startTime: 0, endTime: clipEndTime - clipStartTime, mode: "stacked" as const }];
  }

  // Insert transitions between mode changes.
  const timeline: LayoutSegment[] = [];
  for (let i = 0; i < filtered.length; i++) {
    const seg = filtered[i];

    // Add transition before this segment if mode changes.
    if (i > 0) {
      const prev = filtered[i - 1];
      if (prev.mode !== seg.mode) {
        const transStart = Math.max(prev.end, seg.start - TRANSITION_DURATION);
        timeline.push({
          startTime: transStart,
          endTime: seg.start,
          mode: "transition",
          transitionFrom: prev.mode,
          transitionTo: seg.mode,
          transitionTargetSpeaker: seg.mode === "zoom" ? seg.speaker : undefined,
        });
      }
    }

    timeline.push({
      startTime: seg.start,
      endTime: seg.end,
      mode: seg.mode,
      activeSpeaker: seg.mode === "zoom" ? seg.speaker : undefined,
    });
  }

  return timeline;
}

/**
 * Computes a full ActiveSpeakerLayout by combining face detection,
 * diarization, and layout timeline computation.
 */
export async function computeActiveSpeakerLayout(
  sourcePath: string,
  startTime: number,
  endTime: number,
  sourceWidth: number,
  sourceHeight: number,
  words: Array<{ startTime: number; endTime: number; speaker: string }>,
): Promise<ActiveSpeakerLayout | null> {
  let subClipPath: string | null = null;
  try {
    subClipPath = await extractSubClip(sourcePath, startTime, endTime);
    const detectionResult = await detectFaces(subClipPath, SAMPLE_FPS);
    const { frames } = detectionResult;

    if (frames.length === 0) return null;

    const aggregated = aggregateFacesFromTracks(detectionResult, sourceWidth);
    const minFrames = Math.max(1, Math.floor(frames.length / 5));
    const persistent = aggregated.filter((f) => f.frameCount >= minFrames);

    if (persistent.length < 2) return null;

    // Derive diarization segments from word-level speaker labels.
    const clipWords = words.filter(
      (w) => w.startTime >= startTime && w.endTime <= endTime,
    );
    const diarizationSegs = deriveDiarizationSegments(clipWords);

    // Adjust frame timestamps to be absolute (they're relative to sub-clip).
    const absoluteFrames = frames.map((f) => ({
      ...f,
      timestamp: f.timestamp + startTime,
    }));

    // Map faces to speakers.
    const speakerFaces = mapFacesToSpeakers(
      persistent,
      absoluteFrames,
      diarizationSegs,
      sourceWidth,
    );

    if (speakerFaces.length < 2 || speakerFaces[0].confidence < 0.55) {
      // Low confidence — fall back to Phase 1 stacked layout.
      return null;
    }

    // Compute layout timeline.
    const timeline = computeLayoutTimeline(diarizationSegs, startTime, endTime);

    // Compute zoom CropTracks (9:16) for each speaker.
    const top2 = [...persistent]
      .sort((a, b) => b.width * b.height - a.width * a.height)
      .slice(0, 2)
      .sort((a, b) => a.x - b.x);

    const zoomTracks: Record<string, CropTrack> = {};
    for (let i = 0; i < speakerFaces.length; i++) {
      const face = top2[i];
      zoomTracks[speakerFaces[i].speakerId] = computeCropTrack(
        frames,
        face,
        sourceWidth,
        sourceHeight,
        SINGLE_ASPECT_W_OVER_H,
        startTime,
      );
    }

    // Compute stacked CropTracks (9:8) for each tile.
    const stackedTop = computeCropTrack(
      frames,
      top2[0],
      sourceWidth,
      sourceHeight,
      TILE_ASPECT_W_OVER_H,
      startTime,
    );
    const stackedBottom = computeCropTrack(
      frames,
      top2[1],
      sourceWidth,
      sourceHeight,
      TILE_ASPECT_W_OVER_H,
      startTime,
    );

    console.log(
      `[face-layout] Active speaker layout: ${timeline.length} segments, ${speakerFaces.length} mapped faces`,
    );

    return {
      version: 3,
      source: { width: sourceWidth, height: sourceHeight },
      speakerFaces,
      timeline,
      zoomTracks,
      stackedTop,
      stackedBottom,
    };
  } catch (err) {
    console.error("[face-layout] computeActiveSpeakerLayout failed:", err);
    return null;
  } finally {
    if (subClipPath) {
      try {
        fs.unlinkSync(subClipPath);
        fs.rmdirSync(path.dirname(subClipPath));
      } catch {
        // best-effort cleanup
      }
    }
  }
}
