import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requestCancel } from "@/lib/render-worker";

interface RouteContext {
  params: Promise<{ jobId: string }>;
}

export async function POST(_req: NextRequest, context: RouteContext) {
  const { jobId } = await context.params;

  const job = await db.renderJob.findUnique({ where: { id: jobId } });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  await db.renderJob.update({
    where: { id: jobId },
    data: { cancelRequested: true },
  });
  requestCancel(jobId);

  return NextResponse.json({ ok: true });
}
