import type { CaptionPreset, BrandStripPreset } from "@/types";

export const CAPTION_PRESETS: CaptionPreset[] = [
  {
    id: "bold-impact",
    name: "Bold Impact",
    description: "All caps, bold with outline and animated active word — Hormozi style",
    style: {
      textTransform: "uppercase",
      fontWeight: "bold",
      outline: true,
      backgroundBar: false,
      highlightKeywords: false,
      animateActiveWord: true,
    },
  },
  {
    id: "clean-modern",
    name: "Clean Modern",
    description: "Sentence case, normal weight with background bar — no animation",
    style: {
      textTransform: "none",
      fontWeight: "normal",
      outline: false,
      backgroundBar: true,
      highlightKeywords: false,
      animateActiveWord: false,
    },
  },
  {
    id: "pop-color",
    name: "Pop Color",
    description: "Mixed case, bold with outline, highlighted keywords and animated active word — WickedSmart/GaryVee style",
    style: {
      textTransform: "none",
      fontWeight: "bold",
      outline: true,
      backgroundBar: false,
      highlightKeywords: true,
      animateActiveWord: true,
    },
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Sentence case, normal weight with no effects",
    style: {
      textTransform: "none",
      fontWeight: "normal",
      outline: false,
      backgroundBar: false,
      highlightKeywords: false,
      animateActiveWord: false,
    },
  },
];

export const CAPTION_FONTS = ["Inter", "Montserrat", "Oswald", "Space Grotesk"] as const;

export const BRAND_STRIP_PRESETS: BrandStripPreset[] = [
  {
    id: "dark-classic",
    name: "Dark Classic",
    bgColor: "#000000",
    textColor: "#FFFFFF",
  },
  {
    id: "light-clean",
    name: "Light Clean",
    bgColor: "#FFFFFF",
    textColor: "#000000",
  },
  {
    id: "brand-pink",
    name: "Brand Pink",
    bgColor: "#FF1493",
    textColor: "#FFFFFF",
  },
  {
    id: "brand-blue",
    name: "Brand Blue",
    bgColor: "#1E90FF",
    textColor: "#FFFFFF",
  },
  {
    id: "brand-green",
    name: "Brand Green",
    bgColor: "#00C853",
    textColor: "#FFFFFF",
  },
  {
    id: "custom",
    name: "Custom",
    bgColor: "#000000",
    textColor: "#FFFFFF",
  },
];

export const DEFAULT_PROFANITY_WORDS: string[] = [
  "ass",
  "asshole",
  "bastard",
  "bitch",
  "bollocks",
  "bullshit",
  "cock",
  "crap",
  "cunt",
  "damn",
  "dick",
  "dumbass",
  "fuck",
  "fucking",
  "fucker",
  "goddamn",
  "hell",
  "jackass",
  "jerk",
  "motherfucker",
  "piss",
  "prick",
  "pussy",
  "shit",
  "shithead",
  "slut",
  "son of a bitch",
  "twat",
  "whore",
  "wanker",
];

export const DEFAULT_FILLER_WORDS: string[] = [
  "um",
  "uh",
  "you know",
  "like",
  "basically",
  "right",
  "so",
  "I mean",
  "kind of",
  "sort of",
  "actually",
  "literally",
  "honestly",
  "obviously",
];

export const EXPORT_QUALITIES: Record<"720p" | "1080p" | "4k", { width: number; height: number; label: string }> = {
  "720p": { width: 1280, height: 720, label: "720p HD" },
  "1080p": { width: 1920, height: 1080, label: "1080p Full HD" },
  "4k": { width: 3840, height: 2160, label: "4K Ultra HD" },
};

export const PREVIEW_QUALITY = { width: 426, height: 240 };

export const VERTICAL_QUALITY: Record<"720p" | "1080p" | "4k", { width: number; height: number; label: string }> = {
  "720p": { width: 720, height: 1280, label: "720p Vertical" },
  "1080p": { width: 1080, height: 1920, label: "1080p Vertical" },
  "4k": { width: 2160, height: 3840, label: "4K Vertical" },
};

export const SUPPORTED_VIDEO_FORMATS = [".mp4", ".mov", ".mkv", ".avi", ".webm", ".m4v"] as const;
