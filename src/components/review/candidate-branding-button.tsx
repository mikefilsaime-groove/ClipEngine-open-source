"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Palette, Loader2, Check } from "lucide-react";
import { BrandingSettings as BrandingSettingsUI } from "@/components/settings/branding-settings";
import {
  updateCandidateBranding,
  applyBrandingToAll,
} from "@/actions/branding-actions";
import {
  DEFAULT_BRANDING,
  parseBranding,
  type BrandingSettings,
} from "@/lib/branding";

interface CandidateBrandingButtonProps {
  projectId: string;
  candidateId: string;
  type: "clip" | "short";
  currentOverride: string | null;
  hasOverride: boolean;
}

export function CandidateBrandingButton({
  projectId,
  candidateId,
  type,
  currentOverride,
  hasOverride,
}: CandidateBrandingButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [branding, setBranding] = useState<BrandingSettings>(
    parseBranding(currentOverride) ?? DEFAULT_BRANDING,
  );
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    try {
      await updateCandidateBranding(candidateId, branding);
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
      const result = await applyBrandingToAll(projectId, branding, type);
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
      await updateCandidateBranding(candidateId, null);
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
        <Palette className="size-3 shrink-0" />
        <span className="truncate flex-1 text-left">
          {hasOverride ? "Branding (custom)" : "Branding"}
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Branding override</DialogTitle>
          </DialogHeader>
          <BrandingSettingsUI value={branding} onChange={setBranding} />
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
