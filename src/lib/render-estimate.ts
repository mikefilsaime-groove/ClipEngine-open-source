/**
 * Pre-render time estimate.
 *
 * Coefficients are rough and based on a modern M-series Mac. ffmpeg
 * encoding time scales primarily with (clip duration × quality), plus
 * a per-clip startup overhead, plus modest additions for complex
 * filter steps (captions, bumpers, watermark).
 *
 * Returns seconds. The UI displays a range (±30%) to set expectations.
 */

export type RenderQuality = "720p" | "1080p" | "4k";

export interface EstimateItem {
  duration: number;
  quality: RenderQuality;
  hasCaptions: boolean;
  hasBumpers: boolean;
  hasWatermark: boolean;
  hasBranding: boolean;
  isStacked: boolean;
}

const QUALITY_MULTIPLIER: Record<RenderQuality, number> = {
  "720p": 0.4,
  "1080p": 0.8,
  "4k": 2.5,
};

const STARTUP_OVERHEAD: Record<RenderQuality, number> = {
  "720p": 3,
  "1080p": 3,
  "4k": 5,
};

function estimateSingleItem(item: EstimateItem): number {
  const multiplier = QUALITY_MULTIPLIER[item.quality];
  const startup = STARTUP_OVERHEAD[item.quality];

  let seconds = item.duration * multiplier + startup;

  if (item.hasCaptions) seconds *= 1.1;
  if (item.hasBumpers) seconds *= 1.2;
  if (item.hasWatermark) seconds *= 1.05;
  if (item.hasBranding) seconds *= 1.05;
  if (item.isStacked) seconds *= 1.3;

  return seconds;
}

export function estimateTotalSeconds(items: EstimateItem[]): number {
  return Math.round(items.reduce((sum, it) => sum + estimateSingleItem(it), 0));
}

export function estimateItemSeconds(item: EstimateItem): number {
  return Math.round(estimateSingleItem(item));
}

export function formatDurationRange(totalSeconds: number): string {
  const low = Math.max(1, Math.floor(totalSeconds * 0.7));
  const high = Math.ceil(totalSeconds * 1.3);
  return `${formatDuration(low)} – ${formatDuration(high)}`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (minutes < 60) {
    return secs === 0 ? `${minutes}m` : `${minutes}m ${secs}s`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
}
