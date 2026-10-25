import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalog } from "@/lib/catalog";
import { projectRecords } from "@/lib/records";
import { PageIntro, Badge, DemoNote } from "@/components/ui";
import { TaskRow } from "@/components/work-board";
import { ProjectRoom } from "@/components/project-room";
const sections = [
  "Overview",
  "Evidence",
  "Objective",
  "Impact",
  "Architecture",
  "Roadmap",
  "Repositories",
  "Contributors",
  "Maintainers",
  "Open work",
  "Deployments",
  "Documentation",
  "Decisions",
  "Funding",
  "License",
];
export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [c, { slug }] = await Promise.all([getCatalog(), params]);
  const p = c.projects.find((p) => p.slug === slug);
  if (!p) notFound();
  if (p.slug === "community-platform")
    return (
      <ProjectRoom project={p} catalog={c} tab={(await searchParams).tab} />
    );
  const records = await projectRecords(p.id);
  const work = c.tasks.filter((t) => t.project_id === p.id);
  return (
    <div className="page-content">
      <PageIntro
        eyebrow={
          c.programs.find((x) => x.id === p.program_id)?.name.toUpperCase() ||
          "PROJECT"
        }
        title={p.name}
      >
        {p.summary}
      </PageIntro>
      {p.is_demo && <DemoNote />}
      <p>
        <a className="button" href={`/projects/${p.slug}/brief`} download>
          Download project brief (.md)
        </a>
      </p>
      <dl className="metadata-grid">
        <div>
          <dt>Current stage</dt>
          <dd>
            <Badge status={p.status} />
          </dd>
        </div>
        <div>
          <dt>Software license</dt>
          <dd>{p.license}</dd>
        </div>
        <div>
          <dt>Open work</dt>
          <dd>
            <Link href="#open-work">
              {work.filter((t) => t.status === "OPEN").length} contribution
              tasks ↗
            </Link>
          </dd>
        </div>
      </dl>
      <div className="article-layout">
        <nav className="toc" aria-label="Project sections">
          {sections.map((s) => (
            <a href={"#" + s.toLowerCase().replaceAll(" ", "-")} key={s}>
              {s}
            </a>
          ))}
        </nav>
        <div className="prose">
          <section id="overview">
            <h2>The problem</h2>
            <p>{p.problem}</p>
          </section>
          <section id="evidence">
            <h2>Evidence & constraints</h2>
            <p>{p.evidence}</p>
            {records.sources.map((s) => (
              <p key={s.id}>
                <a href={s.url} rel="noreferrer">
                  {s.title} ↗
                </a>
              </p>
            ))}
          </section>
          <section id="objective">
            <h2>What we are trying to do</h2>
            <p>{p.objective}</p>
          </section>
          <section id="impact">
            <h2>Measured impact</h2>
            {records.metrics.length ? (
              records.metrics.map((m) => (
                <p key={m.id}>
                  {m.name}: {m.value} {m.unit}.{" "}
                  <a href={m.source_url}>Source</a> · {m.measured_at}
                </p>
              ))
            ) : (
              <p>
                No verified outcomes have been published. Activity and
                contributions are not a substitute for evidence of benefit.
              </p>
            )}
          </section>
          <section id="architecture">
            <h2>Technical architecture</h2>
            <p>{p.architecture}</p>
          </section>
          <section id="roadmap">
            <h2>Roadmap</h2>
            {records.milestones.length ? (
              records.milestones.map((m) => (
                <p key={m.id}>
                  {m.title} · {m.status}
                </p>
              ))
            ) : (
              <p>
                No approved milestones yet. Establish evidence, agree
                requirements, complete verification, and secure pilot consent
                before deployment.
              </p>
            )}
            <Link href="/docs/lifecycle">
              Read the nine-stage project lifecycle
            </Link>
          </section>
          <section id="repositories">
            <h2>Source repositories</h2>
            {records.repositories.length ? (
              records.repositories.map((r) => (
                <p key={r.id}>
                  <a href={r.url} rel="noreferrer">
                    {r.name} ↗
                  </a>
                </p>
              ))
            ) : (
              <p>
                No repository is linked. Source and code review will live on
                GitHub, with issue and pull-request links here.
              </p>
            )}
          </section>
          <section id="contributors">
            <h2>Contributors</h2>
            {records.members.length ? (
              records.members.map((m) => (
                <p key={m.id}>
                  <Link href={`/people/${m.profiles.username}`}>
                    {m.profiles.name}
                  </Link>{" "}
                  · {m.role}
                </p>
              ))
            ) : (
              <p>No contributors are recorded for this project.</p>
            )}
          </section>
          <section id="maintainers">
            <h2>Stewardship</h2>
            <p>
              {records.maintainers.length
                ? records.maintainers.map((m) => m.profiles.name).join(", ")
                : "No maintainers have been appointed. Acceptance requires named stewardship, review capacity, and a succession plan."}
            </p>
          </section>
          <section id="open-work">
            <h2>Open work</h2>
            {work.map((t) => (
              <TaskRow key={t.id} task={t} catalog={c} />
            ))}
            {!work.length && <p>No contribution tasks have been published.</p>}
          </section>
          <section id="deployments">
            <h2>Deployments</h2>
            {records.deployments.length ? (
              records.deployments.map((d) => (
                <p key={d.id}>
                  <a href={d.url}>{d.name} ↗</a> · {d.status}
                </p>
              ))
            ) : (
              <p>No operational deployments are recorded.</p>
            )}
          </section>
          <section id="documentation">
            <h2>Documentation</h2>
            <p>
              The institutional guides define our requirements for
              accessibility, security, review, and maintainership.
            </p>
            <Link href="/docs">Open the contributor handbook</Link>
          </section>
          <section id="decisions">
            <h2>Decision records</h2>
            {records.decisions.length ? (
              records.decisions.map((d) => (
                <p key={d.id}>
                  <Link href={`/decisions/${d.id}`}>{d.title}</Link>
                </p>
              ))
            ) : (
              <p>No project decisions have been published.</p>
            )}
          </section>
          <section id="funding">
            <h2>Funding</h2>
            <p>
              {records.funding.length
                ? `${records.funding.length} public funding records are available in the institutional ledger.`
                : "No funding or expenses are recorded for this project."}
            </p>
            <Link href="/transparency">View the public ledger</Link>
          </section>
          <section id="license">
            <h2>Open by default</h2>
            <p>
              Software license: {p.license}. Data, research, hardware, and
              documentation need an appropriate artifact-specific open license.
              Contributions do not confer ownership of the institution.
            </p>
            <Link href="/docs/licensing">Licensing guidance</Link>
          </section>
        </div>
      </div>
    </div>
  );
}
