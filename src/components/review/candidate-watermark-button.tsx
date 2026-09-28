"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Droplet, Loader2, Check } from "lucide-react";
import { WatermarkSettings as WatermarkSettingsUI } from "@/components/settings/watermark-settings";
import {
  updateCandidateWatermark,
  applyWatermarkToAll,
} from "@/actions/branding-actions";
import {
  DEFAULT_WATERMARK,
  parseWatermark,
  type WatermarkSettings,
} from "@/lib/branding";

interface CandidateWatermarkButtonProps {
  projectId: string;
  candidateId: string;
  type: "clip" | "short";
  currentOverride: string | null;
  hasOverride: boolean;
}

export function CandidateWatermarkButton({
  projectId,
  candidateId,
  type,
  currentOverride,
  hasOverride,
}: CandidateWatermarkButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [watermark, setWatermark] = useState<WatermarkSettings>(
    parseWatermark(currentOverride) ?? DEFAULT_WATERMARK,
  );
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    try {
      await updateCandidateWatermark(candidateId, watermark);
      setStatusMsg("Saved");
      window.setTimeout(() => {
        setOpen(false);
        setStatusMsg(null);
        router.refresh();
      }, 800);
    } finally {
      setSaving(false);
    }
  }

  async function handleApplyToAll() {
    setSaving(true);
    try {
      const result = await applyWatermarkToAll(projectId, watermark, type);
      setStatusMsg(`Applied to ${result.updated} ${type}${result.updated === 1 ? "" : "s"}`);
      window.setTimeout(() => {
        setOpen(false);
        setStatusMsg(null);
        router.refresh();
      }, 1200);
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setSaving(true);
    try {
      await updateCandidateWatermark(candidateId, null);
      setStatusMsg("Reset to project default");
      window.setTimeout(() => {
        setOpen(false);
        setStatusMsg(null);
        router.refresh();
      }, 800);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border transition-colors w-full ${
          hasOverride
            ? "border-primary/30 bg-primary/5 text-foreground"
            : "border-input bg-background text-muted-foreground hover:text-foreground"
        }`}
      >
        <Droplet className="size-3 shrink-0" />
        <span className="truncate flex-1 text-left">
          {hasOverride ? "Watermark (custom)" : "Watermark"}
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Watermark override</DialogTitle>
          </DialogHeader>
          <WatermarkSettingsUI
            projectId={projectId}
            value={watermark}
            onChange={setWatermark}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={saving}
            >
              Reset to project default
            </Button>
            <div className="flex items-center gap-2">
              {statusMsg && (
                <span className="text-xs text-green-500 flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  {statusMsg}
                </span>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleApplyToAll}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : null}
                Apply to all {type}s
              </Button>
              <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : null}
                Save for this {type}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
