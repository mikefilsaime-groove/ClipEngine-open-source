"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Check,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  AlertCircle,
  Sparkles,
  Mic,
} from "lucide-react";
import {
  saveApiKeys,
  testGeminiKey,
  testHfToken,
} from "@/actions/api-keys-actions";

interface ApiKeysFormProps {
  initialGemini: string;
  initialHf: string;
}

type TestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "ok" }
  | { status: "error"; message: string };

export function ApiKeysForm({ initialGemini, initialHf }: ApiKeysFormProps) {
  const router = useRouter();

  const [gemini, setGemini] = useState(initialGemini);
  const [hf, setHf] = useState(initialHf);
  const [showGemini, setShowGemini] = useState(false);
  const [showHf, setShowHf] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [geminiTest, setGeminiTest] = useState<TestState>({ status: "idle" });
  const [hfTest, setHfTest] = useState<TestState>({ status: "idle" });

  const geminiDirty = gemini !== initialGemini;
  const hfDirty = hf !== initialHf;
  const dirty = geminiDirty || hfDirty;

  async function handleTestGemini() {
    setGeminiTest({ status: "testing" });
    const result = await testGeminiKey(gemini);
    setGeminiTest(
      result.ok
        ? { status: "ok" }
        : { status: "error", message: result.error ?? "Invalid key" },
    );
  }

  async function handleTestHf() {
    setHfTest({ status: "testing" });
    const result = await testHfToken(hf);
    setHfTest(
      result.ok
        ? { status: "ok" }
        : { status: "error", message: result.error ?? "Invalid token" },
    );
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await saveApiKeys({ geminiApiKey: gemini, hfToken: hf });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <KeyCard
        icon={<Sparkles className="h-5 w-5 text-primary" />}
        title="Google Gemini API Key"
        description="Powers the clip/short analyzer, Find More Candidates, and AI speaker name suggestions. Uses gemini-3-flash-preview."
        whereToGet={{
          label: "Get a free key at ai.google.dev",
          url: "https://aistudio.google.com/app/apikey",
        }}
        placeholder="AIzaSy…"
        value={gemini}
        onChange={setGemini}
        show={showGemini}
        onToggleShow={() => setShowGemini(!showGemini)}
        test={geminiTest}
        onTest={handleTestGemini}
        notes={[
          "Free tier: generous daily quota — more than enough for typical use.",
          "The same key is used for every AI operation in ClipEngine.",
        ]}
      />

      <KeyCard
        icon={<Mic className="h-5 w-5 text-primary" />}
        title="HuggingFace Token"
        description="Used by the Python sidecar for pyannote speaker diarization. Required to identify who's talking in multi-speaker videos."
        whereToGet={{
          label: "Get a free token at huggingface.co",
          url: "https://huggingface.co/settings/tokens",
        }}
        placeholder="hf_…"
        value={hf}
        onChange={setHf}
        show={showHf}
        onToggleShow={() => setShowHf(!showHf)}
        test={hfTest}
        onTest={handleTestHf}
        notes={[
          "Free, no credit card required. Create a token with 'read' permission.",
          "You must also accept the model terms for pyannote/speaker-diarization-3.1 and pyannote/segmentation-3.0 on HuggingFace.",
        ]}
        extraLinks={[
          {
            label: "Accept pyannote/speaker-diarization-3.1",
            url: "https://huggingface.co/pyannote/speaker-diarization-3.1",
          },
          {
            label: "Accept pyannote/segmentation-3.0",
            url: "https://huggingface.co/pyannote/segmentation-3.0",
          },
        ]}
      />

      <div className="flex items-center justify-between pt-2">
        <div className="text-xs text-muted-foreground">
          {dirty ? "You have unsaved changes." : "All changes saved."}
          {saved && (
            <span className="ml-2 text-primary inline-flex items-center gap-1">
              <Check className="h-3 w-3" />
              Saved
            </span>
          )}
        </div>
        <Button onClick={handleSave} disabled={!dirty || saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving…
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </div>
    </div>
  );
}

interface KeyCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  whereToGet: { label: string; url: string };
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  test: TestState;
  onTest: () => void;
  notes: string[];
  extraLinks?: Array<{ label: string; url: string }>;
}

function KeyCard({
  icon,
  title,
  description,
  whereToGet,
  placeholder,
  value,
  onChange,
  show,
  onToggleShow,
  test,
  onTest,
  notes,
  extraLinks,
}: KeyCardProps) {
  const configured = value.trim().length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {icon}
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          <StatusPill configured={configured} />
        </div>
        <CardDescription className="mt-2">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor={`key-${title}`} className="text-xs">
            API Key
          </Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id={`key-${title}`}
                type={show ? "text" : "password"}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="pr-9 font-mono text-sm"
              />
              <button
                type="button"
                onClick={onToggleShow}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onTest}
              disabled={!value.trim() || test.status === "testing"}
            >
              {test.status === "testing" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Test"
              )}
            </Button>
          </div>
        </div>

        {test.status === "ok" && (
          <div className="flex items-center gap-1.5 text-xs text-primary">
            <Check className="h-3.5 w-3.5" />
            Connection successful
          </div>
        )}
        {test.status === "error" && (
          <div className="flex items-start gap-1.5 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{test.message}</span>
          </div>
        )}

        <div className="rounded-md bg-muted/40 border border-border p-3 space-y-2">
          <a
            href={whereToGet.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            {whereToGet.label}
          </a>
          {extraLinks?.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs text-muted-foreground hover:text-primary hover:underline"
            >
              → {link.label}
            </a>
          ))}
          <ul className="space-y-1 pt-1">
            {notes.map((note, i) => (
              <li key={i} className="text-xs text-muted-foreground leading-relaxed">
                • {note}
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusPill({ configured }: { configured: boolean }) {
  return configured ? (
    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
      <Check className="h-3 w-3" />
      Connected
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
      <AlertCircle className="h-3 w-3" />
      Not set
    </span>
  );
}
