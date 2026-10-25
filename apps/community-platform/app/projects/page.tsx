import Link from "next/link";
import { getCatalog } from "@/lib/catalog";
import { PageIntro, DemoNote, ProjectCard, EmptyState } from "@/components/ui";
export const metadata = { title: "Open projects" };
export default async function Projects({
  searchParams,
}: {
  searchParams: Promise<{ program?: string; status?: string }>;
}) {
  const [catalog, params] = await Promise.all([getCatalog(), searchParams]);
  const projects = catalog.projects.filter(
    (p) =>
      (!params.program || p.program_id === params.program) &&
      (!params.status || p.status === params.status),
  );
  return (
    <div className="page-content">
      <PageIntro
        eyebrow="PUBLIC ENGINEERING"
        title="Built together. Open to everyone."
      >
        Projects begin with a human problem and stay accountable to the people
        they aim to serve. Explore the evidence, work, and stewardship behind
        each one.
      </PageIntro>
      {catalog.demo && <DemoNote />}
      <form className="filters" action="/projects">
        <div className="field">
          <label htmlFor="program">Program</label>
          <select
            id="program"
            name="program"
            defaultValue={params.program || ""}
          >
            <option value="">All programs</option>
            {catalog.programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="status">Project stage</label>
          <select id="status" name="status" defaultValue={params.status || ""}>
            <option value="">All stages</option>
            {[
              "PROPOSAL",
              "RESEARCH",
              "DESIGN",
              "BUILDING",
              "VERIFICATION",
              "PILOT",
              "MEASUREMENT",
              "DEPLOYED",
              "MAINTENANCE",
              "ARCHIVED",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="filter-actions">
          <button className="button primary">Apply filters</button>
          <Link className="button" href="/projects">
            Reset
          </Link>
        </div>
      </form>
      <div className="page-toolbar">
        <p>
          {projects.length} {catalog.demo ? "example " : ""}projects
        </p>
        <Link className="text-link" href="/propose">
          Propose a problem ↗
        </Link>
      </div>
      <div className="project-grid">
        {projects.map((p) => (
          <ProjectCard key={p.id} project={p} catalog={catalog} />
        ))}
      </div>
      {!projects.length && (
        <EmptyState title="No published projects match">
          Explore another program or bring a problem to the research process.
        </EmptyState>
      )}
    </div>
  );
}
