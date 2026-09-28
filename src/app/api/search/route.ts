import { NextRequest, NextResponse } from "next/server";
import { searchTranscript } from "@/lib/search";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");
  const q = url.searchParams.get("q");
  const startTimeRaw = url.searchParams.get("startTime");
  const endTimeRaw = url.searchParams.get("endTime");

  if (!projectId || !q) {
    return NextResponse.json(
      { error: "Missing required params: projectId, q" },
      { status: 400 },
    );
  }

  const options: { startTime?: number; endTime?: number } = {};
  if (startTimeRaw) options.startTime = parseFloat(startTimeRaw);
  if (endTimeRaw) options.endTime = parseFloat(endTimeRaw);

  try {
    const results = await searchTranscript(projectId, q, options);
    return NextResponse.json({ results, count: results.length });
  } catch (error) {
    console.error("[search] error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
