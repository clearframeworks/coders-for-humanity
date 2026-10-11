import Link from "next/link";
import { PageIntro } from "@/components/ui";
import { TaskEditor } from "@/components/task-editor";
import { communityReady, getViewer } from "@/lib/community";
import { createClient } from "@/lib/supabase";
import { getCatalog } from "@/lib/catalog";

export const metadata = { title: "Develop a task" };

export default async function NewTask() {
  const viewer = await getViewer();
  const intro = <PageIntro eyebrow="PROJECT MAINTENANCE" title="Turn a need into useful work.">Give the next contributor a goal, the context, and a way to know they succeeded.</PageIntro>;
  if (!communityReady() || !viewer) return <div className="page-content">{intro}<div className="notice">{communityReady() ? <Link href="/login?next=/work/new">Sign in to develop a task.</Link> : "Shared task publishing opens when member accounts are connected."}</div></div>;
  const db = await createClient();
  const [catalog, memberships] = await Promise.all([getCatalog(), db.from("project_maintainers").select("project_id").eq("user_id", viewer.id)]);
  if (memberships.error) throw new Error("Your project permissions could not be loaded.");
  const ids = new Set(memberships.data.map((item) => item.project_id));
  const projects = catalog.projects.filter((item) => ids.has(item.id) && !item.is_demo && item.status !== "ARCHIVED").map(({ id, name }) => ({ id, name }));
  if (!projects.length) return <div className="page-content">{intro}<div className="notice">Project maintainers publish tasks. You can <Link href="/discussions/new">start a project conversation</Link> to propose work and develop its scope with a maintainer.</div></div>;
  const { data, error } = await db.from("project_maintainers").select("project_id,user_id,profiles!project_maintainers_user_id_fkey(name,is_public)").in("project_id", projects.map((item) => item.id));
  if (error) throw new Error("Project reviewers could not be loaded.");
  const rows = data as unknown as { project_id: string; user_id: string; profiles: { name: string; is_public: boolean } | null }[];
  const reviewers = rows.filter((item) => item.profiles?.is_public).map((item) => ({ project_id: item.project_id, user_id: item.user_id, name: item.profiles!.name }));
  return <div className="page-content">{intro}<TaskEditor projects={projects} reviewers={reviewers} tasks={catalog.tasks.filter((item) => !item.is_demo && ids.has(item.project_id)).map(({ id, project_id, title }) => ({ id, project_id, title }))} /></div>;
}
