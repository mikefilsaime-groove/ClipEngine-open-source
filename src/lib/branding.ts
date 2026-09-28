// Shared types + helpers for per-candidate branding and watermark overrides.
// These fields are stored as JSON strings in Candidate.brandingOverride /
// Candidate.watermarkOverride so the schema stays flat.

export type BrandStripPosition = "top" | "bottom";

export type BrandStripHeight = "thin" | "medium" | "thick";

export interface BrandingSettings {
  enabled: boolean;
  position: BrandStripPosition;
  text: string;
  bgColor: string;
  textColor: string;
  font: string;
  opacity: number; // 0..1
  height: BrandStripHeight;
  preset?: string | null;
}

export type WatermarkPosition =
  | "top-left"
  | "top-middle"
  | "top-right"
  | "bottom-left"
  | "bottom-middle"
  | "bottom-right";

export type WatermarkSize = "small" | "medium" | "large";

export interface WatermarkSettings {
  enabled: boolean;
  path: string | null;
  position: WatermarkPosition;
  opacity: number; // 0..1
  size: WatermarkSize;
}

export const DEFAULT_BRANDING: BrandingSettings = {
  enabled: false,
  position: "bottom",
  text: "",
  bgColor: "#000000",
  textColor: "#FFFFFF",
  font: "Inter",
  opacity: 1,
  height: "medium",
  preset: "dark-classic",
};

export const BRAND_FONTS = [
  "Inter",
  "Helvetica",
  "Arial",
  "Georgia",
  "Montserrat",
  "Oswald",
  "Space Grotesk",
] as const;

export const BRAND_HEIGHT_PCT: Record<BrandStripHeight, number> = {
  thin: 0.05,
  medium: 0.08,
  thick: 0.12,
};

export const DEFAULT_WATERMARK: WatermarkSettings = {
  enabled: false,
  path: null,
  position: "bottom-right",
  opacity: 0.7,
  size: "medium",
};

export function parseBranding(value: string | null | undefined): BrandingSettings | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<BrandingSettings>;
    if (parsed && typeof parsed === "object") {
      return { ...DEFAULT_BRANDING, ...parsed };
    }
    return null;
  } catch {
    return null;
  }
}

export function parseWatermark(value: string | null | undefined): WatermarkSettings | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<WatermarkSettings>;
    if (parsed && typeof parsed === "object") {
      return { ...DEFAULT_WATERMARK, ...parsed };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Resolves the final branding settings for a candidate: if the candidate
 * has an override, use it; otherwise fall back to the project-level
 * ProjectSettings columns.
 */
export function resolveBranding(args: {
  override: string | null;
  projectSettings: {
    brandStripEnabled: boolean;
    brandStripPosition: string;
    brandStripPreset: string;
    brandStripBgColor: string;
    brandStripTextColor: string;
    brandStripText: string;
    brandStripFont: string;
  } | null;
}): BrandingSettings {
  const fromOverride = parseBranding(args.override);
  if (fromOverride) return fromOverride;
  const ps = args.projectSettings;
  if (!ps) return DEFAULT_BRANDING;
  return {
    enabled: ps.brandStripEnabled,
    position: (ps.brandStripPosition === "top" ? "top" : "bottom") as BrandStripPosition,
    text: ps.brandStripText ?? "",
    bgColor: ps.brandStripBgColor ?? "#000000",
    textColor: ps.brandStripTextColor ?? "#FFFFFF",
    font: ps.brandStripFont ?? "Inter",
    opacity: DEFAULT_BRANDING.opacity,
    height: DEFAULT_BRANDING.height,
    preset: ps.brandStripPreset ?? null,
  };
}

export function resolveWatermark(args: {
  override: string | null;
  projectSettings: {
    watermarkEnabled: boolean;
    watermarkPath: string | null;
    watermarkPosition: string;
    watermarkOpacity: number;
    watermarkSize: string;
  } | null;
}): WatermarkSettings {
  const fromOverride = parseWatermark(args.override);
  if (fromOverride) return fromOverride;
  const ps = args.projectSettings;
  if (!ps) return DEFAULT_WATERMARK;
  const position: WatermarkPosition = (
    [
      "top-left",
      "top-middle",
      "top-right",
      "bottom-left",
      "bottom-middle",
      "bottom-right",
    ] as const
  ).includes(ps.watermarkPosition as WatermarkPosition)
    ? (ps.watermarkPosition as WatermarkPosition)
    : "bottom-right";
  const size: WatermarkSize = (["small", "medium", "large"] as const).includes(
    ps.watermarkSize as WatermarkSize,
  )
    ? (ps.watermarkSize as WatermarkSize)
    : "medium";
  return {
    enabled: ps.watermarkEnabled,
    path: ps.watermarkPath ?? null,
    position,
    opacity: ps.watermarkOpacity ?? 0.7,
    size,
  };
}

export function stringifyBranding(branding: BrandingSettings): string {
  return JSON.stringify(branding);
}

export function stringifyWatermark(watermark: WatermarkSettings): string {
  return JSON.stringify(watermark);
}
