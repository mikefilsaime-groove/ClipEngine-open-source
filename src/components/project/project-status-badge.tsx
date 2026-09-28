import { Badge } from "@/components/ui/badge";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  importing: { label: "Importing", variant: "outline" },
  transcribing: { label: "Transcribing", variant: "secondary" },
  diarizing: { label: "Detecting Speakers", variant: "secondary" },
  analyzing: { label: "Analyzing", variant: "secondary" },
  ready: { label: "Ready", variant: "default" },
  rendering: { label: "Rendering", variant: "secondary" },
};

export function ProjectStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
