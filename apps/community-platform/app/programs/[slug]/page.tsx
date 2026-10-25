import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalog } from "@/lib/catalog";
import { PageIntro, ProjectCard, DemoNote, EmptyState } from "@/components/ui";
export default async function Program({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [c, { slug }] = await Promise.all([getCatalog(), params]);
  const program = c.programs.find((p) => p.slug === slug);
  if (!program) notFound();
  const projects = c.projects.filter((p) => p.program_id === program.id);
  return (
    <div className="page-content">
      <PageIntro eyebrow="PROGRAM" title={program.name}>
        {program.description} Work in this program must begin with evidence and
        participation from the communities affected.
      </PageIntro>
      {c.demo && <DemoNote />}
      <div className="page-toolbar">
        <p>
          {projects.length} {c.demo ? "example " : ""}projects
        </p>
        <Link
          href={`/contribute?program=${program.id}`}
          className="button primary"
        >
          Find work in this program ↗
        </Link>
      </div>
      <div className="project-grid">
        {projects.map((p) => (
          <ProjectCard project={p} catalog={c} key={p.id} />
        ))}
      </div>
      {!projects.length && (
        <EmptyState title="A place for future work">
          No projects have been accepted in this program.{" "}
          <Link href="/propose">Start with a problem proposal.</Link>
        </EmptyState>
      )}
    </div>
  );
}
