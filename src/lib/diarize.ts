import { resolveHfToken } from "./api-keys";

const SIDECAR_URL = "http://127.0.0.1:5001";

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface DiarizationSegment {
  start: number;
  end: number;
  speaker: string;
}

export interface DiarizationResult {
  segments: DiarizationSegment[];
  speakers: string[];
  speakerCount: number;
}

export interface FaceLandmarks {
  leftEye: [number, number];
  rightEye: [number, number];
  nose: [number, number];
  mouthLeft: [number, number];
  mouthRight: [number, number];
}

export interface FaceBoundingBox {
  id: number;
  trackId?: number; // persistent ID from ByteTrack (YOLO)
  x: number;
  y: number;
  width: number;
  height: number;
  confidence?: number; // 0-1 detection confidence
  noseX?: number;
  noseY?: number;
  landmarks?: FaceLandmarks;
  orientation?: "frontal" | "profile" | "occluded";
}

export interface FaceTrackSummary {
  firstSeen: number;
  lastSeen: number;
  frameCount: number;
}

export interface FaceFrame {
  timestamp: number;
  faces: FaceBoundingBox[];
}

export interface FaceDetectionResult {
  frames: FaceFrame[];
  tracks?: Record<string, FaceTrackSummary>; // keyed by trackId
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

/**
 * Returns true when the Python sidecar is reachable and healthy.
 */
export async function checkSidecarHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${SIDECAR_URL}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { status?: string };
    return body.status === "ok";
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Speaker diarization
// ---------------------------------------------------------------------------

/**
 * Sends an audio file path to the sidecar for speaker diarization.
 * The sidecar runs pyannote-audio and returns speaker segments.
 */
export async function diarizeAudio(audioPath: string): Promise<DiarizationResult> {
  const hfToken = await resolveHfToken();
  const res = await fetch(`${SIDECAR_URL}/diarize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hf-token": hfToken,
    },
    body: JSON.stringify({ audioPath, hfToken }),
    // Diarization can take several minutes for long audio
    signal: AbortSignal.timeout(10 * 60 * 1_000),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(
      `Diarization sidecar error (${res.status}): ${body.error ?? res.statusText}`
    );
  }

  return res.json() as Promise<DiarizationResult>;
}

// ---------------------------------------------------------------------------
// Face detection
// ---------------------------------------------------------------------------

/**
 * Sends a video file path to the sidecar for mediapipe face detection.
 * @param videoPath   Absolute path to the video file.
 * @param sampleRate  Frames per second to sample (default 1 fps).
 */
export async function detectFaces(
  videoPath: string,
  sampleRate: number = 1.0
): Promise<FaceDetectionResult> {
  const res = await fetch(`${SIDECAR_URL}/detect-faces`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoPath, sampleRate }),
    signal: AbortSignal.timeout(10 * 60 * 1_000),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(
      `Face detection sidecar error (${res.status}): ${body.error ?? res.statusText}`
    );
  }

  return res.json() as Promise<FaceDetectionResult>;
}

// ---------------------------------------------------------------------------
// Merge helpers
// ---------------------------------------------------------------------------

interface WordLike {
  startTime: number;
  endTime: number;
}

/**
 * For each word in `words`, finds the diarization segment whose time range
 * contains the word's midpoint and returns the speaker label.
 * Falls back to "SPEAKER_00" when no segment matches.
 */
export function assignSpeakersToWords(
  words: WordLike[],
  diarizationSegments: DiarizationSegment[]
): string[] {
  return words.map((word) => {
    const midpoint = (word.startTime + word.endTime) / 2;
    const match = diarizationSegments.find(
      (seg) => midpoint >= seg.start && midpoint <= seg.end
    );
    return match?.speaker ?? "SPEAKER_00";
  });
}
