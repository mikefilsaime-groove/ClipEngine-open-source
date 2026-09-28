"use client";

import { createContext, useContext, useState } from "react";
import { LayoutGrid, Grid2x2, Grid3x3 } from "lucide-react";
import { cn } from "@/lib/utils";

export type PreviewSize = "large" | "medium" | "small";

const PreviewSizeContext = createContext<PreviewSize>("large");

export function usePreviewSize() {
  return useContext(PreviewSizeContext);
}

export function getGridClasses(size: PreviewSize): string {
  switch (size) {
    case "large":
      return "grid-cols-1";
    case "medium":
      return "grid-cols-1 md:grid-cols-2";
    case "small":
      return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
  }
}

interface PreviewSizeWrapperProps {
  defaultSize?: PreviewSize;
  children: React.ReactNode;
}

export function PreviewSizeWrapper({
  defaultSize = "large",
  children,
}: PreviewSizeWrapperProps) {
  const [size, setSize] = useState<PreviewSize>(defaultSize);

  const options: Array<{ value: PreviewSize; icon: React.ReactNode; label: string }> = [
    { value: "large", icon: <LayoutGrid className="h-4 w-4" />, label: "Large" },
    { value: "medium", icon: <Grid2x2 className="h-4 w-4" />, label: "Medium" },
    { value: "small", icon: <Grid3x3 className="h-4 w-4" />, label: "Small" },
  ];

  return (
    <PreviewSizeContext.Provider value={size}>
      <div className="flex items-center justify-end gap-1 mb-4">
        <span className="text-xs text-muted-foreground mr-2">Preview size</span>
        <div className="flex rounded-md border border-input overflow-hidden">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSize(opt.value)}
              title={opt.label}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors",
                size === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {children}
    </PreviewSizeContext.Provider>
  );
}
