"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getBumpers,
  updateBumper,
  deleteBumper,
  setDefaultFrontBumper,
  setDefaultRearBumper,
  clearDefaultFrontBumper,
  clearDefaultRearBumper,
} from "@/actions/bumper-actions";
import { SettingsDropdown } from "@/components/layout/settings-dropdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Upload,
  Film,
  MoreHorizontal,
  Pencil,
  Trash2,
  Star,
  Tag,
  X,
} from "lucide-react";
import { SUPPORTED_VIDEO_FORMATS } from "@/lib/constants";

type BumperVideo = {
  id: string;
  name: string;
  filePath: string;
  tag: string;
  duration: number | null;
  isDefaultFront: boolean;
  isDefaultRear: boolean;
  createdAt: Date;
};

const TAG_OPTIONS = [
  { value: "front", label: "Front Bumper" },
  { value: "rear", label: "Rear Bumper" },
  { value: "both", label: "Both" },
];

const ACCEPT =
  SUPPORTED_VIDEO_FORMATS.map((ext) => `video/${ext.replace(".", "")}`).join(
    ","
  ) + ",.mp4,.mov,.mkv,.avi,.webm,.m4v";

export default function BumperLibraryPage() {
  const router = useRouter();
  const [bumpers, setBumpers] = useState<BumperVideo[]>([]);
  const [loading, setLoading] = useState(true);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadTag, setUploadTag] = useState("both");
  const inputRef = useRef<HTMLInputElement>(null);

  // Rename state
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState("");

  async function loadBumpers() {
    setLoading(true);
    const data = await getBumpers();
    setBumpers(data as BumperVideo[]);
    setLoading(false);
  }

  useEffect(() => {
    loadBumpers();
  }, []);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    if (inputRef.current) inputRef.current.value = "";
  }

  function uploadFile(file: File) {
    setUploading(true);
    setUploadProgress(0);

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        setUploadProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        loadBumpers();
      }
      setUploading(false);
      setUploadProgress(0);
    });

    xhr.addEventListener("error", () => {
      setUploading(false);
      setUploadProgress(0);
    });

    const baseName = file.name.replace(/\.[^/.]+$/, "");

    xhr.open("POST", "/api/bumper/upload");
    xhr.setRequestHeader("x-file-name", encodeURIComponent(file.name));
    xhr.setRequestHeader("x-bumper-name", encodeURIComponent(baseName));
    xhr.setRequestHeader("x-bumper-tag", uploadTag);
    xhr.send(file);
  }

  async function handleRename(id: string, name: string) {
    await updateBumper(id, { name });
    setBumpers((prev) =>
      prev.map((b) => (b.id === id ? { ...b, name } : b))
    );
    setRenameId(null);
  }

  async function handleChangeTag(id: string, tag: string) {
    await updateBumper(id, { tag });
    setBumpers((prev) =>
      prev.map((b) => (b.id === id ? { ...b, tag } : b))
    );
  }

  async function handleDelete(id: string) {
    await deleteBumper(id);
    setBumpers((prev) => prev.filter((b) => b.id !== id));
    setDeleteId(null);
  }

  async function handleSetDefaultFront(id: string) {
    await setDefaultFrontBumper(id);
    setBumpers((prev) =>
      prev.map((b) => ({ ...b, isDefaultFront: b.id === id }))
    );
  }

  async function handleSetDefaultRear(id: string) {
    await setDefaultRearBumper(id);
    setBumpers((prev) =>
      prev.map((b) => ({ ...b, isDefaultRear: b.id === id }))
    );
  }

  async function handleClearDefaultFront() {
    await clearDefaultFrontBumper();
    setBumpers((prev) =>
      prev.map((b) => ({ ...b, isDefaultFront: false }))
    );
  }

  async function handleClearDefaultRear() {
    await clearDefaultRearBumper();
    setBumpers((prev) =>
      prev.map((b) => ({ ...b, isDefaultRear: false }))
    );
  }

  const formatDuration = (d: number | null) => {
    if (!d) return "—";
    if (d < 60) return `${Math.round(d)}s`;
    return `${Math.floor(d / 60)}m ${Math.round(d % 60)}s`;
  };

  const tagLabel = (tag: string) =>
    TAG_OPTIONS.find((t) => t.value === tag)?.label ?? tag;

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link
              href="/"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
          </div>
          <h1 className="text-3xl font-bold">Bumper Library</h1>
          <p className="text-muted-foreground mt-1">
            Front &amp; rear bumpers for your clips
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SettingsDropdown />
          {/* Tag selector for next upload */}
          <select
            value={uploadTag}
            onChange={(e) => setUploadTag(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {TAG_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <Button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="size-4 mr-2" />
            {uploading ? `Uploading ${uploadProgress}%` : "Upload Bumper"}
          </Button>
        </div>
      </div>

      {/* Upload progress bar */}
      {uploading && (
        <div className="mb-6">
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Bumper list */}
      {loading ? (
        <div className="text-center py-20 text-muted-foreground text-sm">
          Loading...
        </div>
      ) : bumpers.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg">No bumpers yet</p>
          <p className="text-sm mt-1">
            Upload a video to use as a front or rear bumper on your clips
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {bumpers.map((bumper) => (
            <div
              key={bumper.id}
              className="flex items-center gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                <Film className="size-5 text-primary" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{bumper.name}</span>
                  {bumper.isDefaultFront && (
                    <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 px-1.5 py-0.5 rounded font-medium">
                      Default Front
                    </span>
                  )}
                  {bumper.isDefaultRear && (
                    <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-1.5 py-0.5 rounded font-medium">
                      Default Rear
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {tagLabel(bumper.tag)} &middot;{" "}
                  {formatDuration(bumper.duration)} &middot;{" "}
                  {new Date(bumper.createdAt).toLocaleDateString()}
                </p>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="shrink-0">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      setRenameId(bumper.id);
                      setRenameName(bumper.name);
                    }}
                  >
                    <Pencil className="mr-2 size-4" /> Rename
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  {/* Tag change */}
                  {TAG_OPTIONS.filter((t) => t.value !== bumper.tag).map(
                    (opt) => (
                      <DropdownMenuItem
                        key={opt.value}
                        onClick={() => handleChangeTag(bumper.id, opt.value)}
                      >
                        <Tag className="mr-2 size-4" /> Set as {opt.label}
                      </DropdownMenuItem>
                    )
                  )}

                  <DropdownMenuSeparator />

                  {/* Default front */}
                  {(bumper.tag === "front" || bumper.tag === "both") && (
                    <>
                      {bumper.isDefaultFront ? (
                        <DropdownMenuItem onClick={handleClearDefaultFront}>
                          <X className="mr-2 size-4" /> Remove Default Front
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => handleSetDefaultFront(bumper.id)}
                        >
                          <Star className="mr-2 size-4" /> Set Default Front
                        </DropdownMenuItem>
                      )}
                    </>
                  )}

                  {/* Default rear */}
                  {(bumper.tag === "rear" || bumper.tag === "both") && (
                    <>
                      {bumper.isDefaultRear ? (
                        <DropdownMenuItem onClick={handleClearDefaultRear}>
                          <X className="mr-2 size-4" /> Remove Default Rear
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => handleSetDefaultRear(bumper.id)}
                        >
                          <Star className="mr-2 size-4" /> Set Default Rear
                        </DropdownMenuItem>
                      )}
                    </>
                  )}

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => {
                      setDeleteId(bumper.id);
                      setDeleteName(bumper.name);
                    }}
                  >
                    <Trash2 className="mr-2 size-4" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Rename Dialog */}
      <Dialog
        open={!!renameId}
        onOpenChange={(open) => !open && setRenameId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Bumper</DialogTitle>
          </DialogHeader>
          <Input
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && renameId)
                handleRename(renameId, renameName);
            }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameId(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => renameId && handleRename(renameId, renameName)}
              disabled={!renameName.trim()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Bumper</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deleteName}&rdquo;? Clips
              using this bumper will have it removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
