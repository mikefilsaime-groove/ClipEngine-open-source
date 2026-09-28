export type ProjectStatus = "importing" | "transcribing" | "diarizing" | "analyzing" | "ready" | "rendering";

export type CandidateType = "clip" | "short";

export type CandidateStatus = "candidate" | "approved" | "discarded" | "rendering" | "rendered" | "failed";

export type CaptionPosition = "auto" | "top" | "middle" | "bottom";

export type CaptionSize = "small" | "medium" | "large";

export type ExportQuality = "720p" | "1080p" | "4k";

export type SpeakerLayout = "single" | "dual";

export type WatermarkPosition = "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";

export interface CaptionPreset {
  id: string;
  name: string;
  description: string;
  style: {
    textTransform: "uppercase" | "none";
    fontWeight: "bold" | "normal";
    outline: boolean;
    backgroundBar: boolean;
    highlightKeywords: boolean;
    animateActiveWord: boolean;
  };
}

export interface TranscriptWord {
  word: string;
  startTime: number;
  endTime: number;
  speaker: string;
  confidence: number;
}

export const CONTENT_TAGS = [
  "Hot Take",
  "Humor",
  "Actionable Advice",
  "Personal Story",
  "Educational",
  "Quotable One-Liner",
  "Controversial",
  "Newsworthy",
  "Behind the Scenes",
  "Data / Stats",
  "Vulnerability",
  "Framework / Model",
  "Debate / Tension",
  "Transformational",
  "Motivational",
  "Inspirational",
  "Strategy / Tactic",
  "Hidden Gem",
] as const;

export type ContentTag = (typeof CONTENT_TAGS)[number];

export type GradeLetter =
  | "A+" | "A" | "A-"
  | "B+" | "B" | "B-"
  | "C+" | "C" | "C-"
  | "D";

export type RecommendationTier =
  | "Must Use"
  | "Highly Recommended"
  | "Recommended"
  | "Worth Considering"
  | "User Choice";

export interface AnalysisCandidate {
  type: CandidateType;
  title: string;
  startTime: number;
  endTime: number;
  viralityScore: number;
  hookStrength?: number;
  completionPull?: number;
  platformPlay?: string;
  shareTrigger?: string;
  reasoning: string;
  stressWords?: number[];
  tags?: string[];
  grade?: string;
  recommendation?: string;
}

export interface BrandStripPreset {
  id: string;
  name: string;
  bgColor: string;
  textColor: string;
}
