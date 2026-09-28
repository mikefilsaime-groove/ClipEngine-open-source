import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const job = await db.renderJob.findFirst({
    where: {
      projectId,
      status: { in: ["queued", "running"] },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ jobId: job?.id ?? null });
}
