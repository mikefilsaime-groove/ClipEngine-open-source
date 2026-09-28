"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Sparkles, Loader2, Check, Users, Type, Volume2, Palette, Droplet, Globe } from "lucide-react";
import { CaptionSettings } from "@/components/settings/caption-settings";
import {
  saveGlobalCaptionDefaults,
  saveGlobalBrandingDefaults,
  saveGlobalWatermarkDefaults,
  saveGlobalAudioDefaults,
} from "@/actions/global-defaults-actions";
import { AudioSettings } from "@/components/settings/audio-settings";
import { BrandingSettings as BrandingSettingsUI } from "@/components/settings/branding-settings";
import { WatermarkSettings as WatermarkSettingsUI } from "@/components/settings/watermark-settings";
import {
  updateProjectSettings,
  updateSpeakerLabel,
  suggestSpeakerNames,
  type SpeakerSuggestion,
} from "@/actions/settings-actions";
import {
  updateProjectBrandingDefaults,
  updateProjectWatermarkDefaults,
} from "@/actions/branding-actions";
import type {
  BrandingSettings as BrandingType,
  WatermarkSettings as WatermarkType,
  BrandStripPosition,
  WatermarkPosition,
  WatermarkSize,
} from "@/lib/branding";
import { DEFAULT_BRANDING, DEFAULT_WATERMARK } from "@/lib/branding";
import type { ProjectSettingsModel } from "@/generated/prisma/models/ProjectSettings";
import type { SpeakerModel } from "@/generated/prisma/models/Speaker";
import { cn } from "@/lib/utils";

interface SettingsClientProps {
  projectId: string;
  settings: ProjectSettingsModel;
  speakers: SpeakerModel[];
}

export function SettingsClient({ projectId, settings, speakers }: SettingsClientProps) {
  const [captionValues, setCaptionValues] = useState({
    captionsEnabled: settings.captionsEnabled,
    captionPreset: settings.captionPreset ?? "bold-impact",
    captionPosition: settings.captionPosition ?? "auto",
    captionSize: settings.captionSize ?? "medium",
    captionFont: settings.captionFont ?? "Inter",
    captionColor: settings.captionColor ?? "#ffffff",
    captionActiveWordColor: settings.captionActiveWordColor ?? "#facc15",
    captionStressWordColor: settings.captionStressWordColor ?? "#f97316",
  });

  const [audioValues, setAudioValues] = useState({
    profanityFilterEnabled: settings.profanityFilterEnabled,
    profanityWordList: settings.profanityWordList ?? "[]",
    fastCutsEnabled: settings.fastCutsEnabled,
    fastCutsThreshold: settings.fastCutsThreshold ?? 1.5,
    fillerRemovalEnabled: settings.fillerRemovalEnabled,
    fillerWordList: settings.fillerWordList ?? "[]",
    defaultExportQuality: settings.defaultExportQuality ?? "1080p",
  });

  const [speakerLabels, setSpeakerLabels] = useState<Record<string, string>>(
    Object.fromEntries(speakers.map((s) => [s.speakerId, s.label ?? s.speakerId]))
  );
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<SpeakerSuggestion[]>([]);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  const [branding, setBranding] = useState<BrandingType>({
    ...DEFAULT_BRANDING,
    enabled: settings.brandStripEnabled,
    position: (settings.brandStripPosition === "top"
      ? "top"
      : "bottom") as BrandStripPosition,
    text: settings.brandStripText ?? DEFAULT_BRANDING.text,
    bgColor: settings.brandStripBgColor ?? DEFAULT_BRANDING.bgColor,
    textColor: settings.brandStripTextColor ?? DEFAULT_BRANDING.textColor,
    font: settings.brandStripFont ?? DEFAULT_BRANDING.font,
    preset: settings.brandStripPreset ?? DEFAULT_BRANDING.preset,
  });

  const [watermark, setWatermark] = useState<WatermarkType>({
    ...DEFAULT_WATERMARK,
    enabled: settings.watermarkEnabled,
    path: settings.watermarkPath ?? null,
    position: (settings.watermarkPosition ??
      DEFAULT_WATERMARK.position) as WatermarkPosition,
    opacity: settings.watermarkOpacity ?? DEFAULT_WATERMARK.opacity,
    size: (settings.watermarkSize ?? DEFAULT_WATERMARK.size) as WatermarkSize,
  });

  async function handleCaptionChange(data: Partial<typeof captionValues>) {
    setCaptionValues((prev) => ({ ...prev, ...data }));
    await updateProjectSettings(projectId, data);
  }

  async function handleAudioChange(data: Partial<typeof audioValues>) {
    setAudioValues((prev) => ({ ...prev, ...data }));
    await updateProjectSettings(projectId, data);
  }

  async function handleBrandingChange(next: BrandingType) {
    setBranding(next);
    await updateProjectBrandingDefaults(projectId, next);
  }

  async function handleWatermarkChange(next: WatermarkType) {
    setWatermark(next);
    await updateProjectWatermarkDefaults(projectId, next);
  }

  async function handleSpeakerBlur(speakerId: string) {
    const label = speakerLabels[speakerId] ?? speakerId;
    await updateSpeakerLabel(projectId, speakerId, label);
  }

  async function handleSuggestNames() {
    if (suggesting) return;
    setSuggesting(true);
    setSuggestError(null);
    try {
      const result = await suggestSpeakerNames(projectId);
      if (result.error) {
        setSuggestError(result.error);
        return;
      }
      setSuggestions(result.suggestions);
    } catch (err) {
      setSuggestError(err instanceof Error ? err.message : "Suggestion failed");
    } finally {
      setSuggesting(false);
    }
  }

  async function acceptSuggestion(speakerId: string, name: string) {
    if (!name.trim()) return;
    setSpeakerLabels((prev) => ({ ...prev, [speakerId]: name }));
    await updateSpeakerLabel(projectId, speakerId, name);
    // Remove the accepted suggestion from the visible list
    setSuggestions((prev) => prev.filter((s) => s.speakerId !== speakerId));
  }

  async function acceptAllSuggestions() {
    const withNames = suggestions.filter((s) => s.name.trim().length > 0);
    const nextLabels = { ...speakerLabels };
    for (const s of withNames) {
      nextLabels[s.speakerId] = s.name;
    }
    setSpeakerLabels(nextLabels);
    await Promise.all(
      withNames.map((s) =>
        updateSpeakerLabel(projectId, s.speakerId, s.name),
      ),
    );
    setSuggestions([]);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure captions, audio processing, and export options for this project.
        </p>
      </div>

      <Accordion
        type="multiple"
        defaultValue={[]}
        className="space-y-2"
      >
        {/* Speaker labels */}
        {speakers.length > 0 && (
          <AccordionItem value="speakers" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-2 text-left">
                <Users className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <span className="font-semibold">Speaker Labels</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {speakers.length} speaker{speakers.length > 1 ? "s" : ""} detected
                  </span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <div>
                    <CardTitle>Rename Speakers</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Let Gemini scan the transcript for introductions and
                      direct-address cues to guess each speaker&apos;s name.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSuggestNames}
                    disabled={suggesting}
                  >
                    {suggesting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        Analyzing…
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-1" />
                        Suggest names with AI
                      </>
                    )}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {suggestError && (
                    <p className="text-xs text-red-500">{suggestError}</p>
                  )}

                  {suggestions.length > 0 && (
                    <div className="rounded-md border border-blue-500/30 bg-blue-500/5 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-foreground">
                          AI suggestions — review and apply
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={acceptAllSuggestions}
                          className="h-7 px-2 text-xs"
                        >
                          Apply all
                        </Button>
                      </div>
                      <div className="space-y-1.5">
                        {suggestions.map((s) => (
                          <div
                            key={s.speakerId}
                            className="flex items-start gap-3 text-xs"
                          >
                            <span className="w-24 shrink-0 text-muted-foreground font-mono">
                              {s.speakerId}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    "font-semibold",
                                    s.name ? "text-foreground" : "text-muted-foreground italic",
                                  )}
                                >
                                  {s.name || "(no guess)"}
                                </span>
                                <span
                                  className={cn(
                                    "text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded leading-none",
                                    s.confidence === "high" &&
                                      "bg-green-500/20 text-green-700 dark:text-green-400",
                                    s.confidence === "medium" &&
                                      "bg-amber-500/20 text-amber-700 dark:text-amber-400",
                                    s.confidence === "low" &&
                                      "bg-muted text-muted-foreground",
                                  )}
                                >
                                  {s.confidence}
                                </span>
                              </div>
                              {s.evidence && (
                                <p className="text-muted-foreground mt-0.5 leading-relaxed">
                                  {s.evidence}
                                </p>
                              )}
                            </div>
                            {s.name && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs shrink-0"
                                onClick={() =>
                                  acceptSuggestion(s.speakerId, s.name)
                                }
                              >
                                <Check className="h-3 w-3 mr-1" />
                                Apply
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {speakers.map((speaker) => (
                    <div key={speaker.speakerId} className="flex items-center gap-4">
                      <Label
                        htmlFor={`speaker-${speaker.speakerId}`}
                        className="w-24 shrink-0 text-sm text-muted-foreground"
                      >
                        {speaker.speakerId}
                      </Label>
                      <Input
                        id={`speaker-${speaker.speakerId}`}
                        value={speakerLabels[speaker.speakerId] ?? speaker.speakerId}
                        onChange={(e) =>
                          setSpeakerLabels((prev) => ({
                            ...prev,
                            [speaker.speakerId]: e.target.value,
                          }))
                        }
                        onBlur={() => handleSpeakerBlur(speaker.speakerId)}
                        placeholder={speaker.speakerId}
                        className="max-w-xs"
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Audio */}
        <AccordionItem value="audio" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-2 text-left">
              <Volume2 className="h-4 w-4 text-primary shrink-0" />
              <div>
                <span className="font-semibold">Audio Processing</span>
                <span className="text-xs text-muted-foreground ml-2">
                  Profanity filter, filler removal, fast cuts
                </span>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-3">
            <AudioSettings value={audioValues} onChange={handleAudioChange} />
            <SaveAsDefaultButton
              label="audio settings"
              onSave={() => saveGlobalAudioDefaults(audioValues as unknown as Record<string, unknown>)}
            />
          </AccordionContent>
        </AccordionItem>

        {/* Captions */}
        <AccordionItem value="captions" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-2 text-left">
              <Type className="h-4 w-4 text-primary shrink-0" />
              <div>
                <span className="font-semibold">Captions</span>
                <span className="text-xs text-muted-foreground ml-2">
                  {captionValues.captionsEnabled ? "Enabled" : "Disabled"} · {captionValues.captionPreset}
                </span>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-3">
            <CaptionSettings value={captionValues} onChange={handleCaptionChange} />
            <SaveAsDefaultButton
              label="caption settings"
              onSave={() => saveGlobalCaptionDefaults(captionValues)}
            />
          </AccordionContent>
        </AccordionItem>

        {/* Brand Strip */}
        <AccordionItem value="branding" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-2 text-left">
              <Palette className="h-4 w-4 text-primary shrink-0" />
              <div>
                <span className="font-semibold">Brand Strip</span>
                <span className="text-xs text-muted-foreground ml-2">
                  {branding.enabled ? `Enabled · ${branding.text || "No text"}` : "Disabled"}
                </span>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Default brand strip for every clip and short in this project.
              Individual candidates can override this on their card.
            </p>
            <BrandingSettingsUI value={branding} onChange={handleBrandingChange} />
            <SaveAsDefaultButton
              label="brand strip settings"
              onSave={() => saveGlobalBrandingDefaults(branding as unknown as Record<string, unknown>)}
            />
          </AccordionContent>
        </AccordionItem>

        {/* Watermark */}
        <AccordionItem value="watermark" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-2 text-left">
              <Droplet className="h-4 w-4 text-primary shrink-0" />
              <div>
                <span className="font-semibold">Watermark</span>
                <span className="text-xs text-muted-foreground ml-2">
                  {watermark.enabled ? `Enabled · ${watermark.position}` : "Disabled"}
                </span>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Default watermark image overlaid on every rendered clip and
              short. Individual candidates can override this on their card.
            </p>
            <WatermarkSettingsUI
              projectId={projectId}
              value={watermark}
              onChange={handleWatermarkChange}
            />
            <SaveAsDefaultButton
              label="watermark settings"
              onSave={() => saveGlobalWatermarkDefaults(watermark as unknown as Record<string, unknown>)}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

function SaveAsDefaultButton({
  label,
  onSave,
}: {
  label: string;
  onSave: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleClick() {
    setSaving(true);
    try {
      await onSave();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center justify-between pt-3 border-t border-border">
      <p className="text-xs text-muted-foreground">
        Apply these {label} to all future projects.
      </p>
      <Button
        type="button"
        variant={saved ? "default" : "outline"}
        size="sm"
        onClick={handleClick}
        disabled={saving}
        className={cn(
          "text-xs",
          saved && "bg-primary text-primary-foreground",
        )}
      >
        {saved ? (
          <>
            <Check className="h-3.5 w-3.5 mr-1.5" />
            Saved
          </>
        ) : saving ? (
          <>
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            Saving…
          </>
        ) : (
          "Set as default for new projects"
        )}
      </Button>
    </div>
  );
}
