import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ProjectStatusBadge } from "./project-status-badge";
import type { Project } from "@/generated/prisma/client";

interface ProjectCardProps {
  project: Project & { _count: { candidates: number } };
}

export function ProjectCard({ project }: ProjectCardProps) {
  const duration = project.duration
    ? `${Math.floor(project.duration / 60)}m ${Math.round(project.duration % 60)}s`
    : "—";

  return (
    <Link href={`/project/${project.id}`}>
      <Card className="hover:border-primary/50 transition-colors cursor-pointer">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold">{project.name}</CardTitle>
          <ProjectStatusBadge status={project.status} />
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>Duration: {duration}</span>
            <span>Candidates: {project._count.candidates}</span>
          </div>
          <CardDescription className="mt-2 text-xs truncate">
            {project.sourceVideoPath}
          </CardDescription>
        </CardContent>
      </Card>
    </Link>
  );
}
