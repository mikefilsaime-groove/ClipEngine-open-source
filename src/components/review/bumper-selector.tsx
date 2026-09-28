"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  getBumpersForSlot,
  assignBumperToCandidate,
  applyBumperToAllClips,
} from "@/actions/bumper-actions";
import { Film, ChevronDown, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type BumperOption = {
  id: string;
  name: string;
  duration: number | null;
  isDefaultFront: boolean;
  isDefaultRear: boolean;
};

interface BumperSelectorProps {
  projectId: string;
  candidateId: string;
  slot: "front" | "rear";
  currentBumperId: string | null;
  currentBumperName?: string | null;
}

export function BumperSelector({
  projectId,
  candidateId,
  slot,
  currentBumperId,
  currentBumperName,
}: BumperSelectorProps) {
  const router = useRouter();
  const [bumpers, setBumpers] = useState<BumperOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(currentBumperId);
  const [selectedName, setSelectedName] = useState<string | null>(
    currentBumperName ?? null,
  );
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [applyingAll, setApplyingAll] = useState(false);
  const [applyStatus, setApplyStatus] = useState<string | null>(null);

  // Lazy-load bumper options on first open
  async function ensureLoaded() {
    if (loaded) return;
    const data = await getBumpersForSlot(slot);
    setBumpers(data as BumperOption[]);
    setLoaded(true);
  }

  async function handleSelect(bumperId: string | null) {
    const bumper = bumpers.find((b) => b.id === bumperId);
    setSelectedId(bumperId);
    setSelectedName(bumper?.name ?? null);
    setOpen(false);
    await assignBumperToCandidate(candidateId, slot, bumperId);
  }

  async function handleApplyToAll() {
    if (applyingAll) return;
    setApplyingAll(true);
    setApplyStatus(null);
    try {
      const result = await applyBumperToAllClips(projectId, slot, selectedId);
      setApplyStatus(
        `Applied to ${result.updated} clip${result.updated === 1 ? "" : "s"}`,
      );
      // Auto-close after a brief confirmation
      window.setTimeout(() => {
        setOpen(false);
        setApplyStatus(null);
        router.refresh();
      }, 1200);
    } catch (err) {
      setApplyStatus(
        err instanceof Error ? err.message : "Apply to all failed",
      );
    } finally {
      setApplyingAll(false);
    }
  }

  const label = slot === "front" ? "Front Bumper" : "Rear Bumper";

  return (
    <div className="relative">
      <button
        onClick={async () => {
          await ensureLoaded();
          setOpen((o) => !o);
        }}
        className={cn(
          "flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border transition-colors w-full",
          selectedId
            ? "border-primary/30 bg-primary/5 text-foreground"
            : "border-input bg-background text-muted-foreground hover:text-foreground",
        )}
      >
        <Film className="size-3 shrink-0" />
        <span className="truncate flex-1 text-left">
          {selectedName ?? label}
        </span>
        <ChevronDown className="size-3 shrink-0" />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => (applyingAll ? null : setOpen(false))}
          />
          {/* Dropdown */}
          <div className="absolute z-50 mt-1 w-60 rounded-md border bg-popover p-1 shadow-md">
            {/* None option */}
            <button
              onClick={() => handleSelect(null)}
              className={cn(
                "flex items-center w-full px-2 py-1.5 text-xs rounded-sm hover:bg-accent transition-colors",
                !selectedId && "bg-accent font-medium",
              )}
            >
              None
            </button>

            {bumpers.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                No bumpers available
              </p>
            ) : (
              bumpers.map((bumper) => {
                const isDefault =
                  (slot === "front" && bumper.isDefaultFront) ||
                  (slot === "rear" && bumper.isDefaultRear);
                return (
                  <button
                    key={bumper.id}
                    onClick={() => handleSelect(bumper.id)}
                    className={cn(
                      "flex items-center justify-between w-full px-2 py-1.5 text-xs rounded-sm hover:bg-accent transition-colors",
                      selectedId === bumper.id && "bg-accent font-medium",
                    )}
                  >
                    <span className="truncate">
                      {bumper.name}
                      {isDefault && (
                        <span className="ml-1 text-muted-foreground">
                          (default)
                        </span>
                      )}
                    </span>
                    {bumper.duration && (
                      <span className="text-muted-foreground ml-2 shrink-0">
                        {Math.round(bumper.duration)}s
                      </span>
                    )}
                  </button>
                );
              })
            )}

            {/* Apply-to-all footer */}
            <div className="my-1 border-t" />
            <button
              onClick={handleApplyToAll}
              disabled={applyingAll}
              className="flex items-center gap-1.5 w-full px-2 py-1.5 text-xs rounded-sm text-primary hover:bg-primary/10 transition-colors disabled:opacity-60"
            >
              {applyingAll ? (
                <Loader2 className="size-3 animate-spin" />
              ) : applyStatus ? (
                <Check className="size-3 text-green-500" />
              ) : (
                <Check className="size-3" />
              )}
              <span className="truncate text-left">
                {applyStatus ??
                  (selectedId
                    ? `Apply "${selectedName}" to all clips`
                    : "Clear this slot on all clips")}
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
