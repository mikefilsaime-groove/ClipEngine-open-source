import { getProject } from "@/actions/project-actions";
import { getProjectSettings } from "@/actions/settings-actions";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [project, settings] = await Promise.all([
    getProject(id),
    getProjectSettings(id),
  ]);

  return <SettingsClient projectId={id} settings={settings} speakers={project.speakers} />;
}
