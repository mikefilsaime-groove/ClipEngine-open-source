"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  Trophy,
  Image,
  Wand2,
  Youtube,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getYouTubeSuggestions,
  regenerateYouTubeSuggestions,
  type YouTubeSuggestions,
} from "@/actions/youtube-actions";

interface YouTubeSuggestionsCardProps {
  candidateId: string;
  candidateTitle: string;
}

export function YouTubeSuggestionsCard({
  candidateId,
  candidateTitle,
}: YouTubeSuggestionsCardProps) {
  const [suggestions, setSuggestions] = useState<YouTubeSuggestions | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Auto-fetch on mount — suggestions should already exist from the render pipeline
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await getYouTubeSuggestions(candidateId);
        if (!cancelled) {
          setSuggestions(result);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [candidateId]);

  async function handleRegenerate() {
    setRegenerating(true);
    setError(null);
    try {
      const result = await regenerateYouTubeSuggestions(candidateId);
      if (result) setSuggestions(result);
      else setError("Failed to regenerate. Check your Gemini API key.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Regeneration failed");
    } finally {
      setRegenerating(false);
    }
  }

  function copyToClipboard(text: string, fieldId: string) {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  }

  function CopyBtn({ text, fieldId }: { text: string; fieldId: string }) {
    const copied = copiedField === fieldId;
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 shrink-0"
        onClick={() => copyToClipboard(text, fieldId)}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-primary" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </Button>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading YouTube suggestions...
      </div>
    );
  }

  // No suggestions yet (old render before this feature) — offer manual generation
  if (!suggestions && !loading) {
    return (
      <button
        type="button"
        onClick={handleRegenerate}
        disabled={regenerating}
        className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 w-full text-left transition-colors hover:border-primary/40 hover:bg-primary/5 group"
      >
        {regenerating ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
        ) : (
          <Youtube className="h-4 w-4 text-red-500 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium group-hover:text-primary transition-colors">
            {regenerating ? "Generating..." : "Generate YouTube Titles & Thumbnail"}
          </span>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            This was rendered before auto-generation was added. Click to generate now.
          </p>
        </div>
        {!regenerating && (
          <Sparkles className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
        )}
      </button>
    );
  }

  if (!suggestions) return null;

  return (
    <Card className="border-red-500/20 bg-gradient-to-br from-red-500/[0.02] to-background">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Youtube className="h-4 w-4 text-red-500" />
            YouTube Optimization
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={handleRegenerate}
            disabled={regenerating}
            title="Regenerate suggestions"
          >
            {regenerating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
            {error}
          </div>
        )}

        {/* Ranked Titles */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <TrendingUp className="h-3.5 w-3.5" />
            Suggested Titles (ranked by predicted CTR)
          </div>
          <div className="space-y-1.5">
            {suggestions.titles.map((t, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-start gap-2 rounded-md border p-2.5 transition-colors",
                  i === 0
                    ? "border-primary/30 bg-primary/5"
                    : "border-border bg-background",
                )}
              >
                <div
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                    i === 0
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {i === 0 ? <Trophy className="h-3 w-3" /> : i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-snug">{t.title}</p>
                  {t.emotionalPolarity && (
                    <p className="text-[10px] text-primary/70 font-medium mt-0.5">
                      {t.emotionalPolarity}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {t.rationale}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <ViralityPill score={t.viralityScore} />
                  <CopyBtn text={t.title} fieldId={`title-${i}`} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Caption Hook — shorts only */}
        {suggestions.captionHook && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Youtube className="h-3.5 w-3.5" />
                Caption Hook
              </div>
              <CopyBtn text={suggestions.captionHook} fieldId="caption-hook" />
            </div>
            <div className="rounded-md border bg-background p-3">
              <p className="text-sm font-bold text-foreground">{suggestions.captionHook}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                First words on screen before the viewer unmutes — this is the Short&apos;s thumbnail.
              </p>
            </div>
          </div>
        )}

        {/* Thumbnail Layout — clips only */}
        {suggestions.thumbnailLayout && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Image className="h-3.5 w-3.5" />
              Thumbnail Layout
            </div>
            <div className="rounded-md border bg-background p-3 space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                    Layout
                  </span>
                  <CopyBtn
                    text={suggestions.thumbnailLayout.description}
                    fieldId="thumb-layout"
                  />
                </div>
                <p className="text-sm text-foreground mt-1 leading-relaxed">
                  {suggestions.thumbnailLayout.description}
                </p>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                    Text overlay
                  </span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-sm font-bold text-foreground bg-primary/10 px-2 py-0.5 rounded">
                      {suggestions.thumbnailLayout.textOverlay}
                    </span>
                    <CopyBtn
                      text={suggestions.thumbnailLayout.textOverlay}
                      fieldId="thumb-text"
                    />
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                    Style
                  </span>
                  <p className="text-xs text-foreground mt-1">
                    {suggestions.thumbnailLayout.style}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI Thumbnail Prompt — clips only */}
        {suggestions.aiThumbnailPrompt && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Wand2 className="h-3.5 w-3.5" />
              AI Thumbnail Prompt
            </div>
            <CopyBtn
              text={suggestions.aiThumbnailPrompt}
              fieldId="ai-prompt"
            />
          </div>
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground font-mono leading-relaxed whitespace-pre-wrap">
              {suggestions.aiThumbnailPrompt}
            </p>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Paste this prompt into any AI image generator to create your
            thumbnail.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <a
              href="https://imager.gg"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[10px] font-medium text-primary hover:underline bg-primary/5 border border-primary/20 rounded-full px-2.5 py-1"
            >
              <Wand2 className="h-3 w-3" />
              Create with Imager.gg
            </a>
            <a
              href="https://creatorstudio.gg"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[10px] font-medium text-primary hover:underline bg-primary/5 border border-primary/20 rounded-full px-2.5 py-1"
            >
              <Image className="h-3 w-3" />
              Thumbnail Studio at CreatorStudio.gg
            </a>
          </div>
        </div>
        )}
      </CardContent>
    </Card>
  );
}

function ViralityPill({ score }: { score: number }) {
  const color =
    score >= 80
      ? "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20"
      : score >= 60
        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
        : "bg-muted text-muted-foreground border-border";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full border",
        color,
      )}
    >
      {score}%
    </span>
  );
}
