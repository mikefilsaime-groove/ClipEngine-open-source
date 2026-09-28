"use client";

import { useEffect, useState } from "react";
import { Info, X } from "lucide-react";

interface PreviewQualityBannerProps {
  projectId: string;
}

const STORAGE_KEY_PREFIX = "clipengine:preview-banner-dismissed:";

export function PreviewQualityBanner({ projectId }: PreviewQualityBannerProps) {
  // Start hidden to avoid hydration mismatch — localStorage isn't available
  // on the server. Reveal after mount once we know the dismissal state.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(`${STORAGE_KEY_PREFIX}${projectId}`);
      if (!dismissed) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, [projectId]);

  const dismiss = () => {
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${projectId}`, "1");
    } catch {
      // localStorage can throw in private-mode — ignore
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
      <div className="flex items-start gap-3">
        <Info className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0 text-sm">
          <p className="font-medium text-foreground">
            Previews are 240p for speed.
          </p>
          <p className="text-muted-foreground mt-0.5">
            These review videos are rendered at low quality so you can scrub
            through them instantly. Your final exports will use the quality
            set in{" "}
            <span className="font-medium text-foreground">Settings</span>{" "}
            (720p, 1080p, or 4K) and include captions and bumpers.
          </p>
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
