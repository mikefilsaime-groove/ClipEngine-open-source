import type { TranscriptWord } from "@/types";

export interface AudioEdit {
  type: "bleep" | "cut";
  startTime: number;
  endTime: number;
  reason: string;
}

/**
 * Strip non-alphabetic characters from a word for matching purposes.
 */
function stripNonAlpha(word: string): string {
  return word.replace(/[^a-zA-Z]/g, "");
}

/**
 * Find profanity words in the transcript and return bleep edits.
 *
 * Matching is case-insensitive; non-alpha characters are stripped before comparison.
 *
 * @param words - Transcript words with timing
 * @param profanityList - List of profanity words/phrases to match against
 * @returns Array of AudioEdit objects with type "bleep"
 */
export function findProfanity(words: TranscriptWord[], profanityList: string[]): AudioEdit[] {
  const edits: AudioEdit[] = [];

  // Build a lower-case set of single-word profanities (multi-word profanity is
  // not expected for bleeping, but handled gracefully by only matching single words)
  const profanitySet = new Set(
    profanityList
      .filter((p) => !p.includes(" "))
      .map((p) => stripNonAlpha(p).toLowerCase())
  );

  for (const w of words) {
    const cleaned = stripNonAlpha(w.word).toLowerCase();
    if (cleaned && profanitySet.has(cleaned)) {
      edits.push({
        type: "bleep",
        startTime: w.startTime,
        endTime: w.endTime,
        reason: `Profanity: "${w.word}"`,
      });
    }
  }

  return edits;
}

/**
 * Find filler words/phrases in the transcript and return cut edits.
 *
 * Supports multi-word fillers (e.g., "you know", "I mean") by checking
 * consecutive words.
 *
 * @param words - Transcript words with timing
 * @param fillerList - List of filler words/phrases to match against
 * @returns Array of AudioEdit objects with type "cut"
 */
export function findFillerWords(words: TranscriptWord[], fillerList: string[]): AudioEdit[] {
  const edits: AudioEdit[] = [];

  // Sort fillers by length descending so longer phrases are matched first
  const sortedFillers = [...fillerList].sort((a, b) => {
    const aLen = a.split(" ").length;
    const bLen = b.split(" ").length;
    return bLen - aLen;
  });

  const used = new Set<number>(); // word indices already consumed by a match

  for (const filler of sortedFillers) {
    const fillerParts = filler
      .toLowerCase()
      .split(" ")
      .map((p) => stripNonAlpha(p))
      .filter(Boolean);

    const phraseLen = fillerParts.length;

    for (let i = 0; i <= words.length - phraseLen; i++) {
      if (used.has(i)) continue;

      // Check if consecutive words starting at i match this filler phrase
      let match = true;
      for (let j = 0; j < phraseLen; j++) {
        if (used.has(i + j)) {
          match = false;
          break;
        }
        const cleaned = stripNonAlpha(words[i + j].word).toLowerCase();
        if (cleaned !== fillerParts[j]) {
          match = false;
          break;
        }
      }

      if (match) {
        const startWord = words[i];
        const endWord = words[i + phraseLen - 1];

        edits.push({
          type: "cut",
          startTime: startWord.startTime,
          endTime: endWord.endTime,
          reason: `Filler: "${filler}"`,
        });

        // Mark all matched word indices as used
        for (let j = 0; j < phraseLen; j++) {
          used.add(i + j);
        }
      }
    }
  }

  // Sort by start time for consistent ordering
  edits.sort((a, b) => a.startTime - b.startTime);

  return edits;
}

/**
 * Find dead air (long silences) between words and return cut edits.
 *
 * Gaps larger than `threshold` seconds between consecutive words are flagged.
 * The cut is padded by 0.2 seconds on each side (start is moved back 0.2s,
 * end is moved forward 0.2s) to avoid clipping.
 *
 * @param words - Transcript words with timing
 * @param threshold - Minimum gap duration in seconds to flag as dead air
 * @returns Array of AudioEdit objects with type "cut"
 */
export function findDeadAir(words: TranscriptWord[], threshold: number): AudioEdit[] {
  const edits: AudioEdit[] = [];
  const PADDING = 0.2;

  for (let i = 0; i < words.length - 1; i++) {
    const gapStart = words[i].endTime;
    const gapEnd = words[i + 1].startTime;
    const gap = gapEnd - gapStart;

    if (gap > threshold) {
      const cutStart = gapStart + PADDING;
      const cutEnd = gapEnd - PADDING;

      // Only add the cut if there is still a meaningful gap after padding
      if (cutEnd > cutStart) {
        edits.push({
          type: "cut",
          startTime: cutStart,
          endTime: cutEnd,
          reason: `Dead air: ${gap.toFixed(2)}s gap between "${words[i].word}" and "${words[i + 1].word}"`,
        });
      }
    }
  }

  return edits;
}
