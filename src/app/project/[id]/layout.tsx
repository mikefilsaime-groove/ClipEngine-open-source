import { getProject } from "@/actions/project-actions";
import { ProjectNav } from "@/components/layout/project-nav";

interface ProjectLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function ProjectLayout({ children, params }: ProjectLayoutProps) {
  const { id } = await params;
  const project = await getProject(id);

  return (
    <div className="min-h-screen flex flex-col">
      <ProjectNav projectId={id} projectName={project.name} />
      <div className="container mx-auto px-4 py-6 flex-1">{children}</div>
    </div>
  );
}
