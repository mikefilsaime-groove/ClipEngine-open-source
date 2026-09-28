"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ViralityBadge } from "./virality-badge";
import { VideoPreview } from "./video-preview";
import { updateCandidateStatus } from "@/actions/candidate-actions";
import { cn } from "@/lib/utils";
import { Pencil, ThumbsUp, Trash2, Zap, Clock, Share2, Globe } from "lucide-react";
import { BumperSelector } from "./bumper-selector";
import { CandidateBrandingButton } from "./candidate-branding-button";
import { CandidateWatermarkButton } from "./candidate-watermark-button";
import { EditorDialog } from "@/components/editor/editor-dialog";

interface Candidate {
  id: string;
  title: string;
  viralityScore: number;
  duration?: number | null;
  status: string;
  previewPath?: string | null;
  reasoning?: string | null;
  frontBumperId?: string | null;
  rearBumperId?: string | null;
  frontBumper?: { id: string; name: string } | null;
  rearBumper?: { id: string; name: string } | null;
  multiSpeaker?: boolean;
  speakerLayout?: string | null;
  brandingOverride?: string | null;
  watermarkOverride?: string | null;
  tags?: string | null;
  grade?: string | null;
  recommendation?: string | null;
  hookStrength?: number | null;
  completionPull?: number | null;
  platformPlay?: string | null;
  shareTrigger?: string | null;
}

interface CandidateCardProps {
  candidate: Candidate;
  type?: "clip" | "short";
  sourceVideoPath: string;
  projectId: string;
}

export function CandidateCard({ candidate, type = "clip", sourceVideoPath, projectId }: CandidateCardProps) {
  const router = useRouter();
  const [status, setStatus] = useState(candidate.status);
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);

  const handleApprove = async () => {
    if (loading) return;
    const next = status === "approved" ? "candidate" : "approved";
    setLoading(true);
    setStatus(next);
    try {
      await updateCandidateStatus(candidate.id, next);
    } catch {
      setStatus(status);
    } finally {
      setLoading(false);
    }
  };

  const handleDiscard = async () => {
    if (loading) return;
    const next = status === "discarded" ? "candidate" : "discarded";
    setLoading(true);
    setStatus(next);
    try {
      await updateCandidateStatus(candidate.id, next);
    } catch {
      setStatus(status);
    } finally {
      setLoading(false);
    }
  };

  const durationLabel = candidate.duration
    ? `${Math.floor(candidate.duration / 60)}m ${Math.round(candidate.duration % 60)}s`
    : null;

  const parsedTags: string[] = (() => {
    if (!candidate.tags) return [];
    try { return JSON.parse(candidate.tags); } catch { return []; }
  })();

  return (
    <Card
      className={cn(
        "transition-opacity",
        status === "approved" && "border-green-500 border-2",
        status === "discarded" && "opacity-50",
      )}
    >
      <CardHeader className="pb-2 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base leading-snug">{candidate.title}</CardTitle>
              {candidate.grade && <GradeBadge grade={candidate.grade} />}
            </div>
            {candidate.recommendation && (
              <RecommendationLabel recommendation={candidate.recommendation} />
            )}
          </div>
          <ViralityBadge score={candidate.viralityScore} />
        </div>
        {durationLabel && (
          <p className="text-xs text-muted-foreground">{durationLabel}</p>
        )}
        {parsedTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {parsedTags.map((tag) => (
              <ContentTag key={tag} tag={tag} />
            ))}
          </div>
        )}
        {/* Hook Strength + Completion Pull mini-bars */}
        {(candidate.hookStrength != null || candidate.completionPull != null) && (
          <div className="flex gap-3 pt-1">
            {candidate.hookStrength != null && (
              <ScoreMiniBar
                icon={<Zap className="h-3 w-3" />}
                label="Hook"
                score={candidate.hookStrength}
              />
            )}
            {candidate.completionPull != null && (
              <ScoreMiniBar
                icon={<Clock className="h-3 w-3" />}
                label="Completion"
                score={candidate.completionPull}
              />
            )}
          </div>
        )}

        {/* Platform play + share trigger */}
        {candidate.platformPlay && (
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Globe className="h-3 w-3 shrink-0" />
            {candidate.platformPlay}
          </p>
        )}
        {candidate.shareTrigger && (
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Share2 className="h-3 w-3 shrink-0" />
            {candidate.shareTrigger}
          </p>
        )}

        {candidate.reasoning && (
          <p className="text-sm text-muted-foreground leading-relaxed pt-1">
            {candidate.reasoning}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {candidate.previewPath && (
          <VideoPreview
            previewPath={candidate.previewPath}
            vertical={type === "short"}
            multiSpeaker={candidate.multiSpeaker ?? false}
            stacked={candidate.speakerLayout === "stacked"}
          />
        )}

        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant={status === "approved" ? "default" : "outline"}
            onClick={handleApprove}
            disabled={loading}
            className={cn(status === "approved" && "bg-green-600 hover:bg-green-700")}
          >
            <ThumbsUp className="h-4 w-4 mr-1" />
            {status === "approved" ? "Approved" : "Approve"}
          </Button>
          <Button
            size="sm"
            variant={status === "discarded" ? "destructive" : "outline"}
            onClick={handleDiscard}
            disabled={loading}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            {status === "discarded" ? "Discarded" : "Discard"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditorOpen(true)}>
            <Pencil className="h-4 w-4 mr-1" />
            Edit
          </Button>
        </div>

        <EditorDialog
          candidateId={candidate.id}
          sourceVideoPath={sourceVideoPath}
          vertical={type === "short"}
          multiSpeaker={candidate.multiSpeaker ?? false}
          stacked={candidate.speakerLayout === "stacked"}
          open={editorOpen}
          onOpenChange={setEditorOpen}
          onSaved={() => router.refresh()}
        />

        {/* Bumper selectors — clips only */}
        {type === "clip" && (
          <div className="grid grid-cols-2 gap-2">
            <BumperSelector
              projectId={projectId}
              candidateId={candidate.id}
              slot="front"
              currentBumperId={candidate.frontBumperId ?? null}
              currentBumperName={candidate.frontBumper?.name}
            />
            <BumperSelector
              projectId={projectId}
              candidateId={candidate.id}
              slot="rear"
              currentBumperId={candidate.rearBumperId ?? null}
              currentBumperName={candidate.rearBumper?.name}
            />
          </div>
        )}

        {/* Branding + Watermark overrides — both clips and shorts */}
        <div className="grid grid-cols-2 gap-2">
          <CandidateBrandingButton
            projectId={projectId}
            candidateId={candidate.id}
            type={type}
            currentOverride={candidate.brandingOverride ?? null}
            hasOverride={!!candidate.brandingOverride}
          />
          <CandidateWatermarkButton
            projectId={projectId}
            candidateId={candidate.id}
            type={type}
            currentOverride={candidate.watermarkOverride ?? null}
            hasOverride={!!candidate.watermarkOverride}
          />
        </div>

      </CardContent>
    </Card>
  );
}

const GRADE_COLORS: Record<string, string> = {
  "A+": "bg-amber-400/20 text-amber-500 border-amber-400/30",
  "A":  "bg-amber-400/15 text-amber-500 border-amber-400/25",
  "A-": "bg-amber-400/10 text-amber-600 border-amber-400/20",
  "B+": "bg-sky-400/15 text-sky-500 border-sky-400/25",
  "B":  "bg-sky-400/10 text-sky-500 border-sky-400/20",
  "B-": "bg-sky-400/10 text-sky-600 border-sky-400/15",
  "C+": "bg-muted text-muted-foreground border-border",
  "C":  "bg-muted text-muted-foreground border-border",
  "C-": "bg-muted text-muted-foreground border-border",
  "D":  "bg-muted text-muted-foreground border-border",
};

function GradeBadge({ grade }: { grade: string }) {
  const colors = GRADE_COLORS[grade] ?? GRADE_COLORS["D"];
  return (
    <span className={cn(
      "text-[10px] font-bold px-1.5 py-0.5 rounded border leading-none",
      colors,
    )}>
      {grade}
    </span>
  );
}

const REC_COLORS: Record<string, string> = {
  "Must Use": "text-amber-500",
  "Highly Recommended": "text-primary",
  "Recommended": "text-foreground",
  "Worth Considering": "text-muted-foreground",
  "User Choice": "text-muted-foreground",
};

function RecommendationLabel({ recommendation }: { recommendation: string }) {
  const color = REC_COLORS[recommendation] ?? "text-muted-foreground";
  return (
    <span className={cn("text-[10px] font-semibold uppercase tracking-wide", color)}>
      {recommendation}
    </span>
  );
}

const TAG_COLORS: Record<string, string> = {
  "Hot Take": "bg-red-500/10 text-red-500 border-red-500/20",
  "Humor": "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
  "Actionable Advice": "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  "Personal Story": "bg-purple-500/10 text-purple-500 border-purple-500/20",
  "Educational": "bg-blue-500/10 text-blue-500 border-blue-500/20",
  "Quotable One-Liner": "bg-pink-500/10 text-pink-500 border-pink-500/20",
  "Controversial": "bg-red-600/10 text-red-600 dark:text-red-400 border-red-600/20",
  "Newsworthy": "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
  "Behind the Scenes": "bg-orange-500/10 text-orange-500 border-orange-500/20",
  "Data / Stats": "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
  "Vulnerability": "bg-rose-500/10 text-rose-500 border-rose-500/20",
  "Framework / Model": "bg-violet-500/10 text-violet-500 border-violet-500/20",
  "Debate / Tension": "bg-amber-600/10 text-amber-600 dark:text-amber-400 border-amber-600/20",
  "Transformational": "bg-teal-500/10 text-teal-500 border-teal-500/20",
  "Motivational": "bg-lime-500/10 text-lime-600 dark:text-lime-400 border-lime-500/20",
  "Inspirational": "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  "Strategy / Tactic": "bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 border-emerald-600/20",
  "Hidden Gem": "bg-fuchsia-500/10 text-fuchsia-500 border-fuchsia-500/20",
};

function ContentTag({ tag }: { tag: string }) {
  const colors = TAG_COLORS[tag] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span className={cn(
      "text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full border leading-none",
      colors,
    )}>
      {tag}
    </span>
  );
}

function ScoreMiniBar({
  icon,
  label,
  score,
}: {
  icon: React.ReactNode;
  label: string;
  score: number;
}) {
  const color =
    score >= 80
      ? "bg-green-500"
      : score >= 60
        ? "bg-amber-500"
        : "bg-red-400";
  return (
    <div className="flex items-center gap-1.5 flex-1 min-w-0">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className="text-[10px] text-muted-foreground shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-[10px] font-bold tabular-nums text-muted-foreground shrink-0">
        {score}
      </span>
    </div>
  );
}
