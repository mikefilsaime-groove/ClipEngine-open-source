import { db } from "@/lib/db";

export interface SearchResult {
  segmentId: string;
  word: string;
  startTime: number;
  endTime: number;
  speaker: string;
  contextBefore: Array<{ word: string; startTime: number; endTime: number; speaker: string }>;
  contextAfter: Array<{ word: string; startTime: number; endTime: number; speaker: string }>;
}

interface SearchOptions {
  startTime?: number;
  endTime?: number;
  contextWords?: number;
}

export async function searchTranscript(
  projectId: string,
  query: string,
  options: SearchOptions = {},
): Promise<SearchResult[]> {
  const { startTime, endTime, contextWords = 5 } = options;

  if (!query || query.trim().length < 2) return [];

  // Get the transcript for this project
  const transcript = await db.transcript.findUnique({
    where: { projectId },
    select: { id: true },
  });

  if (!transcript) return [];

  // Fetch all segments in time range, ordered by startTime
  const where: Record<string, unknown> = { transcriptId: transcript.id };
  if (startTime !== undefined || endTime !== undefined) {
    where.startTime = {};
    if (startTime !== undefined) (where.startTime as Record<string, number>).gte = startTime;
    if (endTime !== undefined) (where.startTime as Record<string, number>).lte = endTime;
  }

  const allSegments = await db.transcriptSegment.findMany({
    where,
    orderBy: { startTime: "asc" },
  });

  const normalizedQuery = query.trim().toLowerCase();
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  // Strip trailing/leading punctuation for robust matching ("hello," == "hello")
  const normalizeWord = (w: string) => w.toLowerCase().replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, "");

  const toContext = (s: typeof allSegments[number]) => ({
    word: s.word,
    startTime: s.startTime,
    endTime: s.endTime,
    speaker: s.speaker,
  });

  const results: SearchResult[] = [];

  if (tokens.length === 1) {
    // Single-token: substring match against each word (preserves prefix/suffix hits)
    const needle = tokens[0];
    for (let i = 0; i < allSegments.length; i++) {
      const seg = allSegments[i];
      if (normalizeWord(seg.word).includes(needle)) {
        results.push({
          segmentId: seg.id,
          word: seg.word,
          startTime: seg.startTime,
          endTime: seg.endTime,
          speaker: seg.speaker,
          contextBefore: allSegments.slice(Math.max(0, i - contextWords), i).map(toContext),
          contextAfter: allSegments.slice(i + 1, i + 1 + contextWords).map(toContext),
        });
      }
    }
    return results;
  }

  // Multi-token: slide a window of `tokens.length` consecutive segments.
  // First and last tokens use substring match (so "mast" matches "master"),
  // inner tokens require exact word equality after punctuation stripping.
  const lastIdx = tokens.length - 1;
  for (let i = 0; i <= allSegments.length - tokens.length; i++) {
    let matched = true;
    for (let j = 0; j < tokens.length; j++) {
      const segWord = normalizeWord(allSegments[i + j].word);
      const token = tokens[j];
      const ok = j === 0 || j === lastIdx ? segWord.includes(token) : segWord === token;
      if (!ok) {
        matched = false;
        break;
      }
    }
    if (!matched) continue;

    const firstSeg = allSegments[i];
    const lastSeg = allSegments[i + lastIdx];
    const matchedWords = allSegments.slice(i, i + tokens.length).map((s) => s.word).join(" ");

    results.push({
      segmentId: firstSeg.id,
      word: matchedWords,
      startTime: firstSeg.startTime,
      endTime: lastSeg.endTime,
      speaker: firstSeg.speaker,
      contextBefore: allSegments.slice(Math.max(0, i - contextWords), i).map(toContext),
      contextAfter: allSegments
        .slice(i + tokens.length, i + tokens.length + contextWords)
        .map(toContext),
    });
  }

  return results;
}
