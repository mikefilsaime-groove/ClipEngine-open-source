"use client";

import { useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, Image as ImageIcon, Trash2 } from "lucide-react";
import type {
  WatermarkSettings as WatermarkType,
  WatermarkPosition,
  WatermarkSize,
} from "@/lib/branding";
import { cn } from "@/lib/utils";

interface WatermarkSettingsProps {
  projectId: string;
  value: WatermarkType;
  onChange: (next: WatermarkType) => void;
}

const POSITION_GRID: Array<{ id: WatermarkPosition; row: number; col: number }> = [
  { id: "top-left", row: 0, col: 0 },
  { id: "top-middle", row: 0, col: 1 },
  { id: "top-right", row: 0, col: 2 },
  { id: "bottom-left", row: 1, col: 0 },
  { id: "bottom-middle", row: 1, col: 1 },
  { id: "bottom-right", row: 1, col: 2 },
];

const SIZES: Array<{ id: WatermarkSize; label: string; pct: string }> = [
  { id: "small", label: "Small", pct: "8%" },
  { id: "medium", label: "Medium", pct: "14%" },
  { id: "large", label: "Large", pct: "20%" },
];

export function WatermarkSettings({
  projectId,
  value,
  onChange,
}: WatermarkSettingsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const update = (patch: Partial<WatermarkType>) => {
    onChange({ ...value, ...patch });
  };

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const res = await fetch("/api/watermark/upload", {
        method: "POST",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "x-file-name": encodeURIComponent(file.name),
          "x-project-id": projectId,
        },
        body: file,
      });
      const json = await res.json();
      if (!res.ok) {
        setUploadError(json.error ?? "Upload failed");
        return;
      }
      update({ path: json.filePath, enabled: true });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      // Reset the input so selecting the same file again fires onChange
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const fileName = value.path ? value.path.split("/").pop() : null;

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        {/* Enable toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base">Enable Watermark</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Overlay a PNG/JPG logo on every rendered clip and short.
            </p>
          </div>
          <Switch
            checked={value.enabled}
            onCheckedChange={(enabled) => update({ enabled })}
            disabled={!value.path}
          />
        </div>

        {/* File picker */}
        <div className="space-y-2">
          <Label className="text-sm">Image</Label>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-1" />
                  {value.path ? "Replace image" : "Upload image"}
                </>
              )}
            </Button>
            {value.path && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ImageIcon className="h-3 w-3" />
                <span className="font-mono truncate max-w-[240px]">
                  {fileName}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => update({ path: null, enabled: false })}
                  className="h-6 px-1 text-xs"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
          {uploadError && (
            <p className="text-xs text-red-500">{uploadError}</p>
          )}
        </div>

        {value.enabled && value.path && (
          <>
            {/* Position 2x3 grid */}
            <div className="space-y-2">
              <Label className="text-sm">Position</Label>
              <div className="inline-grid grid-cols-3 gap-1 p-2 rounded-md border bg-muted/30">
                {POSITION_GRID.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => update({ position: p.id })}
                    className={cn(
                      "h-10 w-16 rounded flex items-center justify-center text-[10px] font-medium border transition-colors",
                      value.position === p.id
                        ? "border-primary bg-primary/20 text-foreground"
                        : "border-input hover:bg-accent text-muted-foreground",
                    )}
                    aria-label={p.id}
                  >
                    <div
                      className={cn(
                        "h-3 w-3 rounded-sm",
                        value.position === p.id
                          ? "bg-primary"
                          : "bg-muted-foreground/40",
                      )}
                    />
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Current: <span className="font-mono">{value.position}</span>
              </p>
            </div>

            {/* Size */}
            <div className="space-y-2">
              <Label className="text-sm">Size</Label>
              <div className="flex gap-2">
                {SIZES.map((s) => (
                  <Button
                    key={s.id}
                    type="button"
                    size="sm"
                    variant={value.size === s.id ? "default" : "outline"}
                    onClick={() => update({ size: s.id })}
                  >
                    {s.label}
                    <span className="ml-1 text-[10px] opacity-70">
                      {s.pct}
                    </span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Opacity */}
            <div className="space-y-2 max-w-sm">
              <div className="flex items-center justify-between">
                <Label htmlFor="wm-opacity" className="text-sm">
                  Opacity
                </Label>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {Math.round(value.opacity * 100)}%
                </span>
              </div>
              <input
                id="wm-opacity"
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={value.opacity}
                onChange={(e) =>
                  update({ opacity: parseFloat(e.target.value) })
                }
                className="w-full accent-primary"
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
