"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { WordListEditor } from "./word-list-editor";

interface AudioSettingsValue {
  profanityFilterEnabled: boolean;
  profanityWordList: string;
  fastCutsEnabled: boolean;
  fastCutsThreshold: number;
  fillerRemovalEnabled: boolean;
  fillerWordList: string;
  defaultExportQuality: string;
}

interface AudioSettingsProps {
  value: AudioSettingsValue;
  onChange: (data: Partial<AudioSettingsValue>) => void;
}

const EXPORT_QUALITIES = [
  { value: "720p", label: "720p HD" },
  { value: "1080p", label: "1080p Full HD" },
  { value: "4k", label: "4K Ultra HD" },
] as const;

function Toggle({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onToggle}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        enabled ? "bg-primary" : "bg-input"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-lg ring-0 transition-transform",
          enabled ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}

export function AudioSettings({ value, onChange }: AudioSettingsProps) {
  const profanityWords = (() => {
    try {
      return JSON.parse(value.profanityWordList) as string[];
    } catch {
      return [];
    }
  })();

  const fillerWords = (() => {
    try {
      return JSON.parse(value.fillerWordList) as string[];
    } catch {
      return [];
    }
  })();

  return (
    <div className="space-y-4">
      {/* Profanity filter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Profanity Filter</span>
            <Toggle
              enabled={value.profanityFilterEnabled}
              onToggle={() =>
                onChange({ profanityFilterEnabled: !value.profanityFilterEnabled })
              }
            />
          </CardTitle>
        </CardHeader>
        {value.profanityFilterEnabled && (
          <CardContent>
            <WordListEditor
              label="Blocked words"
              words={profanityWords}
              onChange={(words) =>
                onChange({ profanityWordList: JSON.stringify(words) })
              }
            />
          </CardContent>
        )}
      </Card>

      {/* Fast cuts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Fast Cuts</span>
            <Toggle
              enabled={value.fastCutsEnabled}
              onToggle={() => onChange({ fastCutsEnabled: !value.fastCutsEnabled })}
            />
          </CardTitle>
        </CardHeader>
        {value.fastCutsEnabled && (
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="fast-cuts-threshold">
                Minimum cut threshold (seconds)
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id="fast-cuts-threshold"
                  type="number"
                  min={0.5}
                  max={5.0}
                  step={0.1}
                  value={value.fastCutsThreshold}
                  onChange={(e) =>
                    onChange({ fastCutsThreshold: parseFloat(e.target.value) })
                  }
                  className="w-28"
                />
                <span className="text-sm text-muted-foreground">
                  Segments shorter than this will be considered fast cuts
                </span>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Filler removal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Filler Word Removal</span>
            <Toggle
              enabled={value.fillerRemovalEnabled}
              onToggle={() =>
                onChange({ fillerRemovalEnabled: !value.fillerRemovalEnabled })
              }
            />
          </CardTitle>
        </CardHeader>
        {value.fillerRemovalEnabled && (
          <CardContent>
            <WordListEditor
              label="Filler words to remove"
              words={fillerWords}
              onChange={(words) =>
                onChange({ fillerWordList: JSON.stringify(words) })
              }
            />
          </CardContent>
        )}
      </Card>

      {/* Export quality */}
      <Card>
        <CardHeader>
          <CardTitle>Default Export Quality</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <Label htmlFor="export-quality">Quality</Label>
            <select
              id="export-quality"
              value={value.defaultExportQuality}
              onChange={(e) => onChange({ defaultExportQuality: e.target.value })}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {EXPORT_QUALITIES.map((q) => (
                <option key={q.value} value={q.value}>
                  {q.label}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
