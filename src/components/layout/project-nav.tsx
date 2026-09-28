"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, FileText, Film, Scissors, Settings, Play, BookOpen, Clapperboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { renameProject } from "@/actions/project-actions";
import { SettingsDropdown } from "./settings-dropdown";

interface ProjectNavProps {
  projectId: string;
  projectName: string;
}

export function ProjectNav({ projectId, projectName }: ProjectNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const base = `/project/${projectId}`;

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(projectName);
  const inputRef = useRef<HTMLInputElement>(null);

  const isUntitled = name === "Untitled Project";

  useEffect(() => {
    setName(projectName);
  }, [projectName]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (name === "Untitled Project") {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [name]);

  async function saveName() {
    const trimmed = name.trim() || "Untitled Project";
    setName(trimmed);
    setEditing(false);
    if (trimmed !== projectName) {
      await renameProject(projectId, trimmed);
      router.refresh();
    }
  }

  // Left side: navigation / config links
  const navLinks = [
    { label: "Overview", href: base, icon: <Play className="h-4 w-4" />, exact: true },
    { label: "Project Settings", href: `${base}/settings`, icon: <Settings className="h-4 w-4" /> },
    { label: "Transcript", href: `${base}/transcript`, icon: <FileText className="h-4 w-4" /> },
  ];

  // Right side: main workflow actions — bigger, bolder
  const actionButtons = [
    { label: "Clips", href: `${base}/clips`, icon: <Scissors className="h-5 w-5" /> },
    { label: "Shorts", href: `${base}/shorts`, icon: <Film className="h-5 w-5" /> },
    { label: "Render", href: `${base}/render`, icon: <Clapperboard className="h-5 w-5" /> },
  ];

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <header className="border-b bg-background">
      <div className="container mx-auto px-4">
        {/* Top row: breadcrumb + project name + gear */}
        <div className="flex items-center gap-3 py-3">
          <Link
            href="/"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <span className="text-muted-foreground">/</span>
          <Link
            href="/guide"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Guide
          </Link>
          <span className="text-muted-foreground">/</span>

          {editing ? (
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName();
                if (e.key === "Escape") {
                  setName(projectName);
                  setEditing(false);
                }
              }}
              className="font-medium text-sm border-b border-primary bg-transparent outline-none max-w-xs px-0.5"
            />
          ) : (
            <button
              onClick={() => setEditing(true)}
              title="Click to rename"
              className={cn(
                "font-medium text-sm truncate max-w-xs hover:text-primary transition-colors text-left",
                isUntitled && "text-muted-foreground italic"
              )}
            >
              {name}
            </button>
          )}

          <div className="flex-1" />
          <Link
            href="/bumpers"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Film className="h-3.5 w-3.5" />
            Bumpers
          </Link>
          <SettingsDropdown />
        </div>

        {/* Nav row: text links left, action buttons right */}
        <nav className="flex items-center justify-between pb-2">
          {/* Left: nav / config links */}
          <div className="flex items-center gap-1">
            {navLinks.map((link) => {
              const active = isActive(link.href, link.exact);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors",
                    active
                      ? "text-primary font-medium bg-primary/5"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  {link.icon}
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Right: main action buttons */}
          <div className="flex items-center gap-2">
            {actionButtons.map((btn) => {
              const active = isActive(btn.href);
              return (
                <Link
                  key={btn.href}
                  href={btn.href}
                  className={cn(
                    "flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg border transition-all",
                    active
                      ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                      : "bg-background text-foreground border-border hover:border-primary/50 hover:bg-primary/5 hover:text-primary hover:shadow-sm"
                  )}
                >
                  {btn.icon}
                  {btn.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </header>
  );
}
