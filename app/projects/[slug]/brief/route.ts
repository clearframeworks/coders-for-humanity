import { getCatalog } from "@/lib/catalog";
import { projectBrief } from "@/lib/project-brief";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const catalog = await getCatalog();
  const project = catalog.projects.find((item) => item.slug === slug);
  if (
    !project ||
    (project as typeof project & { published?: boolean }).published === false
  )
    return new Response("Project not found.", { status: 404 });
  const filename = `${project.slug.replace(/[^a-z0-9-]/gi, "-").slice(0, 100) || "project"}-brief.md`;
  return new Response(projectBrief(project, catalog, new Date()), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
