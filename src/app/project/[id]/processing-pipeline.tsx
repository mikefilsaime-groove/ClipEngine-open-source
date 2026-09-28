"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProcessingBanner } from "@/components/project/processing-banner";
import { cn } from "@/lib/utils";

interface Project {
  id: string;
  sourceVideoPath: string;
  status: string;
  duration?: number | null;
  transcript?: { id: string } | null;
  speakers: { id: string }[];
}

interface ProcessingPipelineProps {
  project: Project;
}

type StepKey = "probe" | "transcribe" | "diarize" | "analyze";

interface Step {
  key: StepKey;
  label: string;
  description: string;
  isDone: boolean;
}

function getSteps(project: Project): Step[] {
  const probeDone = typeof project.duration === "number" && project.duration > 0;
  const transcribeDone = !!project.transcript;
  const diarizeDone = project.speakers.length > 0;
  const analyzeDone = project.status === "ready";

  return [
    {
      key: "probe",
      label: "Probe Video",
      description: "Extract metadata (duration, resolution, codec)",
      isDone: probeDone,
    },
    {
      key: "transcribe",
      label: "Transcribe",
      description: "Generate transcript with Whisper",
      isDone: transcribeDone,
    },
    {
      key: "diarize",
      label: "Speaker Detection",
      description: "Identify speakers with pyannote",
      isDone: diarizeDone,
    },
    {
      key: "analyze",
      label: "AI Analysis",
      description: "Find clip candidates with Gemini",
      isDone: analyzeDone,
    },
  ];
}

function getApiConfig(key: StepKey, project: Project): { url: string; body: Record<string, unknown> } {
  switch (key) {
    case "probe":
      return { url: "/api/video/probe", body: { filePath: project.sourceVideoPath, projectId: project.id } };
    case "transcribe":
      return { url: "/api/transcribe", body: { projectId: project.id } };
    case "diarize":
      return { url: "/api/diarize", body: { projectId: project.id } };
    case "analyze":
      return { url: "/api/analyze", body: { projectId: project.id } };
  }
}

export function ProcessingPipeline({ project }: ProcessingPipelineProps) {
  const router = useRouter();
  const [runningStep, setRunningStep] = useState<StepKey | null>(null);
  const [stepStartedAt, setStepStartedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoStarted = useRef(false);

  const steps = getSteps(project);
  const nextIncompleteIndex = steps.findIndex((s) => !s.isDone);

  async function runStep(step: Step): Promise<boolean> {
    setRunningStep(step.key);
    setStepStartedAt(Date.now());
    setError(null);

    try {
      const { url, body } = getApiConfig(step.key, project);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `Request failed with status ${res.status}`);
      }

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setRunningStep(null);
      setStepStartedAt(null);
      return false;
    }
  }

  async function runAll() {
    const remaining = steps.filter((s) => !s.isDone);
    for (const step of remaining) {
      const ok = await runStep(step);
      if (!ok) break; // Stop on error, let user see what failed
    }
    setRunningStep(null);
    setStepStartedAt(null);
    router.refresh();
  }

  // Auto-start the pipeline on mount if there are incomplete steps
  useEffect(() => {
    if (autoStarted.current) return;
    if (nextIncompleteIndex === -1) return; // All done
    autoStarted.current = true;
    runAll();
  }, []);

  // Defensive: when the server tells us every step is done, clear any
  // lingering banner state. Covers races where runAll's final setState
  // is missed (e.g. router.refresh triggered before cleanup flushed).
  useEffect(() => {
    if (nextIncompleteIndex === -1 && runningStep !== null) {
      setRunningStep(null);
      setStepStartedAt(null);
    }
  }, [nextIncompleteIndex, runningStep]);

  return (
    <div className="space-y-3">
      {runningStep && stepStartedAt && (
        <ProcessingBanner
          step={runningStep}
          startedAt={stepStartedAt}
          videoDurationSeconds={project.duration}
        />
      )}

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p>{error}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => {
                setError(null);
                runAll();
              }}
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      <ol className="space-y-2">
        {steps.map((step, index) => {
          const isRunning = runningStep === step.key;
          const isNext = index === nextIncompleteIndex && !runningStep;
          const isPending = !step.isDone && !isRunning && !isNext;

          return (
            <li
              key={step.key}
              className={cn(
                "flex items-center gap-4 rounded-lg border px-4 py-3 transition-colors",
                step.isDone && "bg-muted/40"
              )}
            >
              <div className="flex-shrink-0">
                {step.isDone ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <Circle
                    className={cn(
                      "h-5 w-5",
                      isRunning || isNext ? "text-muted-foreground" : "text-muted-foreground/40"
                    )}
                  />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "text-sm font-medium",
                    step.isDone && "text-muted-foreground line-through",
                    isPending && "text-muted-foreground/50"
                  )}
                >
                  {step.label}
                </p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>

              {isPending && (
                <span className="text-xs text-muted-foreground/40">Pending</span>
              )}
            </li>
          );
        })}
      </ol>

      {nextIncompleteIndex === -1 && (
        <p className="text-sm text-green-600 font-medium text-center py-2">
          All steps complete — project is ready!
        </p>
      )}
    </div>
  );
}
