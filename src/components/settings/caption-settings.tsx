"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CAPTION_PRESETS, CAPTION_FONTS } from "@/lib/constants";
import { useEffect, useState } from "react";

interface CaptionSettingsValue {
  captionsEnabled: boolean;
  captionPreset: string;
  captionPosition: string;
  captionSize: string;
  captionFont: string;
  captionColor: string;
  captionActiveWordColor: string;
  captionStressWordColor: string;
}

interface CaptionSettingsProps {
  value: CaptionSettingsValue;
  onChange: (data: Partial<CaptionSettingsValue>) => void;
}

const POSITIONS = [
  { id: "auto", label: "Auto", desc: "Bottom (default)" },
  { id: "top", label: "Top", desc: "Upper third" },
  { id: "middle", label: "Middle", desc: "Center" },
  { id: "bottom", label: "Bottom", desc: "Lower third" },
] as const;

const SIZES = [
  { id: "small", label: "Small", px: "32px" },
  { id: "medium", label: "Medium", px: "48px" },
  { id: "large", label: "Large", px: "64px" },
] as const;

// Animated preview words
const PREVIEW_WORDS = ["Every", "great", "story", "starts", "with", "a", "bold", "hook"];

export function CaptionSettings({ value, onChange }: CaptionSettingsProps) {
  const preset = CAPTION_PRESETS.find((p) => p.id === value.captionPreset);
  const [activeWordIdx, setActiveWordIdx] = useState(0);

  // Animate the active word highlight
  useEffect(() => {
    if (!value.captionsEnabled || !preset?.style.animateActiveWord) return;
    const timer = setInterval(() => {
      setActiveWordIdx((prev) => (prev + 1) % PREVIEW_WORDS.length);
    }, 400);
    return () => clearInterval(timer);
  }, [value.captionsEnabled, preset?.style.animateActiveWord]);

  const positionYClass =
    value.captionPosition === "top"
      ? "top-3"
      : value.captionPosition === "middle"
        ? "top-1/2 -translate-y-1/2"
        : "bottom-3";

  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        {/* Enable toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base">Enable Captions</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Animated word-level subtitles overlaid on every rendered clip and
              short. Powered by whisper transcription.
            </p>
          </div>
          <Switch
            checked={value.captionsEnabled}
            onCheckedChange={(enabled) => onChange({ captionsEnabled: enabled })}
          />
        </div>

        {value.captionsEnabled && (
          <>
            {/* Live preview */}
            <div className="space-y-2">
              <Label className="text-sm">Preview</Label>
              <div className="relative rounded-lg overflow-hidden border shadow-sm bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 aspect-video">
                {/* Grid overlay */}
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTTAgMjBoNDBNMjAgMHYwIiBmaWxsPSJub25lIiBzdHJva2U9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3QgZmlsbD0idXJsKCNnKSIgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIvPjwvc3ZnPg==')] opacity-50" />
                {/* Play icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-white/10">
                    <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12z" />
                    </svg>
                  </div>
                </div>
                {/* Caption text */}
                <div
                  className={cn(
                    "absolute inset-x-0 flex justify-center px-4 transition-all duration-300",
                    positionYClass,
                  )}
                >
                  <div
                    className={cn(
                      "inline-flex flex-wrap justify-center gap-x-1.5 gap-y-0.5 px-3 py-1.5 rounded",
                      preset?.style.backgroundBar && "bg-black/60",
                    )}
                    style={{ fontFamily: value.captionFont }}
                  >
                    {PREVIEW_WORDS.map((word, i) => {
                      const isActive = preset?.style.animateActiveWord && i === activeWordIdx;
                      const isStress = preset?.style.highlightKeywords && (word === "bold" || word === "hook");
                      const fontSize =
                        value.captionSize === "large" ? "text-lg" :
                        value.captionSize === "small" ? "text-xs" : "text-sm";

                      return (
                        <span
                          key={i}
                          className={cn(
                            "transition-all duration-150",
                            fontSize,
                            preset?.style.fontWeight === "bold" && "font-bold",
                            preset?.style.textTransform === "uppercase" && "uppercase",
                            preset?.style.outline &&
                              "[text-shadow:_-1px_-1px_0_#000,_1px_-1px_0_#000,_-1px_1px_0_#000,_1px_1px_0_#000,_0_2px_4px_rgba(0,0,0,0.5)]",
                            isActive && "scale-110",
                          )}
                          style={{
                            color: isActive
                              ? value.captionActiveWordColor
                              : isStress
                                ? value.captionStressWordColor
                                : value.captionColor,
                          }}
                        >
                          {word}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Preset selection — visual cards */}
            <div className="space-y-2">
              <Label className="text-sm">Style preset</Label>
              <div className="grid grid-cols-2 gap-3">
                {CAPTION_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onChange({ captionPreset: p.id })}
                    className={cn(
                      "rounded-lg border-2 overflow-hidden text-left transition-all",
                      value.captionPreset === p.id
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-border hover:border-primary/40",
                    )}
                  >
                    {/* Mini preview */}
                    <div className="relative bg-gradient-to-r from-slate-800 to-slate-700 px-3 py-3 flex items-end justify-center min-h-[48px]">
                      <span
                        className={cn(
                          "text-[11px] leading-tight",
                          p.style.fontWeight === "bold" && "font-bold",
                          p.style.textTransform === "uppercase" && "uppercase",
                          p.style.outline &&
                            "[text-shadow:_-1px_-1px_0_#000,_1px_-1px_0_#000,_-1px_1px_0_#000,_1px_1px_0_#000]",
                          p.style.backgroundBar && "bg-black/60 px-2 py-0.5 rounded",
                        )}
                        style={{ color: value.captionColor }}
                      >
                        Sample{" "}
                        <span
                          style={{
                            color: p.style.animateActiveWord
                              ? value.captionActiveWordColor
                              : value.captionColor,
                          }}
                        >
                          caption
                        </span>{" "}
                        {p.style.highlightKeywords ? (
                          <span style={{ color: value.captionStressWordColor }}>text</span>
                        ) : (
                          "text"
                        )}
                      </span>
                    </div>
                    <div className="px-3 py-2">
                      <div
                        className={cn(
                          "text-xs font-medium",
                          value.captionPreset === p.id
                            ? "text-primary"
                            : "text-foreground",
                        )}
                      >
                        {p.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                        {p.description}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Position — visual mini-screen picker */}
            <div className="space-y-2">
              <Label className="text-sm">Position</Label>
              <div className="grid grid-cols-4 gap-2">
                {POSITIONS.map((pos) => (
                  <button
                    key={pos.id}
                    type="button"
                    onClick={() => onChange({ captionPosition: pos.id })}
                    className={cn(
                      "rounded-lg border-2 overflow-hidden transition-all",
                      value.captionPosition === pos.id
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-border hover:border-primary/40",
                    )}
                  >
                    {/* Mini screen showing position */}
                    <div className="relative bg-muted/30 aspect-[16/10]">
                      <div
                        className={cn(
                          "absolute inset-x-2 h-1 rounded-full bg-primary",
                          pos.id === "top" && "top-1.5",
                          pos.id === "middle" && "top-1/2 -translate-y-1/2",
                          (pos.id === "bottom" || pos.id === "auto") && "bottom-1.5",
                        )}
                      />
                    </div>
                    <div className="px-1.5 py-1 text-center">
                      <span
                        className={cn(
                          "text-[10px]",
                          value.captionPosition === pos.id
                            ? "text-primary font-semibold"
                            : "text-muted-foreground",
                        )}
                      >
                        {pos.label}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Size + Font row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Size */}
              <div className="space-y-2">
                <Label className="text-sm">Size</Label>
                <div className="flex gap-2">
                  {SIZES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onChange({ captionSize: s.id })}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition-colors",
                        value.captionSize === s.id
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-input text-muted-foreground hover:text-foreground hover:bg-accent",
                      )}
                    >
                      {s.label}
                      <span className="text-[10px] opacity-60">{s.px}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Font */}
              <div className="space-y-2">
                <Label htmlFor="caption-font" className="text-sm">
                  Font
                </Label>
                <select
                  id="caption-font"
                  value={value.captionFont}
                  onChange={(e) => onChange({ captionFont: e.target.value })}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {CAPTION_FONTS.map((font) => (
                    <option key={font} value={font} style={{ fontFamily: font }}>
                      {font}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Colors */}
            <div className="space-y-3">
              <Label className="text-sm">Colors</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <ColorField
                  label="Text"
                  id="caption-color"
                  value={value.captionColor}
                  onChange={(v) => onChange({ captionColor: v })}
                  hint="Default color for all caption words"
                />
                <ColorField
                  label="Active Word"
                  id="caption-active-color"
                  value={value.captionActiveWordColor}
                  onChange={(v) => onChange({ captionActiveWordColor: v })}
                  hint="The word currently being spoken — highlights in real-time as the speaker talks"
                />
                <ColorField
                  label="Stress Word"
                  id="caption-stress-color"
                  value={value.captionStressWordColor}
                  onChange={(v) => onChange({ captionStressWordColor: v })}
                  hint="Keywords and emphasized words — permanently highlighted for impact"
                />
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ColorField({
  label,
  id,
  value,
  onChange,
  hint,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  hint: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-foreground" htmlFor={id}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 rounded-md border border-input cursor-pointer appearance-none bg-transparent [&::-webkit-color-swatch-wrapper]:p-1 [&::-webkit-color-swatch]:rounded-sm [&::-webkit-color-swatch]:border-0"
        />
        <Input
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v);
          }}
          className="font-mono text-xs w-24"
          maxLength={7}
        />
      </div>
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        {hint}
      </p>
    </div>
  );
}
