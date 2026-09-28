"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Film, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VideoPathSetupProps {
  projectId: string;
  projectName: string;
}

export function VideoPathSetup({ projectId, projectName }: VideoPathSetupProps) {
  const router = useRouter();
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState("");

  async function handlePickFile() {
    setPicking(true);
    setError("");

    try {
      const res = await fetch("/api/video/pick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });

      const data = await res.json();

      if (data.cancelled) {
        setPicking(false);
        return;
      }

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to select file");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to select file");
      setPicking(false);
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
    if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
    return `${(bytes / 1e3).toFixed(0)} KB`;
  };

  return (
    <div className="max-w-xl mx-auto mt-8">
      <Card
        className="border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/30 transition-all cursor-pointer"
        onClick={handlePickFile}
      >
        <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="flex size-16 items-center justify-center rounded-full bg-muted transition-colors">
            {picking ? (
              <Film className="size-8 text-primary animate-pulse" />
            ) : (
              <FolderOpen className="size-8 text-muted-foreground" />
            )}
          </div>
          <div className="text-center">
            <p className="text-lg font-medium">
              {picking ? "Choose a file from the dialog..." : "Select a video file"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {picking
                ? "A file picker should have opened — select your video"
                : "Click to open the native file picker"}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Supported: .mp4, .mov, .mkv, .avi, .webm, .m4v
          </p>
        </CardContent>
      </Card>

      {error && (
        <p className="text-sm text-destructive mt-4 text-center">{error}</p>
      )}
    </div>
  );
}
