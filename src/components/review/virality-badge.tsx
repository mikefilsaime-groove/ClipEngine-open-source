import { cn } from "@/lib/utils";

interface ViralityBadgeProps {
  score: number;
}

export function ViralityBadge({ score }: ViralityBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        score >= 75
          ? "bg-green-100 text-green-800"
          : score >= 50
          ? "bg-yellow-100 text-yellow-800"
          : "bg-red-100 text-red-800",
      )}
    >
      {score}
    </span>
  );
}
