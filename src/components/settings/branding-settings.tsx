"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { BRAND_STRIP_PRESETS } from "@/lib/constants";
import type { BrandingSettings as BrandingType, BrandStripHeight } from "@/lib/branding";
import { DEFAULT_BRANDING, BRAND_FONTS, BRAND_HEIGHT_PCT } from "@/lib/branding";
import { cn } from "@/lib/utils";
import { AlertTriangle, ArrowDown, ArrowUp } from "lucide-react";

interface BrandingSettingsProps {
  value: BrandingType;
  onChange: (next: BrandingType) => void;
}

function getContrastRatio(hex1: string, hex2: string): number {
  const lum = (hex: string) => {
    const rgb = hex
      .replace("#", "")
      .match(/.{2}/g)
      ?.map((c) => {
        const v = parseInt(c, 16) / 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      }) ?? [0, 0, 0];
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  };
  const l1 = lum(hex1);
  const l2 = lum(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const HEIGHT_OPTIONS: Array<{ id: BrandStripHeight; label: string; desc: string }> = [
  { id: "thin", label: "Thin", desc: "5%" },
  { id: "medium", label: "Medium", desc: "8%" },
  { id: "thick", label: "Thick", desc: "12%" },
];

export function BrandingSettings({ value, onChange }: BrandingSettingsProps) {
  const update = (patch: Partial<BrandingType>) => {
    onChange({ ...value, ...patch });
  };

  const applyPreset = (presetId: string) => {
    const preset = BRAND_STRIP_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    update({
      preset: preset.id,
      bgColor: preset.bgColor,
      textColor: preset.textColor,
    });
  };

  const contrast = getContrastRatio(value.bgColor, value.textColor);
  const lowContrast = contrast < 4.5;
  const stripHeight = BRAND_HEIGHT_PCT[value.height ?? "medium"] ?? 0.08;

  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        {/* Enable toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base">Enable Brand Strip</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              A colored banner with your text overlaid on every rendered
              clip and short.
            </p>
          </div>
          <Switch
            checked={value.enabled}
            onCheckedChange={(enabled) =>
              update({
                enabled,
                ...(enabled && !value.text
                  ? { text: DEFAULT_BRANDING.text }
                  : {}),
              })
            }
          />
        </div>

        {value.enabled && (
          <>
            {/* Presets as mini preview strips */}
            <div className="space-y-2">
              <Label className="text-sm">Style preset</Label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {BRAND_STRIP_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset.id)}
                    className={cn(
                      "group rounded-lg border-2 overflow-hidden transition-all",
                      value.preset === preset.id
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-border hover:border-primary/40",
                    )}
                  >
                    {/* Mini strip preview */}
                    <div className="aspect-[16/5] relative">
                      <div className="absolute inset-0 bg-muted/60" />
                      <div
                        className="absolute inset-x-0 bottom-0 flex items-center justify-center"
                        style={{
                          backgroundColor: preset.bgColor,
                          color: preset.textColor,
                          height: "35%",
                          borderTop:
                            preset.bgColor === "#FFFFFF"
                              ? "1px solid #e5e5e5"
                              : "none",
                        }}
                      >
                        <span className="text-[7px] font-semibold truncate px-1">
                          Brand
                        </span>
                      </div>
                    </div>
                    <div className="px-1.5 py-1 text-center">
                      <span
                        className={cn(
                          "text-[10px] leading-none",
                          value.preset === preset.id
                            ? "text-primary font-semibold"
                            : "text-muted-foreground group-hover:text-foreground",
                        )}
                      >
                        {preset.name}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Brand text input */}
            <div className="space-y-2">
              <Label htmlFor="brand-text" className="text-sm">
                Brand text
              </Label>
              <Input
                id="brand-text"
                value={value.text}
                onChange={(e) => update({ text: e.target.value })}
                placeholder="Your brand, podcast, or show name"
                className="max-w-md"
              />
            </div>

            {/* Font + Position row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
              {/* Font */}
              <div className="space-y-2">
                <Label htmlFor="brand-font" className="text-sm">
                  Font
                </Label>
                <select
                  id="brand-font"
                  value={value.font}
                  onChange={(e) => update({ font: e.target.value })}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {BRAND_FONTS.map((f) => (
                    <option key={f} value={f} style={{ fontFamily: f }}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              {/* Position */}
              <div className="space-y-2">
                <Label className="text-sm">Position</Label>
                <div className="flex rounded-md border border-input overflow-hidden h-9">
                  <button
                    type="button"
                    onClick={() => update({ position: "top" })}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 text-sm transition-colors",
                      value.position === "top"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                    Top
                  </button>
                  <button
                    type="button"
                    onClick={() => update({ position: "bottom" })}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 text-sm transition-colors",
                      value.position === "bottom"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                    Bottom
                  </button>
                </div>
              </div>
            </div>

            {/* Height */}
            <div className="space-y-2">
              <Label className="text-sm">Strip height</Label>
              <div className="flex gap-2">
                {HEIGHT_OPTIONS.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => update({ height: h.id })}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition-colors",
                      (value.height ?? "medium") === h.id
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-input text-muted-foreground hover:text-foreground hover:bg-accent",
                    )}
                  >
                    {h.label}
                    <span className="text-[10px] opacity-60">{h.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Colors */}
            <div className="grid grid-cols-2 gap-4 max-w-md">
              <ColorField
                label="Background"
                id="brand-bg"
                value={value.bgColor}
                onChange={(bgColor) =>
                  update({ bgColor, preset: "custom" })
                }
              />
              <ColorField
                label="Text"
                id="brand-text-color"
                value={value.textColor}
                onChange={(textColor) =>
                  update({ textColor, preset: "custom" })
                }
              />
            </div>

            {/* Contrast warning */}
            {lowContrast && (
              <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Low contrast ({contrast.toFixed(1)}:1). Text may be hard to
                  read. WCAG AA requires at least 4.5:1.
                </span>
              </div>
            )}

            {/* Opacity */}
            <div className="space-y-2 max-w-sm">
              <div className="flex items-center justify-between">
                <Label htmlFor="brand-opacity" className="text-sm">
                  Opacity
                </Label>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {Math.round((value.opacity ?? 1) * 100)}%
                </span>
              </div>
              <input
                id="brand-opacity"
                type="range"
                min={0.3}
                max={1}
                step={0.05}
                value={value.opacity ?? 1}
                onChange={(e) =>
                  update({ opacity: parseFloat(e.target.value) })
                }
                className="w-full accent-primary"
              />
              <p className="text-[10px] text-muted-foreground">
                Lower opacity lets the video show through the strip for a subtler look.
              </p>
            </div>

            {/* Live Preview */}
            <div className="space-y-2">
              <Label className="text-sm">Preview</Label>
              <div className="relative rounded-lg overflow-hidden border shadow-sm bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 aspect-video flex items-center justify-center">
                {/* Fake video content */}
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTTAgMjBoNDBNMjAgMHYwIiBmaWxsPSJub25lIiBzdHJva2U9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3QgZmlsbD0idXJsKCNnKSIgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIvPjwvc3ZnPg==')] opacity-50" />
                <div className="relative flex flex-col items-center gap-1 text-white/20">
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12z" />
                  </svg>
                  <span className="text-[10px] tracking-wide uppercase">Video content</span>
                </div>
                {/* The brand strip */}
                <div
                  className="absolute inset-x-0 flex items-center justify-center transition-all duration-300"
                  style={{
                    backgroundColor: value.bgColor,
                    color: value.textColor,
                    opacity: value.opacity ?? 1,
                    height: `${stripHeight * 100}%`,
                    top: value.position === "top" ? 0 : undefined,
                    bottom: value.position === "bottom" ? 0 : undefined,
                    fontFamily: value.font,
                  }}
                >
                  <span
                    className="font-semibold truncate px-4"
                    style={{
                      fontSize: `clamp(10px, ${stripHeight * 55}vw, 18px)`,
                    }}
                  >
                    {value.text || "Your brand here"}
                  </span>
                </div>
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
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm">
        {label} color
      </Label>
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            id={id}
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 w-12 rounded-md border border-input cursor-pointer appearance-none bg-transparent [&::-webkit-color-swatch-wrapper]:p-1 [&::-webkit-color-swatch]:rounded-sm [&::-webkit-color-swatch]:border-0"
          />
        </div>
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
    </div>
  );
}
