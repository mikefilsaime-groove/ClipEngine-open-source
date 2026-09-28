import { Badge } from "@/components/ui/badge";
import { Clock, Loader2, CheckCircle2, XCircle } from "lucide-react";
import type { Candidate } from "@/generated/prisma/client";

interface RenderItemProps {
  candidate: Candidate;
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "approved":
    case "queued":
      return <Clock className="h-4 w-4 text-muted-foreground" />;
    case "rendering":
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    case "rendered":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
}

export function RenderItem({ candidate }: RenderItemProps) {
  return (
    <div className="flex items-center gap-3 py-3 border-b last:border-0">
      <StatusIcon status={candidate.status} />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{candidate.title}</p>
        {candidate.outputPath && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {candidate.outputPath}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Badge variant="outline" className="text-xs capitalize">
          {candidate.type}
        </Badge>
        <Badge variant="secondary" className="text-xs">
          {candidate.viralityScore}
        </Badge>
      </div>
    </div>
  );
}
