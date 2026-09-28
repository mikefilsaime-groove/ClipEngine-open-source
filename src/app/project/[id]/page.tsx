import { getProject } from "@/actions/project-actions";
import { ProjectStatusBadge } from "@/components/project/project-status-badge";
import { ProcessingPipeline } from "./processing-pipeline";
import { Card, CardContent } from "@/components/ui/card";
import { VideoPathSetup } from "./video-path-setup";

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);

  // If no video path, show the setup prompt
  if (!project.sourceVideoPath) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">New project — select a video to get started</p>
          </div>
          <ProjectStatusBadge status={project.status} />
        </div>
        <VideoPathSetup projectId={id} projectName={project.name} />
      </div>
    );
  }

  const duration = project.duration
    ? `${Math.floor(project.duration / 60)}m ${Math.round(project.duration % 60)}s`
    : "Not probed yet";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{project.sourceVideoPath}</p>
        </div>
        <ProjectStatusBadge status={project.status} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Duration</div>
            <div className="text-lg font-semibold">{duration}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Candidates</div>
            <div className="text-lg font-semibold">{project._count.candidates}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Speakers</div>
            <div className="text-lg font-semibold">{project.speakers.length || "—"}</div>
          </CardContent>
        </Card>
      </div>

      <ProcessingPipeline project={project} />
    </div>
  );
}
