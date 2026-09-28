"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { generateText, Output } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { resolveGeminiKey } from "@/lib/api-keys";

export async function getProjectSettings(projectId: string) {
  return db.projectSettings.findUniqueOrThrow({
    where: { projectId },
  });
}

export async function updateProjectSettings(
  projectId: string,
  data: Partial<{
    captionsEnabled: boolean;
    captionPreset: string;
    captionPosition: string;
    captionSize: string;
    captionFont: string;
    captionColor: string;
    captionActiveWordColor: string;
    captionStressWordColor: string;
    profanityFilterEnabled: boolean;
    profanityWordList: string;
    fastCutsEnabled: boolean;
    fastCutsThreshold: number;
    fillerRemovalEnabled: boolean;
    fillerWordList: string;
    defaultExportQuality: string;
  }>
) {
  await db.projectSettings.update({
    where: { projectId },
    data,
  });
  revalidatePath(`/project/${projectId}/settings`);
}

export async function updateSpeakerLabel(
  projectId: string,
  speakerId: string,
  label: string
) {
  await db.speaker.update({
    where: { projectId_speakerId: { projectId, speakerId } },
    data: { label },
  });
  revalidatePath(`/project/${projectId}/settings`);
}

// ---------------------------------------------------------------------------
// AI speaker name suggestions
// ---------------------------------------------------------------------------

const suggestSchema = z.object({
  suggestions: z.array(
    z.object({
      speakerId: z.string().describe("The internal speaker ID (e.g. SPEAKER_00)"),
      name: z
        .string()
        .describe(
          "Best-guess human name based on transcript evidence. Use empty string if you cannot determine one."
        ),
      confidence: z.enum(["high", "medium", "low"]),
      evidence: z
        .string()
        .describe("1-2 sentence quote or description of the evidence used."),
    })
  ),
});

export interface SpeakerSuggestion {
  speakerId: string;
  name: string;
  confidence: "high" | "medium" | "low";
  evidence: string;
}

/**
 * Asks Gemini to guess human names for each speaker ID by looking for
 * direct addresses ("so John, tell us…"), self-introductions ("I'm Mike"),
 * and host-style lead-ins ("my guest today is Mary"). Returns a list the
 * user can review + accept on the settings page.
 */
export async function suggestSpeakerNames(
  projectId: string
): Promise<{ suggestions: SpeakerSuggestion[]; error?: string }> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      speakers: true,
      transcript: {
        include: { segments: { orderBy: { startTime: "asc" } } },
      },
    },
  });

  if (!project) return { suggestions: [], error: "Project not found" };
  if (!project.transcript)
    return { suggestions: [], error: "Transcript not ready" };
  if (project.speakers.length === 0)
    return { suggestions: [], error: "No speakers found" };

  // Build a compact speaker-labeled transcript. Group consecutive words
  // by the same speaker into one line so the prompt isn't huge.
  const lines: string[] = [];
  let currentSpeaker = "";
  let buffer: string[] = [];
  for (const seg of project.transcript.segments) {
    if (seg.speaker !== currentSpeaker) {
      if (buffer.length > 0) {
        lines.push(`[${currentSpeaker}] ${buffer.join(" ")}`);
      }
      currentSpeaker = seg.speaker;
      buffer = [seg.word];
    } else {
      buffer.push(seg.word);
    }
  }
  if (buffer.length > 0) {
    lines.push(`[${currentSpeaker}] ${buffer.join(" ")}`);
  }
  const transcriptText = lines.join("\n");

  const speakerIds = project.speakers.map((s) => s.speakerId).sort();

  const prompt = `You are analyzing a diarized podcast transcript to map speaker IDs to real names.

## Speaker IDs to identify
${speakerIds.map((id) => `- ${id}`).join("\n")}

## Evidence types to look for
1. **Self-introduction**: "I'm Mike Filsaime", "my name is John", "I'm the host"
2. **Host lead-in**: "My guest today is Sarah", "please welcome David"
3. **Direct address across speakers**: Speaker A says "So John, what do you think?" — then the NEXT speaker starts talking, meaning THAT speaker is John.
4. **Third-person reference**: "As Mary was saying earlier…" — if the referenced person is then heard speaking, that's a clue.

## Rules
- Return one entry for EVERY speaker ID listed above, even if you can't determine a name (use empty string + confidence "low").
- Confidence: "high" = direct self-introduction or clear host lead-in; "medium" = inferred from direct address; "low" = guess or unknown.
- evidence: quote the specific line or pair of lines you used. Keep it to 1-2 sentences.
- Do NOT invent names. If no evidence exists, return name="" and confidence="low".
- Names should be the person's commonly-used name (first name + last if both are stated, otherwise first name only).

## Transcript (speaker-labeled)
${transcriptText}

Return your answer as structured JSON.`;

  try {
    await resolveGeminiKey();
    const result = await generateText({
      model: google("gemini-3-flash-preview"),
      experimental_output: Output.object({ schema: suggestSchema }),
      prompt,
    });

    const raw = result.experimental_output.suggestions;
    // Filter to the known speaker IDs only, preserving the order requested.
    const byId = new Map(raw.map((s) => [s.speakerId, s]));
    const suggestions: SpeakerSuggestion[] = speakerIds.map((id) => {
      const match = byId.get(id);
      return {
        speakerId: id,
        name: match?.name?.trim() ?? "",
        confidence: match?.confidence ?? "low",
        evidence: match?.evidence ?? "",
      };
    });

    return { suggestions };
  } catch (err) {
    console.error("[suggestSpeakerNames] error:", err);
    return {
      suggestions: [],
      error: err instanceof Error ? err.message : "Suggestion failed",
    };
  }
}
