"use server";

import { db } from "@/lib/db";
import { resolveGeminiKey } from "@/lib/api-keys";
import { generateText, Output } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

const titleEntrySchema = z.object({
  title: z.string().describe("YouTube title optimized for CTR"),
  viralityScore: z
    .number()
    .min(0)
    .max(100)
    .describe("Predicted virality/CTR score from 0-100"),
  emotionalPolarity: z
    .string()
    .describe(
      "The two competing emotions this title creates, e.g. 'curiosity + fear', 'excitement + disbelief'. If you can't name two emotions, the title is flat — rewrite it."
    ),
  rationale: z
    .string()
    .describe(
      "One sentence explaining what makes someone CLICK — what question does this title plant in their mind that they can't answer without watching?"
    ),
});

const clipSchema = z.object({
  titles: z.array(titleEntrySchema),
  thumbnailLayout: z.object({
    description: z
      .string()
      .describe(
        "Detailed thumbnail layout description referencing speakers by name: subject placement, facial expression, text overlay, colors, background",
      ),
    textOverlay: z
      .string()
      .describe("The bold text that should appear on the thumbnail (2-5 words max)"),
    style: z
      .string()
      .describe("Visual style reference (e.g., 'MrBeast style', 'dark cinematic', 'bright pop')"),
  }),
  aiThumbnailPrompt: z
    .string()
    .describe(
      "Ready-to-paste prompt for AI image generators to create this thumbnail.",
    ),
});

const shortSchema = z.object({
  titles: z.array(titleEntrySchema),
  captionHook: z
    .string()
    .describe(
      "The first 5-8 words that should appear on screen before the viewer unmutes. This is the Short's equivalent of a thumbnail — it must stop the scroll on its own."
    ),
});

export interface YouTubeSuggestions {
  titles: Array<{
    title: string;
    viralityScore: number;
    emotionalPolarity: string;
    rationale: string;
  }>;
  thumbnailLayout?: {
    description: string;
    textOverlay: string;
    style: string;
  };
  aiThumbnailPrompt?: string;
  captionHook?: string;
}

// -----------------------------------------------------------------------
// Core generation — used by both the render worker (inline) and the
// server action (on-demand / regenerate).
// -----------------------------------------------------------------------

export interface GenerateYouTubeInput {
  candidateId: string;
  title: string;
  type: "clip" | "short";
  reasoning: string;
  trimIn: number;
  trimOut: number;
  transcriptExcerpt: string;
  speakerNames: string[];
}

export async function generateAndStoreYouTubeSuggestions(
  input: GenerateYouTubeInput,
): Promise<YouTubeSuggestions | null> {
  await resolveGeminiKey();

  const duration = Math.round(input.trimOut - input.trimIn);
  const speakerList =
    input.speakerNames.length > 0
      ? input.speakerNames.join(", ")
      : "unknown speaker(s)";

  const isShort = input.type === "short";
  const speakerCount = input.speakerNames.length;
  const primarySpeaker = input.speakerNames[0] ?? "the speaker";

  const prompt = `You are a world-class YouTube growth strategist who has studied the title and thumbnail patterns of MrBeast, Alex Hormozi, Ali Abdaal, Veritasium, and every creator pulling 10M+ views consistently. Your job: maximize click-through rate while accurately representing the content.

## Video Clip Details
- **Working title**: ${input.title}
- **Format**: ${isShort ? "YouTube Short (vertical 9:16, under 60s)" : "YouTube Long-form (landscape 16:9, " + duration + "s)"}
- **Speaker(s)**: ${speakerList} (${speakerCount} speaker${speakerCount > 1 ? "s" : ""})
- **Content summary**: ${input.reasoning}

## Transcript (use this to understand the actual content — don't rely solely on the summary)
${input.transcriptExcerpt.slice(0, 3000)}

---

## 1. TITLES — Generate exactly 5, ranked by predicted CTR

### Rules
- **Under ${isShort ? "40" : "55"} characters** — YouTube truncates on mobile; shorter = more clicks
- **Front-load the hook** — if someone only reads the first 4 words, they should NEED to click
- **Create emotional polarity** — the best titles create tension between two feelings: curiosity + fear, excitement + disbelief, outrage + validation
- **Include searchable keywords naturally** — balance CTR bait with discoverability (people search for topics, not clickbait)
- **Use specific numbers and names** — "$10M" beats "millions", "Gary Halbert" beats "a copywriter"
${isShort ? "- **Shorts-specific**: Shorter, punchier, can use 1-2 relevant emojis, hashtag-friendly phrasing" : "- **Long-form specific**: Brackets/parentheses for context signals — [PROOF], (watch this), [LIVE]"}

### Proven formula archetypes — use at least 3 different formulas across your 5 titles:
1. **The Contrarian**: "Why [Common Belief] Is Dead Wrong"
2. **The Specificity Hook**: "The $10M Lesson I Learned in 30 Seconds"
3. **The Before/After**: "I Tested [X] for [Y] Days — Here's What Happened"
4. **The Authority Drop**: "[Famous Person] Told Me This One Secret"
5. **The Listicle Twist**: "3 Things [Experts] Never Tell You About [Topic]"
6. **The Warning**: "Stop Doing [X] (It's Destroying Your [Y])"
7. **The Story Hook**: "How [Person] Went From [Bad State] to [Good State]"
8. **The Challenge**: "I Tried [X] So You Don't Have To"

### Curiosity gap calibration:
The best titles open a gap between what the viewer knows and what they NEED to know.
- Too wide = feels clickbaity. The viewer doesn't even know what they'd learn.
- Too narrow = no reason to click. The viewer can guess the answer from the title alone.
- The curiosity gap should be answerable ONLY by watching the clip.

### Mine the transcript for gold:
The most clickable titles use the speaker's OWN phrasing — their weird metaphor, the specific number they cited, the provocative way they framed something. At least 2 of the 5 titles MUST incorporate the speaker's exact words or phrasing from the transcript.

### Anti-patterns — NEVER do these:
- Generic "You Won't Believe" or "SHOCKING" without substance
- ALL CAPS for entire title (strategic caps on 1-2 words is fine)
- Misleading claims not supported by the transcript
- Questions that can be answered with "no" (viewer won't click)
- Titles that reveal the entire payoff (kills curiosity)

### Scoring calibration:
- **90-100**: Would compete on trending page. Genuinely exceptional hook.
- **75-89**: Strong title, clear hook, good specificity. Would outperform most creators.
- **60-74**: Decent but could be sharper. Missing emotional polarity or specificity.
- **Below 60**: Generic, vague, or violates anti-patterns.

${isShort ? "" : `
---

## 2. THUMBNAIL LAYOUT — Design a single high-CTR thumbnail

### Content-aware expression matching
The facial expression must match the emotional tone of the content:
- If the content is a WARNING or cautionary tale → concerned/alarmed expression, slightly furrowed brow
- If the content is a BIG WIN or success story → celebration, wide eyes, open mouth smile
- If the content is CONTROVERSIAL or contrarian → skeptical/defiant expression, one eyebrow raised
- If the content is EDUCATIONAL or a revelation → "mind blown" expression, hands on head or pointing at text
- If the content is a PERSONAL STORY → authentic/vulnerable expression, direct eye contact

### Speaker layout (${speakerCount} speaker${speakerCount > 1 ? "s" : ""}):
${speakerCount === 1 ? `- **Single speaker (${primarySpeaker})**: Face fills 40-60% of frame. Place on left or right third, text on opposite side. Expression must be exaggerated — YouTube thumbnails are viewed at 120x90px, subtle expressions disappear.` : `- **Multi-speaker (${speakerList})**: Use a split/reaction layout. ${primarySpeaker} on left reacting, ${input.speakerNames[1] ?? "second speaker"} on right. OR conversation layout with both facing each other. One speaker should have a stronger/more dramatic expression than the other to create visual tension.`}

### Thumbnail composition checklist:
- **Background**: Choose ONE — solid gradient (dark blue→black for authority, red→orange for urgency, yellow→white for energy), blurred video screenshot, or environmental context
- **Text overlay**: 2-4 words MAX. Must COMPLEMENT the title, not repeat it. If the title says "The $10M Secret", the thumbnail text might say "EXPOSED" or "THEY LIED"
- **Text styling**: Bold Impact/Montserrat font, white with thick black stroke, or yellow with red stroke. Must be readable at 120x90px (test: can you read it with squinted eyes?)
- **Graphic elements**: Consider adding ONE of: red arrow pointing at something, red circle highlighting something, ❌ or ✅ emoji overlay, dollar signs, fire effect, or a relevant prop/object
- **Color dominance**: Thumbnail should have ONE dominant color that contrasts with YouTube's white/dark interface. Red, yellow, and cyan perform best in testing.

---

## 3. AI IMAGE GENERATION PROMPT

Write a single, ready-to-paste prompt optimized for state-of-the-art AI image generators.

### Must include:
- **Camera/composition**: "Close-up portrait shot, 85mm lens, shallow depth of field" or "Medium shot, slightly low angle for authority"
- **Lighting**: Specific setup — "Dramatic Rembrandt lighting from the right, strong rim light separating subject from background, studio key light at 45 degrees" or "Bright, flat beauty lighting, no harsh shadows"
- **Subject description**: Reference ${primarySpeaker} by name. Describe their expression in detail: what their eyes, mouth, and eyebrows are doing. If you don't know their appearance, describe a confident professional speaker.
- **Background**: Specific — not just "dark background" but "deep navy blue gradient fading to black, with subtle bokeh light orbs"
- **Text placement**: "Bold white Impact font text reading '[EXACT TEXT]' in the upper-right quadrant, with thick black outline stroke, slightly rotated 2 degrees for energy"
- **Style reference**: Reference a specific visual style — "In the style of a MrBeast thumbnail", "Cinematic movie poster aesthetic", "Clean minimalist tech review style"
- **Aspect ratio**: 16:9 horizontal (landscape orientation)

### Negative prompt (add at the end):
Include: "Avoid: blurry details, extra limbs, text misspellings, low resolution, oversaturated colors, cluttered composition"

### YouTube overlay awareness:
- Keep the bottom-right corner clear of important details — YouTube overlays the video duration badge there.
- Keep the lower third simpler — the title text will appear directly below in search results and the sidebar.
`}
${isShort ? `
---

## 2. CAPTION HOOK — The Short's "Thumbnail"

Shorts don't have thumbnails. The first frame with text IS the thumbnail. Write the first 5-8 words that should appear on screen before the viewer even unmutes. This text alone must stop the scroll.

Rules:
- Must create instant curiosity or tension
- Must be readable in under 1 second
- Must make the viewer unmute to hear the rest
- Think of it as a headline on a silent, auto-playing video in someone's feed
` : ""}
---

## FINAL GUT CHECK

Before returning each title, ask yourself: if this appeared in your YouTube feed right now between a MrBeast video and a Joe Rogan clip, would YOU click it? If not, rewrite it until you would.

Return your answer as structured JSON.`;

  try {
    const result = isShort
      ? await generateText({
          model: google("gemini-3-flash-preview"),
          experimental_output: Output.object({ schema: shortSchema }),
          prompt,
        })
      : await generateText({
          model: google("gemini-3-flash-preview"),
          experimental_output: Output.object({ schema: clipSchema }),
          prompt,
        });

    const raw = result.experimental_output as Record<string, unknown> | null;
    if (!raw || !Array.isArray(raw.titles)) return null;

    const suggestions: YouTubeSuggestions = {
      titles: raw.titles as YouTubeSuggestions["titles"],
      ...(raw.thumbnailLayout ? { thumbnailLayout: raw.thumbnailLayout as YouTubeSuggestions["thumbnailLayout"] } : {}),
      ...(raw.aiThumbnailPrompt ? { aiThumbnailPrompt: raw.aiThumbnailPrompt as string } : {}),
      ...(raw.captionHook ? { captionHook: raw.captionHook as string } : {}),
    };

    suggestions.titles.sort((a, b) => b.viralityScore - a.viralityScore);

    await db.candidate.update({
      where: { id: input.candidateId },
      data: { youtubeSuggestions: JSON.stringify(suggestions) },
    });

    return suggestions;
  } catch (err) {
    console.error("[youtube] generation failed:", err);
    return null;
  }
}

// -----------------------------------------------------------------------
// Server actions for client use
// -----------------------------------------------------------------------

export async function getYouTubeSuggestions(
  candidateId: string,
): Promise<YouTubeSuggestions | null> {
  const candidate = await db.candidate.findUnique({
    where: { id: candidateId },
    select: { youtubeSuggestions: true },
  });
  if (!candidate) return null;
  if (candidate.youtubeSuggestions) {
    try {
      return JSON.parse(candidate.youtubeSuggestions) as YouTubeSuggestions;
    } catch {}
  }
  return null;
}

export async function regenerateYouTubeSuggestions(
  candidateId: string,
): Promise<YouTubeSuggestions | null> {
  const candidate = await db.candidate.findUnique({
    where: { id: candidateId },
    include: {
      project: {
        include: {
          speakers: true,
          transcript: {
            include: {
              segments: { orderBy: { startTime: "asc" } },
            },
          },
        },
      },
    },
  });
  if (!candidate) return null;

  const segments =
    candidate.project.transcript?.segments.filter(
      (s) => s.startTime >= candidate.trimIn && s.endTime <= candidate.trimOut,
    ) ?? [];

  const speakerIds = [...new Set(segments.map((s) => s.speaker))];
  const speakerNames = speakerIds.map((id) => {
    const speaker = candidate.project.speakers.find((s) => s.speakerId === id);
    return speaker?.label ?? id;
  });

  await db.candidate.update({
    where: { id: candidateId },
    data: { youtubeSuggestions: null },
  });

  return generateAndStoreYouTubeSuggestions({
    candidateId: candidate.id,
    title: candidate.title,
    type: candidate.type as "clip" | "short",
    reasoning: candidate.reasoning,
    trimIn: candidate.trimIn,
    trimOut: candidate.trimOut,
    transcriptExcerpt: segments.map((s) => s.word).join(" "),
    speakerNames,
  });
}
