import { generateText, Output } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { TranscriptWord, AnalysisCandidate } from "@/types";
import { resolveGeminiKey } from "./api-keys";

const VALID_TAGS = [
  "Hot Take", "Humor", "Actionable Advice", "Personal Story",
  "Educational", "Quotable One-Liner", "Controversial", "Newsworthy",
  "Behind the Scenes", "Data / Stats", "Vulnerability",
  "Framework / Model", "Debate / Tension", "Transformational", "Motivational",
  "Inspirational", "Strategy / Tactic", "Hidden Gem",
] as const;

const VALID_GRADES = [
  "A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D",
] as const;

const VALID_RECOMMENDATIONS = [
  "Must Use", "Highly Recommended", "Recommended",
  "Worth Considering", "User Choice",
] as const;

const candidateSchema = z.object({
  candidates: z.array(
    z.object({
      type: z.enum(["clip", "short"]),
      title: z.string(),
      startTime: z.number(),
      endTime: z.number(),
      viralityScore: z.number().min(0).max(100),
      hookStrength: z
        .number()
        .min(0)
        .max(100)
        .describe(
          "How likely is a viewer to stop scrolling in the first 3 seconds (shorts) or 30 seconds (clips)? 0-100."
        ),
      completionPull: z
        .number()
        .min(0)
        .max(100)
        .describe(
          "Once hooked, how likely is the viewer to watch to the very end? 0-100."
        ),
      platformPlay: z
        .string()
        .describe(
          "One sentence: which platform this performs best on and why (e.g., 'Best for: YouTube Shorts — educational payoff rewards completion rate')"
        ),
      shareTrigger: z
        .string()
        .optional()
        .describe(
          "If this clip has a share/re-watch trigger, describe it in one sentence. Otherwise omit."
        ),
      reasoning: z
        .string()
        .describe(
          "2-4 sentence paragraph summarizing what this clip is about AND why it's worth publishing. Cover the topic, the hook, and the payoff."
        ),
      tags: z
        .array(z.enum(VALID_TAGS))
        .min(1)
        .max(5)
        .describe("1-5 content type tags that describe this clip"),
      grade: z
        .enum(VALID_GRADES)
        .describe("Letter grade from A+ to D based on overall quality"),
      recommendation: z
        .enum(VALID_RECOMMENDATIONS)
        .describe("Publishing recommendation tier"),
      stressWords: z
        .array(z.number())
        .optional()
        .describe(
          "Indices of stress/emphasis words within this segment"
        ),
    })
  ),
});

/** Converts seconds to "M:SS" format */
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Formats word-level transcript into speaker-labeled, timestamped lines */
function buildTranscriptText(words: TranscriptWord[]): string {
  if (words.length === 0) return "";

  const lines: string[] = [];
  let currentSpeaker = words[0].speaker;
  let segmentStart = words[0].startTime;
  let segmentWords: string[] = [];

  for (const word of words) {
    if (word.speaker !== currentSpeaker) {
      if (segmentWords.length > 0) {
        lines.push(
          `[${currentSpeaker} @ ${formatTime(segmentStart)}] ${segmentWords.join(" ")}`
        );
      }
      currentSpeaker = word.speaker;
      segmentStart = word.startTime;
      segmentWords = [word.word];
    } else {
      segmentWords.push(word.word);
    }
  }

  // Flush last segment
  if (segmentWords.length > 0) {
    lines.push(
      `[${currentSpeaker} @ ${formatTime(segmentStart)}] ${segmentWords.join(" ")}`
    );
  }

  return lines.join("\n");
}

/**
 * Analyzes transcript words using Gemini 3 Flash and returns clip/short candidates
 * with virality scores and reasoning.
 */
export async function analyzeTranscript(
  words: TranscriptWord[],
  durationMinutes: number,
  findExtendedShorts = true,
): Promise<AnalysisCandidate[]> {
  await resolveGeminiKey();
  const transcriptText = buildTranscriptText(words);

  const minClips = Math.max(6, Math.ceil(durationMinutes / 5));
  const minShorts = Math.max(8, Math.ceil(durationMinutes / 4));
  const minExtendedShorts = findExtendedShorts
    ? Math.max(4, Math.ceil(durationMinutes / 8))
    : 0;

  const prompt = `You are a world-class viral content strategist who has built channels from 0 to 1M+ subscribers. You are analyzing a podcast/video transcript to identify EVERY publishable moment. Your philosophy: "open loop / close loop" — every great clip opens a question or tension in the viewer's mind, then closes it satisfyingly.

Your job is NOT to find a few "best" clips. Your job is to surface EVERY moment that has ANY publishing potential and let the user decide. Include marginal moments at honest low scores (25-40). The user WANTS to see D-tier candidates — they just need to know they're D-tier.

## Content Duration
${durationMinutes.toFixed(1)} minutes of content.

---

## 1. OUTPUT REQUIREMENTS (hard minimums, NON-NEGOTIABLE)

| Type | Duration | Minimum Count | Description | Hook Speed Requirement |
|------|----------|---------------|-------------|----------------------|
| **clip** | 3–20 min | ${minClips} | Full standalone video. Complete thought with open+close loop. Worthy of its own YouTube video with thumbnail and title. | Opening hook must land in the FIRST 30 SECONDS. If a viewer can click away at 0:31 without feeling they'd miss something, the hook failed. Score hookStrength accordingly. |
| **short** | 15–60 sec | ${minShorts} | Classic short-form. Punchy, one hook, one payoff. Vertical 9:16. Prefer single-speaker for clean framing. | The hook must create an open loop within the FIRST 3 WORDS the viewer hears. Shorts live or die in the first second. |
${findExtendedShorts ? `| **short** | 61–180 sec | ${minExtendedShorts} | Extended short. Storytelling, educational deep-dives, multi-step advice. YouTube Shorts now supports up to 3 minutes. Still vertical 9:16. | Hook in the first sentence. Must build enough narrative momentum that the viewer can't stop mid-way. |` : ""}

Spread candidates across the ENTIRE transcript. Do not cluster. If you can't find enough high-scoring candidates, include lower-scoring ones. The user filters by score.

${findExtendedShorts ? `### CRITICAL: Extended Shorts (61–180 seconds)

YouTube Shorts now supports videos UP TO 3 MINUTES. You MUST find at least ${minExtendedShorts} shorts that are between 61 and 180 seconds long. These are NOT clips — they are still type "short" but with longer durations. Look for:
- Multi-step explanations that need 90–120 seconds to land
- Stories with setup → conflict → resolution that take 2+ minutes
- Educational walkthroughs with multiple examples
- Debates or back-and-forth exchanges that build over 1–3 minutes

DO NOT cap all shorts at 60 seconds. The extended shorts tier is a SEPARATE requirement from classic shorts. You need BOTH.` : ""}

---

## 2. CONTENT TYPE TAGS (assign 1–5 per candidate)

Every candidate MUST be tagged with at least one content type. These tags help the user filter and prioritize. Choose from:

| Tag | What to look for |
|-----|------------------|
| **Hot Take** | Contrarian opinion, challenges conventional wisdom, "most people are wrong about…" |
| **Humor** | Genuinely funny moment, witty comeback, unexpected joke, self-deprecating humor |
| **Actionable Advice** | Step-by-step instructions, "here's exactly how to…", concrete tactical guidance |
| **Personal Story** | First-person narrative with a lesson, "when I was…", origin story, failure→success |
| **Educational** | Teaching a concept, explaining a mechanism, "here's why X works" |
| **Quotable One-Liner** | A single sentence so good it could be a tweet, meme, or headline |
| **Controversial** | Deliberately provocative, will spark comments and debate |
| **Newsworthy** | References current events, breaking news, timely relevance |
| **Behind the Scenes** | Reveals process, shows how something is made, insider access |
| **Data / Stats** | Cites specific numbers, percentages, research, or studies |
| **Vulnerability** | Raw honesty, admission of failure, emotional openness |
| **Framework / Model** | Names a mental model, system, or methodology (e.g., "The 3-Step Close") |
| **Debate / Tension** | Disagreement between speakers, pushback, challenging each other |
| **Transformational** | Before/after story, dramatic change, pivot moment |
| **Motivational** | Energizing, "you can do this", rally cry, pushing the viewer to take action |
| **Inspirational** | A moment that evokes awe, admiration, or a sense of possibility — stories of overcoming, achievement, or human depth that move the viewer emotionally without telling them what to do |
| **Strategy / Tactic** | Strategic reasoning behind a decision — the "why" behind the move, the chess play with its logic. "We priced it at X because…", "The reason we run ads to Y instead of Z is…" |
| **Hidden Gem** | Doesn't fit any other tag cleanly but is genuinely interesting — unexpected tangents, cultural references, oddly compelling moments the user might otherwise miss |

---

## 3. SCORING, GRADING, AND RECOMMENDATIONS

### Virality Score (0–100)
Be HONEST. Use the full range. Not everything is a 90.
- **95–100**: Stop-scrolling, instant share. Would trend on its own.
- **85–94**: Excellent. Strong hook, clear payoff, high engagement potential.
- **70–84**: Very good. Solid content, quotable, will perform well.
- **55–69**: Good. Useful but needs a strong title/thumbnail to land.
- **40–54**: Decent. Niche appeal, may resonate with core audience.
- **Below 40**: Marginal. Include to meet minimums — score honestly, don't inflate.

### Hook Strength (0–100) — SEPARATE from virality
Would someone stop scrolling in the first 3 seconds (shorts) or 30 seconds (clips)?
- A clip can be deeply valuable (high virality) but have a weak opening (low hook strength). These are different things.
- **90–100**: Impossible to scroll past. Pattern interrupt, shocking claim, or emotional gut-punch in the first moments.
- **70–89**: Strong opener. Creates genuine curiosity or tension quickly.
- **50–69**: Decent hook but takes a moment to build. Might lose impatient viewers.
- **Below 50**: Slow start. Content is good but the opening doesn't grab.

### Completion Pull (0–100) — SEPARATE from virality
Once hooked, how likely is the viewer to watch to the very end?
- **90–100**: The payoff is so anticipated that leaving early feels like a loss.
- **70–89**: Strong narrative momentum. Most viewers will finish.
- **50–69**: Good content but some natural exit points mid-way.
- **Below 50**: Meanders or front-loads the best part. Viewers may drop off.

A short with a 95 hook and 60 completion is a very different beast from one with a 60 hook and 95 completion. The first gets views. The second gets watch time. Report both honestly.

### Letter Grade (based on virality score)
| Score | Grade |
|-------|-------|
| 95-100 | A+ |
| 90-94 | A |
| 85-89 | A- |
| 80-84 | B+ |
| 75-79 | B |
| 70-74 | B- |
| 65-69 | C+ |
| 60-64 | C |
| 55-59 | C- |
| Below 55 | D |

### Recommendation Tier
| Tier | When to assign |
|------|----------------|
| **Must Use** | A+ or A grade. Would be negligent to skip this. |
| **Highly Recommended** | A- or B+. Strong candidate, should publish unless they have too many. |
| **Recommended** | B or B-. Solid, worth publishing in most batches. |
| **Worth Considering** | C+ or C. Has merit but user should evaluate. |
| **User Choice** | C- or D. Included for completeness. User decides. |

---

## 4. OPEN LOOP / CLOSE LOOP (mandatory)

Every candidate MUST:
1. **Open a loop**: Pose a question, introduce tension, make a claim that demands explanation
2. **Close the loop**: Deliver the payoff, resolution, or punchline

For clips: the opening hook must land in the first 30 seconds. If a viewer can click away at 0:31 without feeling they'd miss something, the hook failed — penalize hookStrength.
For shorts: the hook IS the first sentence. Everything else is payoff. The first 3 words the viewer hears determine whether they stay.

---

## 5. PLATFORM PLAY (mandatory for every candidate)

For each candidate, identify which platform it would perform BEST on and why, in one sentence. Consider:
- **YouTube Shorts**: Rewards watch-time-to-completion. Educational payoffs and narrative arcs perform well.
- **TikTok**: Rewards re-watches and shares. Pattern interrupts, visual gags, and "tag someone" moments win.
- **Instagram Reels**: Rewards saves. Actionable advice, frameworks, and quotable one-liners get saved.
- **YouTube Long-form**: Rewards session time. Deep dives, multi-part stories, and high-production moments.
- **Twitter/X Clips**: Rewards controversy and hot takes. Punchy, quotable, debate-sparking.

---

## 6. SHARE TRIGGER (optional but important)

The best-performing shorts have a moment that makes people re-watch or tag a friend. If a candidate contains a share trigger, describe it in one sentence. Examples:
- "Tag someone who does this"
- A visual gag or moment that rewards re-watching
- A claim so bold people will screenshot it
- A framework so useful people save it for later

If no clear share trigger exists, omit this field.

---

## 7. REASONING FIELD

For EVERY candidate, write a 2-4 sentence paragraph covering:
- **What** the clip is about (topic, who's speaking, what happens)
- **The hook** (what tension/question opens the loop)
- **The payoff** (why this moment is worth watching or sharing)

This is shown directly to the user on the candidate card. Write for a human reader. Be concrete. Name speakers. No filler phrases like "this clip discusses."

---

## 8. STRESS WORDS

For each candidate, identify word indices (0-based from startTime) that carry the most emphasis — words a great speaker would punch. Used for animated caption highlighting.

---

## Transcript
${transcriptText}

---

## FINAL INSTRUCTIONS

1. Analyze the ENTIRE transcript section by section. Do not stop early.
2. Be VERBOSE — more candidates is always better. Surface every publishable moment.
3. Spread candidates across the full duration. No clustering.
4. Every candidate gets: type, title, startTime, endTime, viralityScore, hookStrength, completionPull, platformPlay, reasoning, tags (1-5), grade, recommendation, stressWords, and shareTrigger (if applicable).
5. **SELF-CHECK before returning**: Count your candidates:
   - Clips (3-20 min): need ≥ ${minClips}
   - Classic shorts (15-60 sec): need ≥ ${minShorts}
   ${findExtendedShorts ? `- Extended shorts (61-180 sec): need ≥ ${minExtendedShorts} — these are type "short" but with endTime - startTime > 60 seconds. If you have ZERO extended shorts, you have FAILED this requirement. GO BACK and find moments that need 1-3 minutes to tell.` : ""}
   If ANY count is short, GO BACK and find more. This is a HARD REQUIREMENT.

Return your analysis as structured JSON.`;

  const result = await generateText({
    model: google("gemini-3-flash-preview"),
    experimental_output: Output.object({ schema: candidateSchema }),
    prompt,
  });

  return result.experimental_output.candidates as AnalysisCandidate[];
}

/**
 * Asks Gemini for ADDITIONAL candidates the user may have missed on the first
 * pass. The prompt lists the already-found time ranges so the model avoids
 * duplicates and hunts in gaps / lower-scoring territory instead.
 */
export async function findMoreAnalysis(
  words: TranscriptWord[],
  durationMinutes: number,
  wantedType: "clip" | "short",
  existing: Array<{
    type: string;
    startTime: number;
    endTime: number;
    title: string;
    viralityScore: number;
  }>
): Promise<AnalysisCandidate[]> {
  await resolveGeminiKey();
  const transcriptText = buildTranscriptText(words);

  const sameType = existing.filter((c) => c.type === wantedType);
  const existingList =
    sameType.length > 0
      ? sameType
          .map(
            (c) =>
              `- ${formatTime(c.startTime)}–${formatTime(c.endTime)} "${c.title}" (score ${c.viralityScore})`
          )
          .join("\n")
      : "(none yet)";

  const typeLabel = wantedType === "clip" ? "clip" : "short";
  const typeRange = wantedType === "clip" ? "3–20 min" : "25–60 sec";
  const targetMore = wantedType === "clip" ? 8 : 10;

  const prompt = `You are a viral content strategist. The user has already reviewed these ${typeLabel} candidates and wants MORE options they may have missed — secondary hooks, alternate angles, or moments from sections you didn't cover the first time.

## Already-found ${typeLabel}s (DO NOT return overlapping time ranges)
${existingList}

## Content Duration
${durationMinutes.toFixed(1)} minutes of content.

## Your task
Return AT LEAST ${targetMore} NEW ${typeLabel} candidates (${typeRange}) that are NOT in the list above. Priorities:
- Hunt in sections of the transcript the existing candidates skip over
- Surface different angles / alternate quotes from the same discussions (slightly different start/end)
- Include lower-scoring backup options — the user will filter
- Every candidate must still open and close a loop (same philosophy as the first pass)

Time range rule: new candidates must NOT overlap more than 20% with any existing time range. Treat the "Already-found" list as OFF-LIMITS for duplicates.

## Virality Scoring (0–100)
Be HONEST. Use the full range — include scores from 25 to 95. Lower scores are fine; the user is specifically asking to see more options.

## Transcript
${transcriptText}

Return ONLY ${typeLabel} candidates (type="${wantedType}"), as structured JSON.`;

  const result = await generateText({
    model: google("gemini-3-flash-preview"),
    experimental_output: Output.object({ schema: candidateSchema }),
    prompt,
  });

  return (result.experimental_output.candidates as AnalysisCandidate[]).filter(
    (c) => c.type === wantedType
  );
}
