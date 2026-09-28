"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface WordListEditorProps {
  words: string[];
  onChange: (words: string[]) => void;
  label: string;
  className?: string;
}

export function WordListEditor({ words, onChange, label, className }: WordListEditorProps) {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function addWord() {
    const trimmed = inputValue.trim().toLowerCase();
    if (!trimmed || words.includes(trimmed)) {
      setInputValue("");
      return;
    }
    onChange([...words, trimmed]);
    setInputValue("");
    inputRef.current?.focus();
  }

  function removeWord(word: string) {
    onChange(words.filter((w) => w !== word));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addWord();
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2 min-h-[2.5rem] rounded-md border bg-muted/30 p-2">
        {words.map((word) => (
          <span
            key={word}
            className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm font-medium"
          >
            {word}
            <button
              type="button"
              onClick={() => removeWord(word)}
              className="ml-1 rounded-full hover:text-destructive focus:outline-none"
              aria-label={`Remove ${word}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {words.length === 0 && (
          <span className="text-sm text-muted-foreground px-1">No words added</span>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a word..."
          className="flex-1"
        />
        <Button type="button" size="icon" variant="outline" onClick={addWord}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
